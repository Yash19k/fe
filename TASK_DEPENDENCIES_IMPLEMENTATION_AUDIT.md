# Task Dependencies and Automatic Scheduling — Implementation Audit

**Audit date:** 2026-10-27  
**Scope:** Current working-tree backend and frontend source, migrations, tests, and API/state flows.  
**Mode:** Read-only inspection. No application source, configuration, migration, package, or database was changed.  
**Status:** This report describes the current checkout; several files were already modified before the audit. No live database, applied migration history, deployment configuration, or production workload was inspected.

## 1. Executive summary

TaskFlow already persists predecessor relationships, exposes dependency list/create/delete endpoints, and contains frontend cycle detection, working-day calculations, schedule simulation, a dependency-management view, and a Gantt-style timeline. The requested feature is therefore an extension and integration task, not a greenfield dependency implementation.

The critical gap is authority and persistence: the backend dependency-create path rejects self-links and duplicates and checks that both tasks share a project and organization, but it does not detect longer cycles. Its dependency mutations are not transactionally serialized. Frontend cycle detection is useful feedback but cannot prevent API callers or concurrent requests from creating a cycle. The backend has no dependency scheduler and the WorkItem schema has no task-level start date, duration, actual start, or actual finish. The frontend’s schedule preview/cascade is not wired to the task date editing flow and applying a preview updates local state without persisting all affected tasks.

**Recommended direction:** retain the existing dependency table and routes; make backend validation and graph mutation authoritative; add a transaction-backed dependency/scheduling service and tests; decide and persist the schedule inputs that are missing (at minimum a task-level planned start and a defined working-day duration, unless product owners select a different source). Extend current frontend screens and API/state logic rather than creating duplicate dependency UI or graph modules. Do not treat the existing recurrence/SLA scheduler as a dependency scheduler.

| Area | Already present | Missing for the requested behavior |
|---|---|---|
| Dependency persistence/API | `WorkItemDependency`; GET/POST/DELETE under `/api/work-items/:workItemId/dependencies` | Server-side cycle detection; serialized graph mutation; robust deletion ID contract |
| Cycle detection | Frontend graph validation can reject a proposed edge and produce a cycle path | Backend validation and race-safe enforcement |
| Working days | Frontend helper skips Saturday/Sunday | Server-authoritative scheduling and a defined timezone/holiday calendar |
| Schedule propagation | Frontend preview utility computes downstream shifts | Persisted fields and backend cascade wired into dependency and task-date mutations |
| UI | Dependency screen, blocked indicators, Gantt bars, impact preview | Dependency editing in task details; date-edit integration; schedule API reconciliation; Gantt dependency connectors |

## 2. Existing architecture and relevant directory structure

This is a TypeScript/Express/TypeORM backend and React/TypeScript frontend. The backend mounts work-item routes from `backend/app.ts`; work-item endpoints are grouped in `backend/routes/work.item.routes.ts`, use Joi validation and project-permission middleware, and pass asynchronous handlers through the common error handler. Work-item orchestration is in `backend/services/work-item.service.ts`; dependency endpoints currently live in `backend/controllers/work-item-collaboration.controller.ts`.

Relevant backend locations:

- `backend/entities/` — `work.item.entity.ts`, `work.item.dependency.entity.ts`, assignment and time-entry entities.
- `backend/migrations/` — migration history, including `1792300000000-AddFeaturePersistenceTables.ts`.
- `backend/routes/`, `controllers/`, `services/`, `middleware/`, `validations/`, `errors/`, `config/`, `tests/`.
- `backend/services/scheduler.service.ts` and `recurrence.service.ts` — current scheduled processing is for SLA and recurrence, not dependency reflow.

Relevant frontend locations:

- `frontend/src/domain/` — `dependencyGraph.ts`, `businessDays.ts`, `scheduling.ts`, `criticalPath.ts`.
- `frontend/src/features/project/` — `DependenciesView.tsx`, `ProjectTimelineView.tsx`, board/list/calendar views.
- `frontend/src/components/tasks/` — `TaskDetailsDrawer.tsx`, `CreateTaskModal.tsx`, `TaskCard.tsx`, `TaskRow.tsx`.
- `frontend/src/services/api.ts`, `state/AppContext.tsx`, `types/index.ts`.
- `frontend/tests/` — includes `scheduling.test.ts`; tests use Node’s built-in test/assert APIs and the package test script runs `tsx --test tests/**/*.test.ts`.

