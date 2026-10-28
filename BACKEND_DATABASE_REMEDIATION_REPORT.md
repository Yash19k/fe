# Backend and Database Remediation Report

## Executive summary

This report tracks code changes against the findings in
[`BACKEND_DATABASE_ARCHITECTURE_AUDIT.md`](./BACKEND_DATABASE_ARCHITECTURE_AUDIT.md).
The remediation is **partial and not a production-readiness certification**.
Application authorization, invitation, and query-shape changes are present;
this pass also closes three security-review findings in project-chat listing,
client-authored audit writes, and work-item status transitions. Database
migration state, production data, deployment topology, and PostgreSQL query
plans were not available for verification. No database was connected to, no
migration was run, and no deployment configuration or production data was
changed.

| Status | Findings |
|---|---|
| Addressed in code; production verification remains | SEC-02, API-01, SEC-03 |
| Mitigated in code; database or workload verification remains | SEC-01, REL-01, PERF-01, PERF-02, REL-02 |
| Partially addressed | OPS-01, DB-04, DB-05 |
| Open; requires separate design, data review, or operations work | MAINT-01, DB-01, DB-02, DB-03 |
| Fixed in this pass; database/integration verification remains | SEC-04, SEC-05, SEC-06 |

## Finding-by-finding status

| Finding | Status | Remediation and evidence | Remaining work |
|---|---|---|---|
| **SEC-01 — Audit undo authorization and untrusted snapshots** | Mitigated in code; migration required | Undo now resolves the target work item and its project, checks organization/project authorization, rejects legacy records without usable project context, and only permits undo for server-trusted snapshots. Server work-item mutations write audit state in their transaction. The unscoped compatibility route requires `task:update`. Client-provided snapshots are no longer treated as trusted undo state. | Apply `1793020000000-AddTrustedAuditUndo` before deploying code that reads `trusted_for_undo`. Historical rows default to untrusted and therefore lose undo capability; review this product impact and validate migration ordering. Add PostgreSQL-backed tests for private projects, legacy null-project rows, and concurrent undo. |
| **SEC-02 — Assignment implicitly grants project membership** | Addressed in code | Assignee validation is read-only and requires the assignee to already be a project member. The regression test verifies a valid same-organization nonmember is rejected without writes and that existing members remain assignable. | Confirm the product does not require automatic invitations. If it does, provide a separate explicit membership action authorized by `member:add`; do not restore membership creation inside assignment validation. |
| **API-01 — Multiple labels silently truncated** | Addressed in code | Request validation now enforces the existing single-label persistence contract instead of accepting an array and silently discarding all but its first value. The priority/label test covers multi-label rejection. | If multi-label support is desired, design the junction-table/entity and migration as a separate API and data migration; do not imply that the current `labelId` column supports it. |
| **REL-01 — SLA worker can starve records after the first 500** | Mitigated in code; PostgreSQL verification required | Candidate selection filters for missing or stale SLA state and bounded due transitions, and locks candidates with `SKIP LOCKED`; unchanged records are not repeatedly selected as the first batch. Escalation notifications are dispatched after the transaction commits. | Exercise the eligibility SQL on PostgreSQL with more than 500 stable rows followed by due rows, and test multiple workers and policy changes. Confirm scheduler deployment is single-worker or uses a shared scheduler; do not assume the in-process scheduler is distributed. |
| **PERF-01 — Chat list loads all historical messages** | Mitigated in code; workload verification required | Conversation listing is paginated (default page 1, limit 50, maximum 100). Latest messages and grouped unread counts are queried only for the current page; deleted messages remain excluded and ordering is deterministic. The REST response remains an array. | Run PostgreSQL integration tests for unread/timestamp tie behavior and inspect query plans with representative data. |
| **PERF-02 — Work-item list joins unbounded child collections** | Mitigated in code; workload verification required | The root list query is narrower, and child collections are batch-loaded rather than joined together into a fan-out result. The response shape is preserved. | Measure query count, payload size, hydration cost, and `EXPLAIN (ANALYZE, BUFFERS)` on representative data. Confirm pagination and count semantics with integration tests. |
| **REL-02 — Notification failure reported after sprint commit** | Addressed with an explicit best-effort policy | Notification delivery is separated from committed primary writes and handled with `Promise.allSettled` plus diagnostic logging in the related notification paths. A delivery failure no longer turns an already-committed write into a misleading request failure. | Delivery is not durable and has no retry/outbox guarantee. Add an outbox only if the product requires eventual notification delivery, with idempotent dispatch and monitoring. |
| **SEC-03 — Pending invitations can activate through ordinary login** | Addressed in code; acceptance UX remains to verify | Pending accounts cannot log in as active users. Invitations use hashed, one-time, 48-hour tokens; acceptance sets the permanent password and consumes the token under a transaction/row lock. Pending invitations may only be resent for the same organization; the service rechecks organization and status while locking the row to prevent cross-organization reassignment. Validation tests cover token and password shape. | Confirm the end-user acceptance UI invokes the acceptance endpoint, ensure admins can resend old pending invitations whose prior token is unavailable, and add database-backed tests for expiration, reuse, and concurrent acceptance. |
| **OPS-01 — Uploads buffer up to 500 MB per request in process memory** | Partially addressed | Content signatures are checked rather than trusting only the declared MIME/extension, display names are sanitized, and field limits remain enforced. | Multer still buffers up to five 100 MB files in memory. Add a product-approved aggregate/per-file limit, HTTP and per-user rate limits, proxy limits, and preferably streaming or direct object-storage upload. Signature checks occur after buffering and are not malware scanning. |
| **MAINT-01 — Conflicting package manager/lockfiles** | Open | No dependency or lockfile source was selected because deployment and CI consumers were not established. | Decide the authoritative package manager, verify all CI/deployment consumers, then remove redundant lockfiles/dependencies in a dedicated change. Do not remove packages based only on source-code search. |
| **DB-01 — Attachment migrations may drop metadata or fail on populated data** | Open; production-critical | No attachment migration was rewritten or executed. Historical migrations should be treated as immutable unless deployment history proves otherwise. | Inspect deployed migration history, schema, attachment rows, and Cloudinary references. Rehearse an additive/backfill/verify/constraint migration against a restored production-like copy, with backup and rollback procedures, before any production rollout. |
| **DB-02 — Tenant/project consistency lacks composite database constraints** | Open | Application checks remain; no composite ownership constraints were added without a data and domain review. | Inventory and repair inconsistent rows; decide organization-ownership semantics; then design additive composite keys/FKs for work items, sprints, labels, members, assignees, notifications, and audit records as appropriate. Keep application authorization checks. |
| **DB-05 — Domain invariants are not fully constrained** | Partially addressed | Time-entry duration validation now requires a positive whole number in range; SLA-hour updates require positive whole numbers; this pass also enforces work-item workflow transitions and configured role restrictions. | Add database checks only after confirming domain rules. Dependency-cycle policy and workflow JSON semantics remain undecided; positive duration/SLA DB constraints are not present, and application changes are not a substitute for integrity constraints. Add boundary and database tests. |
| **DB-04 — Index alignment and query plans are unverified** | Partially addressed | The chat and work-item query shapes were bounded as described under PERF-01 and PERF-02. No speculative indexes were added. | Measure with representative PostgreSQL data and query plans before selecting indexes, including the project/created-time work-item listing path. Account for index build strategy and write/storage cost. |

