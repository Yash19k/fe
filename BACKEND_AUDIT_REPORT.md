# Backend Audit Report

Audit date: 2026-10-26

## 1. Executive Summary

The reviewed code has high workflow risk. The registration and invitation API contracts used by the frontend do not match mounted backend routes; chat conversation listing is shadowed by an earlier route mount; and the SLA refresh worker repeatedly selects only the oldest 500 unfinished work items. Notification failures can also turn an already-committed operation into an apparent API failure.

| Severity | Count |
|---|---:|
| P0 — Critical | 0 |
| P1 — High | 5 |
| P2 — Medium | 10 |
| P3 — Low | 2 |
| **Total** | **17** |

| Confidence | Count |
|---|---:|
| Confirmed from code/contracts | 16 |
| Likely; failure condition was not reproduced against a live database | 1 |
| Needs runtime verification | 0 |

The dedicated read-only security review identified six access-control findings (three P1 and three P2), described below. Its initial review of the changed work-item permission/attachment surfaces found no additional issue there. No production database, SMTP server, Cloudinary account, or running application was accessed. The working tree was already dirty before the audit, including backend and frontend changes and untracked files; the report assesses the current working-tree contents, which may not match a deployed revision.

### Audit coverage and limitations

Reviewed the backend entry points and route registration; all route files; authentication, organization/invitation, project, work-item, sprint, dashboard, notification, chat, SLA, and audit workflow implementations; validators and middleware; selected related entities and migrations; backend tests; and frontend API calls/components for onboarding, work items, chat, project activity, and attachments. A dedicated security review examined authentication/session handling, organization membership, project/work-item routes, dashboard/audit, SLA/sprint, notifications, chat REST/WebSocket, configuration/migrations, and relevant frontend request contracts. Inspected migrations and entity definitions relevant to the work-item, attachment, invitation, SLA, and project-label workflows, but did not validate the full schema against a live database. Some backend files were inspected by responsibility and call path rather than exhaustively line-by-line.

## 2. Repository and Workflow Map

### Backend request lifecycle

`backend/server.ts` initializes the TypeORM PostgreSQL `DataSource`, starts SLA and recurrence schedulers, creates the HTTP server, and attaches the chat WebSocket gateway. `backend/app.ts` configures JSON/urlencoded parsing, CORS and cookies, mounts Express routers, and installs the centralized error handler. Routes selectively apply authentication, validation, and permission middleware before async controllers; several subresource routes lack project-scoped checks, as recorded below. Controllers use TypeORM repositories/transactions and services; responses are generally JSON envelopes.

| Area | Backend path / responsibility | Frontend evidence |
|---|---|---|
| Authentication and organization setup | `backend/routes/user.routes.ts`, `backend/controllers/user.controller.ts`, `backend/validations/user.validator.ts`; registration, login, refresh, current user, logout | `frontend/src/services/api.ts`, `frontend/src/features/onboarding/CompanySetupView.tsx` |
| Organization members and invitations | `backend/routes/organization.routes.ts`, `backend/controllers/organization.controller.ts`, `backend/controllers/member-invitation.controller.ts`, `backend/services/member-invitation.service.ts` | `frontend/src/services/api.ts`, `frontend/src/features/onboarding/CompanySetupView.tsx` |
| Projects and memberships | `backend/routes/project.routes.ts`, `backend/controllers/project.controller.ts`, `backend/middleware/check.permissions.ts` | `frontend/src/services/api.ts`, project views |
| Work items and collaboration | `backend/routes/work.item.routes.ts`, `backend/controllers/task.controller.ts`, `backend/controllers/feature-persistence.controller.ts`; comments, time entries, dependencies, labels, workflow, audit | `frontend/src/services/api.ts`, task/project components, `frontend/src/state/AppContext.tsx` |
| Sprints and dashboards | `backend/routes/sprint.routes.ts`, `backend/controllers/sprint.controller.ts`, `backend/routes/dashboard.route.ts`, `backend/controllers/dashboard.controller.ts` | `frontend/src/services/api.ts`, project dashboards |
| SLA, recurrence, attachments | `backend/services/sla.service.ts`, `backend/services/recurrence.service.ts`, `backend/services/scheduler.service.ts`, attachment middleware/service and Cloudinary integration | task and attachment components/API calls |
| Notifications | `backend/routes/notification.routes.ts`, `backend/controllers/notification.controller.ts`, `backend/services/notification.service.ts` | `frontend/src/services/api.ts`, notification UI |
| Chat | `backend/routes/chat.routes.ts`, `backend/controllers/chat.controller.ts`, `backend/services/chat.service.ts`, `backend/websocket/chat.gateway.ts` | `frontend/src/features/chat/ChatView.tsx`, `frontend/src/services/api.ts` |

The frontend API client sends JSON requests to `VITE_API_URL` (defaulting to localhost), stores an access token in local storage, and attempts cookie-based refresh after a 401. The backend also uses HTTP-only cookies. The route and payload contracts are not consistent across several onboarding, invitation, chat, and audit surfaces; see findings below.

## 3. Critical and High-Priority Findings

### [B-01] [P1] Frontend organization registration targets an unmounted route

- **Confidence:** Confirmed
- **Category:** Correctness / API contract
- **Affected backend files:** `backend/app.ts:38`, `backend/routes/user.routes.ts:9`, `backend/validations/user.validator.ts:67-77`
- **Related frontend evidence:** `frontend/src/services/api.ts:170-175`; `frontend/src/features/onboarding/CompanySetupView.tsx:88-106`
- **Problem:** The frontend posts to `/api/users/register`, but the mounted user router only registers `POST /` (which resolves to `POST /api/users`). No `/register` route is mounted. The onboarding view catches/logs the registration failure and continues to save the company in local application state, so the user can appear onboarded without a backend organization, user, or session.
- **Root cause:** The route contract and frontend call path have drifted; the caller also treats backend registration failure as a non-blocking notice.
- **Impact:** Backend-backed registration does not complete from the current onboarding workflow. Local state can claim success while backend state is absent, causing later authenticated calls to fail or target a different user/org.
- **Failure scenario:** Submit company setup in the frontend; the request to `/api/users/register` receives an unmatched-route response; the UI continues through onboarding without creating backend records.
- **Recommended backend-only fix:** Add and test a compatibility registration route at the path the existing client calls, delegating to the canonical registration implementation. Preserve the existing nested `{ user, organization }` payload accepted by `onboardingSchema`, and return the response fields consumed by the client. Avoid maintaining a second independent registration implementation.
- **Separation of concerns:** Consolidate organization/user/SLA/session creation into one registration service; keep route-specific compatibility aliases thin.
- **Compatibility and migration risks:** Preserve `/api/users/` for existing consumers. Ensure the compatibility route does not change password, cookie, or response semantics. No schema migration is required.
- **Tests to add:** HTTP integration test for `POST /api/users/register` with the frontend payload; assert one organization, admin user, default SLA policy, and valid session; assert validation and duplicate-email responses; verify the current frontend onboarding contract.
- **Effort:** Small