The actual frontend does have a project dependency view and a Gantt-style timeline. Do not create a second graph or dependency-management page. Existing frontend domain algorithms are not a substitute for backend validation or persistence.

## 3. Existing entities and database relationships

### WorkItem

`backend/entities/work.item.entity.ts:63-157` defines task identifiers (organization, project, creator, optional parent, sprint, and label), type, title, description, status, priority, nullable `dueDate` (`timestamptz`), SLA fields, and creation/update timestamps. It does **not** define a task-level start date, task-level duration, actual start date, or actual finish date.

Relations at `work.item.entity.ts:159-237` include a required project and creator, optional parent/children, assignees, sprint, label, attachments, comments, time entries, and dependency relations. Organization identity is stored as a scalar UUID; the entity has no Organization relation. A work item has a project relation and optional single sprint relation, not multiple project/sprint memberships.

Duration-like information exists only in adjacent models:

- `backend/entities/work.item-assignee.entity.ts:64-78` has assignment-level nullable `startDate` (`date`) and `estimatedHours`; it is not a task-level schedule.
- `backend/entities/work.item.time.entry.entity.ts:19-35` stores logged time (`durationMinutes`, `startTime`, `createdAt`), not planned duration or actual task start/finish.

Consequently, a backend scheduler cannot reliably preserve a task’s planned duration from the current WorkItem schema. Summing assignee estimates or treating a time-entry total as planned duration would invent semantics and should not be done without a product decision.

### Dependency relationship

`backend/entities/work.item.dependency.entity.ts:12-31` defines `WorkItemDependency` with `workItemId` (the dependent/successor) and `dependsOnWorkItemId` (the predecessor), a unique pair constraint, and two cascading WorkItem relations. `backend/migrations/1792300000000-AddFeaturePersistenceTables.ts:71-79` creates the table, unique pair constraint, and cascading foreign keys.

The existing schema prevents duplicate pairs and orphaned edges. It does not prevent cycles, self-dependencies at database level, or cross-project/cross-organization edges at database level. The controller checks some of these rules, but those application checks are not equivalent to database-enforced invariants.

**Conclusion:** Do not create a second dependency entity/table. Reuse `WorkItemDependency`. Add a migration only if the approved scheduling contract requires new persisted fields or stronger database constraints.

## 4. Existing backend implementation findings

### Dependency endpoints and controller

`backend/app.ts:55` mounts work-item routes at `/api/work-items`. `backend/routes/work.item.routes.ts:146-166` defines:

- `POST /api/work-items/:workItemId/dependencies` — validates a UUID `dependsOnWorkItemId` and calls the add operation.
- `GET /api/work-items/:workItemId/dependencies` — calls the list operation.
- `DELETE /api/work-items/:workItemId/dependencies/:depId` — calls the delete operation.

The routes require login and the applicable `task:update` or `task:read` project permission. Joi schemas in `backend/validations/work.item.validations.ts:220-283` validate UUID inputs and reject unknown fields.

`backend/controllers/work-item-collaboration.controller.ts:15-52,212-300` holds the dependency operations and `assertWorkItemAccess`. Add checks self-dependency, source/target access, organization and project equality, and an existing pair before saving. There is no graph reachability check. List returns predecessor IDs (`dependsOnWorkItemId`), rather than rich edge records. Delete matches `depId` to `dependsOnWorkItemId`, not to the edge row UUID; the route parameter name can therefore mislead clients. Clarify and preserve/standardize this contract before changing it.

Dependency add/delete use repository operations without a transaction or graph lock (`:252-267,286-300`). A unique constraint protects duplicate inserts, but a pre-check followed by save is race-prone, and a future cycle check that is not serialized would also be race-prone.

### Task creation, updates, and status

`backend/controllers/task.controller.ts:69-116` dispatches create/update to `createWorkItemOrchestration` and `updateWorkItemOrchestration` in `backend/services/work-item.service.ts:252-505,528-880`. Create defaults status to `BACKLOG`, parses `dueDate`, and uses a transaction. Update uses a transaction, takes a pessimistic write lock on the individual task row (`:533-541`), validates configured status transitions, and updates task fields including due date (`:661-672`). Neither path reflows dependency successors or gates status changes on predecessor completion.

`backend/services/work-item-workflow.service.ts:36-114` handles configured status transitions, not dependency completion rules. Dependencies currently express relationships and frontend blocked indicators; no backend dependency status gate was found.

### Scheduler, configuration, and error conventions

