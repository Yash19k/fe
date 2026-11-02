# Production Readiness Audit

**Audit date:** 2026-11-02  
**Assessment:** **NOT READY FOR PRODUCTION**  
**Scope:** Read-only static review and non-destructive checks of the current working tree. Existing application files were not intentionally changed.

> **Sensitive-data notice:** The IDE-selected material supplied with the request included credential values from a backend environment file. They are deliberately omitted here. If those values are real or have been used, treat them as exposed and rotate them. This is an observation about the supplied context, not a claim that the credentials are committed to the repository.

## 1. Executive Summary

The project has a substantial React/TypeScript frontend and an Express/TypeScript backend, with automated tests covering several important flows. Both projects type-check; frontend and backend tests pass; both builds complete. These results do not establish production readiness.

The highest-priority concerns are:

1. A statically identified work-item authorization path trusts a client-supplied project ID before determining the target item's real project. This can bypass action-specific project permissions.
2. Credentials were included in the supplied IDE selection. Rotate them if active.
3. Frontend and backend network defaults are development-local values. Without deployment-specific environment configuration, the browser targets its own localhost and the backend binds to loopback; default CORS origins are also local.
4. Dependency audit reported **19 advisories** across the two production dependency trees: 12 frontend (7 high, 4 moderate, 1 low) and 7 backend (3 high, 4 moderate).
5. An audit-log migration's `down` method can drop a table that existed before that migration, risking loss of existing audit data during rollback.

There are also medium-priority authentication, rate-limiting, lifecycle, and deployment-command gaps. No live database migration, production-host, browser end-to-end, or external-service test was performed.

### Findings by severity

| Severity | Findings |
|---|---:|
| Critical | 0 |
| High | 6 |
| Medium | 4 |
| Low | 2 |
| **Total** | **12** |

Dependency advisory counts above are separate from this finding count: related advisories are grouped into two actionable findings.

## 2. Project Architecture Overview

- **Frontend:** React 19, TypeScript, Vite, Tailwind, client-side state in `frontend/src/state/AppContext.tsx`, domain helpers, and a centralized API module in `frontend/src/services/api.ts`. Views are selected by application route state in `frontend/src/App.tsx`; several views use lazy imports.
- **Backend:** Express 5, TypeScript, TypeORM, PostgreSQL, Joi validation, JWT authentication, bcrypt, cookie parsing, CORS, and a centralized error handler.
- **Backend feature layers:** 11 route files, controllers, services, middleware, 26 entity files, and 35 migration files.
- **Real-time and scheduled work:** Socket.IO/WebSocket gateways, Croner scheduler services for SLA/recurrence work.
- **External integrations:** SMTP/Nodemailer, Cloudinary, PostgreSQL, JWT, and socket transports. No Redis dependency or tracked Docker/Compose file was found in the repository inventory.

## 3. Audit Scope and Methodology

The review inventoried tracked frontend/backend source files and traced representative frontend API calls through backend route registration, authorization middleware, controllers/services, and persistence definitions. It also inspected package scripts/configuration, selected entity/migration definitions, existing feature tests, and current working-tree status. Findings below are labeled as static unless a check explicitly ran.

- **Source inventory:** 227 tracked TypeScript/TSX files were inventoried (86 frontend and 141 backend files, excluding generated `backend/dist`). The broader 365-file code inventory also includes 138 tracked compiled JavaScript files under `backend/dist`.
- **Files opened by reviewers:** The delegated frontend reviewer reported opening 11 distinct files and the backend reviewer 33. These 44 reviewer-reported opens are not a deduplicated total across those reviews and my direct reads; an exact unique file-open count was not recorded.
- **Backend API inventory:** 91 route declarations across 11 route files were enumerated. Prefix aliases can expose the same controller under multiple URLs; the count is declarations, not deduplicated external URLs.
- **Feature families reviewed:** 16 (authentication/session, organizations/members/invitations, projects, work items, Kanban/workflows, sprints, dependencies/scheduling, recurrence, SLA, notifications, chat, whiteboards, audit/undo, dashboards/reports, attachments, onboarding/settings).
- **Existing worktree changes:** Several frontend files were already modified before the audit. They were left untouched. The report evaluates the current working tree.
- **Secrets:** Credential values were not copied into this report. The IDE selection itself exposed values; see the notice above.
- **Database safety:** No database reset, migration, schema mutation, or live database validation was run.

## 4. Frontend Audit Results

### Routing

`frontend/src/App.tsx` uses an application-state route switch rather than a routing library. Static paths include `/login`, `/signup`, `/forgot-password`, `/reset-password…`, `/accept-invitation…`, `/onboarding/company`, `/projects`, `/my-tasks`, `/settings`, `/chat`, and project paths under `/project/:projectId/...`. Unknown routes render `NotFoundView`. Unauthenticated users are redirected to `/login`; project visibility is also checked in the UI.