### [B-02] [P1] Invitation endpoints and payloads do not match the frontend contract

- **Confidence:** Confirmed
- **Category:** Correctness / API contract
- **Affected backend files:** `backend/app.ts:38-42`, `backend/routes/organization.routes.ts:18-24`, `backend/controllers/member-invitation.controller.ts:12-27, 30-34`
- **Related frontend evidence:** `frontend/src/services/api.ts:226-239`; `frontend/src/features/onboarding/CompanySetupView.tsx:196-204`
- **Problem:** The client posts invitations to `/api/users/invite` with `{ invitations: [...] }`, while the backend exposes invitation endpoints under `/api/organization(s)/members/invite` and accepts either an array or `{ members: [...] }`. The client also posts acceptance to `/api/users/accept-invitation?token=...`, while the backend exposes `POST /api/organization(s)/accept` and requires `token` in the request body. Neither client path is mounted, and the invitation body shape is rejected by the backend schema.
- **Root cause:** Independent endpoint and request-shape changes were not kept in sync across the API surface.
- **Impact:** Team invitations and invitation acceptance fail through the current frontend workflow. The onboarding component catches invitation errors, making the failure easy to mistake for a successful local-only step.
- **Failure scenario:** Submit one or more invitations from onboarding; the request receives a route error. If the route alone were aliased, `{ invitations }` would still fail validation. Acceptance similarly misses the route and omits the required body token.
- **Recommended backend-only fix:** Provide compatibility aliases for the existing client paths and normalize `{ invitations }` to the canonical members list. For acceptance, read and validate the token in the same location the existing client sends it, or provide a compatible alias that safely transfers it to the canonical service. Keep one canonical service implementation and return explicit per-recipient outcomes.
- **Separation of concerns:** Keep payload normalization in a thin route/controller adapter; keep invite lifecycle and persistence in `member-invitation.service.ts`.
- **Compatibility and migration risks:** Keep current `/api/organization(s)/members/invite` and `/api/organization(s)/accept` routes working. Do not silently elevate roles or alter the current invitation credential policy while adding aliases.
- **Tests to add:** Route-level tests for both canonical and compatibility paths; accepted/rejected schema cases; multiple invitation payloads; acceptance token in the client’s current location; API response shape tests.
- **Effort:** Medium

### [B-12] [P1] Organization-wide member-management permission allows project-admin escalation

- **Confidence:** Confirmed (static review; confidence 9/10)
- **Category:** Security / Authorization
- **Affected backend files:** `backend/routes/project.routes.ts:86-109`; `backend/controllers/project.controller.ts:311-359,435-465`
- **Related frontend evidence:** `frontend/src/services/api.ts` project-member API methods
- **Problem:** Project membership mutation routes use the organization-wide `project:member:manage` permission. The controller checks that the target user belongs to the organization, but does not verify that the caller has authority in the particular project before assigning project `ADMIN`. The role-update handler also persists the requested role without enforcing the project-admin-only restriction.
- **Root cause:** Organization-level role permission is treated as sufficient for project-scoped privilege assignment.
- **Impact:** A manager who is not a member of a private project can add themselves as a project administrator, then gain the project-admin permissions.
- **Failure scenario:** An organization manager who knows a private project ID calls `POST /api/projects/:projectId/members` with their own member ID and `role: "ADMIN"`.
- **Recommended backend-only fix:** Require project-scoped authorization for membership mutations and permit only an authorized project administrator to grant the `ADMIN` role. Enforce the rule inside the transaction/controller as well as in route middleware.
- **Separation of concerns:** No extraction required; use the existing project-permission mechanism if it can express the grant restriction without bypassing organization scoping.
- **Compatibility and migration risks:** Existing project membership roles remain unchanged. Verify organization-admin and project-admin management behavior before tightening other roles.
- **Tests to add:** Non-member manager cannot add self as project admin; member/lead cannot promote another member to admin; authorized project admin can grant/demote roles; cross-organization project ID remains not found.
- **Effort:** Medium

### [B-13] [P1] Audit endpoints allow unauthorized log reads and client-forged undo state

- **Confidence:** Confirmed (static review; confidence 9/10)
- **Category:** Security / Authorization / Data integrity
- **Affected backend files:** `backend/routes/project.routes.ts:153-176`; `backend/controllers/feature-persistence.controller.ts:556-614`; `backend/controllers/auditlog.controller.ts:87-190`
- **Related frontend evidence:** `frontend/src/services/api.ts` audit-log create/read/undo methods
- **Problem:** Audit creation accepts client-supplied entity IDs and previous state. Undo loads the log and applies its supplied `previousState` to a same-organization task without checking project membership. Audit reads are authenticated but do not enforce membership in the requested private project.
- **Root cause:** Audit data supplied by clients is trusted as reversible state, and audit routes do not consistently apply project-scoped authorization.
- **Impact:** A same-organization user can inspect private-project audit history and create a forged reversible record that changes a task when undone.
- **Failure scenario:** An authenticated user posts an audit event naming a task they do not manage and a crafted `previousState`, then invokes undo by log ID; alternatively, they query a known private project ID for its audit history.
- **Recommended backend-only fix:** Require project-scoped authorization for audit reads and undo. Only allow undo for server-generated reversible events, and derive the state to restore from trusted server-side snapshots. Validate that the log, project, and target entity are related and in the caller’s authorized project.
- **Separation of concerns:** No extraction required for the authorization fix; a server-owned audit/undo service may be introduced if it centralizes trusted snapshot creation.
- **Compatibility and migration risks:** Existing client-generated audit entries may not have trustworthy snapshots. Preserve historical read access for authorized members while disabling unsafe undo of legacy/untrusted records.
- **Tests to add:** Cross-project read/undo denial; forged client state cannot mutate a task; valid server-generated undo remains atomic and single-use; cross-organization IDs do not reveal existence.
- **Effort:** Medium

