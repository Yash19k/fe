# Work Item Creation and Attachment Upload Flow Audit

**Scope:** Evidence-based audit of the current frontend-to-backend Work Item creation and attachment upload lifecycle.  
**Recommendation scope:** Backend changes only. Frontend files are inspected to establish the request/response contract and diagnose observed behavior; no frontend code changes are proposed here.  
**Audit limitation:** No production/server logs, Cloudinary account configuration, deployment environment, or live reproduction were available. The specific reported attachment `500` therefore cannot be attributed to a confirmed provider or database cause.  
**Repository changes:** This report documents recommended changes; it does not itself implement those changes.

## A. Executive Summary

The current frontend and backend agree on the basic attachment-upload protocol:

- Create the Work Item as JSON using `POST /api/work-items`.
- Receive the persisted Work Item ID.
- Upload one or more actual browser `File` objects in a separate multipart request to `POST /api/work-items/:workItemId/attachments`.
- Use `attachments` as the multipart field name.
- The backend parses the same field with Multer's `.array("attachments", 5)`, uploads to Cloudinary, persists metadata, and returns an `attachments` array.

This separate-request design is already what the frontend depends on and should be retained for the remediation. The backend attachment path already has important protections: authentication, project permission checks, work-item access checks, supported MIME/extension checks, bounded file count, and compensating Cloudinary deletion when an upload batch or metadata save fails.

The most important confirmed weaknesses are:

1. **Post-commit notification failure can make a successful create appear to fail.** The Work Item transaction commits before notification creation is awaited. If notification creation rejects, the client gets an error despite the row already existing. If the client retries after not receiving the ID, it can create a duplicate.
2. **Work Item deletion removes database metadata but not Cloudinary objects.** The attachment foreign key cascades database-row deletion; no Cloudinary deletion is called by the Work Item delete controller. This creates orphaned external assets.
3. **Due dates are treated as both calendar dates and timestamps.** The frontend date input requires `YYYY-MM-DD`; the backend stores `timestamptz` and serializes an ISO timestamp. The active details drawer binds the returned value directly to a date input. The reported browser warning is consistent with this contract mismatch. If due dates mean calendar days, backend persistence and comparisons also need date-only semantics; simply trimming the returned string would conceal rather than solve the data-contract issue.
4. **Attachment retry is not idempotent.** A completed upload can be repeated if the response is lost or the frontend rejects the returned shape. A retry can create additional Cloudinary assets and database rows.
5. **Create-time server-side hierarchy validation is incomplete.** Creation checks that a parent exists in the same project and organization, but not that its type is allowed or that a Subtask has a parent. The frontend's hierarchy validation is not a substitute for backend enforcement.
6. **The Multer memory ceiling is large.** The server permits five files of up to 100 MB each in memory, while the active frontend picker caps each file at 25 MB. Large/concurrent requests can put significant memory pressure on the server.
7. **File validation trusts client-declared MIME type and filename extension.** Neither is proof of file content.

The reported `POST /api/work-items/:id/attachments` `500` remains **unresolved at the cause level**. The inspected source confirms request field and route alignment, and that Cloudinary and database failures can flow to the generic error handler. It does not establish which failure happened. The next diagnostic step is to correlate backend logs for a failed request and distinguish Multer, Cloudinary, database persistence, and other failures without exposing provider details to the client.

## B. Current Frontend-to-Backend Flow

### B.1 Frontend collection and request sequence

1. **Open and populate the active Work Item creation UI.**  
   The active modal is [`frontend/src/components/tasks/CreateTaskModal.tsx`](./frontend/src/components/tasks/CreateTaskModal.tsx), imported by `frontend/src/App.tsx`. It collects:
   - Work Item type, title, description, status, and priority.
   - Parent ID, selected assignees, labels, start date, due date, sprint ID, and estimate hours.
   - Recurrence configuration and type-specific fields for Epics, Stories, and Bugs.
   - Attachment display metadata plus the selected files.

2. **Select and retain files.**  
   [`frontend/src/components/tasks/TaskAttachments.tsx`](./frontend/src/components/tasks/TaskAttachments.tsx) receives file selection from the browser input. It retains actual `File` instances separately from preview metadata, generates object URLs for previews, and stores blobs in frontend media storage. The picker allows up to five files, checks MIME/extension pairing, and caps individual files at 25 MB. `CreateTaskModal` checks that the `File` instances remain available before submitting.

3. **Prepare the JSON creation payload.**  
   `CreateTaskModal.handleSubmit` builds a payload containing form fields and metadata-only attachment entries. Those metadata entries are not uploaded files. The actual files are passed separately to the upload call.

4. **Map and send create data.**  
   [`frontend/src/state/AppContext.tsx`](./frontend/src/state/AppContext.tsx), in `createTask`, applies frontend permission/hierarchy checks, sanitizes fields, and calls `createWorkItemApi`. The mapping sends:
   - `projectId`, `sprintId`, `parentWorkItemId`
   - type, title, description, priority, status, and `dueDate`
   - `assignees: [{ userId }]`

   [`frontend/src/services/api.ts`](./frontend/src/services/api.ts) sends this as JSON to `POST /api/work-items`. The generic JSON request helper sets `Content-Type: application/json`, attaches a bearer token when present, and includes a refresh flow. A `data.id` Work Item response is converted by `backendWorkItemToTask`; the task is added to frontend state and the modal gets the persisted ID.

