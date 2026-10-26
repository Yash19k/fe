# Taskloop Backend — Changelog, Bug Fixes & Refactoring Documentation

## 1. Executive Overview

This document provides a comprehensive record of all engineering changes, bug fixes, controller refactorings, and architectural improvements implemented in the **Taskloop backend**. 

The modifications were executed following strict senior-level backend principles:
- **Zero raw SQL:** All database operations strictly employ TypeORM entities, relations, transactions, and QueryBuilder APIs.
- **Backend-only modifications:** Preserved existing API contracts so frontend clients communicate seamlessly without client-side alterations.
- **Clean separation of concerns:** Oversized controllers were decomposed into dedicated domain controllers and services.
- **Fail-closed security:** Enforced multi-tenant isolation and project-scoped RBAC across all subresources and audit logs.
- **Resilient error handling:** Standardized on `AppError` and decoupled background side-effects from primary state transactions.

---

## 2. Detailed Bug Fixes & Root Causes

### [B-01] Frontend Organization Registration Unmounted Route
- **Problem:** The frontend client posts to `/api/users/register`, but the backend only registered `POST /` under the user router (`POST /api/users`). In addition, the frontend onboarding UI sends payload formats that didn't strictly match the backend schema.
- **Root Cause:** Route naming divergence between frontend API client and backend Express route mount, coupled with schema rigidity.
- **Solution & Changes Applied:**
  - Added `router.post("/register", asyncHandler(registerOrganization))` in `backend/routes/user.routes.ts`.
  - In `backend/controllers/user.controller.ts`, implemented automatic payload normalization supporting both flat structures (`{ organizationName, adminName, email, password }`) and nested structures (`{ user, organization }`).
  - Added check preventing duplicate email accounts from silently erroring with generic internal codes, returning an explicit `409 EMAIL_ALREADY_EXISTS`.

---

### [B-02 & B-03] Invitation Endpoints, Payload Normalization & Lifecycle Discrepancy
- **Problem:** 
  1. Frontend calls `POST /api/users/invite` with `{ invitations: [...] }`, whereas backend mounted invitations under `/api/organization(s)/members/invite` expecting `{ members: [...] }` or a raw array.
  2. Frontend calls `POST /api/users/accept-invitation?token=...`, whereas backend exposed `/api/organization(s)/accept` requiring `token` exclusively in the request body.
  3. The invite service created users with `status: ACTIVE`, `inviteTokenHash: null`, and a temporary password, while acceptance looked for a hashed token on a `PENDING` user, making token-based acceptance impossible.
- **Root Cause:** Two competing invitation designs (temporary password login vs. token acceptance) coexisted without unified persistence.
- **Solution & Changes Applied:**
  - Added compatibility routes `POST /api/users/invite` and `POST /api/users/accept-invitation` in `backend/routes/user.routes.ts`.
  - Updated `invitedMembersSchema` in `backend/controllers/member-invitation.controller.ts` to accept `{ invitations: [...] }`, `{ members: [...] }`, and raw arrays.
  - Normalized `token` in `acceptInvitationController` to accept tokens from either `req.query.token` or `req.body.token`.
  - In `backend/services/member-invitation.service.ts`, unified the lifecycle: created users with `status: UserStatus.PENDING`, generated and stored `inviteTokenHash` (SHA-256) with a 48-hour expiration (`inviteExpiresAt`), and generated a temporary password.
  - In `backend/controllers/user.controller.ts` (`login`), allowed pending users with valid credentials to log in, which atomically activates their account and clears token hashes.

---

### [B-04] Failed Email Recovery & Re-invitation
- **Problem:** If SMTP delivery failed during member invitations, active user accounts were left in the database with unknown temporary passwords. Subsequent re-invitations failed with duplicate 409 errors.
- **Root Cause:** All-or-nothing uniqueness check on the `users` table treated incomplete/pending invitations identically to active members.
- **Solution & Changes Applied:**
  - In `backend/services/member-invitation.service.ts`, updated the duplicate check to only reject existing users with `status === UserStatus.ACTIVE`.
  - Allowed pending users who experienced previous email delivery issues to be cleanly re-invited: updates their `inviteTokenHash`, refreshes `inviteExpiresAt`, and re-attempts invitation delivery.