### [B-14] [P1] Removing an organization member leaves sessions usable and tenant-scoped audit checks fail open

- **Confidence:** Confirmed (static review; confidence 9/10)
- **Category:** Security / Authorization
- **Affected backend files:** `backend/controllers/organization.controller.ts:403-427`; `backend/middleware/is.loggedin.ts:84-105`; `backend/controllers/auditlog.controller.ts:115-117,153-168,308-358`
- **Related frontend evidence:** Organization member removal and authenticated API calls in `frontend/src/services/api.ts`
- **Problem:** Member removal detaches the user from the organization but does not revoke their refresh sessions. Authentication accepts an active user whose current organization is absent. Audit handlers apply tenant equality only when an organization ID exists, so the detached account skips the tenant guard.
- **Root cause:** Membership removal is not coupled to session revocation, and audit handlers treat missing tenant context as permission to omit tenant checks.
- **Impact:** A removed user can retain authenticated access and, with known project/log identifiers, access or undo audit-associated task changes outside their former organization.
- **Failure scenario:** An administrator removes a member; the member reuses an existing access/refresh session and requests another organization’s known audit/project resource.
- **Recommended backend-only fix:** Revoke all sessions for the removed user in the same transaction; require current organization context for tenant-scoped routes; make audit handlers fail closed when tenant context is missing.
- **Separation of concerns:** No extraction required.
- **Compatibility and migration risks:** Detached users may be intended to retain standalone accounts, so revoke only organization-bound sessions and require a new valid organization association for tenant data.
- **Tests to add:** Remove member then reuse access and refresh tokens; verify organization-scoped routes reject users without an organization; verify audit read/undo cannot proceed without tenant context.
- **Effort:** Medium

## 4. Complete Findings Register

### [B-03] [P2] Invitation acceptance expects a token the invite service never issues

- **Confidence:** Confirmed
- **Category:** Correctness / Reliability
- **Affected backend files:** `backend/services/member-invitation.service.ts:64-89, 129-168`; `backend/controllers/member-invitation.controller.ts:30-34, 110-120`
- **Related frontend evidence:** `frontend/src/services/api.ts:235-239`
- **Problem:** `inviteOrganizationMembers` creates users with `status: ACTIVE`, `inviteTokenHash: null`, and `inviteExpiresAt: null`; it sends a temporary password. `acceptOrganizationInvitation`, by contrast, looks up a hashed invitation token and requires a pending user. No reviewed invitation path writes the hash/expiry or pending status.
- **Root cause:** Two incompatible onboarding designs coexist: temporary-password activation and token-based acceptance.
- **Impact:** A token-based acceptance request can never succeed for a user created by the current invite service.
- **Failure scenario:** An invitee follows a token-acceptance flow for an account created through `inviteOrganizationMembers`; lookup fails because the token hash was never stored and the account is already active.
- **Recommended backend-only fix:** Choose and implement one lifecycle end to end. Either persist a pending user with a hashed, expiring, single-use token and use the acceptance handler, or remove the unused token-acceptance path and support the temporary-password flow consistently. Do not store raw invitation tokens.
- **Separation of concerns:** No extraction required beyond keeping lifecycle state transitions in the invitation service.
- **Compatibility and migration risks:** Existing active users created by temporary-password invitations must remain usable. A lifecycle change may need a safe re-invitation or password-reset strategy; do not invalidate existing credentials without a migration plan.
- **Tests to add:** Invite → token acceptance success; wrong/expired/reused token rejection; atomic single-use acceptance; compatibility test for existing active accounts.
- **Effort:** Medium

### [B-04] [P2] Failed invitation email leaves an inaccessible active account

- **Confidence:** Confirmed
- **Category:** Data integrity / Reliability
- **Affected backend files:** `backend/services/member-invitation.service.ts:64-119`
- **Related frontend evidence:** `frontend/src/services/api.ts:226-233`; onboarding catches and reports invitation errors at `frontend/src/features/onboarding/CompanySetupView.tsx:196-204`
- **Problem:** The service persists an active user with a random temporary-password hash before sending the email. If email submission fails, the catch returns `emailSent: false`; the plaintext temporary password is discarded, and the account has no invitation token or pending state. Duplicate checks then prevent the same address from being invited again.
- **Root cause:** Account creation commits before delivery succeeds, without a retryable credential/invitation record or a recovery operation.
- **Impact:** The user record blocks future invitations but the recipient cannot log in; an admin has no documented retry path in the reviewed API.
- **Failure scenario:** SMTP configuration or delivery fails after the account transaction commits. The API reports a failed email, but leaves an active account with an unknown password.
- **Recommended backend-only fix:** Use the token-based pending-user lifecycle with a persisted hashed token and resend/expiry behavior, or persist an outbox entry that retries delivery of a recoverable invitation. Never retain plaintext passwords in logs or responses.
- **Separation of concerns:** Extract invitation delivery/retry orchestration into a service using durable outbox state; leave role/email validation in the controller.
- **Compatibility and migration risks:** Existing active users with unknown temporary passwords need a safe recovery path. Avoid deleting accounts or relying on destructive cleanup.
- **Tests to add:** SMTP unavailable after persistence; subsequent resend succeeds; duplicate invitation recovery; verify no plaintext credential is persisted or logged.
- **Effort:** Medium

### [B-05] [P2] Chat conversation-list route is shadowed by the earlier mount