`backend/services/scheduler.service.ts:14-85` starts minutely SLA and recurrence jobs. `backend/services/recurrence.service.ts:270-360` processes recurrence rules with a transaction and row locking/`skip_locked`; it is not a general task scheduler. Recurrence date logic is timezone-specific (`Asia/Kolkata`, 09:00) in `recurrence.service.ts:20-21,67-69,116-164`; that does not establish a timezone policy for ordinary task dates.

`backend/config/data.source.ts:7-24` configures TypeORM’s PostgreSQL driver and entity/migration globs. `backend/config/config.ts:29-39` reads environment-backed database settings, enables synchronization only when explicitly configured, and rejects it in production. Startup initializes the datasource in `backend/server.ts:19`; no automatic migration execution was identified. PostgreSQL server version and applied migration state are unverified.

Use the established `AppError` (`backend/errors/app.error.ts:2-8`), `asyncHandler`, and centralized handler (`backend/middleware/error.handler.ts:17-63`). The error response convention is `{ success: false, code, message }`; unique violations map to 409. Do not add controller-level catch blocks.

### Authorization

The dependency controller scopes the source to the user’s organization, permits organization admins, and otherwise requires project membership. It also checks the target is in the same project and organization. `backend/services/work-item.service.ts:127-180` has a related project-access helper that permits non-members for public projects, so a refactor must deliberately preserve or reconcile this policy difference. All dependency operations must retain server-side authentication and project authorization; UI visibility is not an authorization boundary.

## 5. Existing frontend implementation findings

### Dependency graph and view

`frontend/src/domain/dependencyGraph.ts:26-45` builds predecessor-to-successor adjacency from `dependencyIds` or the legacy `dependencies` field. Its validation logic (`:95-145`) checks missing tasks, self-links, duplicates, and whether a proposed edge makes a cycle; it can return a cycle path.

`frontend/src/features/project/DependenciesView.tsx:32-49,143-188` validates before adding a dependency, offers predecessor/successor selection, and displays a cycle warning/toast on local rejection. It lists and removes links (`:201-242`); the Teammates role has the remove action hidden. `frontend/src/components/tasks/TaskCard.tsx:21,48-55` and `TaskRow.tsx:22,95-106` show blocked/linked indicators.

This client validation is not authoritative. The frontend API has GET/POST/DELETE helpers in `frontend/src/services/api.ts:511-535`, but the GET helper has no call site in `src`. The state layer calls add/delete, catches failures, and logs warnings (`frontend/src/state/AppContext.tsx:1208-1279`); frontend validation does not establish that the server detects cycles.

### Scheduling and date editing

`frontend/src/domain/businessDays.ts:21-73` skips Saturdays and Sundays and computes business-day intervals; no holiday calendar exists. `frontend/src/domain/scheduling.ts:45-157` previews Finish-to-Start shifts and downstream cascades, preserving business-day duration. `criticalPath.ts:42-96,170` computes a critical path but appends unvisited nodes when a cycle exists rather than rejecting the graph.

`AppContext.tsx:1177-1206` contains a reschedule preview/confirmation flow, but no caller was found. Applying changes updates local tasks and broadcasts (`:1183-1205`) without persisting all affected tasks through the API. The schedule simulation can change the primary task’s start date (`scheduling.ts:71-86`), but its impact result and apply method only update the primary due date (`:163-185`).

`frontend/src/components/tasks/TaskDetailsDrawer.tsx:87-100,249-305,537-558` edits due date and estimated hours, but not start date or dependencies. `CreateTaskModal.tsx:58-60,190-193,565-603,676-681` offers a start date, due date, and estimated working hours. Date forms do not visibly apply the business-day helper. `frontend/src/features/project/ProjectTimelineView.tsx:40,147-165,313-375` renders dated Gantt bars and critical-path highlighting, but no dependency connectors or drag-to-reschedule interaction.

### Types, state, and tests

`frontend/src/types/index.ts:115-140` declares `dependencies?: string[]` but not `dependencyIds`, although state/UI/tests use `dependencyIds`. The API mapper in `frontend/src/services/api.ts:1018-1021` maps dependencies to `dependencyIds`; normalize one canonical type/accessor instead of allowing the two spellings to diverge. `TaskRow` reads `dependencyIds` directly while the graph function tolerates either spelling.

`frontend/tests/scheduling.test.ts:1-234` already tests dependency validation, cycle detection, business-day arithmetic, cascades, and local application. It does not establish API persistence, backend cycle prevention, reschedule failure rollback, or rendered UI behavior. No frontend module is inherently required; extend the existing screens, state, types, API helpers, and tests.