5. **Upload attachments in a separate request.**  
   Once creation returns an ID, `CreateTaskModal.handleSubmit` calls `uploadTaskAttachments`. `uploadWorkItemAttachmentsApi` in `frontend/src/services/api.ts` appends each actual file using:

   ```text
   formData.append("attachments", file)
   ```

   It posts to:

   ```text
   POST {API_BASE_URL}/api/work-items/{workItemId}/attachments
   ```

   The browser generates the multipart `Content-Type` and boundary; the function does not manually set a JSON content type. It sends an Authorization header if a token is stored. Unlike the generic JSON request helper, this direct `fetch` call does not set `credentials: "include"` and does not use the generic refresh/retry flow.

6. **Interpret upload response and failure.**  
   The frontend expects JSON with an `attachments` array matching the number of selected files. Each returned attachment is expected to have an ID and a storage key or URL. On successful validation, the frontend updates the in-memory Work Item's attachment metadata.

   If upload fails after Work Item creation, the modal retains the created Work Item ID and selected files and reports that the item already exists. Retrying from that state is intended to retry attachment upload only. This avoids a duplicate Work Item for a normal upload failure. It does not cover an ambiguous create result where the database commit succeeded but the response failed before the browser learned the ID.

### B.2 Backend route and execution path

1. [`backend/app.ts`](./backend/app.ts) mounts `workItemRoutes` at `/api/work-items`.
2. [`backend/routes/work.item.routes.ts`](./backend/routes/work.item.routes.ts) registers:
   - `POST /` with `isLoggedIn`, `requireProjectPermission("task:create")`, `validateCreateWorkItem`, and `asyncHandler(createWorkItem)`.
   - `POST /:workItemId/attachments` with `isLoggedIn`, `validateWorkItemId`, `requireProjectPermission("task:update")`, `uploadWorkItemAttachments`, and `asyncHandler(uploadAttachmentsToWorkItem)`.
3. [`backend/middleware/is.loggedin.ts`](./backend/middleware/is.loggedin.ts) accepts a bearer access token or `req.cookies.token` and attaches the user identity.
4. [`backend/middleware/project.permission.ts`](./backend/middleware/project.permission.ts) resolves the project from the body or Work Item ID, verifies organization and project access, and checks the requested action.
5. [`backend/validations/work.item.validations.ts`](./backend/validations/work.item.validations.ts) validates create JSON with Joi, including type, title, status, priority, due date, sprint/parent IDs, assignees, labels, and recurrence fields.
6. `createWorkItem` in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts):
   - Loads an active actor and checks accessible project.
   - Verifies parent, sprint, label, and assignees.
   - Creates the Work Item, SLA state, assignee rows, and recurrence inside a TypeORM transaction.
   - After the transaction commits, sends notifications for assigned users.
   - Returns `{ success, message, data }`, with the Work Item ID under `data.id`.
7. For the attachment endpoint, [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts) configures memory storage, applies file count/size/field limits, checks declared MIME and extension, then parses `.array("attachments", 5)` into `req.files`.
8. `uploadAttachmentsToWorkItem` in `task.controller.ts` loads an active actor, confirms the Work Item is accessible, rejects an empty upload, calls `uploadAndPersistWorkItemAttachments`, and responds with `{ success: true, attachments }`.
9. [`backend/services/work.item.attachment.service.ts`](./backend/services/work.item.attachment.service.ts) uploads files to Cloudinary concurrently, constructs attachment entities, persists them, and attempts to remove successful Cloudinary assets if another upload or metadata save fails.
10. [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts) validates that Cloudinary environment variables exist at module load, selects Cloudinary resource type based on the declared MIME type, streams each in-memory buffer, and exposes upload/delete operations.
11. [`backend/middleware/async.handler.ts`](./backend/middleware/async.handler.ts) forwards rejected controller promises to [`backend/middleware/error.handler.ts`](./backend/middleware/error.handler.ts). The handler logs the error server-side and returns a generic `"Internal Server Error"` for 5xx responses.

### B.3 Exact request/response contract summary

| Operation | Method and path | Request body | Expected response |
|---|---|---|---|
| Create Work Item | `POST /api/work-items` | JSON with project/type/title and supported optional fields; assignees are objects with `userId` | `201`, `{ success: true, data: { id, ... } }` |
| Upload attachments | `POST /api/work-items/:workItemId/attachments` | Multipart form; repeat `attachments` for each actual file | `201`, `{ success: true, attachments: [...] }` |

The multipart field name matches on both sides. The request is not a single multipart Work Item creation request.

### B.4 Form fields that are not currently forwarded

The modal collects more than the `AppContext.createTask` backend payload includes. In the inspected mapping:

- Labels are omitted even though the backend schema supports `labelId`/`labels`.
- Recurrence is omitted, and the form uses `recurrenceRule` whereas the backend create schema expects `recurrence`.
- Start date and estimate hours are collected but not part of the inspected backend create DTO/mapping.
- Epic, Story, and Bug-specific properties are collected by the modal but are not included in the inspected create mapping or backend create DTO.

These are frontend-to-backend integration gaps, not attachment upload causes. The backend-only plan does not prescribe frontend edits; the backend cannot persist fields that the request does not send. Any decision to support these values end-to-end requires coordinated contract work.

## C. Root Cause Analysis

Severity reflects impact and exploitability of the code defect, not certainty that it caused the reported runtime incident.

### R1 — A post-commit notification error can make Work Item creation look unsuccessful

