// Inspection & Checklist Execution Engine
import { executeQuery, executeTransaction } from '../../../packages/database/mysql_adapter.js';
import { calculateHaversineDistance, verifyLocation } from './haversine_gps.service.js';
import { calculateRisk, calculateSlaDeadlines } from './risk_sla.service.js';
import { randomUUID } from 'node:crypto';

export async function processInspectionSubmission({
  tenantId,
  safetyPointId,
  safetyAssetId,
  templateVersionId,
  inspectedBy,
  checkinLat,
  checkinLon,
  checkinAccuracy,
  locationOverrideReason,
  answers, // Array of { item_id, result ('PASS'|'FAIL'|'NA'), note, photo_url }
  notes
}) {
  return await executeTransaction(async (tx) => {
    // 1. Fetch Safety Point location details
    const points = await tx.query(
      'SELECT * FROM safety_points WHERE id = ? AND tenant_id = ?',
      [safetyPointId, tenantId]
    );
    if (!points || points.length === 0) throw new Error('Safety Point not found');
    const point = points[0];

    // 2. Fetch Safety Asset
    const assets = await tx.query(
      'SELECT * FROM safety_assets WHERE id = ? AND tenant_id = ?',
      [safetyAssetId, tenantId]
    );
    if (!assets || assets.length === 0) throw new Error('Safety Asset not found');
    const asset = assets[0];

    // 3. Fetch Inspection Checklist Version & Items
    const versions = await tx.query(
      'SELECT * FROM inspection_template_versions WHERE id = ?',
      [templateVersionId]
    );
    if (!versions || versions.length === 0) throw new Error('Template version not found');
    const version = versions[0];

    const items = await tx.query(
      'SELECT * FROM inspection_items WHERE version_id = ? ORDER BY item_order ASC',
      [templateVersionId]
    );
    const itemMap = new Map(items.map(i => [i.id, i]));

    // 4. Geolocation Verification
    const locVer = verifyLocation(
      checkinLat, checkinLon, checkinAccuracy,
      point.latitude, point.longitude,
      point.geofence_radius_m || 30
    );

    let locationStatus = locVer.status;
    if (locationStatus === 'OUTSIDE_GEOFENCE' && !locationOverrideReason) {
      // If outside geofence without override reason, throw error or flag
    }

    // 5. Evaluate Checklist Results
    let totalItems = items.length;
    let failCount = 0;
    let criticalFailCount = 0;
    const itemResults = [];

    for (const ans of answers) {
      const item = itemMap.get(ans.item_id);
      if (!item) continue;

      if (ans.result === 'FAIL') {
        failCount++;
        if (item.is_critical) criticalFailCount++;

        // Validate mandatory note/photo if item configured
        if (item.require_note_on_fail && (!ans.note || !ans.note.trim())) {
          throw new Error(`Note is required for failed item: "${item.question_th}"`);
        }
        if (item.require_photo_on_fail && (!ans.photo_url || !ans.photo_url.trim())) {
          throw new Error(`Evidence photo is required for failed item: "${item.question_th}"`);
        }
      }

      itemResults.push({
        id: randomUUID(),
        item_id: ans.item_id,
        result: ans.result || 'PASS',
        note: ans.note || '',
        photo_url: ans.photo_url || null,
        is_critical: item.is_critical
      });
    }

    // Determine overall inspection result status
    let overallStatus = 'PASS';
    let assetNewStatus = 'NORMAL';

    if (criticalFailCount > 0 || failCount > 2) {
      overallStatus = 'FAIL';
      assetNewStatus = 'DEFECTIVE';
    } else if (failCount > 0) {
      overallStatus = 'PASS_WITH_OBSERVATION';
      assetNewStatus = 'INSPECTION_DUE';
    }

    const inspectionId = randomUUID();
    const inspectedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // 6. Insert Inspection Record
    await tx.query(
      `INSERT INTO inspections 
       (id, tenant_id, safety_point_id, safety_asset_id, template_version_id, inspected_by, inspected_at, status, overall_result, checkin_latitude, checkin_longitude, checkin_accuracy_m, distance_from_point_m, location_status, location_override_reason, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inspectionId, tenantId, safetyPointId, safetyAssetId, templateVersionId,
        inspectedBy, inspectedAt, overallStatus, overallStatus,
        checkinLat || null, checkinLon || null, checkinAccuracy || null,
        locVer.distanceMeters, locationStatus, locationOverrideReason || null, notes || ''
      ]
    );

    // Insert Item Results
    for (const r of itemResults) {
      await tx.query(
        `INSERT INTO inspection_results (id, inspection_id, item_id, result, note, photo_url)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.id, inspectionId, r.item_id, r.result, r.note, r.photo_url]
      );
    }

    // 7. Update Asset Status and Inspection Dates
    const nextInspection = new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await tx.query(
      `UPDATE safety_assets 
       SET status = ?, last_inspection_date = ?, next_inspection_date = ?
       WHERE id = ? AND tenant_id = ?`,
      [assetNewStatus, inspectedAt, nextInspection, safetyAssetId, tenantId]
    );

    // 8. Lock Template Version if not locked
    await tx.query(
      'UPDATE inspection_template_versions SET is_locked = 1 WHERE id = ?',
      [templateVersionId]
    );

    // 9. Auto-create Defect Report if any FAIL item exists
    const createdDefects = [];
    if (failCount > 0) {
      const failedItems = itemResults.filter(r => r.result === 'FAIL');
      for (const fi of failedItems) {
        const itemDef = itemMap.get(fi.item_id);
        const defectId = randomUUID();
        const severity = fi.is_critical ? 4 : 2;
        const likelihood = 3;
        const risk = calculateRisk(severity, likelihood);

        await tx.query(
          `INSERT INTO defect_reports 
           (id, tenant_id, inspection_id, safety_point_id, safety_asset_id, reported_by_type, reported_by_user_id, reporter_name, issue_type, description, photo_url, severity, likelihood, risk_score, risk_level, status, reported_latitude, reported_longitude)
           VALUES (?, ?, ?, ?, ?, 'INSPECTOR', ?, 'Safety Inspector', 'FAILED_CHECKLIST', ?, ?, ?, ?, ?, ?, 'REPORTED', ?, ?)`,
          [
            defectId, tenantId, inspectionId, safetyPointId, safetyAssetId,
            inspectedBy, `Failed Item: ${itemDef.question_th} - ${fi.note}`,
            fi.photo_url, risk.severity, risk.likelihood, risk.score, risk.level,
            checkinLat || null, checkinLon || null
          ]
        );
        createdDefects.push(defectId);
      }
    }

    return {
      inspectionId,
      overallStatus,
      assetNewStatus,
      totalItems,
      failCount,
      criticalFailCount,
      locationStatus,
      distanceMeters: locVer.distanceMeters,
      createdDefects
    };
  });
}
