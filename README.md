# PdhSafetyFire — Fire Safety Inspection & Asset Management System
**ระบบตรวจสอบและบริหารความปลอดภัยด้านอัคคีภัย โรงพยาบาลปลวกแดง**

PdhSafetyFire เป็นระบบบริหารจัดการอุปกรณ์ความปลอดภัยและตรวจเช็คถังดับเพลิงโรงพยาบาลปลวกแดง พัฒนาบนพื้นฐานสถาปัตยกรรม **Tomvis Framework 2.0 Modular Monolith**

## 🌟 Key Features
- **One Asset, One Safety Point, One QR, One Location, One Inspection History, One Corrective Action Trail**
- **6-Level Multi-Tenant Location Hierarchy:** Organization → Site → Building → Floor → Zone → Safety Point → Safety Asset
- **Extensible Safety Asset Registry:** Fire Extinguishers (Dry Chemical ABC/BC, CO2, Foam, Clean Agent), Fire Hose Cabinets, Emergency Lights, AED, Exit Signs, Sprinklers, Gas Systems, and Electrical Panels.
- **GPS Geofence Verification & Haversine Distance Engine:** Calculates client inspector distance from registered Safety Point coordinates; handles `VERIFIED`, `APPROXIMATE`, `OUTSIDE_GEOFENCE`, and `UNAVAILABLE` status with location override audit logging.
- **Cryptographically Secure Random QR Tokens:** Non-predictable, revocable 32-byte tokens for public QR scanning (`/q/{token}`) and printable sticker label generator.
- **Versioned Inspection Checklists:** Categories A to F (Location, Body, Safety Pin, Pressure Gauge, Maintenance, Safety Point). Version locking ensures historic inspection records remain untouched when template definitions evolve.
- **Mobile-First Touch Inspection Execution:** Large touch PASS/FAIL/NA buttons, mandatory notes and photo evidence upload on FAIL items. Auto-generates Defect Reports when critical items fail.
- **Defect & CAPA Workflow Engine:** Full state machine transition enforce (`REPORTED` → `ACKNOWLEDGED` → `ASSIGNED` → `IN_PROGRESS` → `CORRECTED` → `VERIFIED` → `CLOSED`). Prevents closing defects before Corrective Action (CAPA) is verified.
- **Configurable Risk Matrix & SLA Engine:** Computes Risk Score (Severity × Likelihood) and target SLA resolution deadlines.
- **Google Authenticator 2FA TOTP:** Enforced for Super Admin and Safety Officers with AES-256-GCM encrypted secrets at rest and hashed recovery codes.
- **Interactive Safety Map & Executive Dashboard:** Leaflet/OpenStreetMap integration with color-coded status markers (GREEN, YELLOW, ORANGE, RED, GRAY) and CSV report exporter.
- **Immutable Audit Trail:** Logged with before/after JSON states, secret redaction, actor user IDs, IP addresses, and request IDs.

## 🚀 Requirements & Environment
- **Node.js:** `>= 22.17`
- **Database:** MySQL 8 / MariaDB (XAMPP Local Server on `127.0.0.1:3306`)
- **Database Name:** `pdhsafetyfire` (utf8mb4_unicode_ci)
- **Default Super Admin:** `pharmacisttom@gmail.com`

## 🛠️ Local Development Setup (XAMPP)
1. Start **MySQL Module** in XAMPP Control Panel (`127.0.0.1:3306`).
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Run Database Migrations:
   ```bash
   node scripts/migrate.js
   ```
4. Seed Initial Data (Organization, Sites, Buildings, Admin User, Checklist v1.0, Sample Points):
   ```bash
   node scripts/seed.js
   ```
5. Run the Application:
   ```bash
   npm run dev
   ```
6. Open browser at [http://localhost:3000](http://localhost:3000)

## 🧪 Testing & Verification
```bash
npm test
npm run build
npm run doctor
```

See [docs/LOCAL_SETUP_XAMPP.md](docs/LOCAL_SETUP_XAMPP.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/CHECKLIST.md](docs/CHECKLIST.md), and [docs/HANDOFF.md](docs/HANDOFF.md) for detailed technical specifications.