- **Confidence:** Confirmed
- **Category:** Correctness / API contract
- **Affected backend files:** `backend/app.ts:46-47`; `backend/routes/chat.routes.ts:19-21`; `backend/controllers/chat.controller.ts:40-53, 74-78`
- **Related frontend evidence:** `frontend/src/services/api.ts:645-646`; `frontend/src/features/chat/ChatView.tsx:37-44`
- **Problem:** `chatRoutes` is mounted first at `/api/chat`, then again at `/api/chat/conversations`. A `GET /api/chat/conversations` request reaches the first mount as `GET /:conversationId`; the controller validates the literal `conversations` as a UUID and responds with 400 before Express can reach the intended collection route in the second mount.
- **Root cause:** Overlapping router aliases are registered in an order that causes the generic parameter route to match the collection path.
- **Impact:** The frontend cannot load its conversation list from the URL it uses; chat appears empty or errors on initial load.
- **Failure scenario:** Open Chat; `getChatConversationsApi()` calls `/api/chat/conversations`; `getConversationController` rejects `conversations` as an invalid UUID.
- **Recommended backend-only fix:** Mount the more specific `/api/chat/conversations` router before `/api/chat`, or replace aliases with a single unambiguous route layout. Keep the existing message and conversation resource paths compatible.
- **Separation of concerns:** No extraction required.
- **Compatibility and migration risks:** Verify all three current aliases (`/api/conversations`, `/api/chat`, `/api/chat/conversations`) before removing or reordering mounts.
- **Tests to add:** Express integration tests for list, create, fetch-by-id, messages, and member operations through every supported mount.
- **Effort:** Small

### [B-06] [P2] SLA refresh permanently starves work items beyond the oldest 500

- **Confidence:** Confirmed
- **Category:** Correctness / Performance
- **Affected backend files:** `backend/services/sla.service.ts:206-213`; scheduler invocation at `backend/services/scheduler.service.ts:25-47`
- **Related frontend evidence:** SLA deadline and escalation data are consumed as part of work-item views; no frontend behavior is needed to trigger the worker defect.
- **Problem:** Each refresh selects unfinished items ordered by immutable `createdAt ASC` and takes 500. There is no cursor, offset, eligibility predicate, or skip of unchanged rows. If more than 500 unfinished items exist, the same oldest 500 can be selected every minute, leaving later items unrefreshed indefinitely.
- **Root cause:** A fixed first-page batch is used as a recurring worker queue without an advancement mechanism.
- **Impact:** Items outside the selected prefix may not transition to breached/escalated states or generate SLA history/notifications when due.
- **Failure scenario:** Create more than 500 unfinished items; keep the first 500 unchanged; allow a later item’s deadline to pass. Every invocation still selects the first 500.
- **Recommended backend-only fix:** Process a bounded advancing cursor/batch, or select only due/state-stale candidates with an indexed eligibility predicate and repeat until no eligible rows remain. Preserve row locking and transaction boundaries, and ensure concurrent workers do not duplicate effects.
- **Separation of concerns:** No extraction required for the fix; consider a dedicated candidate-query helper only if shared by multiple worker operations.
- **Compatibility and migration risks:** A new candidate predicate may require an index. Verify how manually escalated, resolved, completed, and no-priority items are treated before changing eligibility.
- **Tests to add:** More than 500 unfinished records with an eligible record after the first 500; batch advancement; concurrent workers; exactly-once audit/notification state transitions.
- **Effort:** Medium

### [B-07] [P2] Audit-log pagination is not implemented end to end

- **Confidence:** Confirmed
- **Category:** Correctness / API contract / Performance
- **Affected backend files:** `backend/controllers/feature-persistence.controller.ts:422-449, 501-554`
- **Related frontend evidence:** `frontend/src/services/api.ts:569-588`; `frontend/src/features/project/ProjectActivityView.tsx:31-45`; `frontend/src/features/project/ProjectSettingsView.tsx:523-536`
- **Problem:** The backend always takes at most 150 audit rows, does not read `page` or `limit`, and returns no pagination metadata. The UI calls the API helper with page and limit and expects `pagination`; the helper accepts only `projectId` and constructs a URL without query parameters. Frontend type-check/tests confirm this mismatch.
- **Root cause:** Pagination was added to the views without implementing the corresponding request/response contract in the API helper and backend.
- **Impact:** Users cannot navigate audit history beyond the fixed 150 rows. The UI may show pagination controls without usable server pages; the current TypeScript build also rejects the three-argument call.
- **Failure scenario:** A project has more than 150 audit events; request a later page from the view. The request contains no page/limit, and the server returns the same latest 150 events with no pagination metadata.
- **Recommended backend-only fix:** Validate bounded `page`/`limit`, apply stable ordering with a unique tie-breaker, and return total/page metadata in the response. The current client helper does not send those query parameters, so a backend-only change cannot complete the contract; this limitation is recorded here without recommending frontend edits.
- **Separation of concerns:** Keep audit event mapping separate from query/pagination construction if the controller is split.
- **Compatibility and migration risks:** Preserve the current `success` and `data` fields; pagination additions should be additive. Avoid loading every task ID in a large project solely to build the audit query.
- **Tests to add:** First/last page, stable order for same timestamps, bounds/defaults, total count, and more than 150 events; verify an HTTP request carrying page/limit.
- **Effort:** Medium

### [B-08] [P2] Chat summaries issue two additional database queries per conversation

- **Confidence:** Confirmed
- **Category:** Performance
- **Affected backend files:** `backend/services/chat.service.ts:117-151`
- **Related frontend evidence:** `frontend/src/features/chat/ChatView.tsx:37-44`
- **Problem:** `listConversations` loads the conversation/member list, then runs one last-message query and one unread-count query for each conversation. There is no limit on the initial conversation query.
- **Root cause:** Summary data is computed with per-row repository calls rather than grouped/batched query results.
- **Impact:** Query count grows approximately as `1 + 2N` for a user with N conversations; large histories increase latency and database load.
- **Failure scenario:** A member with many direct/project conversations loads chat; each list refresh fans out into separate message and count queries.
- **Recommended backend-only fix:** Use a bounded conversation page and fetch last-message/unread aggregates in batched grouped queries or a single suitable database query. Keep message ordering deterministic and unread counts consistent with `lastReadAt`.
- **Separation of concerns:** Extract summary aggregation into `services/chat.service.ts` helper or a chat query/repository module; return the same summary shape.
- **Compatibility and migration risks:** Preserve existing response fields and ordering. An index may be warranted on message conversation/time/deletion columns after checking existing migrations.
- **Tests to add:** Query-count test for multiple conversations; last-message ordering; unread count around read timestamps; pagination boundaries.
- **Effort:** Medium