The client route guard is not a substitute for backend authorization. Nested-route refresh behavior depends on the hosting server's SPA fallback configuration, which was not tested against a deployed host.

### API integration and state

`frontend/src/services/api.ts` centralizes JSON requests, refresh retries, and attachment uploads. The attachment upload correctly uses `FormData` without manually setting a multipart content type. The helpers use many `any` response/payload types, reducing compile-time checking of backend response contracts.

Notification helpers catch request failures and return fallback objects. This can render a failed notifications request as an empty state. A `createNotificationApi` helper sends `POST /api/notifications`, but the registered notification router has no POST route; whether the helper is invoked by a current UI path was not established.

The access token is retained in browser `localStorage`; see SEC-04. The frontend API base defaults to localhost; see DEP-01.

### Quality and UI

Frontend TypeScript compilation and production build succeeded. Oxlint exited successfully but emitted **124 warning diagnostics**, including unused imports/variables and React hook dependency warnings. The lint result is not proof of dead code or runtime failure. No confirmed unused-file count was established.

No browser-driven accessibility, responsive-layout, or end-to-end interaction audit was run.

## 5. Backend Audit Results

The app registers the feature route modules, sets several baseline response headers, restricts CORS to configured origins, and installs a centralized error handler. Authentication middleware verifies HS256 access tokens and reloads the active user from the database. Entity registration is explicit in `backend/config/data.source.ts`.

The most consequential backend finding is SEC-01: an item-scoped permission path checks a project identifier supplied in the request body before resolving the project from the target work-item ID. This is a static authorization concern and was not live-exploited.

Public registration routes do not use the limiter applied to login. The limiter stores state in a process-local map, so it does not coordinate across replicas or survive process restarts (SEC-03).

`backend/server.ts` starts the scheduler after database initialization. It stops it on selected server events, but no explicit SIGINT/SIGTERM shutdown path or database-source destruction was found in the server entry point (OPS-01).

## 6. API Integration Audit

The table groups the frontend API helper families with backend route/controller/service surfaces. **PARTIALLY IMPLEMENTED** means paths/methods and portions of the implementation were statically matched, but the complete request/response/authentication flow was not verified against a live backend. `MATCHED` is reserved for the narrow health-check contract. The 91 route declaration count includes aliases and is not a count of unique URL patterns.

| Feature | Frontend API/helper family | Backend route family | Controller/service surface | Status |
|---|---|---|---|---|
| Health | `checkBackendHealth` → `GET /health` | `GET /health` | App health handler | MATCHED |
| Registration and session | `registerOrganizationApi`, `loginApi`, `currentUserApi`, `logoutApi`, `refreshTokenApi` → `/api/users/...` | `/api/users` routes | User/auth controllers; auth session service | PARTIALLY IMPLEMENTED |
| Password recovery | `requestPasswordResetApi`, `resetPasswordApi` → `/api/auth/forgot-password`, `/api/auth/reset-password` | `/api/auth/...` | Auth controller; password-reset service | PARTIALLY IMPLEMENTED |
| Invitations | `inviteOrganizationMembersApi`, `acceptInvitationApi` → `/api/users/invite`, `/api/users/accept-invitation` | User and organization invitation routes | Member-invitation controller/service | PARTIALLY IMPLEMENTED |
| Organization members | `getOrganizationMembersApi`, add/update/remove member helpers → `/api/organization/members...` | `/api/organization` and `/api/organizations` aliases | Organization/member-invitation controllers | PARTIALLY IMPLEMENTED |
| Projects and project members | Project CRUD/member helpers → `/api/projects...` | `/api/projects` | Project and project-settings controllers | PARTIALLY IMPLEMENTED |
| Work items | Create/list/get/update/delete/escalate helpers → `/api/work-items...` | `/api/work-items` | Task controller; work-item services | PARTIALLY IMPLEMENTED |
| Comments and dependencies | Comment/dependency helpers → `/api/work-items/:id/comments` and `/dependencies` | Work-item subroutes | Collaboration/task controllers; dependency service | PARTIALLY IMPLEMENTED |
| Attachments | `uploadWorkItemAttachmentsApi` → `POST /api/work-items/:id/attachments` | Work-item attachment route | Task/attachment services and upload middleware | PARTIALLY IMPLEMENTED |
| Labels, workflow, audit | Project-label/workflow/audit helpers → `/api/projects/:id/...` | Project subroutes | Project-settings/audit controllers | PARTIALLY IMPLEMENTED |
| Sprints and dashboard | Sprint/dashboard helpers → `/api/projects/:id/sprints`, `/api/projects/:id/dashboard`, `/api/dashboard/personal` | Sprint/dashboard routes | Sprint/dashboard controllers | PARTIALLY IMPLEMENTED |
| SLA | SLA helpers → `/api/organization/sla` | SLA routes mounted under organization and SLA prefixes | SLA controller/service | PARTIALLY IMPLEMENTED |
| Notifications | Read/unread helpers → `/api/notifications...`; create helper → `POST /api/notifications` | GET/PATCH routes only | Notification controller/service | **BROKEN for create helper**; other helpers PARTIALLY IMPLEMENTED |
| Chat | Conversation/message helpers → `/api/chat/conversations...` | Chat routes mounted under multiple aliases | Chat controller/service; chat gateway | PARTIALLY IMPLEMENTED |
| Whiteboards | Whiteboard/revision helpers → `/api/projects/:id/whiteboards...`, `/api/whiteboards/:id...` | Whiteboard routes mounted under `/api` | Whiteboard controller/service; socket gateway | PARTIALLY IMPLEMENTED |

