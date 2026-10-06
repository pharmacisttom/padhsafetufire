import { getMysqlPool } from '../packages/database/mysql_adapter.js';
import { hashPassword } from '../packages/security/index.js';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config();

export async function runSeed() {
  console.log('--- Seeding PdhSafetyFire Initial Data ---');
  const pool = await getMysqlPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const tenantId = 'demo';
    const orgId = 'org-pdh';
    const siteId = 'site-pdh-main';
    const bldId1 = 'bld-opd';
    const bldId2 = 'bld-ipd';
    const flrId1 = 'flr-opd-f01';
    const flrId2 = 'flr-ipd-f01';
    const zoneId1 = 'zone-opd-er';
    const zoneId2 = 'zone-ipd-hall';
    const deptId1 = 'dept-er';
    const deptId2 = 'dept-pharmacy';
    const deptId3 = 'dept-maint';

    // 1. Organization
    await conn.query(
      `INSERT INTO organizations (id, tenant_id, code, name, description) 
       VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [orgId, tenantId, 'PDH', 'โรงพยาบาลปลวกแดง', 'ระบบตรวจสอบและบริหารความปลอดภัยด้านอัคคีภัย โรงพยาบาลปลวกแดง']
    );

    // 2. Sites
    await conn.query(
      `INSERT INTO sites (id, tenant_id, organization_id, code, site_name, address)
       VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE site_name=VALUES(site_name)`,
      [siteId, tenantId, orgId, 'SITE-MAIN', 'โรงพยาบาลหลัก (ปลวกแดง)', 'อ.ปลวกแดง จ.ระยอง']
    );

    // 3. Buildings
    await conn.query(
      `INSERT INTO buildings (id, tenant_id, site_id, code, building_name, description) VALUES
       (?, ?, ?, 'B01', 'อาคารผู้ป่วยนอก (OPD)', 'อาคารตรวจรักษาผู้ป่วยนอก'),
       (?, ?, ?, 'B02', 'อาคารผู้ป่วยใน (IPD)', 'อาคารหอผู้ป่วยใน')
       ON DUPLICATE KEY UPDATE building_name=VALUES(building_name)`,
      [bldId1, tenantId, siteId, bldId2, tenantId, siteId]
    );

    // 4. Floors
    await conn.query(
      `INSERT INTO floors (id, tenant_id, building_id, code, floor_name, floor_level) VALUES
       (?, ?, ?, 'F01', 'ชั้น 1', 1),
       (?, ?, ?, 'F01', 'ชั้น 1', 1)
       ON DUPLICATE KEY UPDATE floor_name=VALUES(floor_name)`,
      [flrId1, tenantId, bldId1, flrId2, tenantId, bldId2]
    );

    // 5. Zones
    await conn.query(
      `INSERT INTO zones (id, tenant_id, floor_id, code, zone_name, risk_category) VALUES
       (?, ?, ?, 'Z-ER', 'โซนห้องฉุกเฉินและอุบัติเหตุ', 'HIGH'),
       (?, ?, ?, 'Z-IPD-HALL', 'โถงทางเดินหอผู้ป่วย', 'MODERATE')
       ON DUPLICATE KEY UPDATE zone_name=VALUES(zone_name)`,
      [zoneId1, tenantId, flrId1, zoneId2, tenantId, flrId2]
    );

    // 6. Departments
    await conn.query(
      `INSERT INTO departments (id, tenant_id, dept_code, dept_name) VALUES
       (?, ?, 'ER', 'งานอุบัติเหตุฉุกเฉิน'),
       (?, ?, 'PHARM', 'กลุ่มงานเภสัชกรรม'),
       (?, ?, 'MAINT', 'งานซ่อมบำรุงและอาคารสถานที่')
       ON DUPLICATE KEY UPDATE dept_name=VALUES(dept_name)`,
      [deptId1, tenantId, deptId2, tenantId, deptId3, tenantId]
    );

    // 7. Roles & Permissions
    const rolesList = [
      ['role-super-admin', 'super_admin', 'Super Administrator', 'Full system access'],
      ['role-org-admin', 'organization_admin', 'Organization Admin', 'Admin access to org'],
      ['role-safety-admin', 'safety_admin', 'Safety Administrator', 'Safety officer full control'],
      ['role-safety-manager', 'safety_manager', 'Safety Manager', 'Safety manager review & reports'],
      ['role-inspector', 'inspector', 'Safety Inspector', 'Perform routine inspections'],
      ['role-maintenance', 'maintenance', 'Maintenance Staff', 'Corrective actions maintenance'],
      ['role-dept-manager', 'department_manager', 'Department Manager', 'Departmental safety oversight'],
      ['role-auditor', 'auditor', 'Safety Auditor', 'Read only audit & compliance access'],
      ['role-viewer', 'viewer', 'Viewer', 'Read only basic access']
    ];

    for (const [rId, rCode, rName, rDesc] of rolesList) {
      await conn.query(
        `INSERT INTO roles (id, role_code, role_name, description) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role_name=VALUES(role_name)`,
        [rId, rCode, rName, rDesc]
      );
    }

    // 8. Super Admin User (pharmacisttom@gmail.com)
    const superPass = process.env.SUPER_ADMIN_PASSWORD || 'PdhSafetyFire2026!Admin';
    const hashedSuperPass = hashPassword(superPass);
    const superAdminUserId = 'usr-super-admin';

    await conn.query(
      `INSERT INTO users (id, email, name, password, department_id, disabled)
       VALUES (?, ?, ?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE password=VALUES(password), name=VALUES(name)`,
      [superAdminUserId, 'pharmacisttom@gmail.com', 'Super Admin (PharmacistTom)', hashedSuperPass, deptId1]
    );

    await conn.query(
      `INSERT INTO user_roles (user_id, tenant_id, role_code)
       VALUES (?, ?, 'super_admin')
       ON DUPLICATE KEY UPDATE role_code='super_admin'`,
      [superAdminUserId, tenantId]
    );

    // Create demo staff & maintenance users
    const staffPass = hashPassword('Staff2026!Pdh');
    await conn.query(
      `INSERT INTO users (id, email, name, password, department_id) VALUES
       ('usr-inspector-1', 'inspector@pdh.go.th', 'ผู้ตรวจอัคคีภัย ประจำโรงพยาบาล', ?, ?),
       ('usr-maint-1', 'maintenance@pdh.go.th', 'ช่างซ่อมบำรุง อาคารสถานที่', ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name)`,
      [staffPass, deptId1, staffPass, deptId3]
    );

    await conn.query(
      `INSERT INTO user_roles (user_id, tenant_id, role_code) VALUES
       ('usr-inspector-1', ?, 'inspector'),
       ('usr-maint-1', ?, 'maintenance')
       ON DUPLICATE KEY UPDATE role_code=VALUES(role_code)`,
      [tenantId, tenantId]
    );

    // 9. Asset Types
    const assetTypes = [
      ['at-fe', 'FIRE_EXTINGUISHER', 'ถังดับเพลิง', 'Fire Extinguisher', 'flame'],
      ['at-fh', 'FIRE_HOSE', 'ตู้สายฉีดน้ำดับเพลิง', 'Fire Hose Cabinet', 'hose'],
      ['at-fa', 'FIRE_ALARM', 'สัญญาณแจ้งเหตุเพลิงไหม้', 'Fire Alarm', 'bell'],
      ['at-sd', 'SMOKE_DETECTOR', 'อุปกรณ์ตรวจจับควัน', 'Smoke Detector', 'smoke'],
      ['at-el', 'EMERGENCY_LIGHT', 'ไฟส่องสว่างฉุกเฉิน', 'Emergency Light', 'light'],
      ['at-es', 'EXIT_SIGN', 'ป้ายทางออกฉุกเฉิน', 'Exit Sign', 'exit'],
      ['at-aed', 'AED', 'เครื่องกระตุกหัวใจไฟฟ้า', 'AED', 'heart'],
      ['at-fa-kit', 'FIRST_AID', 'ชุดปฐมพยาบาล', 'First Aid Kit', 'medical'],
      ['at-elec', 'ELECTRICAL_PANEL', 'แผงควบคุมไฟฟ้า', 'Electrical Panel', 'bolt'],
      ['at-gen', 'GENERATOR', 'เครื่องกำเนิดไฟฟ้าสำรอง', 'Generator', 'power'],
      ['at-spk', 'SPRINKLER', 'หัวกระจายน้ำดับเพลิง', 'Sprinkler', 'droplet'],
      ['at-gas', 'GAS_SYSTEM', 'ระบบก๊าซและออกซิเจน', 'Gas/Oxygen System', 'gas'],
      ['at-oth', 'OTHER', 'อุปกรณ์ความปลอดภัยอื่น', 'Other Safety Equipment', 'box']
    ];

    for (const [atId, atCode, atTh, atEn, icon] of assetTypes) {
      await conn.query(
        `INSERT INTO asset_types (id, type_code, type_name_th, type_name_en, icon) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE type_name_th=VALUES(type_name_th)`,
        [atId, atCode, atTh, atEn, icon]
      );
    }

    // 10. Default Inspection Template (Fire Extinguisher Monthly Inspection v1.0)
    const tplId = 'tpl-fe-monthly';
    const verId = 'ver-fe-monthly-v1.0';

    await conn.query(
      `INSERT INTO inspection_templates (id, tenant_id, title, asset_type_id, frequency, description)
       VALUES (?, ?, ?, 'at-fe', 'MONTHLY', 'การตรวจสอบถังดับเพลิงประจำเดือน มาตรฐานโรงพยาบาลปลวกแดง')
       ON DUPLICATE KEY UPDATE title=VALUES(title)`,
      [tplId, tenantId, 'Fire Extinguisher Monthly Routine Inspection']
    );

    await conn.query(
      `INSERT INTO inspection_template_versions (id, template_id, version_number, standard_name, standard_reference, effective_date, is_active, is_locked)
       VALUES (?, ?, '1.0', 'มาตรฐานความปลอดภัยอัคคีภัยโรงพยาบาลปลวกแดง 2026', 'NFPA 10 / กฎหมายความปลอดภัยในการทำงาน 2569', '2026-01-01', 1, 1)
       ON DUPLICATE KEY UPDATE version_number=VALUES(version_number)`,
      [verId, tplId]
    );

    // Insert Default Checklist Questions (Categories A to F)
    const checklistItems = [
      // Cat A: Location & Access
      ['item-a1', verId, 'ตำแหน่งและการเข้าถึง', 1, 'ถังดับเพลิงอยู่ในตำแหน่งที่กำหนดและมองเห็นได้ชัดเจน', 'Located in designated area and clearly visible', 1, 1, 1],
      ['item-a2', verId, 'ตำแหน่งและการเข้าถึง', 2, 'ไม่มีสิ่งของกีดขวาง เข้าถึงและหยิบใช้งานได้สะดวก', 'No obstructions, easy to reach and operate', 1, 1, 1],
      ['item-a3', verId, 'ตำแหน่งและการเข้าถึง', 3, 'ป้ายระบุตำแหน่งและชนิดถังดับเพลิงติดตั้งชัดเจน', 'Location and type sign clearly posted', 0, 1, 1],
      // Cat B: External Condition
      ['item-b1', verId, 'สภาพภายนอก', 4, 'ตัวถังอยู่ในสภาพสมบูรณ์ ไม่มีรอยบุบ แตกร้าว หรือสนิมรุนแรง', 'Cylinder in good condition, no dents, cracks, or severe rust', 1, 1, 1],
      ['item-b2', verId, 'สภาพภายนอก', 5, 'ฉลาก วิธีใช้งาน และคำเตือน อ่านได้อย่างชัดเจน', 'Label, operating instructions, and warnings readable', 0, 1, 1],
      // Cat C: Safety Components
      ['item-c1', verId, 'Safety Components', 6, 'สลักนิรภัย (Safety Pin) และซีล (Tamper Seal) อยู่ครบถ้วน', 'Safety pin and tamper seal intact', 1, 1, 1],
      ['item-c2', verId, 'Safety Components', 7, 'สายฉีด (Hose) และหัวฉีด (Nozzle) อยู่ในสภาพดี ไม่แตกรั่ว หรือกรอบ', 'Hose and nozzle in good condition, no cracks or blockages', 1, 1, 1],
      ['item-c3', verId, 'Safety Components', 8, 'คันกดและมือจับ (Handle & Trigger) อยู่ในสภาพสมบูรณ์', 'Handle and trigger intact and operational', 0, 1, 1],
      // Cat D: Pressure Status
      ['item-d1', verId, 'Pressure Status', 9, 'เข็มวัดแรงดัน (Pressure Gauge) อยู่ในแถบสีเขียวปกติ (ถ้ามี)', 'Pressure gauge needle in green operable zone (if applicable)', 1, 1, 1],
      // Cat E: Maintenance Dates
      ['item-e1', verId, 'Maintenance', 10, 'วันหมดอายุและกำหนด Refill / Hydrostatic Test ไม่เกินกำหนด', 'Expiry, Refill, and Hydrostatic test dates within valid range', 1, 1, 1],
      // Cat F: Safety Point & Environment
      ['item-f1', verId, 'Safety Point & Environment', 11, 'ป้าย QR Code อ่านได้ชัดเจน และรหัสตรงกับจุดติดตั้ง', 'QR code readable and code matches location', 0, 1, 1],
      ['item-f2', verId, 'Safety Point & Environment', 12, 'ไม่มีการเคลื่อนย้ายถังออกนอกจุดโดยไม่ได้แจ้ง', 'No unauthorized relocation of cylinder', 1, 1, 1],
      ['item-f3', verId, 'Safety Point & Environment', 13, 'ไม่มีร่องรอยการทดลองฉีดหรือใช้งานโดยไม่ได้บันทึก', 'No evidence of unrecorded discharge or tampering', 1, 1, 1]
    ];

    for (const [iId, vId, cat, ord, qTh, qEn, isCrit, reqPic, reqNote] of checklistItems) {
      await conn.query(
        `INSERT INTO inspection_items (id, version_id, category, item_order, question_th, question_en, is_critical, require_photo_on_fail, require_note_on_fail)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE question_th=VALUES(question_th)`,
        [iId, vId, cat, ord, qTh, qEn, isCrit, reqPic, reqNote]
      );
    }

    // 11. Risk Matrices & SLA Rules
    const riskLevels = [
      ['rm-low', tenantId, 1, 4, 'LOW', 'ความเสี่ยงต่ำ', '#10B981'],
      ['rm-mod', tenantId, 5, 9, 'MODERATE', 'ความเสี่ยงปานกลาง', '#F59E0B'],
      ['rm-high', tenantId, 10, 16, 'HIGH', 'ความเสี่ยงสูง', '#EF4444'],
      ['rm-crit', tenantId, 17, 25, 'CRITICAL', 'ความเสี่ยงวิกฤต', '#991B1B']
    ];

    for (const [rmId, tId, minS, maxS, code, name, color] of riskLevels) {
      await conn.query(
        `INSERT INTO risk_matrices (id, tenant_id, min_score, max_score, level_code, level_name, color_hex)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE level_name=VALUES(level_name)`,
        [rmId, tId, minS, maxS, code, name, color]
      );
    }

    const slaRules = [
      ['sla-crit', tenantId, 'CRITICAL', 1, 4, 2],
      ['sla-high', tenantId, 'HIGH', 4, 24, 12],
      ['sla-mod', tenantId, 'MODERATE', 24, 168, 48],
      ['sla-low', tenantId, 'LOW', 72, 720, 168]
    ];

    for (const [sId, tId, rLvl, ackH, corrH, verH] of slaRules) {
      await conn.query(
        `INSERT INTO sla_rules (id, tenant_id, risk_level, acknowledge_hours, corrective_hours, verification_hours)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE acknowledge_hours=VALUES(acknowledge_hours)`,
        [sId, tId, rLvl, ackH, corrH, verH]
      );
    }

    // 12. Sample Safety Points & Fire Extinguishers
    const spId1 = 'sp-pdh-b01-f01-fe-001';
    const spId2 = 'sp-pdh-b02-f01-fe-002';
    const qrToken1 = 'pdh_point_token_er_001_sec_rand_hash';
    const qrToken2 = 'pdh_point_token_ipd_002_sec_rand_hash';

    await conn.query(
      `INSERT INTO safety_points 
       (id, tenant_id, site_id, building_id, floor_id, zone_id, department_id, point_code, point_name, location_description, latitude, longitude, geofence_radius_m, qr_token, status)
       VALUES
       (?, ?, ?, ?, ?, ?, ?, 'PDH-B01-F01-FE-001', 'จุดติดตั้งถังดับเพลิง หน้าห้องฉุกเฉิน (ER)', 'เสาด้านหน้าห้องฉุกเฉิน ตรงข้ามเคาน์เตอร์พยาบาล', 12.96440000, 101.21350000, 30, ?, 'ACTIVE'),
       (?, ?, ?, ?, ?, ?, ?, 'PDH-B02-F01-FE-002', 'จุดติดตั้งถังดับเพลิง โถงหอผู้ป่วยใน 1', 'ผนังด้านขวาทางเดินเข้าหอผู้ป่วยใน', 12.96480000, 101.21380000, 30, ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE point_name=VALUES(point_name)`,
      [spId1, tenantId, siteId, bldId1, flrId1, zoneId1, deptId1, qrToken1,
       spId2, tenantId, siteId, bldId2, flrId2, zoneId2, deptId2, qrToken2]
    );

    // Sample Safety Assets
    const astId1 = 'ast-fe-001';
    const astId2 = 'ast-fe-002';

    await conn.query(
      `INSERT INTO safety_assets
       (id, tenant_id, safety_point_id, asset_type_id, asset_code, asset_name, serial_number, manufacturer, model, status, purchase_date, manufacture_date, install_date, expiry_date, last_inspection_date, next_inspection_date)
       VALUES
       (?, ?, ?, 'at-fe', 'FE-PDH-001', 'ถังดับเพลิงเคมีแห้ง ABC 15 ปอนด์ (ER)', 'SN-FE-2025-001', 'FireShield', 'FS-ABC-15', 'NORMAL', '2025-01-10', '2025-01-01', '2025-01-15', '2030-01-15', '2026-09-10 09:00:00', '2026-10-10 09:00:00'),
       (?, ?, ?, 'at-fe', 'FE-PDH-002', 'ถังดับเพลิงก๊าซ CO2 10 ปอนด์ (IPD)', 'SN-FE-2025-002', 'SafeGuard', 'SG-CO2-10', 'DUE_SOON', '2025-02-10', '2025-02-01', '2025-02-15', '2030-02-15', '2026-08-10 09:00:00', '2026-09-10 09:00:00')
       ON DUPLICATE KEY UPDATE asset_name=VALUES(asset_name)`,
      [astId1, tenantId, spId1, astId2, tenantId, spId2]
    );

    // Extinguisher details
    await conn.query(
      `INSERT INTO fire_extinguisher_details
       (id, tenant_id, asset_id, subtype, capacity, capacity_unit, fire_rating, agent_type, pressure_type, last_refill_date, next_refill_date, last_service_date, next_service_date, supplier)
       VALUES
       ('fed-001', ?, ?, 'DRY_CHEMICAL_ABC', 15.00, 'Lbs', '4A:60B:C', 'Monoammonium Phosphate', 'STORED_PRESSURE', '2025-01-10', '2027-01-10', '2025-01-10', '2026-01-10', 'บริษัท เซฟตี้ไฟร์ จำกัด'),
       ('fed-002', ?, ?, 'CO2', 10.00, 'Lbs', '10B:C', 'Carbon Dioxide', 'HIGH_PRESSURE_GAS', '2025-02-10', '2027-02-10', '2025-02-10', '2026-02-10', 'บริษัท สยามดับเพลิง จำกัด')
       ON DUPLICATE KEY UPDATE subtype=VALUES(subtype)`,
      [tenantId, astId1, tenantId, astId2]
    );

    await conn.commit();
    console.log('--- PdhSafetyFire Initial Data Seeded Successfully ---');
  } catch (err) {
    await conn.rollback();
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    conn.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(() => {
      console.log('Seed completed successfully.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
