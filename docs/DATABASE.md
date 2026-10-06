# Database Architecture & Entity Relationship Specification

## Overview
- **Database Engine:** MySQL 8 / MariaDB (XAMPP Port 3306)
- **Database Name:** `pdhsafetyfire`
- **Character Set:** `utf8mb4`
- **Collation:** `utf8mb4_unicode_ci`

## Main Relational Diagram & Relationships
```
organizations (1) ───< sites (N) ───< buildings (N) ───< floors (N) ───< zones (N)
                                                                            │
                                                                            ▼
                                                                     safety_points (1)
                                                                            │
                                                                            ▼
                                                                     safety_assets (1)
                                                                            │
                                                                            ▼
                                                               fire_extinguisher_details (1:1)

safety_points (1) ───< inspections (N) ───< inspection_results (N)
                           │
                           ▼
                     defect_reports (1) ───< corrective_actions (1:1)
```

## Table Definitions
1. **`organizations`**: Root hospital entity (ID, tenant_id, code, name).
2. **`sites`**: Hospital campuses/sites.
3. **`buildings`**: Hospital buildings (OPD, IPD, Pharmacy).
4. **`floors`**: Building floors (Floor 1, 2, 3).
5. **`zones`**: Specific floor zones (ER, Hallway, Risk area).
6. **`departments`**: Hospital work units.
7. **`safety_points`**: Physical equipment installation points storing latitude, longitude, geofence radius, and secure random QR tokens.
8. **`asset_types`**: Asset classifications (FIRE_EXTINGUISHER, FIRE_HOSE, AED, etc.).
9. **`safety_assets`**: Master registry of safety equipment.
10. **`fire_extinguisher_details`**: Fire extinguisher specific properties (subtype, capacity, fire rating, agent type, hydrostatic test dates).
11. **`inspection_templates`**: Checklist template headers per asset type.
12. **`inspection_template_versions`**: Immutable version headers (1.0, 1.1, locked status).
13. **`inspection_items`**: Questions mapped to Categories A–F with critical flags.
14. **`inspections`**: Inspection check-in execution records with Haversine GPS distance and location status.
15. **`inspection_results`**: Responses per item (PASS, FAIL, NA) with evidence photos.
16. **`defect_reports`**: Equipment defects & public issue reports with Risk level calculation.
17. **`corrective_actions`**: CAPA remediation plans with SLA due dates and before/after evidence photos.
18. **`risk_matrices`**: Configurable severity × likelihood risk calculation tables.
19. **`sla_rules`**: Target resolution SLA hours per risk level.
20. **`audit_logs`**: Immutable audit logs with secret redaction.
21. **`two_factor_auth`**: Encrypted TOTP secrets per user.
22. **`recovery_codes`**: Scrypt-hashed single-use 2FA recovery codes.

## Migrations & Seeding Commands
```bash
node scripts/migrate.js
node scripts/seed.js
```
