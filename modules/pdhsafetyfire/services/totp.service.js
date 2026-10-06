// TOTP 2FA Engine (Google Authenticator Compatible)
import { randomBytes, createHmac, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(length = 20) {
  const buf = randomBytes(length);
  let secret = '';
  for (let i = 0; i < buf.length; i++) {
    secret += BASE32_CHARS[buf[i] % 32];
  }
  return secret;
}

function base32ToBuffer(base32) {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < clean.length; i++) {
    value = (value << 5) | BASE32_CHARS.indexOf(clean[i]);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpCode(secret, timeStep = 30) {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
  return code;
}

export function verifyTotpCode(secret, userCode, window = 1) {
  if (!userCode || userCode.length !== 6) return false;
  const nowCounter = Math.floor(Date.now() / 1000 / 30);
  const key = base32ToBuffer(secret);

  for (let i = -window; i <= window; i++) {
    const counter = nowCounter + i;
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter));

    const hmac = createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');

    if (code === userCode.trim()) return true;
  }
  return false;
}

export function generateOtpAuthUri(email, secret, issuer = 'PdhSafetyFire') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

// Encrypt secret at rest using AES-256-GCM
export function encryptSecret(secret, masterKey = process.env.TOTP_ENCRYPTION_KEY || 'default_totp_key_32_bytes_long!') {
  const key = scryptSync(masterKey, 'salt_pdh_2fa', 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptSecret(encryptedPayload, masterKey = process.env.TOTP_ENCRYPTION_KEY || 'default_totp_key_32_bytes_long!') {
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const key = scryptSync(masterKey, 'salt_pdh_2fa', 32);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function generateRecoveryCodes(count = 8) {
  const plainCodes = [];
  const hashedCodes = [];

  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase(); // 8 character hex
    plainCodes.push(code);
    const hash = scryptSync(code, 'pdh_rec_salt', 32).toString('hex');
    hashedCodes.push(hash);
  }

  return { plainCodes, hashedCodes };
}

export function verifyRecoveryCode(plainCode, storedHash) {
  const candidate = scryptSync(plainCode.trim().toUpperCase(), 'pdh_rec_salt', 32).toString('hex');
  return candidate === storedHash;
}