The notification POST mismatch is the only concrete missing HTTP route identified in this mapping. Other rows are not labeled fully working merely because a route exists.

## 7. Authentication and Authorization Audit

- Backend access-token verification pins the algorithm to HS256, checks the access-token type, and reloads the active user's role/status/organization from the database.
- The frontend persists a bearer token in `localStorage` (SEC-04); any successful same-origin script injection can read it.
- The project/item permission ordering issue in SEC-01 may allow bypassing action-specific permissions for an item by providing a different project ID in the request body. The backend must enforce permissions against the target item's persisted project.
- Registration is public and currently lacks the login/reset rate-limit middleware; the in-memory limiter is not distributed (SEC-03).
- Frontend route guards and the client-side project access check are UX controls only; authorization must remain server-enforced.
- No live cross-organization IDOR test was performed. Existing backend tests do cover selected project-authorization and audit-undo cases, but do not establish complete authorization coverage.

## 8. Database and Migration Audit

The application registers 26 entities and uses 35 migration files. `DB_SYNCHRONIZE` is parsed as an explicit boolean and startup rejects synchronization in production. This is a positive safeguard.

**DB-01:** Fixed in source. `1792300000000-AddFeaturePersistenceTables.ts` owns `audit_logs`; `1792584447276-CreateAuditLogs.ts` is now a no-op, and the `1792399247543-AddProjectLabels.ts` rollback no longer drops the table or its owner-created indexes. Five isolated migration tests pass. A read-only check confirmed the three relevant migrations are recorded in the local TypeORM migration table. No migration was executed; production state and database-level rollback behavior remain unverified.

Two migrations share timestamp `1792400000000` (`AddAuditLogUndoTracking` and `AddChatTables`). Their reviewed operations appear independent, so this was not classified as a confirmed ordering failure; deterministic migration ordering should nevertheless be checked.

Entity/migration parity, actual indexes under production data, production migration status, and database-level rollback behavior were not validated against PostgreSQL.

## 9. Feature-by-Feature Audit

| Feature family | Static result | Runtime evidence / limitation |
|---|---|---|
| Authentication/session | Routes, token middleware, session services, and frontend helpers present; see SEC-04 | Unit/API tests ran; no live database or browser session test |
| Organizations/members/invitations | Routes and invitation service are wired | Existing invitation tests; no SMTP provider test |
| Projects/project members | Frontend helpers and backend routes/controllers are present | No live authorization matrix across all roles |
| Work items/assignment | Work-item routes/services and entity relations are present | Unit tests cover selected validation/assignment flows |
| Kanban/workflow | Frontend board/domain logic and backend workflow route/service are present | Workflow tests passed; no browser drag/drop run |
| Sprints | Sprint helpers/routes/controller are present | Frontend sprint tests exist; no live persistence test |
| Dependencies/scheduling | Frontend and backend scheduling/dependency logic is present | Tests cover cycles/working days and selected constraints |
| Recurrence | Frontend recurrence helpers, backend service, persistence entities, and scheduler are present | Unit tests exist; no long-running scheduler/timezone test |
| SLA | Frontend settings/dashboard and backend SLA service/routes are present | Selected eligibility/permission tests ran; no live escalation |
| Notifications | Read helpers/routes exist; create helper lacks a POST route | No live push/delivery test |
| Chat | REST controllers/services and socket gateway are present | Selected pagination/query tests ran; no multi-client socket test |
| Whiteboards | CRUD/revisions and socket surfaces are present | No real-time browser or concurrent-edit test |
| Audit logs/undo | Audit controller/entity/migrations and undo path are present | Undo tests passed; migration rollback risk remains |
| Dashboard/reports | Personal/project dashboard route/controller and frontend views are present | No aggregate performance or organization-isolation load test |
| Attachments | Upload middleware/service and Cloudinary integration are present | Signature-validation tests passed; no live upload/provider test |
| Onboarding/settings | Frontend onboarding/settings and backend configuration routes exist | Contract tests cover schema portions; no deployed flow |

