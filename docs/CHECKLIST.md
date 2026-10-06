# Inspection Checklist Architecture & Standard Specifications

## Standard Definition
- **Standard Name:** มาตรฐานความปลอดภัยอัคคีภัยโรงพยาบาลปลวกแดง 2026
- **Reference:** NFPA 10 / กฎหมายความปลอดภัยในการทำงาน 2569
- **Template Title:** Fire Extinguisher Monthly Routine Inspection
- **Default Active Version:** 1.0

## Checklist Item Categories

### Category A: ตำแหน่งและการเข้าถึง (Location & Access)
1. **[CRITICAL]** ถังดับเพลิงอยู่ในตำแหน่งที่กำหนดและมองเห็นได้ชัดเจน
2. **[CRITICAL]** ไม่มีสิ่งของกีดขวาง เข้าถึงและหยิบใช้งานได้สะดวก
3. ป้ายระบุตำแหน่งและชนิดถังดับเพลิงติดตั้งชัดเจน

### Category B: สภาพภายนอก (External Body & Labels)
4. **[CRITICAL]** ตัวถังอยู่ในสภาพสมบูรณ์ ไม่มีรอยบุบ แตกร้าว หรือสนิมรุนแรง
5. ฉลาก วิธีใช้งาน และคำเตือน อ่านได้อย่างชัดเจน

### Category C: Safety Components
6. **[CRITICAL]** สลักนิรภัย (Safety Pin) และซีล (Tamper Seal) อยู่ครบถ้วน
7. **[CRITICAL]** สายฉีด (Hose) และหัวฉีด (Nozzle) อยู่ในสภาพดี ไม่แตกรั่ว หรือกรอบ
8. คันกดและมือจับ (Handle & Trigger) อยู่ในสภาพสมบูรณ์

### Category D: Pressure Status
9. **[CRITICAL]** เข็มวัดแรงดัน (Pressure Gauge) อยู่ในแถบสีเขียวปกติ (ถ้ามี / N/A สำหรับ CO2)

### Category E: Maintenance Dates
10. **[CRITICAL]** วันหมดอายุและกำหนด Refill / Hydrostatic Test ไม่เกินกำหนด

### Category F: Safety Point & Environment
11. ป้าย QR Code อ่านได้ชัดเจน และรหัสตรงกับจุดติดตั้ง
12. **[CRITICAL]** ไม่มีการเคลื่อนย้ายถังออกนอกจุดโดยไม่ได้แจ้ง
13. **[CRITICAL]** ไม่มีร่องรอยการทดลองฉีดหรือใช้งานโดยไม่ได้บันทึก

## Version Locking Rules
1. Template versions are **locked** automatically upon the first completed inspection using that version (`is_locked = 1`).
2. Locked versions cannot be modified in-place to prevent corrupting historical audit data.
3. Editing a locked checklist creates a new cloned version (e.g. `1.1`).