### [B-09] [P2] Post-commit notification failure can make a successful work-item write appear to fail

- **Confidence:** Likely; the failure path is evident in code but was not reproduced against a live database
- **Category:** Reliability / Data integrity
- **Affected backend files:** `backend/controllers/task.controller.ts:411-443, 646-664, 1137-1144`; `backend/services/notification.service.ts:26-75`; SLA notification call in `backend/services/sla.service.ts:292-324`
- **Related frontend evidence:** Work-item create/update calls in `frontend/src/services/api.ts` and `frontend/src/state/AppContext.tsx`
- **Problem:** Work-item creation commits its transaction before awaiting assignment notifications. If notification persistence fails, the request rejects and returns an error after the work item is durable. The update path has the same pattern. Separately, SLA refresh writes notifications inside its transaction; a notification error can roll back the batch’s SLA updates.
- **Root cause:** Notification side effects are coupled to request success after commit in one path and to the main state transaction in another.
- **Impact:** A client may retry a create that already committed, creating duplicates; a failing recipient/notification insert can also prevent SLA progress for a batch.
- **Failure scenario:** Work-item transaction commits, then a notification insert fails; the endpoint returns an error although the item exists. In the SLA job, one notification failure aborts the transaction and causes repeated retries.
- **Recommended backend-only fix:** Persist notification/outbox intents atomically with the primary state change, then deliver/retry them asynchronously. If notifications are explicitly best-effort instead, log failures with identifiers and return success only after the primary operation has committed; do not swallow errors silently.
- **Separation of concerns:** Extract notification intent creation and delivery into a dedicated service/worker; keep the controller responsible for HTTP status and response.
- **Compatibility and migration risks:** An outbox requires a migration and worker lifecycle/retention policy. Keep notification type, recipient, and deduplication semantics stable.
- **Tests to add:** Notification insert failure after work-item commit; no duplicate item on client retry; outbox retry/idempotency; failure isolation across SLA candidates.
- **Effort:** Medium

### [B-10] [P3] Frontend health check uses a path the backend does not expose

- **Confidence:** Confirmed
- **Category:** Correctness / Operations
- **Affected backend files:** `backend/app.ts:55-62`
- **Related frontend evidence:** `frontend/src/services/api.ts:147-153`
- **Problem:** The backend exposes `GET /` as its health-like response, while the frontend calls `GET /health` and expects a `status` field. No `/health` route was found in the reviewed backend routes.
- **Root cause:** Health-check route and response shape differ between the client and server.
- **Impact:** `checkBackendHealth()` returns false for a running backend, so UI service status can be misleading and diagnostics can report an unavailable API.
- **Failure scenario:** Run the backend and call the frontend health helper; the unmatched `/health` request is caught and converted to `false`.
- **Recommended backend-only fix:** Add a dedicated `GET /health` response with the status shape already expected by the client; optionally expose readiness separately if database connectivity must be checked.
- **Separation of concerns:** No extraction required.
- **Compatibility and migration risks:** Keep `GET /` unchanged. A liveness endpoint should not expose configuration or sensitive dependency details.
- **Tests to add:** Route integration test for status code/body; readiness behavior when the database is unavailable, if readiness is added.
- **Effort:** Small

### [B-11] [P3] Backend feature controllers combine unrelated persistence responsibilities

- **Confidence:** Confirmed
- **Category:** Architecture
- **Affected backend files:** `backend/controllers/feature-persistence.controller.ts:24-556, 801-872`; `backend/controllers/task.controller.ts:411-664`
- **Related frontend evidence:** `frontend/src/services/api.ts` exposes independent work-item, project-settings, audit, and notification APIs.
- **Problem:** `feature-persistence.controller.ts` contains independent comment, time-entry, dependency, label, workflow, audit, and notification operations. `createWorkItem` in `task.controller.ts` coordinates HTTP parsing, validation, project/parent/sprint/label checks, writes, SLA initialization, recurrence setup, assignment persistence, response projection, and notifications.
- **Root cause:** Controllers own both HTTP handling and substantial feature-specific persistence/orchestration, while unrelated controller operations have accumulated in a single module.
- **Impact:** Changes to one feature are harder to test in isolation; duplicate validation/response logic and accidental transaction/side-effect coupling become more likely. File length alone is not the issue—the responsibility boundaries are distinct.
- **Failure scenario:** A change to audit or label persistence must be edited in the same module as comment/time-entry/dependency operations; work-item transaction changes must also navigate notification and recurrence logic in the request controller.
- **Recommended backend-only fix:** Split controllers by resource boundary and move work-item orchestration to a service. Keep HTTP request validation, status codes, and response envelopes in controllers. Do not change URLs or response shapes during the extraction.
- **Separation of concerns:** Detailed plan is in Section 5.
- **Compatibility and migration risks:** Maintain route exports and response compatibility; preserve transaction ownership and side-effect ordering. Implement in small steps with characterization tests.
- **Tests to add:** Controller contract tests plus service unit/integration tests for work-item creation, audit retrieval, labels/workflow, comments, time entries, and dependencies.
- **Effort:** Large

### [B-15] [P2] Work-item comments, time entries, and dependencies lack complete project/tenant authorization