## 6. Missing functionality and identified risks

### Required functionality gaps

1. Backend cycle/path validation is absent.
2. Dependency mutations and schedule updates are not serialized across a project graph.
3. There is no server-side downstream traversal, topological order, working-day arithmetic, or schedule persistence.
4. WorkItem lacks the planned start/duration inputs required to preserve schedule duration; current assignment estimates and logged work are not equivalent.
5. Task date edits and dependency creation do not trigger persisted server-side reflow.
6. Frontend schedule application is local-only; create/delete API failures are logged rather than surfaced and reconciled consistently.
7. Dependency editing is available in a project view, not in the task details drawer. Gantt dependency lines are absent.
8. Dependency list/type shapes and delete parameter semantics are inconsistent or under-specified.

### Principal risks

- **Race-created cycles:** two individually valid edges can jointly close a cycle unless graph mutation is serialized.
- **Lost or misleading updates:** local preview success can differ from persisted server state; refresh/reload can discard the cascade.
- **Schedule semantics are undefined:** “finish,” zero lag, inclusive dates, duration units, completed tasks, manual overrides, and pulling successors earlier need product decisions.
- **Date/time shifts:** WorkItem `dueDate` is `timestamptz`, while assignment start date is `date` and recurrence uses a specific timezone. Frontend date parsing may use local time. No universal task calendar/timezone policy is established.
- **Authorization inconsistency:** public project access behavior differs between task service and dependency controller.
- **Migration/deployment uncertainty:** PostgreSQL version, deployed schema, applied migration state, and production data are not available for inspection.

## 7. Proposed database/entity changes

### Required only after scheduling policy is approved

Reuse `WorkItemDependency`; do not add a duplicate table. A minimal robust schedule needs persisted task-level plan inputs, for example:

- `plannedStartDate` (`date`, nullable initially).
- `plannedDurationWorkingDays` (positive integer, nullable until explicitly scheduled or backfilled).
- Existing `dueDate` remains the planned finish only if product owners confirm this meaning and settle its current timestamp-to-date semantics.

If dependency edges may vary beyond Finish-to-Start or require lag, add `type` (initially constrained to `FS`) and non-negative integer `lagWorkingDays` with default zero. Otherwise leave the existing edge schema unchanged for the first version.

Consider a `schedulingMode`/manual override field only if manual scheduling must be distinguishable from automatic scheduling. The current schema has no actual start/finish fields; do not overwrite time entries or infer actual completion dates from due dates. Decide whether separate actual dates are in scope rather than adding them implicitly.

### Constraints and migration

The existing unique pair and cascading FKs are useful and should remain. A new additive migration may add the approved columns, non-negative checks, and a self-edge check. For same-project/org integrity, keep service checks inside the transaction; consider composite constraints only if matching unique keys and migration complexity are verified against actual deployed schema. A cycle cannot be enforced with a simple row-level check constraint.

Do not edit historical migrations: deployment/applied state is unknown. Add a forward migration and implement a correct `down` path; use staged nullable columns/backfill/constraint enforcement if existing rows need transformation. Inspect existing data and rehearse upgrade/rollback on a production-like copy before release. No migration or database operation was run during this audit.

## 8. Proposed backend file-by-file changes

### Existing files to extend

| Path | Current responsibility / reuse | Required or recommended change and reason |
|---|---|---|
| `backend/controllers/work-item-collaboration.controller.ts` | Current dependency list/create/delete handlers and access check. Reuse route-facing operations and auth scope. | Delegate to a transaction-backed dependency service; return cycle errors and changed schedule data; retain source/target authorization. Clarify whether the delete parameter denotes edge ID or predecessor ID. |
| `backend/routes/work.item.routes.ts` | Existing GET/POST/DELETE dependency endpoints with login/project permission. | Reuse the routes and middleware. Extend request validation only for approved edge options; keep response and path compatibility explicit. |
| `backend/validations/work.item.validations.ts` | Joi task/dependency schemas and UUID checks. | Validate approved dependency type/lag and schedule date/duration rules; reject negative/fractional lag and invalid durations. |
| `backend/services/work-item.service.ts` | Transactional task create/update and individual task locking. | Invoke scheduling within the same transaction for relevant due/start/duration/status changes; acquire the agreed project graph lock before task locks. Preserve workflow behavior. |
| `backend/entities/work.item.entity.ts` | WorkItem schema and relations. | Add only approved task-level plan columns; do not duplicate due date, assignment estimate, or actual time-entry fields. |
| `backend/entities/work.item.dependency.entity.ts` | Existing dependency pair entity. | No change for initial FS with zero lag; add only approved edge metadata/constraints. |
| `backend/tests/` | Existing backend regression tests. | Add service/API tests for cycles, authorization, transactional cascade, and concurrency. Keep existing task/workflow, recurrence, and SLA regressions. |

