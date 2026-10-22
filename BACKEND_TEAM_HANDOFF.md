# Backend Team Handoff

This document details the backend requirements that cannot be resolved through frontend-only changes under the strict frontend isolation constraints.

---

## Issue 1: Work Item to Label Association Persistence

### 1. FEATURE OR BUG
Work item label assignment persistence (`work_items` to `project_labels` association).

### 2. CURRENT BEHAVIOR
While project-level label management (creation, listing, and deletion under `/api/projects/:projectId/labels`) is fully implemented, functional, and persists to PostgreSQL, assigning a label to an individual work item (or removing a label from a work item) does not persist across browser reloads or page refreshes.

### 3. INVESTIGATION
1. **Frontend Investigation**:
   - `CreateTaskModal.tsx` and `TaskDetailsDrawer.tsx` capture selected labels in local draft state (`draft.labels`) as label names and IDs.
   - On save, `updateTask` constructs payload and calls `updateWorkItemApi(taskId, backendUpdates)` targeting `PATCH /api/work-items/:workItemId`.
2. **Backend Investigation**:
   - Inspected `backend/entities/work.item.entity.ts`: The `WorkItem` TypeORM entity declares columns for `organizationId`, `projectId`, `createdById`, `parentWorkItemId`, `type`, `title`, `description`, `status`, `priority`, `dueDate`, `slaDeadline`, etc., but **does not** define any relation or column for `labelId`, `labels`, or a join table to `ProjectLabel`.
   - Inspected database migration `backend/migrations/1792399247543-AddProjectLabels.ts`: A column named `label_id` was added to `work_items` in the database, but it is not mapped in the TypeORM entity (`WorkItem`), and only supports a single label per item.
   - Inspected `backend/validations/work.item.validations.ts`: The Joi validation schemas `createWorkItemSchema` and `updateWorkItemSchema` use `.unknown(false)` and do not include `labelId`, `labelIds`, or `labels`. Any request passing label fields is rejected by Joi with HTTP 400 `ValidationError`.
   - Inspected `backend/controllers/work.item.controller.ts`: The controller only selects and updates properties defined on `WorkItem` and ignores/rejects label parameters.

### 4. WHY A FRONTEND-ONLY FIX IS INSUFFICIENT
Under the strict Frontend-Only directive, backend source files, TypeORM entities, Joi validation schemas, controllers, and database tables cannot be modified by the frontend team. Attempting to pass label parameters to the existing `PATCH /api/work-items/:workItemId` fails backend schema validation (`.unknown(false)`). Storing task label assignments in `localStorage` or `sessionStorage` is strictly prohibited by architectural requirements to avoid fake persistent state. Therefore, server-side entity mapping and API schema support are required from the backend team.

### 5. REQUIRED BACKEND CHANGE
1. In `backend/validations/work.item.validations.ts`:
   - Add optional `labelId: uuidV4.allow(null).optional()` (or `labelIds: Joi.array().items(uuidV4).optional()`) to `createWorkItemSchema` and `updateWorkItemSchema`.
2. In `backend/entities/work.item.entity.ts`:
   - Add `@Column({ name: "label_id", type: "uuid", nullable: true }) labelId: string | null;`
   - Alternatively, support multi-label assignment via a relation table `work_item_labels (work_item_id, label_id)`.
3. In `backend/controllers/work.item.controller.ts`:
   - Include `labelId` (or `labels`) in the `select` and `relations` query options when returning work items.
   - Include `labelId` in `updateWorkItem` update queries.

### 6. SUGGESTED API CONTRACT
- **Method & Route**: `PATCH /api/work-items/:workItemId`
- **Request Body**:
  ```json
  {
    "labelId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  }
  ```
  *(Or for multi-label support)*:
  ```json
  {
    "labelIds": [
      "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "7ca85f64-5717-4562-b3fc-2c963f66afb2"
    ]
  }
  ```
- **Response Format (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "workItemId",
      "title": "Task title",
      "labelId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      ...
    }
  }
  ```
- **HTTP Status Codes**:
  - `200 OK`: Work item updated successfully.
  - `400 Bad Request`: Validation failure (invalid UUID or unknown field).
  - `404 Not Found`: Work item or label not found.

### 7. DATA PERSISTENCE
The work item record must persist its associated label ID(s) so that GET queries (`GET /api/projects/:projectId/work-items` and `GET /api/work-items/:workItemId`) return the saved label ID(s) upon subsequent requests and page reloads.

### 8. AUTHENTICATION AND AUTHORIZATION
- Inherits existing `isLoggedIn` middleware and `checkPermission("work_item:update")`.
- Enforce that the assigned label belongs to the same `projectId` as the work item to prevent cross-project label contamination.

### 9. DATABASE IMPACT
- If single-label is used: The database migration `1792399247543-AddProjectLabels.ts` has already added `label_id` column to `work_items`, so no new database migration is required.
- If multi-label is adopted: A new migration creating `work_item_labels (work_item_id, label_id)` table would be needed.

### 10. ACCEPTANCE CRITERIA
1. `PATCH /api/work-items/:workItemId` accepts `labelId` without a Joi validation error.
2. `GET /api/projects/:projectId/work-items` returns `labelId` (or mapped `labels`) for each work item.
3. Reloading the browser preserves the label badge on the work item.

### 11. FRONTEND STATUS
- The frontend `LabelPicker` component is fully implemented, responsive (min-width 280-320px, scrollable max-height, colored chips, search filtering, multi-selection), and integrated into both `CreateTaskModal` and `TaskDetailsDrawer`.
- Project label CRUD (`/api/projects/:projectId/labels`) is integrated, robust, and correctly synchronizes with authoritative backend data.
- Task details drawer preserves label selections in local form state and dispatches the update to `updateTask`.
- Blocked only on backend validation acceptance and database mapping for `work_items.label_id`.

### 12. PRIORITY
**Medium** — Project label management is completely functional; task-to-label assignment persistence requires this small backend entity and validation update.