- **Confidence:** Confirmed (static review; confidence 9/10)
- **Category:** Security / Authorization
- **Affected backend files:** `backend/routes/work.item.routes.ts:114-160`; `backend/controllers/feature-persistence.controller.ts:24-80,104-180,188-245`
- **Related frontend evidence:** Work-item comments, time-entry, and dependency API methods in `frontend/src/services/api.ts`
- **Problem:** These routes require authentication but do not apply the project-permission middleware. Comment handlers check only organization equality; time-entry and dependency handlers do not consistently verify tenant/project access for the work item and both sides of a dependency.
- **Root cause:** Subresource handlers rely on authentication or incomplete resource checks rather than the same project-scoped access policy used for work-item routes.
- **Impact:** A user with a known work-item ID may read or write collaboration data for a private project, and dependency IDs may be used without confirming both items are authorized and related as intended.
- **Failure scenario:** An authenticated non-member calls a comment, time-entry, or dependency endpoint using a known private-project work-item ID; malformed/cross-tenant dependency IDs are also submitted.
- **Recommended backend-only fix:** Apply project-scoped authorization to every subresource route and resolve the work item within the authenticated organization/project before any read/write. For dependencies, validate both work items’ organization and project relationship within the same transaction.
- **Separation of concerns:** No extraction required.
- **Compatibility and migration risks:** Existing authorized project members retain API behavior. Return non-enumerating not-found responses for inaccessible resources.
- **Tests to add:** Unauthorized private-project read/write cases for each endpoint; cross-tenant work-item IDs; cross-project dependency; authorized member success.
- **Effort:** Medium

### [B-16] [P2] Project labels and workflows can be modified without project-scoped authorization

- **Confidence:** Confirmed (static review; confidence 9/10)
- **Category:** Security / Authorization
- **Affected backend files:** `backend/routes/project.routes.ts:112-149`; `backend/controllers/feature-persistence.controller.ts:252-305,323-405`
- **Related frontend evidence:** Project labels and workflow API methods in `frontend/src/services/api.ts`
- **Problem:** Label handlers are mounted with authentication only. Workflow handlers use a global project-update role check, then read/write by project ID without verifying the project belongs to the caller’s organization or that the caller has project membership/permission.
- **Root cause:** Resource mutation routes do not apply the project-scoped authorization and tenant checks used elsewhere.
- **Impact:** An authenticated user can modify labels or workflow configuration for a project they do not control, including a project in another tenant if its identifier is known.
- **Failure scenario:** Submit a label create/delete or workflow update using a known project ID without membership in that project.
- **Recommended backend-only fix:** Resolve the project under the authenticated organization and enforce the appropriate project-scoped permission before every label/workflow read or mutation.
- **Separation of concerns:** No extraction required.
- **Compatibility and migration risks:** Preserve existing roles’ documented project-settings behavior while denying unauthorized users; no schema change is required.
- **Tests to add:** Non-member and cross-tenant reads/writes denied; authorized project admin/lead actions; public project read behavior does not grant mutation permission.
- **Effort:** Medium

### [B-17] [P2] Removed chat members remain subscribed to live WebSocket rooms

- **Confidence:** Confirmed (static review; confidence 9/10)
- **Category:** Security / Sensitive data exposure
- **Affected backend files:** `backend/services/chat.service.ts:173-176`; `backend/websocket/chat.gateway.ts:138-145,164-176`
- **Related frontend evidence:** Chat membership and message flows in `frontend/src/features/chat/ChatView.tsx`
- **Problem:** Removing a member deletes the database membership but does not evict that user’s already-connected socket from the in-memory room. Message broadcasts iterate room sockets without rechecking membership.
- **Root cause:** REST membership changes and WebSocket room state are not synchronized; delivery trusts stale socket subscriptions.
- **Impact:** A removed user continues receiving messages sent to the conversation until their socket disconnects.
- **Failure scenario:** A member joins a group conversation over WebSocket, an authorized manager removes them over REST, and another member sends a message while the removed user’s socket remains connected.
- **Recommended backend-only fix:** Evict all sockets for the removed user from the conversation room when membership is removed, or revalidate membership before each broadcast. Ensure the synchronization works across all application instances if WebSockets are deployed horizontally.
- **Separation of concerns:** Extract a small room-membership coordination method shared by the WebSocket gateway and chat membership service if the current process-local map cannot be safely updated from the service.
- **Compatibility and migration risks:** For multi-instance deployments, process-local eviction is insufficient; use shared pub/sub or revalidation. Current message API and event shapes can remain unchanged.
- **Tests to add:** Remove a connected member, send a subsequent message, and assert no broadcast reaches that socket; verify active members continue receiving messages; test multi-instance behavior if applicable.
- **Effort:** Medium

## 5. Separation-of-Concerns Refactoring Plan

| Current file/function | Current responsibility | Recommended extraction | Proposed module/function | Benefit | Dependencies and tests |
|---|---|---|---|---|---|
| `backend/controllers/task.controller.ts` — `createWorkItem` | HTTP body interpretation plus project/resource validation, transactional writes, assignments, SLA, recurrence, and notification effects | Extract application orchestration while retaining HTTP boundary | `backend/services/work-item.service.ts` — `createWorkItem(manager, actor, input)` returning a typed result/DTO; separate notification intent service | Smaller controller; test transaction and business rules without Express; makes side-effect consistency explicit | TypeORM `EntityManager`, SLA/recurrence helpers, assignment and notification services. Add service transaction tests and controller response tests. |
| `backend/controllers/feature-persistence.controller.ts` — comments/time entries/dependencies | Several independent work-item collaboration operations | Split by resource while preserving current route behavior | `controllers/work-item-collaboration.controller.ts`; service methods such as `addComment`, `recordTimeEntry`, `addDependency` | Changes to one feature no longer affect unrelated persistence code; clearer test fixtures | Existing entities/repositories and `AppError`; tests for each endpoint and validation/failure paths. |
| `backend/controllers/feature-persistence.controller.ts` — labels/workflow | Project configuration and workflow persistence | Separate project configuration | `controllers/project-settings.controller.ts` and, only if business rules grow, `services/project-workflow.service.ts` | Establishes a clear ownership boundary and allows workflow validation to be tested independently | `ProjectLabel`, `ProjectWorkflow`; tests for create/update/default workflow and unchanged API envelopes. |
| `backend/controllers/feature-persistence.controller.ts` — audit retrieval/create | Audit query, event mapping, and HTTP response | Use existing audit controller as sole route owner; extract query/projection only if reusable | `controllers/auditlog.controller.ts` plus optional `services/audit-log-query.service.ts` | Avoids audit logic sharing a module with labels/comments and clarifies pagination/query responsibilities | `AuditLog`, `WorkItem`, pagination helper; query and contract tests. |
| `backend/services/chat.service.ts` — `listConversations` | Conversation list plus per-conversation summary query fan-out | Extract batched summary query | `services/chat.service.ts` helper or `repositories/chat-query.repository.ts` — `listConversationSummaries(actor, page)` | Bounded query count and a testable summary contract | Conversation/member/message repositories; query-count, ordering, unread and pagination tests. |