### New files proposed

| Proposed path | Purpose and main responsibilities | Why separate |
|---|---|---|
| `backend/services/work-item-dependency.service.ts` | `listDependencies`, `addDependency`, `removeDependency`, graph load/reachability with cycle path, affected successor traversal, topological order, working-day schedule calculation, and transactional persistence. | The graph mutation and schedule cascade require a shared transaction boundary across routes and task updates; keeping that orchestration out of controllers avoids duplicated logic. Reuse existing entities, datasource, AppError, and validators. |
| `backend/migrations/<new timestamp>-AddWorkItemSchedulingFields.ts` | Add only the approved scheduling columns/constraints and reversible rollback. | A new forward migration is required if persistence changes; historical migrations may already be deployed. |
| `backend/tests/work-item-dependency.test.ts` (or repository’s matching test naming convention) | Cycle, graph, permissions, persistence, transaction and concurrency coverage. | Existing backend tests have no dependency-cycle or scheduling coverage. |

A separate pure business-day utility is optional, not mandatory: begin with well-tested functions in the service or extract only if the backend needs that calculation in multiple domains. Do not add a background job unless the product requires asynchronous reflow; the current scheduler is for recurrence/SLA and should not be repurposed by assumption.

## 9. Proposed frontend file-by-file changes

| Path | Current responsibility / reuse | Required or recommended change |
|---|---|---|
| `frontend/src/components/tasks/TaskDetailsDrawer.tsx` | Task detail/date/estimate editing. | Add predecessor/successor display and dependency create/remove or link to existing dependency view; integrate task date/duration edits with the server schedule response. |
| `frontend/src/features/project/DependenciesView.tsx` | Dependency selection, local cycle feedback, list/removal. | Keep current UX; treat local check as preflight only, handle authoritative server cycle errors with the full returned cycle path, and refresh state after successful mutations. |
| `frontend/src/state/AppContext.tsx` | Central task/dependency/scheduling state and mutation functions. | Replace local-only schedule application with persisted, failure-aware updates/reconciliation; handle API errors visibly and refresh all affected tasks; use one canonical dependency representation. |
| `frontend/src/services/api.ts` | Dependency endpoints, work-item mapping and API error handling. | Align endpoint methods, DELETE identifier semantics, response typing, and updated-task payload with backend contract; surface errors instead of warning-only behavior. |
| `frontend/src/types/index.ts` | Frontend task and API types. | Add canonical `dependencyIds` or normalize to `dependencies`, and type approved planned dates/duration and schedule-change responses. Remove the current mismatch. |
| `frontend/src/domain/scheduling.ts` | Frontend preview/cascade. | Preserve it as optional preview, align exact rules with backend, and include the primary task’s start-date change in the impact result and apply path. Do not treat it as the source of truth. |
| `frontend/src/features/project/ProjectTimelineView.tsx` | Dated Gantt bars and critical-path visualization. | Optional enhancement: render dependency connectors after persisted data is reliable. Not essential to server-side scheduling or cycle prevention. |
| `frontend/src/components/tasks/TaskCard.tsx`, `TaskRow.tsx` | Blocked/linked indicators. | Normalize dependency access and reflect server-returned blocked/updated state consistently if status gating is selected. |
| `frontend/tests/scheduling.test.ts` and relevant frontend API/UI tests | Existing pure graph/business-day tests. | Add server error-path, optimistic rollback/reconciliation, primary-start-date, and date-form integration coverage. |

No new frontend source file is required for the minimum feature: existing graph, business-day, scheduling, dependency-view, and API modules are suitable extension points. A new connector component is optional if Gantt arrows are approved.

## 10. Proposed API contracts

The existing dependency routes are sufficient for the minimum CRUD flow. Exact current response envelopes should be checked against controller code before preserving them; the following is a recommended typed contract, not a claim that the current API already returns it.