- **Severity:** High
- **Status:** Confirmed defect; whether it caused a particular duplicate depends on runtime sequence.
- **Evidence:** `createWorkItem` runs the database writes inside `AppDataSource.transaction`, then awaits `Promise.all` for assignment notifications after the transaction returns. A rejected notification promise proceeds to `asyncHandler` and the global error handler. The response is sent only after notification creation completes.
- **Function/file:** `createWorkItem` in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts).
- **Why it occurs:** The HTTP success response is coupled to a side effect that occurs after the durable Work Item commit. Database rollback is no longer possible at that point, yet the controller can still return a `500`.
- **Observable impact:** The Work Item exists while the caller sees an error. If the caller retries without receiving the ID, a second Work Item can be created. With multiple assignees, `Promise.all` may also leave some notifications created and others failed.
- **Backend recommendation:** Preserve post-commit notification behavior but decouple delivery success from Work Item creation success. Prefer recording notification intent in a transactional outbox and processing it asynchronously. If that infrastructure is not available, isolate/log the notification failure in a way that does not report the already-committed Work Item as uncreated. Add an idempotency strategy for create retries if required by client behavior.
- **Do not:** Move external notification work inside the SQL transaction and assume that makes the external side effect transactional.

### R2 — Due date has timestamp persistence/serialization but calendar-date UI semantics

- **Severity:** Medium
- **Status:** Confirmed contract mismatch; the exact warning is consistent with it.
- **Evidence:**
  - The active creation modal uses `formatDateInputValue` to take a `YYYY-MM-DD` prefix when initializing its date inputs.
  - The active details drawer initializes `draft.dueDate` from `task.dueDate` and binds it directly to `<input type="date">`.
  - `backendWorkItemToTask` preserves `item.dueDate`.
  - The backend entity maps `dueDate` to `timestamptz`; the create/update validators accept ISO date values; the controller converts values to `Date`.
  - Dashboard overdue/due-soon queries compare the timestamp to `NOW()`.
- **Function/file:** Entity and validation in [`backend/entities/work.item.entity.ts`](./backend/entities/work.item.entity.ts) and [`backend/validations/work.item.validations.ts`](./backend/validations/work.item.validations.ts); persistence in `createWorkItem`/`updateWorkItem` in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts); output mapping in [`frontend/src/services/api.ts`](./frontend/src/services/api.ts); date input in [`frontend/src/components/tasks/TaskDetailsDrawer.tsx`](./frontend/src/components/tasks/TaskDetailsDrawer.tsx).
- **Why it occurs:** A date input accepts a date-only string, while the backend emits a timestamp such as `2026-11-03T00:00:00.000Z`. Timestamp conversion also introduces timezone semantics that are not necessarily appropriate for a calendar due date.
- **Observable impact:** Browser warning/blank input; users may be unable to edit the date as intended. If the value is converted to local time, it may display as a prior/next day. A midnight UTC timestamp can also be considered overdue during the due date in some timezones/query interpretations.
- **Backend recommendation:** Decide whether due dates represent a calendar day or an instant. The UI contract strongly suggests calendar-day semantics. If so, define date-only validation, persistence, serialization, and dashboard comparison semantics consistently; add a migration with an explicit policy for interpreting existing timestamp values. Leave SLA deadlines and other true instants as timestamps.
- **Runtime/requirements verification:** Confirm product timezone rules and the existing data interpretation before migration. Do not make an unreviewed UTC-to-local conversion.
- **Do not:** Change timestamps only to silence the browser warning or apply date-only semantics to SLA deadlines.

### R3 — Create-time hierarchy rules are weaker than the frontend's rules

- **Severity:** Medium
- **Status:** Confirmed backend validation gap.
- **Evidence:** `createWorkItem` verifies that a specified parent exists with the same project and organization, but it does not inspect parent type or require a parent for Subtasks. The existing `validateParentWorkItem` helper checks scope and, for updates, ancestry cycles; it does not enforce all type/required-parent rules. Frontend rules in `frontend/src/domain/hierarchy.ts` specify Epic/Story/Task/Bug/Subtask constraints.
- **Function/file:** `createWorkItem`, `validateParentWorkItem`, and create/update validation in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts) and [`backend/validations/work.item.validations.ts`](./backend/validations/work.item.validations.ts).
- **Why it occurs:** The backend treats parent existence as sufficient for creation, while hierarchy requirements currently reside partly in frontend validation.
- **Observable impact:** Direct API clients can create an Epic with a parent, a Subtask without one, a Subtask under an invalid type, or other invalid parent relationships despite the frontend preventing some of these cases.
- **Backend recommendation:** Implement authoritative hierarchy validation on the server for both create and update. Reuse the existing helper where possible, make it transaction-manager-aware, and preserve project/organization checks and cycle protection.
- **Do not:** Rely on client validation as an authorization or integrity boundary.

### R4 — Attachment upload is not idempotent across ambiguous retries

- **Severity:** Medium
- **Status:** Confirmed retry risk; duplicate occurrence requires a retry after server success.
- **Evidence:** The upload endpoint creates new Cloudinary assets and attachment rows for every request. There is no idempotency key, operation token, or duplicate-request guard in the frontend, route, controller, service, or entity. The frontend retries when it believes upload failed or the returned shape is invalid.
- **Function/file:** `uploadTaskAttachments`, `uploadWorkItemAttachmentsApi`, and `uploadAndPersistWorkItemAttachments` in [`frontend/src/state/AppContext.tsx`](./frontend/src/state/AppContext.tsx), [`frontend/src/services/api.ts`](./frontend/src/services/api.ts), and [`backend/services/work.item.attachment.service.ts`](./backend/services/work.item.attachment.service.ts).
- **Why it occurs:** A server may finish upload and database persistence but the response can be lost, time out, or fail frontend shape checks. Retrying repeats the side effects.
- **Observable impact:** Duplicate attachment rows/assets associated with one Work Item.
- **Backend recommendation:** If retries need to be safe, accept and persist an idempotency key for an upload batch, return the original result for the same operation, and coordinate generation/reuse of that key with the client. Define retention and concurrency behavior. Avoid using only filename/size for deduplication because users may intentionally attach the same file more than once.
- **Dependency:** A robust end-to-end idempotency key requires frontend coordination; no key is currently sent.