## 10. Third-Party Integration Audit

| Integration | Static assessment | Not verified |
|---|---|---|
| PostgreSQL / TypeORM | Configured through backend environment settings; entities/migrations registered | Production connection, migration status, backup/recovery, pool behavior |
| Cloudinary | Service and attachment metadata integration present | Credentials, provider availability, timeout/retry behavior, live upload |
| SMTP / Nodemailer | SMTP settings and mail service used for invitations/reset flows | Real SMTP delivery, provider throttling, retry/timeout behavior |
| Socket.IO/WebSocket | Chat and whiteboard gateways attach to the HTTP server | Proxy upgrade config, reconnect behavior, multi-instance room coordination |
| Croner | Scheduler starts during server startup and stops on selected close/error events | Replica coordination, crash recovery, graceful OS-signal shutdown |
| Redis | No Redis dependency/configuration found in the inspected manifests | Not applicable unless deployment supplies an out-of-process integration |

Dependency audit results for Nodemailer and other packages are detailed under SEC-06/SEC-07 in the issue register.

## 11. Security Audit

Confirmed/static concerns are SEC-01, SEC-02, SEC-03, SEC-04, SEC-06, and SEC-07. The migration data-loss risk is tracked separately as DB-01. No confirmed SQL injection, unsafe file-signature bypass, or cross-organization data leak was established in this audit. Those areas still require targeted integration testing before launch.

Baseline security headers are set in `backend/app.ts`, and CORS uses an explicit origin allowlist. Production correctness depends on setting the allowlist and frontend/backend URLs appropriately; defaults are development-local (DEP-01).

## 12. Performance and Scalability Audit

No load test or query profiler was run. Existing pagination is present in some surfaces (for example chat, whiteboards, sprints, and work-item listing), but this does not establish that all list/report queries are bounded or efficient. The frontend build transformed 4,296 modules; this is a build statistic, not a measured runtime performance problem.

The process-local rate limiter and in-process scheduler are the clearest scaling risks. Their state and execution are per backend process; horizontal replicas do not share counters or coordinate scheduler jobs without an external coordination mechanism.

## 13. Code Quality and Garbage Code Audit

- Oxlint reported 124 warnings; many concern unused imports/variables or hook dependency arrays. They should be triaged rather than treated as 124 confirmed runtime defects.
- API response and payload interfaces use `any` in multiple places, limiting contract safety.
- `console` logging remains in application startup/request paths. No secret values were copied into the report.
- No dead-file/unused-code count is claimed. Dynamic route registration, entity registration, socket wiring, and scheduler imports make a no-reference search insufficient, and no exhaustive dead-code tool run was performed.

## 14. Environment and Deployment Audit

- No tracked `.env.example`, Dockerfile, or Docker Compose file was found.
- `frontend/src/services/api.ts` defaults `VITE_API_URL` to `http://localhost:3000`; `backend/config/config.ts` defaults the host to `127.0.0.1` and CORS origins to local development URLs. Deployment must override these values (DEP-01).
- Backend production validation requires an HTTPS `FRONTEND_URL` and rejects `DB_SYNCHRONIZE=true`, which are positive safeguards.
- `backend/package.json` provides `build` and `dev` scripts but no `start` script. The production launch command therefore is not defined in the package scripts (DEP-04).
- The `.env` file is not tracked in the repository inventory. Its values were not inspected directly; the selected excerpt was sufficient to raise the rotation warning.
- Health, graceful shutdown, structured logs/monitoring, backups, and disaster recovery were not validated in a deployed environment.

## 15. Automated Test Results

| Check | Result |
|---|---|
| Frontend typecheck (`pnpm --dir frontend typecheck`) | PASS |
| Frontend lint (`pnpm --dir frontend lint`) | PASS with 124 warnings |
| Frontend tests (`pnpm --dir frontend test`) | PASS — 344 tests, 0 failures |
| Frontend production build (Vite, temporary output directory) | PASS — 4,296 modules transformed |
| Backend typecheck (`pnpm --dir backend typecheck`) | PASS |
| Backend tests (`pnpm --dir backend test`) | PASS — 75 tests, 0 failures |
| Backend build (`pnpm --dir backend build`) | PASS |
| Frontend production dependency audit (`pnpm --dir frontend audit --prod`) | FINDINGS — 12 advisories; command exited nonzero |
| Backend production dependency audit (`pnpm --dir backend audit --prod`) | FINDINGS — 7 advisories; command exited nonzero |
| Live database/migration validation | NOT TESTED — no database migration or destructive database command was run |
| Browser end-to-end, production host, SMTP, Cloudinary, socket deployment | NOT TESTED — external/live infrastructure was not exercised |