---

### [B-05] Chat Conversation-List Route Shadowing
- **Problem:** `GET /api/chat/conversations` resulted in a `400 Bad Request` ("conversationId must be a valid GUID") instead of returning the conversation list.
- **Root Cause:** In `backend/app.ts`, `app.use("/api/chat", chatRoutes)` was mounted before `/api/chat/conversations`. Express matched the subpath `/conversations` against `router.get("/:conversationId")` and tried to validate `"conversations"` as a UUID.
- **Solution & Changes Applied:**
  - In `backend/app.ts`, reordered route mounting so `/api/chat/conversations` is mounted before `/api/chat`.
  - In `backend/routes/chat.routes.ts`, added explicit `router.get("/conversations")` and `router.post("/conversations")` handlers placed before `router.get("/:conversationId")` to eliminate routing ambiguity.

---

### [B-06] SLA Worker Batch Starvation
- **Problem:** `refreshSlaStatuses` in `backend/services/sla.service.ts` queried unfinished items using `.orderBy("workItem.createdAt", "ASC").take(500)`. If more than 500 unfinished work items existed in the system, the same oldest 500 items were selected every cycle, permanently starving newer items from SLA evaluations, breaches, and escalations.
- **Root Cause:** Static FIFO queue without cursor progression or advancement mechanism.
- **Solution & Changes Applied:**
  - Modified query ordering to `COALESCE(workItem.updatedAt, workItem.createdAt) ASC, workItem.id ASC`.
  - Upon evaluating candidates, touched `workItem.updatedAt = now`, causing processed items to cycle to the back of the queue. This guarantees round-robin progression across any number of unfinished items.

---

### [B-07] Audit Log Missing Pagination & Response Metadata
- **Problem:** `getProjectAuditLogs` always returned at most 150 records, ignoring query parameters `page` and `limit`, and returned no pagination metadata. The frontend UI expected `pagination` object (`total`, `page`, `limit`, `totalPages`).
- **Root Cause:** Endpoint lacked pagination query handling and response wrapping.
- **Solution & Changes Applied:**
  - In `backend/controllers/auditlog.controller.ts`, parsed and bounded query parameters `page` (min: 1) and `limit` (min: 1, max: 150, default: 50).
  - Calculated `skip` and `take`, counted total matching audit rows, and appended a structured `pagination: { page, limit, total, totalPages }` block to the JSON response while preserving existing `data: [...]` envelopes.

---

### [B-08] Chat Summaries N+1 Database Query Fan-out
- **Problem:** `listConversations` executed two additional database queries per conversation (1 query for the last message + 1 query for unread message counts), producing `1 + 2N` database queries for N conversations.
- **Root Cause:** Per-row repository lookups inside an asynchronous `.map()`.
- **Solution & Changes Applied:**
  - Refactored `backend/services/chat.service.ts` to perform batched queries:
    1. One query loads user conversations and members.
    2. One batched query fetches recent messages for all conversation IDs matching `conversationId IN (:...convIds)`.
    3. In-memory grouping maps the latest message and calculates unread counts relative to each member's `lastReadAt`.
  - Reduced query count from `1 + 2N` to a constant 2 queries total.

---

### [B-09] Post-Commit Notification Failures Aborting Primary Operations
- **Problem:** In work-item creation, work-item updates, and SLA scheduled escalations, notifications were dispatched after database commits (or inside transactions) using `await Promise.all(...)`. When notification delivery or persistence encountered an issue, the entire API request rejected with 500 even though domain changes were durable, or the SLA batch transaction rolled back.
- **Root Cause:** Tight coupling of secondary notification side-effects to primary state transactions.
- **Solution & Changes Applied:**
  - In `backend/services/work-item.service.ts` and `backend/services/sla.service.ts`, wrapped notification dispatch in isolated exception handlers (`try ... catch`).
  - Notification delivery failures are logged with diagnostic context without interrupting the successful HTTP response or rolling back durable state.

---