### R5 — Work Item deletion leaves Cloudinary objects behind

- **Severity:** Medium
- **Status:** Confirmed resource-cleanup gap.
- **Evidence:** `WorkItemAttachment` rows reference Work Items with database cascade deletion. The `deleteWorkItem` controller removes the Work Item but does not call `deleteFromCloudinary`; no cleanup queue is visible in the inspected flow.
- **Function/file:** `deleteWorkItem` in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts), attachment relation in [`backend/entities/work.item.attachment.entity.ts`](./backend/entities/work.item.attachment.entity.ts), Cloudinary delete adapter in [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts).
- **Why it occurs:** A relational database cascade only deletes database rows; it cannot delete an external Cloudinary asset.
- **Observable impact:** Cloudinary assets remain stored after attachment metadata and Work Item are gone, causing storage leakage and making cleanup/reconciliation harder.
- **Backend recommendation:** Before deleting attachment metadata, create durable deletion intent (for example, an outbox/cleanup record in the same transaction as the database deletion). A worker should call the existing Cloudinary delete adapter and retry failures. Make deletion handling safe for already-missing assets.
- **Do not:** Assume a database transaction can roll back Cloudinary deletion or upload.

### R6 — Server-side memory upload limits are much larger than the frontend limit

- **Severity:** Medium
- **Status:** Confirmed configuration mismatch; actual operational impact depends on deployment and concurrency.
- **Evidence:** The middleware uses Multer memory storage, allows five files, and sets a 100 MB per-file limit. The active frontend picker allows five files of 25 MB each.
- **Function/file:** [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts) and [`frontend/src/components/tasks/TaskAttachments.tsx`](./frontend/src/components/tasks/TaskAttachments.tsx).
- **Why it occurs:** The server buffers each request's file contents in process memory before forwarding them to Cloudinary. The server's maximum batch is potentially 500 MB before other process overhead.
- **Observable impact:** Under concurrent uploads or an unexpectedly large client request, memory pressure can cause latency, allocation failures, or process termination.
- **Backend recommendation:** Set the authoritative server limits according to deployment capacity and product requirements; consider streaming to storage instead of buffering if large uploads are a real requirement. Preserve the five-file rule or explicitly revise it. Coordinate the user-facing limit with the frontend.
- **Runtime verification:** Check reverse-proxy/request-body limits and available application memory; these were not available in this audit.

### R7 — File type checks do not verify file content

- **Severity:** Medium
- **Status:** Confirmed validation limitation.
- **Evidence:** The Multer `fileFilter` compares `file.mimetype` and filename extension against an allowlist. Cloudinary `resource_type` is then selected from the declared MIME type. No content signature/magic-byte inspection or malware scan is present in the inspected flow.
- **Function/file:** [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts) and [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts).
- **Why it occurs:** MIME type and extension are supplied by the client and can be inconsistent with file contents.
- **Observable impact:** A file with misleading metadata may pass the allowlist and be stored under a type selected from client-supplied values.
- **Backend recommendation:** Validate signatures/content for supported formats, reject mismatches, and consider malware scanning based on product and threat requirements. Keep file-size/count bounds and safe error responses.
- **Do not:** Treat extension/MIME pairing as proof of safe file content.

### R8 — Specific attachment `500` source is not established by inspected code

- **Severity:** High operational priority; root cause **unconfirmed**.
- **Status:** Requires runtime logs/reproduction.
- **Evidence:** The request field (`attachments`), route path, route method, and Multer array parser match. The controller awaits the service, and the service awaits Cloudinary uploads and database saves. Cloudinary or database failures can reject to the async wrapper and global error handler. The handler returns generic `"Internal Server Error"` for 5xx.
- **Function/file:** Route in [`backend/routes/work.item.routes.ts`](./backend/routes/work.item.routes.ts), middleware in [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts), controller/service in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts) and [`backend/services/work.item.attachment.service.ts`](./backend/services/work.item.attachment.service.ts), error handling in [`backend/middleware/error.handler.ts`](./backend/middleware/error.handler.ts).
- **Why the code alone is insufficient:** Several independent failure points share the same generic HTTP response: Cloudinary network/auth/API errors, incomplete provider metadata, TypeORM/database errors, foreign-key/column issues, or other unexpected exceptions.
- **Observable impact:** The browser sees a generic 500 and cannot diagnose which stage failed.
- **Backend recommendation:** Add request-correlated structured diagnostics at safe boundaries: identify validation, Cloudinary upload, attachment persistence, and cleanup stages; record a stable error code and provider status/code where safe. Keep client 5xx messages generic and never log credentials or expose secrets.
- **Needed evidence:** Timestamp/request ID, backend stack and sanitized provider/database error, environment/config status (without secret values), and whether Cloudinary created any asset for the failed request.

### R9 — Authorization is checked, but Cloudinary URL privacy is not proven

