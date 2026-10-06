// File Upload Storage Manager & Evidence Validator
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'storage/uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf']
};

export function validateFileHeader(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  // Magic bytes inspection
  const hex = buffer.toString('hex', 0, 4).toUpperCase();

  if (mimeType === 'image/jpeg') {
    return hex.startsWith('FFD8FF');
  } else if (mimeType === 'image/png') {
    return hex.startsWith('89504E47');
  } else if (mimeType === 'image/webp') {
    return buffer.toString('utf8', 8, 12) === 'WEBP';
  } else if (mimeType === 'application/pdf') {
    return hex.startsWith('25504446'); // %PDF
  }
  return false;
}

export function saveUploadedFile(fileBuffer, originalFilename, mimeType, uploadedBy = 'system') {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('Invalid file buffer');
  }

  if (fileBuffer.length > 10 * 1024 * 1024) {
    throw new Error('File exceeds maximum size limit of 10MB');
  }

  if (!ALLOWED_MIME_TYPES[mimeType]) {
    throw new Error(`Invalid file type ${mimeType}. Allowed: JPEG, PNG, WEBP, PDF`);
  }

  if (!validateFileHeader(fileBuffer, mimeType)) {
    throw new Error('File content signature does not match declared MIME type');
  }

  const ext = ALLOWED_MIME_TYPES[mimeType][0];
  const fileId = randomUUID();
  const safeFilename = `${fileId}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, safeFilename);

  fs.writeFileSync(targetPath, fileBuffer);

  const fileHash = createHash('sha256').update(fileBuffer).digest('hex');

  return {
    fileId,
    filePath: `/uploads/${safeFilename}`,
    absolutePath: targetPath,
    fileSize: fileBuffer.length,
    mimeType,
    fileHash,
    uploadedBy
  };
}