### Detailed extraction guidance

**Work-item creation.** Keep authentication extraction, request validation middleware, response status/envelope, and HTTP error propagation in `createWorkItem` (or a thin replacement controller). Move domain orchestration to a service accepting a transaction manager, a typed actor (`id`, organization, role), and validated create input. The service should validate linked project resources in the same transaction, persist the work item, assignments, SLA state/audit, and recurrence record, and return the persisted work item with relations needed for response formatting. Notification delivery should be represented as a durable intent/outbox write in that same transaction rather than an awaited network/secondary write after commit. Throw typed `AppError`s for validation/not-found conflicts and let the controller/error middleware format them. Preserve existing status codes and JSON shape. Test rollback for each related write, recurrence/SLA initialization, assignment response projection, and notification failure/retry.

**Feature persistence.** Move by resource boundary, not by file length: comments, time entries, and dependencies are work-item collaboration; labels and workflows are project configuration; audit routes belong with the existing audit controller. Keep `feature-persistence.controller.ts` exports temporarily as compatibility re-exports if imports require a staged migration. Avoid changing API routes until integration tests show all consumers are updated.

## 6. Backend-Only Remediation Roadmap

### Phase 1 — Critical security and data-integrity fixes

| Order | Task | Backend files | Dependencies | Tests / acceptance criteria |
|---|---|---|---|---|
| 1 | Prevent organization managers/non-members from granting project-admin membership | `routes/project.routes.ts`, `controllers/project.controller.ts`, project permission middleware | Define project role grant policy | Unauthorized add/promote requests fail; authorized project admin behavior remains covered. |
| 2 | Secure audit reads/undo and reject client-forged reversible state | Project routes, `controllers/feature-persistence.controller.ts`, `controllers/auditlog.controller.ts` | Define trusted audit event/undo policy | Only authorized project members read/undo; only trusted, related server snapshots are reversible. |
| 3 | Revoke organization-bound sessions on member removal and fail closed without tenant context | `controllers/organization.controller.ts`, `middleware/is.loggedin.ts`, `controllers/auditlog.controller.ts` | Define detached-account behavior | Removed sessions stop working; tenant-scoped handlers reject absent tenant context. |
| 4 | Protect work-item subresources and project labels/workflows | Work-item/project routes, `controllers/feature-persistence.controller.ts`, project permission middleware | Reuse project-scoped authorization | Cross-tenant/non-member operations fail for comments, time entries, dependencies, labels, and workflows. |
| 5 | Evict removed chat members from active WebSocket rooms | `services/chat.service.ts`, `websocket/chat.gateway.ts` | Determine single- versus multi-instance deployment | Removed member receives no subsequent room broadcasts; active members remain unaffected. |
| 6 | Make invitation persistence recoverable on email failure | `services/member-invitation.service.ts`, invitation controller/service, migrations if outbox selected | Decide single invitation lifecycle | Failed delivery can be retried without duplicate or unusable active accounts; acceptance token is hashed, expiring, and single-use if token flow is retained. |

### Phase 2 — Core workflow and correctness fixes

| Order | Task | Backend files | Dependencies | Tests / acceptance criteria |
|---|---|---|---|---|
| 1 | Add the frontend-compatible organization registration route | `app.ts`, `routes/user.routes.ts`, registration controller/service | Keep canonical registration implementation | Existing onboarding payload creates exactly one organization, admin, SLA policy, and session; existing `/api/users/` remains compatible. |
| 2 | Add invitation route/payload compatibility and unify acceptance lifecycle | `app.ts`, `routes/organization.routes.ts`, `controllers/member-invitation.controller.ts`, `services/member-invitation.service.ts` | Select token or temporary-password flow | Frontend invite/accept request contract passes end-to-end tests; no failed request is treated as a successful backend invitation. |
| 3 | Fix chat collection route ordering | `app.ts`, `routes/chat.routes.ts` | Confirm supported aliases | `GET /api/chat/conversations` returns the list, not a UUID error; resource routes continue to work. |
| 4 | Implement advancing SLA candidate processing | `services/sla.service.ts`, relevant migration/index if needed | Define worker eligibility and cursor semantics | A due item after the first 500 is processed; concurrent workers do not duplicate transitions. |
| 5 | Decouple notification persistence/delivery from primary API success | `services/notification.service.ts`, `services/sla.service.ts`, `controllers/task.controller.ts`; add outbox entity/migration/worker only if chosen | Outbox design and idempotency key policy | Primary writes remain correct during delivery outages; notification intents retry without duplicate delivery or transaction-wide rollback. |

### Phase 3 — Reliability and performance improvements

| Order | Task | Backend files | Dependencies | Tests / acceptance criteria |
|---|---|---|---|---|
| 1 | Add bounded audit-log pagination and response metadata | `controllers/feature-persistence.controller.ts` or `controllers/auditlog.controller.ts`, pagination helper | Decide page/limit defaults and maximum | Server returns stable pages and total metadata for histories >150; query limits are bounded. Note: the current frontend wrapper does not transmit page/limit. |
| 2 | Batch chat conversation summaries and page the list | `services/chat.service.ts`, chat routes/controller | Agree on page/cursor contract | Query count does not grow by two per conversation; summary ordering and unread counts remain correct. |
| 3 | Add a dedicated health route | `app.ts` | Decide liveness versus readiness contract | `GET /health` matches the existing client’s status expectation and does not expose secrets. |

