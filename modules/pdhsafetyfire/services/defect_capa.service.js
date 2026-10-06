// Defect & Corrective Action (CAPA) Workflow Engine
import { executeQuery, executeTransaction } from '../../../packages/database/mysql_adapter.js';
import { calculateRisk, calculateSlaDeadlines } from './risk_sla.service.js';
import { randomUUID } from 'node:crypto';

export async function createDefectReport({
  tenantId,
  safetyPointId,
  safetyAssetId,
  reportedByType = 'PUBLIC',
  reportedByUserId = null,
  reporterName = 'Anonymous',
  reporterPhone = '',
  reporterEmail = '',
  issueType,
  description,
  photoUrl = null,
  severity = 2,
  likelihood = 2,
  reportedLat = null,
  reportedLon = null
}) {
  const risk = calculateRisk(severity, likelihood);
  const defectId = randomUUID();

  await executeQuery(
    `INSERT INTO defect_reports
     (id, tenant_id, safety_point_id, safety_asset_id, reported_by_type, reported_by_user_id, reporter_name, reporter_phone, reporter_email, issue_type, description, photo_url, severity, likelihood, risk_score, risk_level, status, reported_latitude, reported_longitude)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REPORTED', ?, ?)`,
    [
      defectId, tenantId, safetyPointId, safetyAssetId || null,
      reportedByType, reportedByUserId, reporterName, reporterPhone, reporterEmail,
      issueType, description, photoUrl, risk.severity, risk.likelihood, risk.score, risk.level,
      reportedLat, reportedLon
    ]
  );

  // Auto-generate CAPA record for the defect
  const capaId = randomUUID();
  const slaDeadlines = calculateSlaDeadlines(risk.level);

  await executeQuery(
    `INSERT INTO corrective_actions
     (id, tenant_id, defect_id, problem, risk_level, acknowledge_due_at, corrective_due_at, verification_due_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      capaId, tenantId, defectId, description, risk.level,
      slaDeadlines.acknowledge_due_at, slaDeadlines.corrective_due_at, slaDeadlines.verification_due_at
    ]
  );

  return { defectId, capaId, riskLevel: risk.level };
}

export async function updateDefectStatus({ tenantId, defectId, newStatus, actorUserId, reason = '' }) {
  const allowedTransitions = {
    REPORTED: ['ACKNOWLEDGED', 'REJECTED'],
    ACKNOWLEDGED: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
    ASSIGNED: ['IN_PROGRESS', 'CORRECTED'],
    IN_PROGRESS: ['CORRECTED'],
    CORRECTED: ['VERIFIED'],
    VERIFIED: ['CLOSED'],
    CLOSED: ['REOPENED'],
    REJECTED: ['REPORTED']
  };

  const rows = await executeQuery('SELECT * FROM defect_reports WHERE id = ? AND tenant_id = ?', [defectId, tenantId]);
  if (!rows || rows.length === 0) throw new Error('Defect report not found');
  const defect = rows[0];

  const currentStatus = defect.status;
  if (!allowedTransitions[currentStatus]?.includes(newStatus)) {
    throw new Error(`Cannot transition defect status from ${currentStatus} to ${newStatus}`);
  }

  // Prevent closing defect if CAPA is not verified
  if (newStatus === 'CLOSED') {
    const capas = await executeQuery('SELECT * FROM corrective_actions WHERE defect_id = ?', [defectId]);
    if (capas.length > 0) {
      const capa = capas[0];
      if (capa.status !== 'VERIFIED' && capa.status !== 'CLOSED') {
        throw new Error('Cannot close Defect until associated Corrective Action (CAPA) is Verified');
      }
    }
  }

  await executeQuery(
    'UPDATE defect_reports SET status = ?, rejection_reason = ? WHERE id = ? AND tenant_id = ?',
    [newStatus, newStatus === 'REJECTED' ? reason : defect.rejection_reason, defectId, tenantId]
  );

  return { defectId, oldStatus: currentStatus, newStatus };
}

export async function updateCapaWorkflow({
  tenantId,
  capaId,
  ownerUserId,
  rootCause,
  immediateCorrection,
  correctiveAction,
  preventiveAction,
  status,
  afterPhotoUrl,
  verifiedBy
}) {
  const capas = await executeQuery('SELECT * FROM corrective_actions WHERE id = ? AND tenant_id = ?', [capaId, tenantId]);
  if (!capas || capas.length === 0) throw new Error('CAPA record not found');
  const capa = capas[0];

  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

  let completedAt = capa.completed_at;
  let verifiedAt = capa.verified_at;
  let verificationResult = capa.verification_result;

  if (status === 'COMPLETED' && !completedAt) {
    completedAt = nowStr;
  }

  if (status === 'VERIFIED') {
    verifiedAt = nowStr;
    verificationResult = 'PASSED_VERIFICATION';

    // Update parent defect to VERIFIED
    await executeQuery(
      'UPDATE defect_reports SET status = "VERIFIED" WHERE id = ? AND tenant_id = ?',
      [capa.defect_id, tenantId]
    );
  }

  await executeQuery(
    `UPDATE corrective_actions
     SET owner_user_id = COALESCE(?, owner_user_id),
         root_cause = COALESCE(?, root_cause),
         immediate_correction = COALESCE(?, immediate_correction),
         corrective_action = COALESCE(?, corrective_action),
         preventive_action = COALESCE(?, preventive_action),
         status = COALESCE(?, status),
         after_photo_url = COALESCE(?, after_photo_url),
         completed_at = ?,
         verified_by = COALESCE(?, verified_by),
         verified_at = ?,
         verification_result = ?
     WHERE id = ? AND tenant_id = ?`,
    [
      ownerUserId, rootCause, immediateCorrection, correctiveAction, preventiveAction,
      status, afterPhotoUrl, completedAt, verifiedBy, verifiedAt, verificationResult,
      capaId, tenantId
    ]
  );

  return { capaId, status };
}