### Latest architecture-audit checklist

| Finding | Status | Evidence and remaining work |
|---|---|---|
| **B-01 — Upload memory exhaustion** | Open / partially mitigated | [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts) checks MIME/signatures and limits to five files, but still uses Multer memory storage and allows 100 MB per file. An aggregate budget, rate limiting, streaming storage, and proxy limits require a supported size and deployment-topology decision. |
| **B-02 — Unbounded work-item child collections** | Open / partially mitigated | [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts) batch-loads child relations instead of join fan-out, but list responses still embed unbounded comments, time entries, children, assignees, and attachments. A bounded summary contract needs client compatibility review; no frontend change was made. |
| **B-03 — HTTP rate limiting** | Open | No application-wide or shared-store HTTP limiter is configured in [`backend/app.ts`](./backend/app.ts). Proxy trust and multi-instance topology are unknown; an in-memory limiter would not provide the requested distributed protection. |
| **B-04 — Readiness and graceful shutdown** | Open | `/health` in [`backend/app.ts`](./backend/app.ts) remains a static liveness response. [`backend/server.ts`](./backend/server.ts) does not install signal-driven draining/cleanup. The hosting termination timeout and scheduler/WebSocket shutdown requirements were not provided. |
| **B-05 — Controller responsibilities** | Partially addressed | Work-item writes already use [`backend/services/work-item.service.ts`](./backend/services/work-item.service.ts); this pass also moves workflow transition policy into [`backend/services/work-item-workflow.service.ts`](./backend/services/work-item-workflow.service.ts). Sprint orchestration, audit undo, and list-query extraction remain unmodified. |
| **B-06 — Package-manager and lockfile ambiguity** | Open | The root and backend manifests declare pnpm, but backend `package-lock.json` and `pnpm-lock.yaml` both exist and are modified in the pre-existing worktree. No lockfile was removed because CI/deployment consumers are not established. |
| **DB-01 — Historical attachment migration safety** | Open; production-critical | Historical migrations were not changed or run. The applied migration state and attachment data are unknown; perform a backup-backed rehearsal before adding a corrective migration. |
| **DB-02 — Tenant/project database integrity** | Open | No composite constraints were added without checking existing data and organization-membership semantics. The chat listing now applies project-membership scoping at the application query layer; this is not a substitute for DB constraints. |
| **DB-03 — Migration execution in deployment** | Open | Migrations are registered, production synchronization is guarded, and startup does not run migrations. No CI/CD or deployment migration job was available to verify. |
| **DB-04 — Query plans and indexes** | Open / partially mitigated | Existing list query shape is bounded by pagination/batch loading, but work-item nested collections remain unbounded. No representative PostgreSQL data or safe query plan was available; no index was added speculatively. |
| **DB-05 — Domain invariants** | Partially addressed | This pass enforces application-level work-item status transitions and workflow role restrictions. Cross-tenant/project ownership, database checks, and existing-row consistency still require a schema/data review. |