- **Severity:** Low to Medium, depending on confidentiality requirements.
- **Status:** Backend upload/access checks are confirmed; public/private Cloudinary delivery requires account/runtime verification.
- **Evidence:** The upload controller verifies the active actor and accessible Work Item; route permission checks `task:update`; the Work Item query scopes organization and project. The attachment `storageKey` is persisted as Cloudinary `secure_url`, and no authenticated/private delivery option is apparent in the inspected upload configuration.
- **Function/file:** `getAccessibleWorkItem` and `uploadAttachmentsToWorkItem` in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts), `uploadToCloudinary` in [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts), attachment fields in [`backend/entities/work.item.attachment.entity.ts`](./backend/entities/work.item.attachment.entity.ts).
- **Why it matters:** Authorization controls access to the application endpoint, but a publicly deliverable URL may be usable by anyone who obtains it.
- **Observable impact:** Potential access outside the app's organization/project authorization boundary if Cloudinary delivery is public and URLs are exposed.
- **Backend recommendation:** Verify Cloudinary account/delivery settings and data sensitivity requirements. If private access is required, use authenticated delivery or short-lived signed URLs and avoid treating an obscure URL as authorization.
- **Do not:** Claim a confirmed vulnerability without verifying current Cloudinary delivery settings.

### R10 — Direct attachment fetch has different authentication behavior from JSON requests

- **Severity:** Low/Medium, conditional on authentication mode.
- **Status:** Confirmed behavioral difference; impact depends on whether cookie-only sessions are used.
- **Evidence:** The generic `request` helper in `frontend/src/services/api.ts` includes the bearer token and has a refresh flow; its refresh request includes cookies. `uploadWorkItemAttachmentsApi` uses direct `fetch`, attaches a token if available, but does not set `credentials: "include"` and does not refresh/retry. Backend `isLoggedIn` accepts either bearer token or a cookie token.
- **Why it occurs:** The attachment call bypasses the shared request helper.
- **Observable impact:** Cookie-only auth may not reach the backend, or an expired bearer token may fail without the normal refresh/retry behavior. This is not established as the reported 500; it would commonly surface as authentication failure instead.
- **Backend recommendation:** No backend change is required if the documented frontend contract is bearer-token auth. If cookie-only attachment requests are an intended supported mode, ensure the frontend includes credentials; backend CORS already enables credentials for allowed origins.

### R11 — Some creation-form fields are not part of the request that reaches the backend

- **Severity:** Medium for feature correctness; not an attachment-upload failure.
- **Status:** Confirmed frontend/backend integration gap.
- **Evidence:** The modal collects labels, recurrence, start date, estimates, and type-specific fields. `AppContext.createTask` sends only the supported mapped subset. The backend accepts `recurrence`, `labels`, and `labelId`, while the form's recurrence property is named `recurrenceRule`; the inspected mapper does not send either recurrence shape or labels. The backend create DTO does not expose all the other UI fields.
- **Function/file:** `CreateTaskModal.handleSubmit` in [`frontend/src/components/tasks/CreateTaskModal.tsx`](./frontend/src/components/tasks/CreateTaskModal.tsx), `createTask` in [`frontend/src/state/AppContext.tsx`](./frontend/src/state/AppContext.tsx), `CreateWorkItemApiInput` in [`frontend/src/services/api.ts`](./frontend/src/services/api.ts), and `CreateWorkItemBody`/schema in [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts) and [`backend/validations/work.item.validations.ts`](./backend/validations/work.item.validations.ts).
- **Why it occurs:** Fields collected in UI state are not mapped to the backend's accepted payload names and contracts.
- **Observable impact:** The Work Item may be created without values that the user selected; some values may only exist in local UI state.
- **Backend recommendation:** No backend-only fix can persist data absent from the request. Confirm the intended supported fields and coordinate the payload contract with the frontend. Extend backend DTO/schema/entity/migration only for fields selected for durable server support.
- **Scope note:** This finding is included because the audit asks for the full creation flow; it is not proposed as a frontend code change.

## D. Separation-of-Concerns Plan

The current attachment controller is appropriately thin and the existing attachment service should be improved rather than duplicated. The largest separation opportunity is the Work Item creation controller and consistent hierarchy validation.