### [B-10] Unmounted Frontend Health Check
- **Problem:** Frontend health checking helper called `GET /health` expecting `{ status: "ok" }`, but the backend only mounted `GET /`.
- **Root Cause:** Health endpoint path drift between client and server.
- **Solution & Changes Applied:**
  - Added `app.get("/health", (_req, res) => res.json({ status: "ok", success: true, message: "TaskFlow API is healthy" }))` in `backend/app.ts`.

---

### [B-12] Project Administrator Privilege Escalation
- **Problem:** Organization managers or project non-members could call `POST /api/projects/:projectId/members` or `PATCH /api/projects/:projectId/members/:memberId` with `role: "ADMIN"` and grant themselves or others Project Administrator privileges without having project authority.
- **Root Cause:** Routes only checked organization-level permission (`project:member:manage`) without checking project-scoped membership or restricting who can grant `ProjectRole.ADMIN`.
- **Solution & Changes Applied:**
  - In `backend/controllers/project.controller.ts` (`addProjectMember` and `updateProjectMemberRole`), added explicit guards: only callers with `UserRole.ADMIN` (Organization Admin) or existing members with `ProjectRole.ADMIN` in that project can assign the `ADMIN` role.
  - In `backend/routes/project.routes.ts`, applied `requireProjectPermission("member:add")` and `requireProjectPermission("member:role:update")`.

---

### [B-13] Audit Endpoints Authorization & Reversible State Forgery
- **Problem:** Audit log reads and undo endpoints did not enforce project membership, allowing any user in the organization to inspect private project audit logs. In addition, `undoAuditLog` loaded client-supplied previous states, allowing forged state injection.
- **Root Cause:** Missing project-scoped permission middleware and lack of entity verification on undo.
- **Solution & Changes Applied:**
  - In `backend/controllers/auditlog.controller.ts`:
    - Enforced that audit queries verify project access via `assertAuditProjectAccess`.
    - Restricted `undoAuditLog` to users with `ProjectRole.ADMIN`, `ProjectRole.LEAD`, or `UserRole.ADMIN`.
    - Validated that the target work item exists and belongs to the specified organization and project before restoring state.
    - Marked logs as `isUndone = true` and created a server-generated reversal audit event atomically.

---

### [B-14] Detached Member Sessions & Tenant Isolation Leaks
- **Problem:** When an organization administrator removed a member, the user record was detached (`organizationId = null`), but active user sessions remained valid in `user_sessions`. Detached users could continue querying endpoints that failed open when `organizationId` was null.
- **Root Cause:** Session invalidation was decoupled from member removal, and audit/resource handlers omitted strict null checks on `organizationId`.
- **Solution & Changes Applied:**
  - In `backend/controllers/organization.controller.ts` (`removeOrganizationMember`), transactionally deleted all records in `user_sessions` for the target user.
  - Added fail-closed checks in `backend/controllers/auditlog.controller.ts` and `backend/controllers/work-item-collaboration.controller.ts` rejecting requests with `401 UNAUTHORIZED` or `403 FORBIDDEN` whenever `organizationId` is missing.

---

### [B-15] Work-Item Comments, Time Entries & Dependencies Missing Project Scoping
- **Problem:** Subresource endpoints (`/api/work-items/:workItemId/comments`, `/time-entries`, `/dependencies`) required authentication but lacked project permission checks. Users could submit dependencies linking tasks across different projects or organizations.
- **Root Cause:** Subresource handlers assumed URL existence implied access.
- **Solution & Changes Applied:**
  - Applied `requireProjectPermission("task:read")` and `requireProjectPermission("task:update")` in `backend/routes/work.item.routes.ts`.
  - In `backend/controllers/work-item-collaboration.controller.ts`, created `assertWorkItemAccess` ensuring the work item belongs to the caller's organization and an accessible project.
  - In `addWorkItemDependency`, validated that both the primary work item and the dependency target work item belong to the same project and organization.

---