Both dependency audits were read-only and did not update package manifests or lockfiles.

## 16. Broken Links and Broken API Inventory

| Method and path | Frontend surface | Backend registration | Status |
|---|---|---|---|
| `POST /api/notifications` | `createNotificationApi` in `frontend/src/services/api.ts` | No POST handler in `backend/routes/notification.routes.ts` | BROKEN if called; call-site usage not confirmed |

No other broken navigation path or endpoint was confirmed from the static route/helper inventory. Direct nested-route refresh and external deployment rewrites remain untested.

## 17. Database Integrity Findings

| Finding | Severity | Affected object | Status |
|---|---|---|---|
| DB-01: audit-log rollback could drop a pre-existing table/data | HIGH | `audit_logs`, migrations `179230...`, `179239...`, `179258...` | Fixed in source; isolated tests pass; production state unverified |

No actual production data was queried. Entity/migration parity, index effectiveness, and referential integrity under real data remain unverified.

## 18. Production Risks

1. Work-item permission checks may be bypassable through a forged project identifier (SEC-01).
2. Supplied IDE context exposed credential values; rotate if active (SEC-02).
3. Default network addresses are not deployable production values without explicit environment configuration (DEP-01).
4. Dependency audits reported high-severity issues in frontend and backend dependency trees (SEC-06/SEC-07).
5. Production migration state and database-level rollback behavior remain unverified after the DB-01 source fix.
6. Registration abuse/rate-limit distribution and process shutdown/scheduler behavior need hardening (SEC-03/OPS-01).
7. There is no package-level backend production start command (DEP-04).

## 19. Complete Issue Register

### SEC-01 — Item-scoped project authorization trusts request-body project ID

- **Severity:** HIGH
- **Affected feature:** Work-item authorization; project-role enforcement
- **Files:** `backend/middleware/project.permission.ts:192-207`; `backend/routes/work.item.routes.ts:49-55,107-112`; `backend/controllers/task.controller.ts:415-442`; `backend/services/work-item.service.ts:293-338`
- **Problem / evidence:** Static review found that the permission guard uses `req.body.projectId` before resolving the project from the work-item route parameter. Update and delete routes invoke the guard before the target item is established; delete has no body validator. The service checks organization and broad project access, but the reviewed path does not enforce the requested action against the actual target project's role.
- **Why it matters / impact:** A caller may provide a project ID where they have broader rights while targeting an item in another project in the same organization. This can bypass action-specific restrictions, including deletion. Cross-organization access was not established.
- **Reproduction:** Not live-reproduced. Static test hypothesis: as a user with weaker permissions on a target item's project, submit an item-scoped mutation with a different permitted project ID in the body and compare authorization outcomes.
- **Expected / actual:** Expected: action authorization derives from the persisted target item/project. Actual: the guard can consult the client-supplied project ID first.
- **Recommended fix:** Resolve the item and its project from the database, then enforce the requested action in the service/transaction; do not trust a body project ID for item-scoped actions. Add forged-ID regression tests for PATCH/DELETE and other mutations.
- **Related issues:** None. **Status:** Static identification; not reproduced.

### SEC-02 — Credentials were exposed in supplied IDE context

- **Severity:** HIGH, conditional on values being active
- **Affected feature:** Authentication, database, mail, and cloud-storage configuration
- **Files:** Supplied IDE selection referencing `backend/.env`; values omitted
- **Problem / evidence:** The IDE-selected excerpt included credential values. No values are repeated in this report and the file was not read directly for this audit.
- **Why it matters / impact:** If live, exposed credentials may permit token signing, database access, mail sending, or cloud-storage access.
- **Reproduction:** Already present in the context supplied with the request; this is not a source-code finding.
- **Expected / actual:** Expected: secrets remain private and are shared only through a secret manager. Actual: credential values appeared in the supplied selection.
- **Recommended fix:** Rotate any active values, invalidate affected sessions/tokens as appropriate, review provider access logs, and use managed secret storage. Confirm `.env` remains excluded from version control.
- **Related issues:** DEP-01. **Status:** Contextual exposure observed; operational impact not independently verified.

### DB-01 — Audit-log migration rollback can drop existing audit data