### Phase 4 — Architecture, separation of concerns, and test coverage

| Order | Task | Backend files | Dependencies | Tests / acceptance criteria |
|---|---|---|---|---|
| 1 | Extract work-item creation orchestration | `controllers/task.controller.ts`, new `services/work-item.service.ts` | Characterization tests and notification consistency fix | Existing create response/status behavior remains unchanged; all transaction and SLA/recurrence tests pass. |
| 2 | Split feature-persistence handlers by resource | `controllers/feature-persistence.controller.ts`, route imports, existing audit controller | Add endpoint contract tests first | No route changes; each resource controller has focused responsibility and passing regression tests. |
| 3 | Consolidate organization registration behavior | `controllers/user.controller.ts`, `controllers/organization.controller.ts`, new registration service if needed | Route alias decision and session behavior contract | Both supported paths delegate to one service and return compatible cookies/session semantics. |

## 7. Test Plan

- **High-priority regressions:** Register through the frontend’s current path/body; invite and accept through current frontend paths/body; verify route aliases and response envelopes.
- **Organization and tenant isolation:** Verify each organization member can only access resources scoped to their organization; exercise cross-organization IDs for projects, work items, attachments, audit events, conversations, and notifications.
- **Role and permission tests:** Test org roles and project roles independently for view/create/update/delete/member management/SLA/chat/audit operations, including public versus private projects.
- **API contract tests:** Exercise actual Express routes for onboarding, invitations, audit pagination, chat collection and resource routes, notification read operations, and health. Assert status, body shape, and compatibility aliases.
- **Workflow integration tests:** Registration → login → project creation → work-item assignment/update → comments/time entries/dependencies → sprint assignment → notification and audit history.
- **Database transaction and concurrency tests:** Related work-item writes roll back together; project key uniqueness under concurrent requests; invite acceptance is single-use; recurring occurrence generation and SLA transitions are idempotent with concurrent workers.
- **Scheduler tests:** More than 500 unfinished items; due and not-due records; retries after notification failure; recurrence backlog and `skip_locked` behavior; worker shutdown.
- **Attachment tests:** Unsupported/mismatched files, size/count limits, Cloudinary partial failure cleanup, database persistence failure cleanup, and metadata migration/entity agreement.
- **External-service failure tests:** SMTP failures after invite creation; Cloudinary unavailable; notification/outbox delivery failure; ensure API and persistent state remain consistent.
- **Non-destructive database validation:** Run migrations against a disposable PostgreSQL database and compare resulting columns, constraints, indexes, enum values, and foreign keys with entity mappings. No live database was used during this audit.

## 8. Validation Evidence

Commands were run from the repository root; no dependencies were installed and no production systems were accessed.

| Command | Result |
|---|---|
| `pnpm --dir backend typecheck` | Passed (exit code 0). |
| `pnpm --dir backend test` | Passed: 6 tests, 3 suites, 0 failures. |
| `pnpm --dir frontend typecheck` | Failed (exit code 1). Reported missing `src/data/mockData` imports, an implicit `any`, chat request/response type mismatches, onboarding input mismatch, audit helper arity/response mismatches, and possibly-undefined project references. |
| `pnpm --dir frontend lint` | Passed (exit code 0) with warnings, including unused variables/imports and React hook warnings. |
| `pnpm --dir frontend test` | Failed (exit code 1): 174 passed, 10 failed of 184. Failures include audit pagination helper signature, missing `BACKEND_TEAM_HANDOFF.md` expected by existing tests, notification error-handling expectations, project-role mapping, assignee hydration, and sprint temporary-ID filtering. The requested audit deliverable is `BACKEND_AUDIT_REPORT.md`; no additional handoff file was created. |

No backend build was run because type-check and backend tests were the smallest relevant safe checks; no live API, database, scheduler, SMTP, Cloudinary, or WebSocket runtime test was run. The report includes findings that require runtime integration verification.

## 9. Recommended Implementation Checklist

- [ ] **P1 — Registration route:** Add a backend compatibility route for `/api/users/register`; verify the existing onboarding payload creates one backend organization/user/SLA/session.
- [ ] **P1 — Invitation API contract:** Support the existing invite/accept paths and payloads without duplicating lifecycle logic; verify success and validation error response shapes.
- [ ] **P1 — Project admin grants:** Enforce project-admin-only role grants and add negative tests for organization managers and project non-members.
- [ ] **P1 — Audit authorization:** Require project-scoped access to audit reads/undo; reject client-forged state and validate log/entity/project relationships.
- [ ] **P1 — Member session revocation:** Revoke sessions on organization removal and reject tenant-scoped requests when the authenticated user has no organization.
- [ ] **P2 — Invitation lifecycle:** Reconcile pending-token acceptance with the active temporary-password implementation; provide a retry/recovery path for SMTP failure.
- [ ] **P2 — Chat route order:** Ensure `GET /api/chat/conversations` reaches the collection handler, then test all supported aliases.
- [ ] **P2 — Resource-level authorization:** Protect comments, time entries, dependencies, project labels, and workflows with project/tenant checks.
- [ ] **P2 — Live chat membership:** Ensure removed users no longer receive broadcasts through already-joined WebSocket rooms.
- [ ] **P2 — SLA worker fairness:** Process eligible items beyond the oldest 500; prove with a regression test containing more than 500 unfinished rows.
- [ ] **P2 — Notification reliability:** Persist notification intents transactionally and deliver/retry independently; verify API success and SLA progress under notification failure.
- [ ] **P2 — Audit history:** Add bounded backend pagination and stable metadata; separately resolve the client’s missing query transmission before claiming end-to-end pagination.
- [ ] **P2 — Chat list performance:** Batch message/unread summaries and cap conversation pages; test query growth and ordering.
- [ ] **P3 — Health endpoint:** Add `/health` with the existing client-compatible response shape.
- [ ] **P3 — Controller boundaries:** Extract work-item orchestration and split feature-persistence responsibilities after characterization tests.
- [ ] **Before release — Security review:** Complete and record the full backend security review; do not treat the initial limited review as a clean bill of health.