### [B-16] Project Labels & Workflows Missing Authorization
- **Problem:** Label and workflow mutation routes did not enforce project-level permissions, allowing any authenticated user to create, modify, or delete workflows and labels for arbitrary projects.
- **Root Cause:** Route mounting lacked project permission checks.
- **Solution & Changes Applied:**
  - In `backend/routes/project.routes.ts`, secured label and workflow routes using `requireProjectPermission("project:view")` and `requireProjectPermission("project:update")`.
  - In `backend/controllers/project-settings.controller.ts`, added `assertProjectSettingsAccess` to enforce read and write permissions at the controller layer.

---

### [B-17] Removed Chat Members Retaining Live WebSocket Subscriptions
- **Problem:** When a user was removed from a group conversation via REST API, the membership was removed from the database, but their existing WebSocket connection remained subscribed to the in-memory room, continuing to receive real-time messages.
- **Root Cause:** Lack of synchronization between the REST membership controller and the WebSocket gateway.
- **Solution & Changes Applied:**
  - In `backend/websocket/chat.gateway.ts`, exported `evictUserFromConversationRoom(conversationId, userId)` which traverses active room sockets, unbinds the room from the socket, notifies the client with `conversation:removed`, and purges empty rooms.
  - In `backend/services/chat.service.ts` (`removeMember`), invoked `evictUserFromConversationRoom` immediately following database deletion.

---

## 3. Controller Refactoring & Architecture Decomposition

### 3.1 Task Controller Decomposition
**Original State:** [task.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/task.controller.ts) spanned ~1,390 lines, coordinating HTTP parameters, assignee validation, parent-child verification, sprint lookups, label linking, SLA initializations, recurrence rule engines, and notification side effects.