| Operation | Request | Recommended response | Validation/permission | Scheduling side effect |
|---|---|---|---|---|
| `GET /api/work-items/:workItemId/dependencies` | UUID path parameter | `200 { success: true, dependencies: [{ id, workItemId, dependsOnWorkItemId, type, lagWorkingDays, predecessor, successor }] }` | Authenticated; `task:read`; task accessible in caller’s organization/project. | None. |
| `POST /api/work-items/:workItemId/dependencies` | `{ "dependsOnWorkItemId": "<uuid>", "type": "FS", "lagWorkingDays": 0 }`; type/lag may be omitted if fixed FS/zero lag. | `201 { success: true, dependency, rescheduledWorkItems: [...] }` (or retain established envelope while including affected tasks). | Authenticated; `task:update`; reject missing/cross-project/cross-org task, self-edge, duplicate, invalid type/lag, and cycle. | Atomically create edge and reschedule affected unfinished successors, if policy requires. |
| `DELETE /api/work-items/:workItemId/dependencies/:depId` | Existing path; current controller interprets `depId` as predecessor `dependsOnWorkItemId`, not edge-row UUID. | `200 { success: true, removedDependency, rescheduledWorkItems: [...] }` or existing no-content convention, agreed before frontend changes. | Authenticated; `task:update`; verify both edge endpoints and access. | Decide whether removal leaves dates as-is or recomputes from remaining predecessors; return every changed task. |
| Existing task update endpoint | Current task update body, extended only for approved planned start/duration fields. | Existing updated task envelope plus affected task schedule changes, or a stable schedule-change field. | Existing auth/validation; validate date ordering and duration. | Persist the edited task and cascade within one transaction. |

For cycle rejection, return HTTP `409` with the established error shape, e.g. `{ success:false, code:"DEPENDENCY_CYCLE", message:"Dependency would create a cycle", cycle:["Build API","Connect frontend","Testing","Build API"] }`. Preserve the existing `{ success:false, code, message }` convention; the optional `cycle` field is a contract extension. A missing/invalid task should use the repository’s established 4xx validation/not-found handling.

Do not silently reinterpret `depId`: either preserve its existing predecessor-ID meaning and document it, or introduce a versioned/compatible edge-ID contract and update the frontend. The user flow is: select predecessor → submit edge → server checks permissions and same-project/org → lock/transaction → reject cycle or persist edge and cascade → return canonical changed tasks → frontend replaces/reconciles affected state and displays result.

## 11. Dependency graph and cycle-detection design

Represent each dependency row as predecessor → successor for traversal: `dependsOnWorkItemId` points to `workItemId`. When adding predecessor `P` to successor `S`, the new directed edge is `P → S`; it creates a cycle exactly when `P` is already reachable from `S`. Search the project graph before insert. If reachable, reconstruct the actual path and append the start node to return a readable closed cycle, with task names and IDs available for unambiguous UI display.

Use iterative/recursive DFS with a visited set and parent map, or another linear-time traversal, in `O(V + E)` for the affected project graph. Validate missing nodes, self-edge, duplicate, and project/organization scope before persistence. Frontend `dependencyGraph.ts` can continue to provide immediate feedback, but only the backend result is authoritative.

Build affected successors from the changed task, then calculate in topological order. Multiple predecessors constrain a successor using the latest required start. The implementation must detect and fail if existing persisted graph data is cyclic rather than silently appending remaining nodes as `criticalPath.ts` currently does.

## 12. Automatic scheduling algorithm and working-day rules

Recommended first scope is Finish-to-Start (FS), Monday–Friday, no holiday calendar, and zero working-day lag by default. Define whether “finish” is `dueDate` and whether zero lag means same working day or the next working day. A conservative recommendation is that an unfinished successor starts on the first working day strictly after its latest predecessor finish plus configured working-day lag; document this as a product rule before implementation.

Suggested transaction algorithm:

1. Load and validate the changed task, its project graph, and policy-relevant status.
2. Acquire the project-level schedule/graph lock.
3. For dependency mutations, validate the prospective edge and cycle before writing it.
4. Persist the dependency/date/duration edit.
5. Traverse all reachable successors in topological order.
6. Compute each successor’s earliest allowed start as the maximum of all predecessor constraints.
7. If an auto-scheduled unfinished successor must move, preserve its stored working-day duration and compute its new finish; propagate the changed finish onward.
8. Persist all task dates and dependency changes atomically; return the entire changed-task set.

Frontend helpers already skip weekends and preserve business-day intervals, but backend needs equivalent authoritative functions. No holiday calendar exists. Existing task-level duration is absent, so the algorithm cannot safely preserve it until a task duration policy/field is established. Do not use assignment `estimatedHours` or time-entry totals as a silent substitute.

