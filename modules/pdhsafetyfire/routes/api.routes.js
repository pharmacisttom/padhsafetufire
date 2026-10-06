// PdhSafetyFire API Routes Controller
import { executeQuery, executeTransaction } from '../../../packages/database/mysql_adapter.js';
import { can } from '../../../packages/rbac/index.js';
import { generateSecureToken, generateQrSvg, renderPrintableStickerHtml } from '../services/qr.service.js';
import { verifyLocation } from '../services/haversine_gps.service.js';
import { generateBase32Secret, generateOtpAuthUri, verifyTotpCode, encryptSecret, decryptSecret, generateRecoveryCodes, verifyRecoveryCode } from '../services/totp.service.js';
import { calculateRisk } from '../services/risk_sla.service.js';
import { processInspectionSubmission } from '../services/inspection.service.js';
import { createDefectReport, updateDefectStatus, updateCapaWorkflow } from '../services/defect_capa.service.js';
import { saveUploadedFile } from '../services/storage.service.js';
import { randomUUID } from 'node:crypto';

export async function handlePdhSafetyFireRoutes(req, res, url, user, body, reply, fail, audit) {
  const method = req.method;
  const path = url.pathname;
  const tenantId = user?.tenant_id || 'demo';

  const requirePerm = (p) => {
    if (!user || user.disabled) fail(401, 'Please sign in');
    if (!can(user.role, p)) fail(403, `Permission denied: ${p}`);
  };

  // ==========================================
  // 1. PUBLIC UNAUTHENTICATED QR PORTAL
  // ==========================================
  const qMatch = path.match(/^\/api\/pdhsafetyfire\/q\/([a-zA-Z0-9_-]+)$/);
  if (qMatch && method === 'GET') {
    const token = qMatch[1];
    const points = await executeQuery(
      `SELECT p.id, p.point_code, p.point_name, p.location_description, p.latitude, p.longitude, p.geofence_radius_m, p.status as point_status,
              b.building_name, f.floor_name, z.zone_name, d.dept_name
       FROM safety_points p
       LEFT JOIN buildings b ON b.id = p.building_id
       LEFT JOIN floors f ON f.id = p.floor_id
       LEFT JOIN zones z ON z.id = p.zone_id
       LEFT JOIN departments d ON d.id = p.department_id
       WHERE p.qr_token = ? AND p.status = 'ACTIVE'`,
      [token]
    );

    if (!points || points.length === 0) return reply(404, 'Safety point not found or invalid QR token', 'NOT_FOUND');
    const point = points[0];

    // Fetch assets at this point (Public Safe Info)
    const assets = await executeQuery(
      `SELECT a.id, a.asset_code, a.asset_name, a.status, a.last_inspection_date, a.next_inspection_date,
              t.type_name_th, t.type_name_en, fed.subtype, fed.capacity, fed.capacity_unit
       FROM safety_assets a
       JOIN asset_types t ON t.id = a.asset_type_id
       LEFT JOIN fire_extinguisher_details fed ON fed.asset_id = a.id
       WHERE a.safety_point_id = ?`,
      [point.id]
    );

    return reply(200, {
      point: {
        id: point.id,
        point_code: point.point_code,
        point_name: point.point_name,
        location: `${point.building_name} ${point.floor_name} (${point.zone_name})`,
        dept_name: point.dept_name,
        location_description: point.location_description,
        point_status: point.point_status
      },
      assets: assets.map(a => ({
        asset_code: a.asset_code,
        asset_name: a.asset_name,
        type: a.type_name_th,
        subtype: a.subtype || null,
        capacity: a.capacity ? `${a.capacity} ${a.capacity_unit}` : null,
        status: a.status,
        last_inspection: a.last_inspection_date
      }))
    });
  }

  // Public Report Submission
  const qReportMatch = path.match(/^\/api\/pdhsafetyfire\/q\/([a-zA-Z0-9_-]+)\/report$/);
  if (qReportMatch && method === 'POST') {
    const token = qReportMatch[1];
    const points = await executeQuery('SELECT * FROM safety_points WHERE qr_token = ?', [token]);
    if (!points || points.length === 0) return reply(404, 'Invalid point token', 'NOT_FOUND');
    const point = points[0];

    if (!body.issue_type || !body.description) fail(422, 'Issue type and description required');

    const result = await createDefectReport({
      tenantId: point.tenant_id,
      safetyPointId: point.id,
      safetyAssetId: body.safety_asset_id || null,
      reportedByType: 'PUBLIC',
      reporterName: body.reporter_name || 'Anonymous Public',
      reporterPhone: body.reporter_phone || '',
      reporterEmail: body.reporter_email || '',
      issueType: body.issue_type,
      description: body.description,
      photoUrl: body.photo_url || null,
      severity: body.severity || 2,
      likelihood: body.likelihood || 2,
      reportedLat: body.reported_latitude || null,
      reportedLon: body.reported_longitude || null
    });

    await audit('defect.public_report', 'defect_reports', result.defectId, null, { issue_type: body.issue_type, point_code: point.point_code }, { id: 'public', tenant_id: point.tenant_id });
    return reply(201, { success: true, defect_id: result.defectId, message: 'Report submitted successfully' });
  }

  // ==========================================
  // 2. AUTHENTICATION & 2FA ENGINE
  // ==========================================
  if (path === '/api/pdhsafetyfire/auth/2fa/setup' && method === 'POST') {
    requirePerm('safety.point.read');
    const secret = generateBase32Secret();
    const uri = generateOtpAuthUri(user.email, secret);
    const encryptedSecret = encryptSecret(secret);

    await executeQuery(
      `INSERT INTO two_factor_auth (id, user_id, secret_encrypted, is_enabled)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE secret_encrypted=VALUES(secret_encrypted), is_enabled=0`,
      [randomUUID(), user.id, encryptedSecret]
    );

    return reply(200, { secret, otpauth_url: uri, qr_svg: generateQrSvg(uri, 180) });
  }

  if (path === '/api/pdhsafetyfire/auth/2fa/enroll' && method === 'POST') {
    requirePerm('safety.point.read');
    const { otp_code } = body;
    if (!otp_code) fail(422, '6-digit OTP code required');

    const rows = await executeQuery('SELECT * FROM two_factor_auth WHERE user_id = ?', [user.id]);
    if (!rows || rows.length === 0) fail(404, '2FA setup not initialized');

    const record = rows[0];
    const plainSecret = decryptSecret(record.secret_encrypted);

    if (!verifyTotpCode(plainSecret, otp_code)) {
      fail(400, 'Invalid 6-digit OTP code');
    }

    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);

    await executeTransaction(async (tx) => {
      await tx.query('UPDATE two_factor_auth SET is_enabled = 1, enrolled_at = NOW() WHERE user_id = ?', [user.id]);
      await tx.query('DELETE FROM recovery_codes WHERE user_id = ?', [user.id]);
      for (const h of hashedCodes) {
        await tx.query('INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)', [randomUUID(), user.id, h]);
      }
    });

    await audit('2fa.enabled', 'user', user.id, null, { enabled: true });
    return reply(200, { message: '2FA TOTP successfully enrolled', recovery_codes: plainCodes });
  }

  // ==========================================
  // 3. LOCATIONS HIERARCHY
  // ==========================================
  if (path === '/api/pdhsafetyfire/locations' && method === 'GET') {
    requirePerm('safety.point.read');
    const sites = await executeQuery('SELECT * FROM sites WHERE tenant_id = ?', [tenantId]);
    const buildings = await executeQuery('SELECT * FROM buildings WHERE tenant_id = ?', [tenantId]);
    const floors = await executeQuery('SELECT * FROM floors WHERE tenant_id = ?', [tenantId]);
    const zones = await executeQuery('SELECT * FROM zones WHERE tenant_id = ?', [tenantId]);
    const departments = await executeQuery('SELECT * FROM departments WHERE tenant_id = ?', [tenantId]);

    return reply(200, { sites, buildings, floors, zones, departments });
  }

  if (path === '/api/pdhsafetyfire/locations/building' && method === 'POST') {
    requirePerm('safety.point.manage');
    if (!body.building_name || !body.code) fail(422, 'Building name and code required');

    const bldId = randomUUID();
    const sites = await executeQuery('SELECT id FROM sites WHERE tenant_id = ? LIMIT 1', [tenantId]);
    const siteId = sites[0]?.id || 'site-pdh-main';

    await executeQuery(
      'INSERT INTO buildings (id, tenant_id, site_id, code, building_name, description) VALUES (?, ?, ?, ?, ?, ?)',
      [bldId, tenantId, siteId, body.code, body.building_name, body.description || '']
    );

    await audit('building.created', 'buildings', bldId, null, { name: body.building_name });
    return reply(201, { id: bldId });
  }

  // ==========================================
  // 4. SAFETY POINTS & GPS ENGINE
  // ==========================================
  if (path === '/api/pdhsafetyfire/points' && method === 'GET') {
    requirePerm('safety.point.read');
    const points = await executeQuery(
      `SELECT p.*, b.building_name, f.floor_name, z.zone_name, d.dept_name,
              COUNT(a.id) as asset_count
       FROM safety_points p
       LEFT JOIN buildings b ON b.id = p.building_id
       LEFT JOIN floors f ON f.id = p.floor_id
       LEFT JOIN zones z ON z.id = p.zone_id
       LEFT JOIN departments d ON d.id = p.department_id
       LEFT JOIN safety_assets a ON a.safety_point_id = p.id
       WHERE p.tenant_id = ?
       GROUP BY p.id
       ORDER BY p.point_code ASC`,
      [tenantId]
    );

    return reply(200, points);
  }

  if (path === '/api/pdhsafetyfire/points' && method === 'POST') {
    requirePerm('safety.point.manage');
    if (!body.point_code || !body.point_name || body.latitude === undefined || body.longitude === undefined) {
      fail(422, 'Point code, point name, latitude and longitude required');
    }

    const lat = Number(body.latitude);
    const lon = Number(body.longitude);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      fail(422, 'Invalid GPS coordinates');
    }

    const pointId = randomUUID();
    const qrToken = generateSecureToken();
    const siteId = body.site_id || 'site-pdh-main';

    await executeQuery(
      `INSERT INTO safety_points
       (id, tenant_id, site_id, building_id, floor_id, zone_id, department_id, point_code, point_name, location_description, latitude, longitude, geofence_radius_m, qr_token, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        pointId, tenantId, siteId, body.building_id, body.floor_id, body.zone_id,
        body.department_id || null, body.point_code, body.point_name,
        body.location_description || '', lat, lon, body.geofence_radius_m || 30, qrToken
      ]
    );

    await audit('safety_point.created', 'safety_points', pointId, null, { point_code: body.point_code });
    return reply(201, { id: pointId, qr_token: qrToken });
  }

  const qrRegenMatch = path.match(/^\/api\/pdhsafetyfire\/points\/([a-zA-Z0-9_-]+)\/qr\/regenerate$/);
  if (qrRegenMatch && method === 'POST') {
    requirePerm('safety.point.manage');
    const ptId = qrRegenMatch[1];
    const newToken = generateSecureToken();

    await executeQuery('UPDATE safety_points SET qr_token = ? WHERE id = ? AND tenant_id = ?', [newToken, ptId, tenantId]);
    await audit('qr_token.regenerated', 'safety_points', ptId, null, { token_changed: true });
    return reply(200, { qr_token: newToken });
  }

  // Printable Sticker Label
  const stickerMatch = path.match(/^\/api\/pdhsafetyfire\/points\/([a-zA-Z0-9_-]+)\/sticker$/);
  if (stickerMatch && method === 'GET') {
    requirePerm('safety.point.read');
    const ptId = stickerMatch[1];
    const points = await executeQuery('SELECT * FROM safety_points WHERE id = ? AND tenant_id = ?', [ptId, tenantId]);
    if (!points || points.length === 0) fail(404, 'Point not found');

    const html = renderPrintableStickerHtml(points[0], process.env.APP_URL || 'http://localhost:3000');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  // ==========================================
  // 5. ASSET REGISTER & FIRE EXTINGUISHERS
  // ==========================================
  if (path === '/api/pdhsafetyfire/assets' && method === 'GET') {
    requirePerm('safety.asset.read');
    const assets = await executeQuery(
      `SELECT a.*, p.point_code, p.point_name, b.building_name, f.floor_name,
              t.type_name_th, t.type_name_en, fed.subtype, fed.capacity, fed.capacity_unit, fed.next_refill_date, fed.next_hydrostatic_test
       FROM safety_assets a
       JOIN safety_points p ON p.id = a.safety_point_id
       JOIN buildings b ON b.id = p.building_id
       JOIN floors f ON f.id = p.floor_id
       JOIN asset_types t ON t.id = a.asset_type_id
       LEFT JOIN fire_extinguisher_details fed ON fed.asset_id = a.id
       WHERE a.tenant_id = ?
       ORDER BY a.asset_code ASC`,
      [tenantId]
    );

    return reply(200, assets);
  }

  if (path === '/api/pdhsafetyfire/assets' && method === 'POST') {
    requirePerm('safety.asset.create');
    if (!body.safety_point_id || !body.asset_code || !body.asset_name) {
      fail(422, 'Safety point, asset code, and asset name required');
    }

    const assetId = randomUUID();
    const assetTypeId = body.asset_type_id || 'at-fe';

    await executeTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO safety_assets 
         (id, tenant_id, safety_point_id, asset_type_id, asset_code, asset_name, serial_number, manufacturer, model, status, purchase_date, manufacture_date, install_date, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NORMAL', ?, ?, ?, ?)`,
        [
          assetId, tenantId, body.safety_point_id, assetTypeId, body.asset_code, body.asset_name,
          body.serial_number || '', body.manufacturer || '', body.model || '',
          body.purchase_date || null, body.manufacture_date || null, body.install_date || null, body.expiry_date || null
        ]
      );

      if (assetTypeId === 'at-fe') {
        await tx.query(
          `INSERT INTO fire_extinguisher_details 
           (id, tenant_id, asset_id, subtype, capacity, capacity_unit, fire_rating, agent_type, pressure_type, last_refill_date, next_refill_date, last_service_date, next_service_date, supplier)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            randomUUID(), tenantId, assetId, body.subtype || 'DRY_CHEMICAL_ABC',
            body.capacity || 15.0, body.capacity_unit || 'Kg', body.fire_rating || '4A:60B:C',
            body.agent_type || 'Monoammonium Phosphate', body.pressure_type || 'STORED_PRESSURE',
            body.last_refill_date || null, body.next_refill_date || null,
            body.last_service_date || null, body.next_service_date || null,
            body.supplier || ''
          ]
        );
      }
    });

    await audit('safety_asset.created', 'safety_assets', assetId, null, { asset_code: body.asset_code });
    return reply(201, { id: assetId });
  }

  // ==========================================
  // 6. INSPECTION CHECKLIST & EXECUTION
  // ==========================================
  if (path === '/api/pdhsafetyfire/templates' && method === 'GET') {
    requirePerm('safety.inspection.read');
    const templates = await executeQuery(
      `SELECT t.*, v.id as active_version_id, v.version_number, v.standard_name, v.is_locked
       FROM inspection_templates t
       JOIN inspection_template_versions v ON v.template_id = t.id AND v.is_active = 1
       WHERE t.tenant_id = ?`,
      [tenantId]
    );

    for (const t of templates) {
      t.items = await executeQuery(
        'SELECT * FROM inspection_items WHERE version_id = ? ORDER BY item_order ASC',
        [t.active_version_id]
      );
    }

    return reply(200, templates);
  }

  if (path === '/api/pdhsafetyfire/inspections' && method === 'GET') {
    requirePerm('safety.inspection.read');
    const inspections = await executeQuery(
      `SELECT i.*, p.point_code, p.point_name, a.asset_code, a.asset_name, u.name as inspector_name
       FROM inspections i
       JOIN safety_points p ON p.id = i.safety_point_id
       JOIN safety_assets a ON a.id = i.safety_asset_id
       LEFT JOIN users u ON u.id = i.inspected_by
       WHERE i.tenant_id = ?
       ORDER BY i.inspected_at DESC LIMIT 100`,
      [tenantId]
    );

    return reply(200, inspections);
  }

  if (path === '/api/pdhsafetyfire/inspections' && method === 'POST') {
    requirePerm('safety.inspection.perform');
    if (!body.safety_point_id || !body.safety_asset_id || !body.template_version_id || !Array.isArray(body.answers)) {
      fail(422, 'Safety point, safety asset, template version, and answers array required');
    }

    const result = await processInspectionSubmission({
      tenantId,
      safetyPointId: body.safety_point_id,
      safetyAssetId: body.safety_asset_id,
      templateVersionId: body.template_version_id,
      inspectedBy: user.id,
      checkinLat: body.checkin_latitude,
      checkinLon: body.checkin_longitude,
      checkinAccuracy: body.checkin_accuracy_m,
      locationOverrideReason: body.location_override_reason,
      answers: body.answers,
      notes: body.notes
    });

    await audit('inspection.completed', 'inspections', result.inspectionId, null, { result: result.overallStatus, fails: result.failCount });
    return reply(201, result);
  }

  // ==========================================
  // 7. DEFECTS & CAPA WORKFLOW
  // ==========================================
  if (path === '/api/pdhsafetyfire/defects' && method === 'GET') {
    requirePerm('safety.defect.read');
    const defects = await executeQuery(
      `SELECT d.*, p.point_code, p.point_name, b.building_name, f.floor_name,
              c.id as capa_id, c.status as capa_status, c.due_date as capa_due_date, c.owner_user_id
       FROM defect_reports d
       JOIN safety_points p ON p.id = d.safety_point_id
       JOIN buildings b ON b.id = p.building_id
       JOIN floors f ON f.id = p.floor_id
       LEFT JOIN corrective_actions c ON c.defect_id = d.id
       WHERE d.tenant_id = ?
       ORDER BY d.created_at DESC`,
      [tenantId]
    );

    return reply(200, defects);
  }

  const defStatusMatch = path.match(/^\/api\/pdhsafetyfire\/defects\/([a-zA-Z0-9_-]+)\/status$/);
  if (defStatusMatch && method === 'PATCH') {
    requirePerm('safety.defect.manage');
    if (!body.status) fail(422, 'Status required');

    const result = await updateDefectStatus({
      tenantId,
      defectId: defStatusMatch[1],
      newStatus: body.status,
      actorUserId: user.id,
      reason: body.reason || ''
    });

    await audit('defect.status_updated', 'defect_reports', defStatusMatch[1], { old: result.oldStatus }, { new: result.newStatus });
    return reply(200, result);
  }

  if (path === '/api/pdhsafetyfire/capa' && method === 'GET') {
    requirePerm('safety.capa.read');
    const capas = await executeQuery(
      `SELECT c.*, d.issue_type, d.description as defect_description, d.status as defect_status,
              p.point_code, p.point_name, u.name as owner_name
       FROM corrective_actions c
       JOIN defect_reports d ON d.id = c.defect_id
       JOIN safety_points p ON p.id = d.safety_point_id
       LEFT JOIN users u ON u.id = c.owner_user_id
       WHERE c.tenant_id = ?
       ORDER BY c.created_at DESC`,
      [tenantId]
    );

    return reply(200, capas);
  }

  const capaUpdateMatch = path.match(/^\/api\/pdhsafetyfire\/capa\/([a-zA-Z0-9_-]+)$/);
  if (capaUpdateMatch && method === 'PATCH') {
    requirePerm('safety.capa.update');
    const result = await updateCapaWorkflow({
      tenantId,
      capaId: capaUpdateMatch[1],
      ownerUserId: body.owner_user_id,
      rootCause: body.root_cause,
      immediateCorrection: body.immediate_correction,
      correctiveAction: body.corrective_action,
      preventiveAction: body.preventive_action,
      status: body.status,
      afterPhotoUrl: body.after_photo_url,
      verifiedBy: body.status === 'VERIFIED' ? user.id : null
    });

    await audit('capa.updated', 'corrective_actions', capaUpdateMatch[1], null, { status: result.status });
    return reply(200, result);
  }

  // ==========================================
  // 8. SAFETY MAP & EXECUTIVE DASHBOARD
  // ==========================================
  if (path === '/api/pdhsafetyfire/map' && method === 'GET') {
    requirePerm('safety.point.read');
    const points = await executeQuery(
      `SELECT p.id, p.point_code, p.point_name, p.latitude, p.longitude, p.geofence_radius_m, p.status as point_status,
              b.building_name, f.floor_name, z.zone_name,
              COUNT(d.id) as open_defects,
              MAX(d.risk_level) as max_risk_level,
              a.asset_code, a.status as asset_status, a.last_inspection_date
       FROM safety_points p
       JOIN buildings b ON b.id = p.building_id
       JOIN floors f ON f.id = p.floor_id
       JOIN zones z ON z.id = p.zone_id
       LEFT JOIN safety_assets a ON a.safety_point_id = p.id
       LEFT JOIN defect_reports d ON d.safety_point_id = p.id AND d.status NOT IN ('CLOSED', 'REJECTED')
       WHERE p.tenant_id = ?
       GROUP BY p.id`,
      [tenantId]
    );

    const geoJsonFeatures = points.map(pt => {
      let markerColor = 'GREEN';
      if (pt.open_defects > 0) {
        markerColor = pt.max_risk_level === 'CRITICAL' ? 'RED' : 'ORANGE';
      } else if (pt.asset_status === 'DUE_SOON' || pt.asset_status === 'INSPECTION_DUE') {
        markerColor = 'YELLOW';
      } else if (pt.point_status === 'INACTIVE') {
        markerColor = 'GRAY';
      }

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(pt.longitude), Number(pt.latitude)]
        },
        properties: {
          id: pt.id,
          point_code: pt.point_code,
          point_name: pt.point_name,
          location: `${pt.building_name} ${pt.floor_name} (${pt.zone_name})`,
          markerColor,
          asset_code: pt.asset_code,
          asset_status: pt.asset_status,
          open_defects: pt.open_defects,
          last_inspection: pt.last_inspection_date
        }
      };
    });

    return reply(200, { type: 'FeatureCollection', features: geoJsonFeatures });
  }

  if (path === '/api/pdhsafetyfire/dashboard' && method === 'GET') {
    requirePerm('safety.point.read');
    const totalPoints = (await executeQuery('SELECT COUNT(*) as n FROM safety_points WHERE tenant_id = ?', [tenantId]))[0].n;
    const totalAssets = (await executeQuery('SELECT COUNT(*) as n FROM safety_assets WHERE tenant_id = ?', [tenantId]))[0].n;
    const normalAssets = (await executeQuery('SELECT COUNT(*) as n FROM safety_assets WHERE tenant_id = ? AND status = "NORMAL"', [tenantId]))[0].n;
    const defectiveAssets = (await executeQuery('SELECT COUNT(*) as n FROM safety_assets WHERE tenant_id = ? AND status = "DEFECTIVE"', [tenantId]))[0].n;
    const dueSoonAssets = (await executeQuery('SELECT COUNT(*) as n FROM safety_assets WHERE tenant_id = ? AND status IN ("DUE_SOON", "INSPECTION_DUE")', [tenantId]))[0].n;

    const openDefects = (await executeQuery('SELECT COUNT(*) as n FROM defect_reports WHERE tenant_id = ? AND status NOT IN ("CLOSED", "REJECTED")', [tenantId]))[0].n;
    const criticalDefects = (await executeQuery('SELECT COUNT(*) as n FROM defect_reports WHERE tenant_id = ? AND risk_level = "CRITICAL" AND status NOT IN ("CLOSED", "REJECTED")', [tenantId]))[0].n;
    const openCapas = (await executeQuery('SELECT COUNT(*) as n FROM corrective_actions WHERE tenant_id = ? AND status NOT IN ("CLOSED", "VERIFIED")', [tenantId]))[0].n;

    const totalInspections = (await executeQuery('SELECT COUNT(*) as n FROM inspections WHERE tenant_id = ?', [tenantId]))[0].n;
    const passInspections = (await executeQuery('SELECT COUNT(*) as n FROM inspections WHERE tenant_id = ? AND status = "PASS"', [tenantId]))[0].n;

    const complianceRate = totalInspections > 0 ? Math.round((passInspections / totalInspections) * 100) : 100;

    return reply(200, {
      totalPoints,
      totalAssets,
      normalAssets,
      defectiveAssets,
      dueSoonAssets,
      openDefects,
      criticalDefects,
      openCapas,
      totalInspections,
      complianceRate
    });
  }

  // ==========================================
  // 9. AUDIT LOGS & REPORTS EXPORT
  // ==========================================
  if (path === '/api/pdhsafetyfire/audit' && method === 'GET') {
    requirePerm('safety.audit.view');
    const logs = await executeQuery(
      `SELECT a.*, u.name as actor_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.actor_user_id
       WHERE a.tenant_id = ?
       ORDER BY a.id DESC LIMIT 100`,
      [tenantId]
    );

    return reply(200, logs);
  }

  if (path === '/api/pdhsafetyfire/reports/export' && method === 'GET') {
    requirePerm('safety.report.export');
    const format = url.searchParams.get('format') || 'csv';
    const type = url.searchParams.get('type') || 'assets';

    let rows = [];
    if (type === 'assets') {
      rows = await executeQuery('SELECT asset_code, asset_name, status, last_inspection_date FROM safety_assets WHERE tenant_id = ?', [tenantId]);
    } else if (type === 'defects') {
      rows = await executeQuery('SELECT id, issue_type, description, risk_level, status FROM defect_reports WHERE tenant_id = ?', [tenantId]);
    }

    if (format === 'csv') {
      if (rows.length === 0) return reply(200, 'No data');
      const headers = Object.keys(rows[0]).join(',');
      const csvLines = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      const csvContent = '\uFEFF' + [headers, ...csvLines].join('\n'); // UTF-8 BOM for Excel Thai language

      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="PdhSafetyFire_${type}_report.csv"`
      });
      return res.end(csvContent);
    }

    return reply(200, rows);
  }

  // ==========================================
  // 10. FILE UPLOAD ENDPOINT
  // ==========================================
  if (path === '/api/pdhsafetyfire/upload' && method === 'POST') {
    requirePerm('safety.inspection.perform');
    if (!body.file_base64 || !body.mime_type) fail(422, 'Base64 file content and mime type required');

    const fileBuf = Buffer.from(body.file_base64, 'base64');
    const saved = saveUploadedFile(fileBuf, body.filename || 'upload.jpg', body.mime_type, user.id);

    return reply(201, saved);
  }

  return reply(404, 'API endpoint not found', 'NOT_FOUND');
}
