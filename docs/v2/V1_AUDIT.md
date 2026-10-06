# V1 Audit — 2026-10-06

The supplied workspace was empty, with no Git repository, README, instructions, package manifests, database, authentication, API, deployment, tests, or documentation. No V1 source or production credentials were accessed. Branch v2-development was initialized for this independent implementation.

| Classification | Finding |
|---|---|
| KEEP | No existing source available |
| REFACTOR | Requires a separately supplied V1 repository |
| REPLACE | No existing source available |
| DEPRECATE | No existing source available |
| REMOVE | Nothing removed |

The attached specification ends mid-sentence in section 50. No additional requirements are assumed.

## Follow-up: supplied V1 repository

User subsequently supplied `pharmacisttom/Tomvis`. Read-only shallow checkout inspected at commit `8610ef0` (feat: initialize TOMVIS Core Foundation v0.1), with no tags observed in the shallow checkout. No code or database in V1 was changed. README, AGENTS, blueprint, architecture, database, security, API, deployment, test instructions, package manifest, Prisma schema, authorization and API handler were read. V2 remote `pharmacisttom/tomvis2.0` returned no refs at inspection.

| Classification | V1 component and action |
|---|---|
| KEEP | Next.js modular monolith, MySQL/Prisma, Argon2id, hashed opaque sessions, TOTP/recovery/reset controls, tenant composite keys, server authorization, transactional audit, pinned dependencies |
| REFACTOR | Extract existing core interfaces into internal packages; model Tenant separately from Organization and support Membership through reviewed additive migrations |
| REPLACE | No security or persistence replacement recommended; the local SQLite app is an independent disposable interaction prototype |
| DEPRECATE | Direct single-organization assumptions only after membership adapters and compatibility tests exist |
| REMOVE | Nothing authorized or removed |

V1 uses Next 16.3.4 / React 19.3 / Prisma 7.10, with a lockfile and advisory overrides. It provides auth, users, roles, permissions, audit, organizations and settings modules; business modules, API keys, webhooks and sandbox lifecycle are deferred. MySQL rate limits work across workers; deployment documents Nginx/PM2 and manual migrations. Unit/mocked API tests exist; live MySQL tests are conditional on a disposable `_test` database. None of V1's tests or dependency advisory claims were independently validated during this source audit.

Static source review is not a production security certification. Full source review, dependency validation, MySQL integration tests and migration rehearsals remain required. The V2 local prototype lacks several controls already present in V1 and must not replace V1 identity in production.