Behavior decisions required before build:

- **Multiple predecessors:** use the latest predecessor-imposed start; define how differing lags interact.
- **Cascades:** recalculate all affected successors in topological order, not just direct children.
- **Earlier moves:** recommended initial policy is to move successors later when constraints require it, not automatically pull them earlier after a predecessor advances or an edge is removed. Recompute-earlier can surprise users and should be a separate explicit policy.
- **Completed tasks:** recommended freeze their planned/actual history and report a constraint conflict if a predecessor change would require moving them; schema currently lacks explicit actual dates.
- **Tasks without duration:** do not guess. Require duration or leave dates unchanged with a surfaced scheduling conflict/decision.
- **Manual schedules:** current schema has no manual/automatic flag. Decide whether all eligible successors auto-move or users can pin a task.
- **Dates/timezone:** existing WorkItem due date is `timestamptz`; `DATE` is used for assignment start date; frontend form parsing and recurrence timezone do not establish one common task calendar. Choose date-only semantics or an explicit project timezone and consistently parse/store/display; do not infer from recurrence’s Asia/Kolkata setting.

## 13. Transaction, concurrency, authorization, and error-handling requirements

Use one TypeORM transaction for the graph check, edge mutation, affected task updates, and response data. A task-level lock alone does not serialize different edge writes in the same graph. Recommended simple strategy: serialize schedule/dependency mutations on the owning project row (`pessimistic_write`) before loading the graph; acquire subsequent task locks in stable sorted ID order. Apply the same lock order to dependency creation/deletion and every task update that can affect schedule dates. An equivalent PostgreSQL transaction-scoped advisory lock is possible but requires a documented keying strategy.

This avoids the check-then-insert race for cycles and keeps edge and schedule data atomic. On failure, roll back both edge and all date changes. Retain the unique pair constraint as a final duplicate guard. Avoid deadlocks by taking the project lock first and task locks in deterministic order; consider retry policy only for known transient database errors, not broad catches.

Check both endpoints against the caller’s organization and same project; keep existing `task:update`/`task:read` and project membership semantics. Resolve the current public-project membership-policy mismatch intentionally, and enforce all checks on the server. If database-level tenant/project invariants are required, assess composite foreign keys only after confirming existing constraints and deployed data.

Use `AppError` and centralized async error handling. Return explicit 409 cycle/duplicate/conflict errors with stable codes, 400-class validation errors for invalid dates/durations/lag, and existing not-found/permission responses. Never return success-shaped fallback data or hide scheduling failures. Frontend must show failures and restore/reconcile optimistic state.

The database driver is PostgreSQL; deployed server version, production migration state, and actual transaction isolation settings were not verifiable from repository source. Migrations are configured but were not observed auto-running at application startup.

## 14. Testing strategy and acceptance criteria

### Unit tests

- Graph direction and cycle path for direct and indirect cycle attempts, with readable closed path.
- Missing node, self-edge, duplicate edge, and topological ordering.
- Business-day add/difference with Friday-to-Monday, weekends, zero/positive lag, and multi-week cascades.
- Multiple predecessor max constraint, duration preservation, no-duration behavior, earlier-shift policy, and completed/manual task policy.
- Validate date-only/timezone conversions under the chosen project calendar.

### Backend integration tests

- Dependency list/create/delete and response shape; duplicate and self-link errors.
- Same-project/same-organization enforcement; cross-project and cross-organization denial; unauthorized/non-member behavior matching the selected public-project policy.
- Direct/indirect cycle rejection returns complete path and persists no edge.
- Cascade across multiple levels, multiple predecessors, and weekend skipping; stored duration remains constant.
- Dependency removal behavior and task date-update behavior.
- Transaction rollback when any downstream schedule write fails.
- Concurrent dependency requests that would jointly create a cycle: at most one commits; no cyclic graph remains.
- Status completion/reopening behavior for dependency rules if status gating is selected.

### Frontend/API and end-to-end tests

- Cycle 409 is rendered with full cycle path even when local preflight was bypassed/stale.
- Dependency create/delete reflects canonical backend state; failed requests roll back optimistic changes and show an error.
- Date/duration edits persist and refresh all rescheduled tasks, including after reload.
- Drawer and dependency view controls respect role UX; backend remains authoritative.
- Timeline displays changed bars and, if approved, dependency connectors.
- Regression coverage for existing task CRUD, workflow/sprint transitions, recurrence, and SLA behavior.

### Acceptance criteria