### Security-review findings fixed in this pass

| Finding | Status | Root cause, impact, fix, and evidence |
|---|---|---|
| **SEC-04 — Project-chat listing omits project authorization** | Fixed in code; PostgreSQL integration verification remains | [`backend/services/chat.service.ts`](./backend/services/chat.service.ts) previously selected conversations by organization and conversation membership alone. The listing query now excludes project conversations unless the caller is an organization Admin/Manager or has a `project_members` row for that project. Latest-message and unread aggregation run only for the scoped page. |
| **SEC-05 — Client-authored audit events can be fabricated** | Fixed in code; client compatibility impact is intentional | [`backend/controllers/auditlog.controller.ts`](./backend/controllers/auditlog.controller.ts) now rejects client writes with `FORBIDDEN`; persisted audit records must come from server-side operations. This closes the arbitrary action/entity/description/state input path. The existing frontend's non-task audit-notice request will be rejected and remains local-only; server-side logging for those project mutations is not implemented here. |
| **SEC-06 — Work-item status changes bypass workflow policy** | Fixed in code; PostgreSQL integration verification remains | [`backend/services/work-item.service.ts`](./backend/services/work-item.service.ts) now validates changes inside the existing transaction before saving. [`backend/services/work-item-workflow.service.ts`](./backend/services/work-item-workflow.service.ts) checks configured transitions and source-stage role restrictions, using the existing default workflow where no project workflow is stored. Invalid transitions return 409; unauthorized destination roles return 403. Regression cases cover valid/invalid transitions, role restrictions, and malformed workflow data. |

## Additional changes in scope

- Added basic security headers and a production guard against TypeORM schema
  synchronization.
- Added or extended backend tests for assignment membership, invitation input
  validation, attachment signatures, and the single-label contract.
- Updated [`backend/README-INTEGRATION-NOTES.md`](./backend/README-INTEGRATION-NOTES.md)
  with invitation acceptance, SLA worker/notification behavior, and chat-list
  pagination notes.

These changes are in a pre-existing dirty worktree that also contains unrelated
tracked and untracked modifications. The report does not imply that every
existing change in that worktree was made as part of this remediation.

## Verification

| Check | Result |
|---|---|
| `pnpm --dir backend test` (this pass) | Passed: 22 tests, 0 failures, including new workflow-policy and rejected client-audit-write tests. |
| `pnpm --dir backend typecheck` (this pass) | Passed. |
| `pnpm test` | Not rerun in this pass. A prior report recorded 207 passing tests; it predates the changes in this pass. |
| `pnpm typecheck` | Not rerun in this pass. A prior report recorded backend pass and frontend type errors; it predates the changes in this pass. |
| `git diff --check` | Reports trailing whitespace at `frontend/src/state/AppContext.tsx:951`; this was present in the dirty worktree and was not changed as unrelated cleanup. Git also reports a line-ending conversion warning for `backend/pnpm-lock.yaml`. |
| PostgreSQL migration/integration tests, chat authorization query tests | Not run; no database was connected to or configured for integration tests. |
| Backend production build | Not run; `backend/dist` already contains untracked/pre-existing generated files that should not be overwritten as part of this work. |

## Rollout and follow-up

1. **Do not deploy the audit-controller change before applying and verifying**
   `backend/migrations/1793020000000-AddTrustedAuditUndo.ts` on a safe database
   copy and then the target database. Confirm the column exists before the
   application version that queries it is started.
2. The generic client audit-write endpoint now rejects writes. Confirm that
   consumers do not rely on persisted client-authored project activity; if
   durable project-event history is required, add server-side audit writes in
   the corresponding project mutation transactions.
3. Before production, inspect current attachment schema/data and migration
   history; rehearse a corrective migration with backup/restore verification.
4. Run PostgreSQL-backed authorization, invitation, audit, SLA batch/locking,
   work-item listing, and migration tests. Include concurrency tests for
   invitation acceptance and parallel SLA workers.
5. Decide and implement upload aggregate limits, request rate limiting, and a
   streaming/direct-storage strategy. Confirm reverse-proxy limits and
   operational memory budgets.
6. Decide the authoritative package manager and lockfile, and establish the
   scheduler's multi-instance deployment policy.
7. Measure the modified list queries and candidate indexes with production-like
   data before claiming a performance improvement.
8. Verify backup/restore, graceful shutdown, notification monitoring/retry
   requirements, and the invited-user acceptance experience in the deployment
   environment.

**Overall conclusion:** High-risk application paths were hardened and the
available automated tests pass, but this is not a production-readiness
certification. Database migration safety, tenant constraints, upload resource
limits, delivery/retry guarantees, and PostgreSQL operational verification
remain explicit follow-up work.
