# Backend Production Readiness Audit

## Executive summary

This backend is not production-ready as implemented. The codebase contains several solid building blocks (TypeORM entity registration, bcrypt hashing, JWT-based auth, route-based authorization, request-validation patterns, database transactions for some flows), but the current configuration and access-control design still leaves material production risk.

The most important concerns are:

- A project-scoped authorization path trusts a caller-supplied `projectId` before resolving the actual project from the target resource, which creates an authorization bypass risk.
- Organization/project permission checks are implemented across multiple layers and are not fully consistent; manager/admin exemptions and project-role logic are not uniform.
- Default backend/frontend configuration values are development-local and will not hold in production unless explicitly overridden.
- The project contains migration rollback risk and route aliasing that can create confusing or unsafe API behavior.
- The auth/session design is partly hardened, but the frontend still stores access tokens in browser storage and the backend relies on multiple auth sources without a single, consistently enforced production policy.

Overall verdict: read-only review indicates `NOT READY FOR PRODUCTION`.

## Scope and method

This report is based on a read-only source inspection of the backend and its relevant configuration, route registration, auth middleware, RBAC checks, entities, and migrations. No database migration, schema synchronization, or live attack simulation was executed. Existing user changes in the working tree were left untouched.

## 1. Architecture and configuration review

### Strengths

- `backend/app.ts` performs baseline hardening (disabled `x-powered-by`, security headers, CORS restrictions, JSON body limits, JSON + URL-encoded parsing, centralized error handling).
- `backend/config/config.ts` validates host, port, CORS origins, frontend URL, cookie same-site values, and secret length for a production-ready startup guard.
- `backend/config/data.source.ts` explicitly registers entities and uses `migrations` rather than blind auto-sync by default.
- Globals are validated to reject missing environment values in production, especially for `HOST`, `PORT`, `DB_PASSWORD`, `CORS_ORIGINS`, and `ACCESS_TOKEN_SECRET`.

### Production gaps

- Default configuration values are still localhost-oriented: `HOST` falls back to `127.0.0.1` and `FRONTEND_URL` falls back to `http://localhost:5173` in non-production; in production, these values must be explicit. This is acceptable for local dev, but dangerous for deployment if environment files are incomplete.
- CORS is intentionally restricted, but the application also exposes route aliases such as `/api/organization` and `/api/organizations`, `/api/chat` and `/api/conversations`, and `/api/sla` plus `/api/organization/sla`. This broadens the externally exposed surface and can create inconsistent policy enforcement.
- The app uses multiple auth entry points (`Authorization: Bearer ...` and cookie-based `token`/`refreshToken`), but the backend does not enforce a single, explicit production cookie policy beyond the session helper configuration.

## 2. Database and migration audit

### Database configuration

`backend/config/data.source.ts` defines a PostgreSQL TypeORM data source with explicit entities and migration path scanning. `config.database.synchronize` is guarded by runtime validation, and the config rejects `DB_SYNCHRONIZE=true` in production.

This is a positive control, but it also means migration correctness is critical because there is no live schema drift safeguard during boot.

### Migration risks

The migration suite includes a rollback path that drops existing tables, including `audit_logs`, `notifications`, `project_workflows`, `work_item_dependencies`, and related objects. In the migration file `backend/migrations/1792300000000-AddFeaturePersistenceTables.ts`, `down()` executes `DROP TABLE IF EXISTS "audit_logs";` and other destructive drops.

This is a major operational risk because:

- a rollback can permanently remove production audit data;
- a multi-tenant workspace can lose historical records during a migration downgrade;
- the migration ordering and rollback semantics are not production-safe if a partial deployment or failed migration occurs.

### Migration verification status

No clean-database migration test was performed in this audit. The read-only review therefore cannot confirm that every schema change is fully migration-safe across a fresh database and cannot confirm the migration sequence is free of ordering issues. This is marked as `NOT EXECUTED`.

## 3. Authentication and session management

### What is implemented

- Password hashing uses `bcrypt.hash` with a 12-round cost in user registration and password reset flows.
- JWT access tokens are HS256-signed with explicit `userId`, `role`, `organizationId`, and `type: "ACCESS"` claims (`backend/middleware/is.loggedin.ts`, `backend/services/auth.session.service.ts`).
- Access tokens carry a short lifetime (`15m`).
- Refresh tokens are hashed before storage in `UserSession` and are rotated on refresh.
- Refresh token use is guarded by `pessimistic_write` locking in the refresh flow, which reduces concurrent-refresh races.
- Logout revokes the current refresh token and clears cookies.

### Remaining issues

1. Frontend token storage risk
   - The project includes an access-token flow that is persisted in browser storage instead of a short-lived secure-only cookie. This was flagged in the project audit notes as an exposure risk for XSS-driven token theft.
   - The backend has cookie-based auth controls, but the overall end-to-end auth posture is only as strong as the client-side storage model.

2. Refresh-session edge behavior
   - Refresh rotation is present, and invalid/expired/revoked refresh tokens are rejected. However, the implementation uses process-local runtime state and is only as reliable as the database/session consistency and deployment topology.
   - There is no evidence of a broad production replay or hijack test under adversarial concurrent requests.

3. Cookie configuration
   - `secure` is only enabled when `NODE_ENV === "production"`, which is correct for prod. `httpOnly` is enabled, and `sameSite` is validated.
   - However, the runtime still relies on each environment being configured carefully; if the app is deployed behind a proxy or with a misconfigured origin, cookies may not be accepted or may be invalid across hosts.

## 4. RBAC and authorization audit

### Overall assessment

Authorization is spread across multiple mechanisms:

- organization-level middleware (`backend/middleware/check.permissions.ts`);
- project-role enforcement (`backend/middleware/project.permission.ts`);
- controller/service-level checks; and
- frontend permission hints that are not authoritative.

This creates a layered but inconsistent permission model.

### High-risk issue: client-supplied project ID is trusted

The critical authorization issue is in `backend/middleware/project.permission.ts`:

- `authorizeProjectPermission()` resolves a `projectId` from `req.params`, `req.body.projectId`, and `req.query.projectId`.
- If an endpoint does not provide a resource-specific `projectId` in the route, the middleware may accept a request-supplied project ID before verifying whether the target work item belongs to that project.
- This means a caller can potentially switch the authorization context to a different project than the actual resource lifecycle would imply.

This directly contradicts a safe authorization model where the target resource should determine the project context, and then the caller’s permissions are checked against that project.

### Organization-level issues

The backend organization role model defines `ADMIN`, `MANAGER`, and `TEAMMATE` roles. The code effectively makes:

- organization Admins able to manage members and perform privileged actions;
- organization Managers able to create projects and manage some project actions in practice;
- organization teammates generally limited to read access and project-role-bound behavior.

However, the actual permission model is inconsistent with the expected matrix in a few places:

- Manager access to organization SLA policy update is allowed in code, even though the expected matrix reserves write access to Admin.
- Organization member listing is not strongly role-gated at the API layer; the roster is only restricted in the UI for some flows.
- The project creation and collection-read checks rely on a global organization role table, but those checks are narrower than the overall project permission model.

### Project-level issues

- `ProjectRole.ADMIN`, `LEAD`, and `MEMBER` are enforced by `hasProjectPermission()`. The matrix shows that `MEMBER` can create/update/assign tasks, which is broader than a “task assignee only” interpretation and is inconsistent with some expected business rules.
- `authorizeProjectPermission()` contains a special case where organization `ADMIN` bypasses project membership checks for most project actions, except `task:create`, which requires project membership.
- The permission logic is suitable for a broad internal tool but is not a strict least-privilege model and is not fully aligned with the expected organization/project permission matrix.

### Security scenarios explicitly called out by audit

The read-only review found that these scenarios are not sufficiently controlled across the codebase without additional validation:

- a non-project member creating work items through an untrusted project ID path;
- a user targeting another organization’s project by supplying a project UUID in the body/query;
- a user modifying another organization’s work item if the route resolves a project based on request data instead of resource data;
- a teammate or lower-privileged user performing manager/admin-only actions through a bypassed route or inconsistent permission layer;
- project member access to restricted resources if the path is not strictly anchored to the correct project and resource.

## 5. Route and controller audit

### Route structure

The backend registers numerous route modules from `backend/app.ts`, including auth, users, organizations, projects, work items, sprints, dashboard, notifications, chat, whiteboards, and SLA. This is a broad feature surface, which increases the chance of route drift and policy inconsistencies.

### Observed route issues

- Duplicate aliases exist for the same functions, such as `/api/organization` and `/api/organizations`.
- The API exposes multiple path variants for the same domain (e.g. chat and SLA endpoints), which can be convenient for compatibility but makes authorization and policy auditing harder.
- The route registration strategy is broad and not fully aligned with a strict API contract; route duplication widens the attack surface and increases risk of undocumented access.
- Several routes appear to be protected by auth + project access middleware, but path resolution is not consistently resource-bound across all controller actions.

### HTTP validation gap

A read-only inspection did not find a uniformly enforced UUID/validator gate across all route parameter types. This is part of the broader issue that authorization and request validation are more dependent on controller/service logic than on a consistent top-level API contract.

## 6. Operational and deployment concerns

### Dependency and runtime posture

The read-only project audit flagged multiple dependency advisories across frontend and backend packages, which means the application should not be treated as production-safe until those are reviewed and resolved. Several audit reports in the workspace also call out deployment-configuration issues, including localhost defaults and exposure assumptions in browser/client configurations.

### Process lifecycle

The backend starts schedulers on boot, but there was no evidence in the static review of a complete, production-safe shutdown sequence explicitly clearing database resources, stopping workers, or guaranteeing clean termination under `SIGINT`/`SIGTERM`.

### Not executed

The following checks were intentionally not executed because of the strict read-only requirement:

- clean-database migration verification;
- production schema synchronization or database mutation;
- live RBAC exploitation attempts;
- runtime token replay or session hijack testing;
- production deployment or host-level validation.

## 7. Final verdict

The backend is not production-ready. The implementation has several strong patterns, but the current state still fails a production-readiness bar because of:

- an authorization bypass risk caused by trusting request-supplied `projectId` values;
- inconsistent RBAC across organization-, project-, and controller-level layers;
- migration rollback risk and insufficient migration safety review;
- production configuration gaps and localhost defaults;
- partially hardened auth/session logic that is still vulnerable to client-side storage and deployment misconfiguration issues;
- route aliasing and broad permission surfaces that complicate security review.

The correct status is: `NOT READY FOR PRODUCTION`.

## 8. Required next steps before rollout

1. Refactor project authorization to anchor all permission checks to the actual target resource (`workItem`, `sprint`, `whiteboard`, `project`, etc.) before consulting request-supplied IDs.
2. Unify RBAC logic into a single policy model for organization and project actions, and align managers/admins with the intended matrix.
3. Review and harden every migration `down()` path; ensure rollback is safe and non-destructive for production data.
4. Validate configuration for production hostnames, HTTPS origins, CORS, secrets, and cookie settings in a real deployment environment.
5. Replace or redesign access-token storage and reduce token exposure risk in the frontend.
6. Re-run the full auth/RBAC suite against a clean, production-like database before any launch decision.