| Existing file/function | Responsibility currently handled | Problem | Recommended destination/function | Responsibility after separation | Call relationship | Justification |
|---|---|---|---|---|---|---|
| `backend/controllers/task.controller.ts` — `createWorkItem` | Actor/project access; parent/sprint/label/assignee checks; transaction; Work Item/assignee/recurrence/SLA persistence; notification side effects; response assembly | Controller mixes HTTP orchestration and persistence/business rules. Post-commit notification rejection can report failure after commit. | A focused work-item service operation such as `createWorkItem` in a work-item service (destination name to follow existing repository conventions) | Accept validated create data and actor identity; run transaction; return persisted aggregate and durable notification intent/status | Controller authorizes/validates request, calls service, maps result to HTTP response. Notification delivery is decoupled via outbox or equivalent. | Improves unit testing and transaction boundaries without moving HTTP concerns or rewriting unrelated features. |
| `backend/controllers/task.controller.ts` — `validateParentWorkItem` and create-time parent check | Parent existence/scope and update cycle validation | Create and update do not enforce the same hierarchy rules; create check is existence-only. | Shared manager-aware hierarchy validation in the work-item domain/service layer | Validate project/organization scope, allowed parent type, required parent rules, self-parenting, and ancestry cycles | Called by create/update service operations using the same transaction manager where applicable | Prevents invalid data through direct API requests and avoids inconsistent business rules. |
| `backend/controllers/task.controller.ts` — `uploadAttachmentsToWorkItem` | Actor/work-item access check, empty-files response, call service, HTTP response | No significant separation defect identified; it is thin and already delegates upload/persistence. | Keep the current controller; retain `uploadAndPersistWorkItemAttachments` in `backend/services/work.item.attachment.service.ts` | Controller continues HTTP/auth composition; service continues upload orchestration and persistence/compensation | Existing route invokes controller after auth, permission, and Multer middleware | Avoids creating a duplicate attachment controller/service without a demonstrated benefit. |
| `backend/services/work.item.attachment.service.ts` — `uploadAndPersistWorkItemAttachments` | Concurrent upload, metadata construction, metadata save, best-effort compensation | Cleanup failure is only logged; no durable retry/reconciliation or idempotency is present. | Keep the existing service; add small explicit cleanup/idempotency behavior or durable cleanup intent as requirements demand | Orchestrate batch semantics, persist metadata, compensate on failures, enqueue cleanup retry when compensation fails | Existing attachment controller calls it; Cloudinary service remains the provider adapter | Reuses existing service and isolates external-storage orchestration from request handling. |
| `backend/controllers/task.controller.ts` — `deleteWorkItem` | Authorize/find Work Item and remove it from database | Database cascade does not delete Cloudinary objects. | Attachment cleanup intent/outbox operation called as part of deletion workflow | Persist deletion intent together with metadata deletion; worker invokes Cloudinary delete and retries | Delete controller/service records intent; background worker uses existing `deleteFromCloudinary` adapter | Gives reliable cleanup without pretending SQL transactions cover external storage. |
| `backend/validations/work.item.validations.ts` — `createWorkItemSchema` | Validate request structure and basic field formats | Date schema allows timestamp conversion despite apparent date-only semantics; business hierarchy checks are not in schema. | Extend the existing schema and call the shared semantic validator from service; do not create duplicate Joi modules | Syntactic validation remains in middleware; semantic checks reside in shared domain/service function | Existing route continues to invoke Joi middleware before controller | Keeps transport validation at the route boundary and database-aware rules near business logic. |
| `backend/middleware/work.item.attachment.upload.middleware.ts` — `uploadWorkItemAttachments` | Multer limits, declared MIME/extension filter, error normalization | High memory ceiling and declared metadata is not content validation. | Keep the middleware; adjust limits and use a content-validation step where supported | Parse bounded multipart content and reject content/signature mismatch before provider upload | Route continues middleware before controller/service | A focused change improves safety without duplicating file handling. |

### Responsibilities that should stay where they are

- `isLoggedIn` should remain the authentication middleware.
- Project-level permission checks should remain in the existing permission middleware and be retained for the attachment route.
- The global error response should remain centralized in `error.handler.ts`; do not add broad controller-level `try/catch` blocks that conceal failure details.
- Cloudinary-specific upload/delete calls should remain behind `cloudinary.service.ts`.
- Do not create a second attachment service while `work.item.attachment.service.ts` already owns upload orchestration.

## E. Recommended Backend Architecture

### E.1 Preserve the separate-upload contract

```text
POST /api/work-items (JSON)
  isLoggedIn
  task:create permission
  validate request shape/date contract
  controller
    work-item service transaction:
      verify active actor and accessible project
      validate parent/sprint/label/assignee scope and hierarchy
      persist Work Item, relationships, SLA, and recurrence
      record durable notification intent if applicable
  return 201 with data.id and documented date representation

POST /api/work-items/:workItemId/attachments (multipart)
  isLoggedIn
  validate UUID
  task:update permission
  bounded Multer parser: attachments[]
  controller verifies active actor and accessible Work Item
    existing attachment service:
      validate accepted file content
      upload to Cloudinary
      persist metadata
      compensate/remove successful siblings if batch fails
      durably enqueue cleanup if compensation fails
  return 201 with all persisted attachment metadata

Work Item deletion
  authorize and locate Work Item
  transactionally record Cloudinary deletion intents
  delete Work Item/attachment metadata
  asynchronous cleanup worker calls Cloudinary delete with retries
```

### E.2 Separate upload versus combined multipart creation

#### Approach A — Separate attachment upload (recommended)

1. Create Work Item as JSON.
2. Return its database ID.
3. Upload files to the existing attachment endpoint.
4. Persist metadata and return uploaded attachment information.

**Advantages**

- Matches the current frontend API sequence.
- Work Item creation remains a comparatively small JSON request.
- If attachment upload fails after the client has the Work Item ID, the client can retry upload without creating another Work Item.
- Attachment-specific limits, validation, permissions, and errors remain isolated.
- The backend already implements the endpoint and upload service.

**Trade-offs**

- There is an intentional state where the Work Item exists without all selected attachments.
- If the create transaction commits but the response is lost before the client gets the ID, the client cannot reliably resume the attachment upload without a create idempotency/recovery strategy.
- Upload retries need idempotency or can create duplicate assets.
- A database transaction cannot atomically include Cloudinary operations; compensation is required either way.

#### Approach B — Combined multipart creation and upload

1. Submit Work Item fields and files in one multipart request.
2. Validate request fields and files.
3. Persist the Work Item, upload files, and persist attachment metadata.
4. Return Work Item and attachments.

**Advantages**

- One client submission can express the user's entire creation intent.
- Potentially fewer UI states and fewer client requests.

**Trade-offs**

- Requires frontend changes: current `createWorkItemApi` sends JSON and the modal depends on a separate upload step.
- Combines large-file parsing with Work Item field validation and creation.
- Increases request duration and memory requirements.
- Makes retry semantics harder: a retry may duplicate the Work Item and files unless both operations are idempotent.
- Cloudinary remains external to the database transaction, so combined HTTP requests do not provide true atomicity.
- Partial upload still needs explicit all-or-nothing compensation or a documented partial-success response.

**Recommendation:** Keep Approach A. It matches the existing frontend contract. First fix backend failure reporting, durable cleanup, validation, and retry safety. Consider a combined endpoint only as a separately coordinated API evolution, not as a backend-only patch.