- **Severity:** HIGH
- **Affected feature:** Database migration rollback and audit history
- **Files:** `backend/migrations/1792300000000-AddFeaturePersistenceTables.ts`, `backend/migrations/1792399247543-AddProjectLabels.ts`, and `backend/migrations/1792584447276-CreateAuditLogs.ts`
- **Problem / evidence:** The `179230...` migration creates and owns `audit_logs`. The `179258...` migration skipped creation when the table existed but dropped it on rollback. The `179239...` rollback also dropped the table and its indexes despite only adding constraints to it.
- **Why it matters / impact:** Rolling back a migration that did not own `audit_logs` could remove the table and all audit history.
- **Reproduction:** Not run against a database. Isolated QueryRunner tests exercise the pre-existing-table, rollback, fresh-sequence, and owner-rollback cases.
- **Expected / actual:** The `179258...` migration is now a no-op, and the `179239...` rollback removes only its own audit-log constraints. The `179230...` migration remains responsible for creating and dropping the table.
- **Validation:** Five isolated migration tests pass; backend typecheck passes; full backend suite passes (84/84). A read-only check confirmed `179230...`, `179239...`, and `179258...` are recorded in the local TypeORM migrations table. Production migration state was not available.
- **Related issues:** No disposable PostgreSQL migration test was run; production state remains unverified. **Status:** Fixed in source and covered by isolated rollback tests.

### DEP-01 — Production network configuration defaults to local addresses

- **Severity:** HIGH
- **Affected feature:** Production frontend/backend connectivity and CORS
- **Files:** `frontend/src/services/api.ts:22-23`; `backend/config/config.ts:57-69`
- **Problem / evidence:** The frontend defaults its API base to `http://localhost:3000`; backend host and CORS origins default to loopback/local frontend origins. These are development defaults, not safe production defaults.
- **Why it matters / impact:** Without explicit deployment configuration, browsers call localhost on each user's own device, a remotely hosted backend binds only to loopback, and the production frontend origin is not allowed by CORS.
- **Reproduction:** Build/launch without `VITE_API_URL`, `HOST`, and `CORS_ORIGINS` overrides and inspect the resulting request origin/bind address. This was not tested against a production host.
- **Expected / actual:** Expected: production build and server use validated deployment URLs. Actual: local defaults are accepted for API/host/CORS settings.
- **Recommended fix:** Require a production API origin or use a same-origin reverse-proxy path; require an externally reachable bind address and explicit CORS origins in production; fail fast on missing/unsafe settings.
- **Related issues:** SEC-02, DEP-04. **Status:** Static identification.

### SEC-06 — Frontend production dependency tree has 12 audit advisories

- **Severity:** HIGH
- **Affected feature:** Frontend dependency supply chain (transitive Excalidraw/Mermaid stack)
- **Files:** `frontend/package.json`; `frontend/pnpm-lock.yaml`
- **Problem / evidence:** `pnpm audit --prod` reported 12 advisories: 7 high, 4 moderate, and 1 low. Affected transitive packages include `lodash-es`, `nanoid`, and `katex`; advisories include template code injection/prototype-pollution issues and non-secure or looping ID-generation cases.
- **Why it matters / impact:** Vulnerable transitive code may be included in the production bundle. Exploitability depends on actual package versions and whether affected functions/data are reachable; reachability was not independently tested.
- **Reproduction:** `pnpm --dir frontend audit --prod` exited nonzero and reported the advisories.
- **Expected / actual:** Expected: production dependency tree has no unaccepted known high-risk advisories. Actual: registry audit reports the above vulnerable ranges in the lockfile dependency tree.
- **Recommended fix:** Review advisory paths and resolved versions, update or constrain affected dependencies through supported upstream releases, then rebuild and re-audit. Do not apply blind overrides without compatibility tests.
- **Related issues:** DEP-01. **Status:** Automated dependency audit; runtime reachability not verified.

### SEC-07 — Backend production dependency tree has 7 audit advisories

- **Severity:** HIGH
- **Affected feature:** Backend request parsing, uploads, validation, and email
- **Files:** `backend/package.json`; `backend/pnpm-lock.yaml`
- **Problem / evidence:** `pnpm audit --prod` reported 7 advisories: 3 high and 4 moderate. High findings include `body-parser` denial-of-service, `multer` denial-of-service, and Joi email-validation denial-of-service advisories. Moderate findings include Nodemailer address parsing and `qs`.
- **Why it matters / impact:** Affected request or email parsing paths can create denial-of-service or recipient-parsing risks if attacker-controlled inputs reach vulnerable code. Reachability was not independently reproduced.
- **Reproduction:** `pnpm --dir backend audit --prod` exited nonzero and reported the advisories.
- **Expected / actual:** Expected: production dependency tree contains no unaccepted vulnerable versions. Actual: the audit found affected ranges.
- **Recommended fix:** Confirm exact resolved versions and usage, update to patched compatible releases, then run tests and repeat the audit.
- **Related issues:** SEC-03. **Status:** Automated dependency audit; runtime reachability not verified.

