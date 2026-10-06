# Local Development Setup Guide (XAMPP + MySQL)

## 1. Prerequisites
- **Windows 10 / 11**
- **XAMPP Server** with MySQL / MariaDB enabled on port `3306`
- **Node.js 22.17+**

## 2. Environment Configuration
Create a `.env` file in the project root based on `.env.example`:

```ini
APP_NAME=PdhSafetyFire
APP_ENV=local
APP_URL=http://localhost:3000
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=pdhsafetyfire
DB_USERNAME=root
DB_PASSWORD=
SESSION_SECRET=pdh_safety_fire_super_secret_session_key_2026
TOTP_ENCRYPTION_KEY=pdh_safety_fire_totp_secret_encryption_key_32_bytes!
TIMEZONE=Asia/Bangkok
SUPER_ADMIN_PASSWORD=PdhSafetyFire2026!Admin
```

## 3. Database Initialization
Execute the migration script to create the `pdhsafetyfire` database and all 35 tables:
```bash
node scripts/migrate.js
```

Seed initial master data:
```bash
node scripts/seed.js
```

Seed data includes:
- **Organization:** โรงพยาบาลปลวกแดง
- **Sites:** โรงพยาบาลหลัก (ปลวกแดง)
- **Buildings:** อาคารผู้ป่วยนอก (OPD), อาคารผู้ป่วยใน (IPD)
- **Super Admin Account:** `pharmacisttom@gmail.com`
- **Default Checklist Version:** 1.0 (Categories A–F)
- **Sample Safety Points & Fire Extinguishers**

## 4. Running the App
Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 5. Google Authenticator 2FA Setup
1. Log in as `pharmacisttom@gmail.com` with password `PdhSafetyFire2026!Admin`.
2. Click **🔑 2FA** button in the top navigation bar.
3. Scan the displayed QR Code with **Google Authenticator** app.
4. Input the 6-digit OTP to complete enrollment and receive your recovery codes.