### E.3 Failure semantics and consistency model

- **Database transaction:** Use it for Work Item and relational database writes that share the transaction manager. Do not include Cloudinary calls in the SQL transaction and claim external rollback.
- **Cloudinary upload followed by database failure:** Attempt compensating Cloudinary deletion. If deletion fails, persist cleanup intent durably and retry; a log line alone does not guarantee cleanup.
- **One of multiple uploads fails:** Current service attempts to remove successful siblings and throws. This is an all-or-nothing API contract. Keep that behavior unless the API explicitly adopts per-file partial results and the frontend can represent them.
- **Database success followed by response loss:** The attachment data may already exist even though the client sees failure. Idempotency is the reliable remedy; client-side retry alone cannot distinguish this from a failed upload.
- **Work Item create commit followed by notification failure:** Return/retain the committed result and process notification intent independently. For robust delivery, use a transactional outbox.
- **Cleanup failures:** Record retryable intent with provider asset ID and resource type; do not expose provider credentials/messages in client errors.
- **Authorization:** Preserve both route permission checks and organization/project-scoped Work Item access. A valid Work Item ID is not sufficient authorization.

## F. Implementation Plan

### Phase 1 — Immediate runtime diagnosis and failure reporting

1. Capture a request ID/correlation ID for failed attachment uploads.
2. Establish whether the 500 occurred during:
   - Multer parsing or limit enforcement,
   - Cloudinary upload,
   - Cloudinary response validation,
   - attachment metadata persistence,
   - cleanup, or another backend operation.
3. Add safe, stage-specific structured logging where necessary. Include stable internal error codes and safe provider/database metadata; exclude credentials, tokens, and raw sensitive values.
4. Ensure a post-commit notification failure does not make Work Item creation appear not to have committed.
5. Keep the existing global error-handler convention and generic client-facing 5xx response.

### Phase 2 — Correctness and validation

1. Decide the canonical due-date meaning and timezone policy.
2. If calendar-date semantics are intended:
   - update Joi validation and the API contract to be date-only,
   - use a date-only database representation,
   - add a migration with an explicit mapping for existing timestamps,
   - update due-soon/overdue comparisons,
   - leave SLA timestamps unchanged.
3. Enforce hierarchy constraints server-side for both create and update.
4. Preserve project/organization checks for parent, sprint, labels, and assignees.
5. Decide which collected creation fields should be durable and coordinate payload/schema/entity changes for fields not currently sent.

### Phase 3 — Upload consistency, retry, and cleanup

1. Preserve existing batch compensation when any upload or metadata save fails.
2. Add durable retry/reconciliation for failed compensation.
3. Queue deletion of each Cloudinary asset when a Work Item with attachments is deleted.
4. Decide and implement idempotency semantics for repeated attachment upload requests; coordinate an idempotency key with the frontend if adopted.
5. Align server file count/size caps with resource capacity and product requirements.
6. Add server-side content/signature validation; consider scanning if required by product threat model.
7. Verify Cloudinary delivery privacy and implement authenticated/signed delivery if attachment confidentiality requires it.

### Phase 4 — Targeted separation of concerns

1. Extract the create persistence transaction from `createWorkItem` into a focused work-item service operation.
2. Keep HTTP validation, authentication, and response mapping in their current layers.
3. Reuse a shared manager-aware hierarchy validator in create and update.
4. Retain `work.item.attachment.service.ts`; improve it rather than introducing a duplicate attachment service.
5. Add an outbox/worker only if reliable post-commit notification and external cleanup retry are required by the deployment. Treat this as targeted reliability infrastructure, not a broad rewrite.

### Phase 5 — Tests and regression verification

1. Add unit tests for date validation/serialization and hierarchy rules.
2. Add attachment service tests with mocked Cloudinary and repository failures.
3. Add route/integration tests for authentication, permissions, organization isolation, Multer behavior, and response shape.
4. Verify all existing Work Item behavior and regression tests before deployment.

## G. Test Plan

### Work Item creation

- Create without attachments and confirm a single persisted Work Item and expected `201` response.
- Create with one or multiple assignees; verify assignee rows and valid notification intent.
- Inject notification failure after transaction commit; verify the caller is not told the Work Item failed without a recoverable ID/result.
- Exercise project membership and organization boundaries.
- Verify parent, sprint, label, and assignee checks remain scoped correctly.
- Verify SLA initialization, custom SLA authorization, priority-null behavior, and SLA audit persistence.
- Verify recurrence validation, persistence, next-run calculation, and active-state behavior.

### Attachment handling

- Upload one and multiple valid files with actual multipart `attachments` fields.
- Upload no files and verify the explicit `ATTACHMENT_REQUIRED` response.
- Submit wrong multipart field, more than five files, oversized file, too-long filename, unsupported type, MIME/extension mismatch, and content-signature mismatch.
- Verify server file limits and reverse-proxy limits agree.
- Simulate Cloudinary credential/authentication failure, network failure, API error, and incomplete response metadata.
- Simulate database metadata-save failure after Cloudinary success; verify cleanup attempt and durable retry intent if deletion fails.
- Simulate one failure in a multi-file batch; verify successful sibling assets are compensated and no partial metadata is returned under all-or-nothing semantics.
- Simulate lost response after successful upload and retry; verify chosen idempotency behavior.
- Delete a Work Item with attachments; verify cleanup intents are saved and Cloudinary deletes are retried safely.
- Confirm database IDs, uploaded-by ownership, Work Item association, MIME type, original name, byte size, URL, public ID, and resource type are consistent.

### Authorization and errors