### SEC-03 — Public registration is unthrottled and limiter state is process-local

- **Severity:** MEDIUM
- **Affected feature:** Account/organization registration and abuse prevention
- **Files:** `backend/middleware/rate.limiter.ts:19-39`; `backend/routes/user.routes.ts:16-24`; `backend/controllers/user.controller.ts:86`
- **Problem / evidence:** Rate-limit state is held in an in-memory map. Login/reset routes use limits, while the public registration aliases do not. Registration performs bcrypt hashing.
- **Why it matters / impact:** Signup abuse can consume CPU and create unwanted accounts/organizations; limits reset on restart and do not coordinate across replicas. Proxy IP handling also depends on deployment proxy-trust configuration.
- **Reproduction:** Static route/middleware review; no load or abuse test was performed.
- **Expected / actual:** Expected: public account creation has abuse controls that work across production instances. Actual: no signup limiter was found, and current counters are process-local.
- **Recommended fix:** Add signup abuse controls and a shared rate-limit store; configure trusted proxy hops narrowly and test deployed client-IP behavior.
- **Related issues:** SEC-07. **Status:** Static identification.

### SEC-04 — Persistent bearer token is stored in localStorage

- **Severity:** MEDIUM
- **Affected feature:** Browser authentication/session storage
- **Files:** `frontend/src/services/api.ts:25-43,138-149`
- **Problem / evidence:** The frontend persists the bearer token in `localStorage` and attaches it to API requests.
- **Why it matters / impact:** Any successful same-origin script injection can read the stored token and use it until expiry/revocation.
- **Reproduction:** Static inspection; no XSS exploit or browser test was performed.
- **Expected / actual:** Expected: persistent credentials are protected from script access. Actual: bearer credentials are script-readable.
- **Recommended fix:** Prefer secure, HttpOnly, SameSite cookies for persistent credentials; if access tokens remain in the browser, keep them short-lived/in-memory and apply robust XSS defenses and CSP.
- **Related issues:** SEC-02. **Status:** Static identification.

### OPS-01 — Server shutdown does not explicitly handle OS signals or destroy the data source

- **Severity:** MEDIUM
- **Affected feature:** Scheduler, HTTP server, database lifecycle
- **Files:** `backend/server.ts:16-58`
- **Problem / evidence:** Scheduler startup is wired to server startup and stop calls exist on selected server events, but no explicit SIGINT/SIGTERM handler or `AppDataSource.destroy()` path was found in the server entry point.
- **Why it matters / impact:** Container/process termination may interrupt active work and leave scheduler/database resources without an orderly shutdown path.
- **Reproduction:** Static review only; no process termination test was run.
- **Expected / actual:** Expected: shutdown stops accepting requests, drains work, stops jobs, and closes database connections. Actual: no explicit coordinated signal-driven shutdown is present in the reviewed entry point.
- **Recommended fix:** Implement and test idempotent signal-driven graceful shutdown for HTTP, scheduler, sockets, and TypeORM.
- **Related issues:** SEC-03. **Status:** Static identification.

### DEP-04 — Backend production start command is not defined in package scripts

- **Severity:** MEDIUM
- **Affected feature:** Deployment/build operations
- **Files:** `backend/package.json`
- **Problem / evidence:** Backend scripts define `dev`, `build`, `test`, `typecheck`, and `seed`, but no production `start` script.
- **Why it matters / impact:** Deployment systems cannot rely on a documented package-level production launch command and may use inconsistent or incorrect entry points.
- **Reproduction:** Inspect backend package scripts; no production launch command is listed.
- **Expected / actual:** Expected: a documented command launches the built server. Actual: no `start` script is declared.
- **Recommended fix:** Add/document a production command for the compiled entry point and exercise it in deployment CI without using development tooling.
- **Related issues:** DEP-01, OPS-01. **Status:** Static identification.

### API-01 — Notification creation helper has no backend route; read failures can appear as empty state