1. No API path can persist a self-link, duplicate, cross-project/org edge, or cyclic graph.
2. A detected cycle returns a stable error and a complete readable path before commit.
3. An approved schedule mutation atomically updates the dependency and all affected persisted tasks or commits nothing.
4. Weekend and duration rules match the selected date/timezone policy across backend and frontend.
5. UI state after success matches server data; errors do not leave success-shaped stale state.
6. Existing task, recurrence, sprint/workflow, and SLA tests remain passing.

## 15. Implementation order with dependencies

1. **Resolve product rules** in Section 16: date/timezone, duration source, FS boundary/lag, completion/manual behavior, and pulling earlier.
2. **Confirm persistence and deployment state**; design an additive reversible migration only for approved columns/constraints.
3. **Implement and unit-test backend graph and business-day rules** in the dependency service; cycle-path output must be stable.
4. **Implement transaction/locking policy** and backend dependency CRUD; include auth/scope checks and concurrency tests.
5. **Add scheduling persistence and cascade** to dependency changes and task create/update flows; return affected tasks atomically.
6. **Extend backend validation and API types/contracts**; test errors, rollback, and legacy delete semantics.
7. **Align frontend types/API/state** to the canonical contract; persist/reconcile schedule changes and show cycle errors.
8. **Wire task detail date/dependency UI** to the backend flow; retain the existing dependency page and optional preview.
9. **Add optional Gantt connectors and UX polish** only after server data is authoritative.
10. **Run targeted suites, then relevant regressions** for task/workflow, recurrence, sprint, SLA, and frontend scheduling; rehearse migration against a populated database copy before deployment.

Dependencies: steps 3–6 rely on step 1; step 5 also relies on step 2 if schema changes are needed. Frontend contract/state work (step 7) depends on the agreed backend contract from steps 4–6. Visualization work is optional and should follow persisted behavior.

## 16. Unresolved product decisions and assumptions

1. Does a task’s `dueDate` represent planned finish, and should it remain a timestamp or become/use a date-only value for scheduling?
2. What is the authoritative task duration: a new working-day duration, estimated hours converted by a workday length, or another model? How are existing tasks initialized?
3. Which timezone defines a working day? Is the calendar always Monday–Friday, or should project holidays/weekends be configurable?
4. For FS with zero lag, may a successor start on the predecessor’s finish date, or only on the next working day?
5. Are edge type and lag needed in the first release, or is fixed FS/zero lag sufficient?
6. Should successors ever move earlier after a predecessor advances or a dependency is removed?
7. Are completed tasks immutable to reflow? What should happen when a fixed/completed task violates a new dependency constraint?
8. Can users manually pin tasks, and if so how is that state persisted?
9. Should adding/removing a dependency immediately reflow dates, or only task date/duration edits? Should users get a preview/confirmation before commit?
10. Does dependency completion block status transitions, or are dependencies schedule-only?
11. What is the intended public-project permission behavior for dependency reads and writes?
12. Should deletion continue to identify an edge by predecessor task ID, or move to the dependency row UUID?
13. Are notifications/audit events required for automatic changes, and should rescheduling be synchronous or durable asynchronous work?

Unverified: active production schema and migration state; PostgreSQL server version/isolation; project timezone; date serialization conventions across all clients; external API consumers of dependency endpoints; and database-backed test/concurrency infrastructure.

## 17. Final checklist of required changes

- [ ] Reuse existing `WorkItemDependency`; do not create a duplicate relationship table.
- [ ] Make backend cycle detection and complete cycle-path errors authoritative.
- [ ] Serialize dependency graph changes and schedule-affecting task updates at project scope.
- [ ] Define and persist task-level planned start/duration semantics before claiming duration-preserving scheduling.
- [ ] Implement transactional downstream traversal, topological scheduling, weekend rules, and rollback.
- [ ] Preserve organization/project authorization and resolve public-project behavior consistently.
- [ ] Clarify dependency deletion identifier and response contract.
- [ ] Align frontend dependency types, API methods, and state updates with backend truth.
- [ ] Integrate date/dependency controls with persistence and visible failure recovery.
- [ ] Add cycle, concurrency, date, multi-predecessor, cascade, rollback, authorization, and regression tests.
- [ ] Add a forward reversible migration only if approved schema changes are needed; verify against deployed state.
- [ ] Keep Gantt connectors and richer visualization optional; do not duplicate existing frontend modules.

**Inspection-only verification:** the report destination was absent before creation. No existing source, configuration, package, migration, or database file was modified by this audit.