- Missing/invalid authentication; bearer-token and cookie paths as supported.
- Missing, malformed, nonexistent, and cross-organization Work Item IDs.
- User without project membership and user without `task:update`.
- Ensure cross-organization checks return no attachment data or Cloudinary metadata.
- Ensure internal errors produce generic client responses while logs identify the failure stage without secrets.
- Test both missing and misconfigured Cloudinary environment behavior at startup/runtime as appropriate.

### Date handling

- Round-trip a date-only value such as `2026-11-03` through create, read, and update.
- Reject invalid calendar dates and unsupported ambiguous values.
- Verify legacy ISO timestamp compatibility during any migration window.
- Verify date input receives a date-only representation.
- Verify dashboard overdue/due-soon behavior at the start and end of the due date across supported timezones.
- Confirm SLA deadlines remain timestamps and existing SLA calculations are unchanged.

### Regression behavior

- Verify recurrence and generated occurrence behavior.
- Verify SLA initialization/escalation/audit paths.
- Verify assignee notifications and project/organization authorization.
- Verify sprint association, labels, status, priority, and parent relationships.
- Verify existing comment, time-entry, dependency, and Work Item deletion behavior.
- Run focused backend tests and then the repository's configured backend typecheck/test commands.

## H. Final Change Checklist

### Required or strongly recommended backend changes

| File/resource | Why it needs changing | Intended change |
|---|---|---|
| [`backend/controllers/task.controller.ts`](./backend/controllers/task.controller.ts) | `createWorkItem` currently couples HTTP success to post-commit notification completion; create hierarchy checks are incomplete; delete omits external-asset cleanup | Decouple committed Work Item success from notification delivery; use shared server-side hierarchy validation; invoke durable attachment cleanup intent during deletion; preserve existing SLA, assignee, recurrence, sprint, and authorization behavior |
| [`backend/validations/work.item.validations.ts`](./backend/validations/work.item.validations.ts) | Due-date contract and syntactic validation need to match the chosen date semantics | Validate a canonical date-only representation if that is the product contract; retain existing field constraints; add tests for invalid calendar dates and migration compatibility |
| [`backend/entities/work.item.entity.ts`](./backend/entities/work.item.entity.ts) | `dueDate` is currently `timestamptz` despite apparent calendar-date use | If confirmed as a calendar date, change the due-date mapping to date-only; do not change SLA timestamp fields |
| **New TypeORM migration** using repository naming convention | Existing `due_date` values need safe conversion if the entity moves to date-only | Convert existing values according to an explicitly approved timezone/date policy; include a safe rollback strategy where feasible |
| [`backend/controllers/dashboard.controller.ts`](./backend/controllers/dashboard.controller.ts) | Due-soon and overdue queries compare `dueDate` to `NOW()` | If due dates become date-only, update predicates to calendar-day semantics and test timezone/date boundaries |
| [`backend/services/work.item.attachment.service.ts`](./backend/services/work.item.attachment.service.ts) | Cleanup failures are not durable; retries are not idempotent | Retain current compensation; add durable retry intent/reconciliation and, if adopted, batch idempotency |
| [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts) | 100 MB in-memory per-file limit permits a large aggregate memory footprint; MIME/extension are client-declared | Set server limits based on resource capacity and validate file content/signatures before provider upload |
| [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts) | Existing adapter is the deletion boundary and may need private-delivery support | Keep as provider adapter; alter delivery mode only if account/product requirements confirm private attachments |
| [`backend/middleware/error.handler.ts`](./backend/middleware/error.handler.ts) or service-level logging | The reported 500 does not reveal its stage to the client; diagnosis requires safe server-side evidence | Add/retain safe structured diagnostic context, stable codes, and request correlation without exposing provider errors or credentials |

### Tests to add or expand

| File/resource | Why it needs changing | Intended coverage |
|---|---|---|
| [`backend/tests/work-item-attachment-upload.test.ts`](./backend/tests/work-item-attachment-upload.test.ts) | Current visible tests cover the MIME/extension helper only | Middleware limits, multipart shape, upload compensation, metadata failure, cleanup failure, authorization, response shape, and retry semantics |
| New focused Work Item service/controller tests | Current tests do not cover the complete creation transaction and post-commit notification failure | Create idempotency/recoverability, hierarchy validation, assignee/sprint/SLA/recurrence preservation |
| New date contract tests | Existing visible tests do not establish date-only storage/serialization behavior | Validation, API round-trip, migration policy, and dashboard date-boundary comparisons |

### Conditional changes and explicit verification

- **Cloudinary delivery:** Change only after checking account configuration and confirming whether attachments must be private.
- **Idempotency key:** Requires a defined client/server contract; the current frontend does not send one.
- **Date-only migration:** Requires product confirmation of timezone policy and review of existing stored values. Do not convert stored values by assumption.
- **500 root cause:** Requires request-correlated logs or reproduction. Cloudinary is not confirmed as the cause.
- **Frontend contract gaps:** Labels, recurrence, dates/estimates, and type-specific fields currently collected but not forwarded require frontend coordination; no frontend changes are included in this backend-only plan.

## Conclusion

The multipart attachment contract is correctly aligned, and the current backend already separates attachment upload from Work Item creation. The strongest immediate backend fixes are to stop post-commit notification failures from masquerading as create failures, preserve/extend upload compensation with durable cleanup, clean up Cloudinary assets on Work Item deletion, and enforce server-side hierarchy rules. The date warning should be addressed by choosing a consistent date-only or timestamp contract, not by changing unrelated timestamps. The specific attachment `500` must be diagnosed from runtime evidence before naming Cloudinary, the database, or any other component as its cause.