- **Severity:** LOW
- **Affected feature:** Notifications
- **Files:** `frontend/src/services/api.ts:819-858`; `backend/routes/notification.routes.ts:16-19`
- **Problem / evidence:** `createNotificationApi` sends `POST /api/notifications`, while the registered router exposes GET and PATCH operations only. The read helpers also catch errors and return fallback objects that can be rendered as an empty notification list.
- **Why it matters / impact:** A caller of the create helper receives a 404; notification retrieval failures can be visually indistinguishable from an empty list. Current helper call-site usage was not confirmed.
- **Reproduction:** Static route/helper comparison; no browser request was run.
- **Expected / actual:** Expected: every exposed helper has a corresponding backend contract and errors remain visible. Actual: the POST route is absent and read errors are converted to fallback values.
- **Recommended fix:** Remove/replace the unused helper or implement an authorized server-side route if client creation is intended; surface retry/error state instead of treating failures as empty data.
- **Related issues:** None. **Status:** Static contract mismatch; call-site usage not verified.

### QUAL-01 — Frontend lint reports 124 warnings

- **Severity:** LOW
- **Affected feature:** Maintainability and change safety
- **Files:** Frontend source/tests; see `pnpm --dir frontend lint` output
- **Problem / evidence:** Oxlint completed with 124 warnings, including unused symbols and missing/unnecessary React hook dependencies.
- **Why it matters / impact:** Warnings can conceal stale closures, accidental dead code, or regressions and reduce the usefulness of lint in CI.
- **Reproduction:** Run `pnpm --dir frontend lint`; it exits successfully with warnings.
- **Expected / actual:** Expected: warning baseline is controlled and actionable. Actual: 124 diagnostics remain.
- **Recommended fix:** Triage hook-dependency warnings first, then remove confirmed unused symbols and establish a CI warning budget.
- **Related issues:** None. **Status:** Automated check.

## 20. Recommended Fixes

1. Fix SEC-01 by deriving every item-scoped authorization decision from the target database record.
2. Treat the supplied credentials as compromised if active; rotate them and check access logs (SEC-02).
3. Validate the DB-01 rollback fix against a disposable PostgreSQL database before deployment.
4. Require valid production network/CORS configuration and add an explicit backend production start command (DEP-01, DEP-04).
5. Resolve and patch the audited dependency paths, then rerun both dependency audits and all tests (SEC-06, SEC-07).
6. Add distributed signup throttling and explicit graceful shutdown (SEC-03, OPS-01).
7. Revisit browser token storage and the notification helper/error contract (SEC-04, API-01).
8. Reduce lint warning debt without auto-fixing unreviewed code (QUAL-01).

## 21. Prioritized Remediation Roadmap

| Phase | Work | Issue IDs / dependencies |
|---|---|---|
| **Phase 1 – Critical/high fixes** | Correct item-level authorization; rotate exposed credentials; validate migration rollback safety; patch high dependency advisories | SEC-01, SEC-02, DB-01, SEC-06, SEC-07 |
| **Phase 2 – High-priority functional/deployment fixes** | Require production API/host/CORS settings; verify all API contracts; resolve notification route mismatch; define production start command | DEP-01, API-01, DEP-04; SEC-01 must precede authorization sign-off |
| **Phase 3 – Reliability improvements** | Distributed signup limits; signal-driven graceful shutdown and coordinated scheduler/database closure; exercise SMTP/upload/socket failures | SEC-03, OPS-01; DEP-01 required for deployed tests |
| **Phase 4 – Code cleanup** | Triage lint warnings and unused symbols; strengthen API types and confirm dead code before removal | QUAL-01, API-01 |
| **Phase 5 – Performance and deployment** | Run query profiling/load tests, verify pagination/indexes, add deployment health/monitoring/backup validation, test horizontal scheduler behavior | SEC-03, OPS-01, DEP-01; requires staging database and representative workload |

## 22. Final Production Readiness Assessment

**Do not declare this application production-ready yet.** The passing type checks, builds, and tests are positive, but the authorization concern, supplied credential exposure, migration rollback risk, production-local defaults, and vulnerable dependency advisories require resolution or documented risk acceptance. Before launch, also verify the app against a disposable/staging PostgreSQL database, a production-like deployment, real browser flows, and external-service failure scenarios.

### Required completion metrics

| Metric | Result |
|---|---|
| Files inspected/inventoried | 227 tracked TypeScript/TSX source files inventoried; reviewers reported 44 direct file opens, plus my own reads (overlap not deduplicated); 138 tracked compiled JS files also appear in the broader 365-file code inventory |
| API route declarations inspected | 91 across 11 route files |
| Feature families statically reviewed | 16 |
| Automated checks executed | 9 (two dependency audits reported findings) |
| Findings | 6 HIGH, 4 MEDIUM, 2 LOW, 0 CRITICAL |
| Areas not verified | Live database/migrations, production hosting/CORS, browser E2E, SMTP/Cloudinary delivery, deployed socket behavior, load/scalability |
