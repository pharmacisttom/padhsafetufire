# Architecture and migration plan

Phase 1: independent runnable Feedback reference application, native Node HTTP API, SQLite migrations, hashed passwords, opaque server-side sessions, tenant-scoped membership authorization, audit redaction, sandbox seed/reset, responsive UI and isolation tests.

Phase 2: MySQL adapter and migration validation, custom roles, full identity lifecycle, API keys, signed webhooks with retry, notification/storage/job adapters, sandbox expiration and private tenant provisioning.

Phase 3: shared UI package, developer CLI, production hardening, deployment and browser accessibility testing. Only after Feedback is stable: Workforce and EMS modules.

Core has no business-domain dependencies. Feedback declares a module manifest. SQLite is an explicitly local alpha database; MySQL deployment is not yet implemented. The current app accepts sandbox/demo/development only and fails closed for staging/production. Role previews never change backend identity. Reset is tenant-scoped and preserves identity/configuration/audit records.

V1 migration requires a separate source audit, adapter boundaries, synthetic-data rehearsals, explicit database migration review, and a rollback plan. This alpha does not migrate V1.

After the user supplied V1, the production target is to retain its Next.js/Prisma/MySQL stack and existing identity/security controls. Extract rather than duplicate its core services; introduce Tenant/Membership via additive migration with legacy Organization mapping. Preserve existing API routes through compatibility adapters. The native Node/SQLite app is a local UX/reference prototype only. Production implementation must integrate the Feedback module into the retained V1 platform and run its mandatory lint/typecheck/test/build and disposable MySQL isolation checks.
