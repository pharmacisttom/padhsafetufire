import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateHaversineDistance, verifyLocation } from '../modules/pdhsafetyfire/services/haversine_gps.service.js';
import { generateSecureToken } from '../modules/pdhsafetyfire/services/qr.service.js';
import { generateBase32Secret, generateTotpCode, verifyTotpCode, encryptSecret, decryptSecret, generateRecoveryCodes, verifyRecoveryCode } from '../modules/pdhsafetyfire/services/totp.service.js';
import { calculateRisk, calculateSlaDeadlines } from '../modules/pdhsafetyfire/services/risk_sla.service.js';
import { can, roles } from '../packages/rbac/index.js';

test('GPS Haversine distance calculation and geofence verification', () => {
  // Coords at Pluakdaeng Hospital
  const lat1 = 12.964400;
  const lon1 = 101.213500;
  // 15 meters away
  const lat2 = 12.964535;
  const lon2 = 101.213500;

  const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
  assert(distance > 10 && distance < 20, `Distance should be ~15m, got ${distance}`);

  const verResult = verifyLocation(lat2, lon2, 10, lat1, lon1, 30, 20);
  assert.equal(verResult.status, 'VERIFIED');
  assert.equal(verResult.isInside, true);

  // Far away point (100m away)
  const farLat = 12.965400;
  const farResult = verifyLocation(farLat, lon1, 10, lat1, lon1, 30, 20);
  assert.equal(farResult.status, 'OUTSIDE_GEOFENCE');
  assert.equal(farResult.isInside, false);
});

test('Secure random QR token generation and unpredictability', () => {
  const t1 = generateSecureToken();
  const t2 = generateSecureToken();
  assert.equal(t1.length, 64);
  assert.notEqual(t1, t2);
});

test('2FA TOTP secret encryption, code verification and recovery codes', () => {
  const secret = generateBase32Secret();
  assert.equal(secret.length, 20);

  const encrypted = encryptSecret(secret, 'test_master_key_32_bytes_long!!');
  assert.notEqual(encrypted, secret);

  const decrypted = decryptSecret(encrypted, 'test_master_key_32_bytes_long!!');
  assert.equal(decrypted, secret);

  const totpCode = generateTotpCode(secret);
  assert.equal(totpCode.length, 6);
  assert(verifyTotpCode(secret, totpCode));
  assert(!verifyTotpCode(secret, '000000'));

  const { plainCodes, hashedCodes } = generateRecoveryCodes(4);
  assert.equal(plainCodes.length, 4);
  assert(verifyRecoveryCode(plainCodes[0], hashedCodes[0]));
  assert(!verifyRecoveryCode('WRONGCODE', hashedCodes[0]));
});

test('Risk Matrix calculation and SLA resolution deadlines', () => {
  const riskLow = calculateRisk(1, 2);
  assert.equal(riskLow.score, 2);
  assert.equal(riskLow.level, 'LOW');

  const riskCrit = calculateRisk(5, 4);
  assert.equal(riskCrit.score, 20);
  assert.equal(riskCrit.level, 'CRITICAL');

  const sla = calculateSlaDeadlines('CRITICAL');
  assert(sla.acknowledge_due_at);
  assert(sla.corrective_due_at);
  assert(sla.verification_due_at);
});

test('Granular RBAC permission checks for safety roles', () => {
  assert(can('super_admin', 'safety.point.manage'));
  assert(can('safety_admin', 'safety.inspection.perform'));
  assert(can('inspector', 'safety.inspection.perform'));
  assert(!can('inspector', 'safety.point.manage'));
  assert(!can('viewer', 'safety.inspection.perform'));
  assert(can('viewer', 'safety.point.read'));
  assert(can('maintenance', 'safety.capa.update'));
  assert(!can('maintenance', 'safety.inspection.perform'));
});
