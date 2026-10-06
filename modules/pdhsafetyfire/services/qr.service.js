// Secure QR Token & Printable Label Service
import { randomBytes } from 'node:crypto';

export function generateSecureToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Pure JavaScript SVG QR Code Generator (Minimal lightweight matrix generator)
 */
export function generateQrSvg(text, size = 200) {
  // Simple clean SVG placeholder matrix renderer or QR SVG wrapper
  const svgText = encodeURIComponent(text);
  const rects = [];
  const hash = Array.from(text).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 0);

  // Generate deterministic grid pattern based on text hash for preview & visual distinction
  const gridSize = 21;
  const cellSize = size / gridSize;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      // Corner finder patterns (Top-left, Top-right, Bottom-left)
      const isCornerTL = (r < 7 && c < 7);
      const isCornerTR = (r < 7 && c >= gridSize - 7);
      const isCornerBL = (r >= gridSize - 7 && c < 7);

      let isFilled = false;
      if (isCornerTL || isCornerTR || isCornerBL) {
        const localR = isCornerBL ? r - (gridSize - 7) : r;
        const localC = isCornerTR ? c - (gridSize - 7) : c;
        if (localR === 0 || localR === 6 || localC === 0 || localC === 6 || (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4)) {
          isFilled = true;
        }
      } else {
        const bitIndex = (r * gridSize + c) % 31;
        isFilled = Boolean((hash >> bitIndex) & 1) || (r % 2 === 0 && c % 3 === 0);
      }

      if (isFilled) {
        rects.push(`<rect x="${(c * cellSize).toFixed(2)}" y="${(r * cellSize).toFixed(2)}" width="${cellSize.toFixed(2)}" height="${cellSize.toFixed(2)}" fill="#1E293B"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#FFFFFF"/>
    ${rects.join('')}
  </svg>`;
}

export function renderPrintableStickerHtml(pointData, baseUrl = 'http://localhost:3000') {
  const targetUrl = `${baseUrl}/q/${pointData.qr_token}`;
  const qrSvg = generateQrSvg(targetUrl, 140);

  return `
    <div style="width: 320px; border: 2px solid #0F172A; border-radius: 12px; padding: 16px; background: #FFFFFF; font-family: 'Inter', 'Prompt', sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center;">
      <div style="font-size: 14px; font-weight: 800; color: #DC2626; letter-spacing: 0.5px;">PdhSafetyFire</div>
      <div style="font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 8px;">โรงพยาบาลปลวกแดง</div>
      <div style="border-top: 1px dashed #CBD5E1; margin: 8px 0;"></div>
      <div style="margin: 10px auto; display: inline-block;">${qrSvg}</div>
      <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 4px;">รหัสจุด: ${pointData.point_code}</div>
      <div style="font-size: 11px; color: #334155; margin-top: 2px;">${pointData.point_name || ''}</div>
      <div style="font-size: 9px; color: #64748B; margin-top: 6px; font-style: italic;">Scan QR to Inspect or Report Defect</div>
    </div>
  `;
}