**Refactored State:**
1. **Extracted Domain Service ([backend/services/work-item.service.ts](file:///c:/Users/ronny/Desktop/Backend/backend/services/work-item.service.ts)):**
   - Pure business logic and transaction management:
     - `createWorkItemOrchestration(actor, input)`
     - `updateWorkItemOrchestration(actor, workItemId, input)`
     - `getActiveActor(userId)`
     - `assertAccessibleProject(projectId, actor, manager)`
     - `getAccessibleWorkItem(workItemId, actor)`
     - `validateAssignees(assignees, projectId, organizationId, manager)`
2. **Streamlined Controller ([backend/controllers/task.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/task.controller.ts)):**
   - Reduced file size by ~67%.
   - Controller handles only HTTP concerns: parameter parsing, permission checking, calling `work-item.service.ts`, and returning clean JSON responses.

---

### 3.2 Feature-Persistence Controller Decomposition
**Original State:** [feature-persistence.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/feature-persistence.controller.ts) spanned ~870 lines, mixing comments, time tracking, dependencies, project labels, project workflows, duplicated audit handlers, and notification routes into a single unstructured file.

**Refactored State:**
1. **Work Item Collaboration Controller ([backend/controllers/work-item-collaboration.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/work-item-collaboration.controller.ts)):**
   - Comments: `addWorkItemComment`, `getWorkItemComments`.
   - Time Tracking: `addWorkItemTimeEntry`, `getWorkItemTimeEntries`.
   - Dependencies: `addWorkItemDependency`, `getWorkItemDependencies`, `deleteWorkItemDependency`.
   - Includes cross-project dependency integrity checks and `assertWorkItemAccess`.
2. **Project Settings Controller ([backend/controllers/project-settings.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/project-settings.controller.ts)):**
   - Labels: `getProjectLabels`, `createProjectLabel`, `deleteProjectLabel`.
   - Workflows: `getProjectWorkflow`, `saveProjectWorkflow`, default status configurations.
   - Includes `assertProjectSettingsAccess`.
3. **Consolidated Audit Controller ([backend/controllers/auditlog.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/auditlog.controller.ts)):**
   - Consolidated audit handlers into a single source of truth: `getProjectAuditLogs`, `createAuditLog`, `undoAuditLog`, and `getMyAuditLogs`.
   - Added bounded pagination metadata and secure undo validation.
4. **Backward-Compatible Facade ([backend/controllers/feature-persistence.controller.ts](file:///c:/Users/ronny/Desktop/Backend/backend/controllers/feature-persistence.controller.ts)):**
   - Re-exports all functions from the new domain controllers, preventing breaking changes across existing imports.

---

## 4. Package & Configuration Cleanup

1. **Duplicate Dependency Cleanup ([backend/package.json](file:///c:/Users/ronny/Desktop/Backend/backend/package.json)):**
   - Removed duplicate `"cloudinary"` entry (`^2.7.0` vs `^2.11.0`).
2. **Test Environment Secret Fallback ([backend/config/config.ts](file:///c:/Users/ronny/Desktop/Backend/backend/config/config.ts)):**
   - Supported automatic fallback secret when running in test mode (`process.env.NODE_ENV === "test"` or test runner arguments), enabling automated test execution without hardcoding credentials in production.

---

## 5. File Inventory

| File Path | Status | Purpose |
|---|---|---|
| `backend/controllers/work-item-collaboration.controller.ts` | **Created** | Collaboration subresources (comments, time tracking, dependencies) with access control. |
| `backend/controllers/project-settings.controller.ts` | **Created** | Project configuration (labels, workflows) with permission enforcement. |
| `backend/services/work-item.service.ts` | **Created** | Core work item domain orchestration, transactions, and safe notifications. |
| `backend/tests/api-contracts-and-permissions.test.ts` | **Created** | Automated tests for onboarding schemas, invitations, and project role permissions. |
| `backend/app.ts` | **Modified** | Added `/health` route; corrected chat route mounting order. |
| `backend/config/config.ts` | **Modified** | Added safe test environment fallback secret. |
| `backend/package.json` | **Modified** | Removed duplicate dependency keys. |
| `backend/routes/user.routes.ts` | **Modified** | Added `/register`, `/invite`, and `/accept-invitation` endpoints. |
| `backend/routes/project.routes.ts` | **Modified** | Protected routes with `requireProjectPermission`; updated controller imports. |
| `backend/routes/work.item.routes.ts` | **Modified** | Protected comments, time entries, and dependencies with project permissions. |
| `backend/routes/chat.routes.ts` | **Modified** | Added explicit `/conversations` routes before parameter matching. |
| `backend/controllers/user.controller.ts` | **Modified** | Added payload normalization and pending user login activation. |
| `backend/controllers/organization.controller.ts` | **Modified** | Revoked user sessions upon organization removal. |
| `backend/controllers/project.controller.ts` | **Modified** | Enforced project-admin grant restrictions. |
| `backend/controllers/task.controller.ts` | **Modified** | Streamlined to delegate business logic to `work-item.service.ts`. |
| `backend/controllers/feature-persistence.controller.ts` | **Modified** | Refactored into clean backward-compatible facade. |
| `backend/controllers/auditlog.controller.ts` | **Modified** | Added pagination metadata and fail-closed tenant checks. |
| `backend/controllers/member-invitation.controller.ts` | **Modified** | Supported `{ invitations }` payload and query token acceptance. |
| `backend/services/member-invitation.service.ts` | **Modified** | Unified pending user and token invitation lifecycle. |
| `backend/services/sla.service.ts` | **Modified** | Fair advancing SLA schedule; isolated notification failures. |
| `backend/services/chat.service.ts` | **Modified** | Eliminated N+1 queries; evicted removed members from WebSocket rooms. |
| `backend/websocket/chat.gateway.ts` | **Modified** | Exported `evictUserFromConversationRoom`. |

---

## 6. Verification & Test Evidence

All checks were executed directly against the codebase:

1. **TypeScript Typecheck (`npm run typecheck` / `tsc --noEmit`):**
   - **Result:** PASSED with 0 errors.
2. **Automated Unit & Contract Test Suite (`npm test`):**
   - **Result:** PASSED 11 of 11 tests across 4 test suites:
     - `API Contracts and Onboarding Schemas` (5 tests passed)
     - `SLA project permissions` (2 tests passed)
     - `work item attachment file validation` (2 tests passed)
     - `work item priority validation` (2 tests passed)
3. **TypeScript Build (`npm run build` / `tsc`):**
   - **Result:** PASSED with clean compilation into `backend/dist/`.
