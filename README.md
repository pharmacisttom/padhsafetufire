# Tomvis V2 — local Sandbox prototype

Version 2.0.0-alpha.1. Independent Feedback reference prototype. V1 source at https://github.com/pharmacisttom/Tomvis is preserved; this prototype is **not a completed migration or production framework**. Target repository: https://github.com/pharmacisttom/tomvis2.0.

Requires Node 22.17+ with native experimental SQLite. No npm dependencies.

PowerShell:
```powershell
$env:TOMVIS_MODE='sandbox'
$env:TOMVIS_DEMO_PASSWORD=Read-Host 'Choose local demo password (at least 12 characters)'
npm run dev
```
Open http://localhost:3000. Accounts: admin@tomvis.demo, staff@tomvis.demo, viewer@tomvis.demo. All use the password supplied at first initialization. Changing the environment password does not change existing database accounts. `.env.example` documents variables; `.env` is not automatically loaded.

Includes dashboard, persistent Feedback create/resolve/search/filter, users, permission matrix, audit viewer, confirmed tenant-scoped reset, and planned-module catalog. Supports sandbox/demo/development only, bound to loopback. Every tenant read/write is scoped to the authenticated membership. No production connectors or credentials are used.

`npm test`, `npm run build`, `npm run doctor`. Doctor requires the password environment variable. `build` checks JavaScript syntax; there is no bundling. Browser layout and accessibility QA remain pending.

SQLite schema is initialized and versioned locally; a full reviewed incremental migration runner remains pending. API list is capped at 100 records; pagination/sorting, custom roles, account lockout, 2FA/reset, external adapters, API keys, webhook delivery, sandbox lifecycle, MySQL support and production deployment are not yet implemented. Sessions are SHA-256 digested at rest; mutations and audits share transactions. V1 already implements several identity controls and should be reused for the production migration rather than replaced by this prototype.

See docs/v2/V1_AUDIT.md and docs/v2/ARCHITECTURE.md.
