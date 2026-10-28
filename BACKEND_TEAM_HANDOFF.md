# Backend Team Handoff

This document details backend capabilities and database constraints identified during frontend integration that cannot be resolved solely on the frontend without backend code changes or database migrations.

---

## Issue 1: Multi-Label Persistence Constrained by Database Schema

### Issue
The frontend user interface supports selecting multiple labels on a work item (via `LabelPicker` and multi-selection chips). However, only a single primary label can be persisted in the backend database.

### Current API Behavior
- Endpoint: `PATCH /api/work-items/:workItemId` and `POST /api/work-items`
- The backend validation accepts `labelId` (UUID) or `labels` (array of UUIDs).
- However, in `work_item.service.ts`:
  ```typescript
  if (body.labelId !== undefined || body.labels !== undefined) {
    const targetLabelId = body.labelId || (Array.isArray(body.labels) ? body.labels[0] : null);
    workItem.labelId = targetLabelId;
  }
  ```
- The backend assigns only `body.labels[0]` to the single `workItem.labelId` column.
- When retrieving work items (`GET /api/projects/:projectId/work-items`), the backend returns a single `label` object or null based on the `labelId` foreign key.

### Missing Capability
There is currently no many-to-many association table or relation between `work_items` and `labels`. The database table `work_items` only has a single column `label_id: uuid`.

### Why Frontend Cannot Solve This Completely
The frontend correctly resolves selected label names to backend label UUIDs and submits both `labelId` and the `labels` array in update/creation payloads. The frontend also safely maps the persisted single label on reload. However, any subsequent labels selected beyond the first cannot be stored because there is no backend database structure to hold multiple label associations per work item.

### Expected Behavior
A work item should be able to persist and return multiple associated labels (e.g., `workItem.labels: Label[]`).

### Recommended Implementation
1. Create a TypeORM join table entity `WorkItemLabel` or create a `@ManyToMany(() => Label)` relation on `WorkItem` with `@JoinTable({ name: 'work_item_labels' })`.
2. Add a migration creating the `work_item_labels` join table with foreign keys `work_item_id` and `label_id`.
3. Update `work_item.service.ts` during creation and updates to synchronize the join table associations when `body.labels` is provided.
4. Update `GET /api/projects/:projectId/work-items` and `GET /api/work-items/:workItemId` to load the `labels` relation.

### Frontend Impact
The frontend is already designed to send `labels: string[]` (array of label UUIDs) and unpack `item.labels` or `item.label`. Once the join table is added on the backend, multiple labels will automatically persist and hydrate seamlessly without requiring further frontend architectural changes.

---

## Issue 2: Notifications Endpoint 500 (Internal Server Error)

### Issue
Calls to `GET /api/notifications` occasionally return 500 (Internal Server Error) due to column discrepancies in the `notifications` table following recent notification entity migrations.

### Current API Behavior
- Endpoint: `GET /api/notifications`
- When invoked with a valid JWT bearer token, the handler in `notification.controller.ts` attempts to query notifications with relations or columns that may mismatch the current database state, resulting in a database exception and 500 response.

### Missing Capability
Robust query execution and schema synchronization for notifications.

### Why Frontend Cannot Solve This Completely
The frontend cannot alter backend database tables or query definitions. To prevent this error from breaking application initialization or freezing the UI, the frontend has implemented a non-blocking handler that logs a warning and returns `{ success: false, count: 0, data: [] }`.

### Expected Behavior
`GET /api/notifications` should consistently return HTTP 200 with `{ success: true, count: number, data: Notification[] }` for the authenticated user.

### Recommended Implementation
1. Review migration `1792736602187-changedNotification.ts` and the `Notification` entity definition.
2. Verify that all queried columns (e.g., `read`, `isRead`, `actorId`, `recipientId`) match the PostgreSQL schema.
3. Add try/catch block around the repository query in `notification.controller.ts` to return an empty array if the notification table is being migrated or empty.

### Frontend Impact
The frontend handles errors gracefully without blocking UI rendering, but users will not receive push notification alerts until the backend endpoint is corrected.

---

## Issue 3: Chat Message File and Media Attachment API & Storage Missing

### Feature Affected
Chat Message Composer — File Attachments and Media Attachments.

### Existing API or Response Examined
- Endpoints: `POST /api/chat/conversations/:conversationId/messages`, WebSocket event `message:send`, and entity `ChatMessage` (`backend/entities/chat-message.entity.ts`).
- Current database table: `chat_messages` only contains columns:
  - `id: uuid`
  - `conversation_id: uuid`
  - `sender_id: uuid`
  - `content: varchar(4000)`
  - `created_at`, `updated_at`, `edited_at`, `deleted_at`
- There are no columns, join tables, or storage associations for attachments (`attachments`, `fileUrl`, `fileType`, `fileSize`, etc.).
- The message controllers (`sendMessageController` and WebSocket gateway `chat.gateway.ts`) validate and save only `{ content: string }`.

### Missing Capability
1. Backend file and media upload endpoints for Chat (multipart/form-data upload or presigned URL upload).
2. Chat message attachment persistence (table `chat_message_attachments` or JSONB column for file metadata).
3. Retrieval of attachments in `GET /api/chat/conversations/:conversationId/messages` and real-time broadcast via WebSocket `message:new`.

### Why Frontend Cannot Implement the Feature Completely
The frontend has implemented the full user interface:
- Controls for "Attach file" (`Paperclip` icon) and "Attach media" (`ImageIcon`).
- File/media pickers with type filtering (`image/*,video/*` for media).
- Draft attachment preview pills showing file name, file size, thumbnail preview, and removal button before sending.
However, because the backend database and API endpoints do not accept or store attachments, the frontend cannot persist or transmit uploaded files to other participants. Storing arbitrary files in browser `localStorage` or `sessionStorage` is strictly prohibited. The frontend transparently dispatches the text message and informs the user that chat file attachments require backend API enablement.

### Expected Backend Behavior
1. Allow authenticated participants to upload files or media for a conversation.
2. Return persisted attachment metadata with each message (e.g., `message.attachments: Array<{ id, fileName, fileUrl, fileType, fileSize }>`).
3. Broadcast the attachment metadata over WebSocket on `message:new`.

### Recommended Implementation
1. Create a `ChatMessageAttachment` entity or table:
   - `id: uuid`
   - `message_id: uuid` (foreign key to `chat_messages(id)` with `CASCADE`)
   - `file_name: varchar`
   - `file_url: text`
   - `file_type: varchar`
   - `file_size: integer`
   - `created_at: timestamptz`
2. Implement `POST /api/chat/conversations/:conversationId/attachments` using Multer or cloud storage upload service.
3. Update `saveMessage` in `chat.service.ts` to accept optional `attachmentIds: string[]` or `attachments` metadata.
4. Update `getMessages` and WebSocket payload to include the `attachments` relation.

---

## Issue 4: Chat Participant Profile Display Names for Invited Users

### Feature Affected
Active conversation header, conversation list items, and participant labels.

### Existing API or Response Examined
- Endpoints: `GET /api/chat/conversations`, `POST /api/chat/conversations`, and `POST /api/users/invite` (`backend/services/member-invitation.service.ts`).
- When a user is invited or added via `POST /api/users/invite`:
  ```typescript
  const user = repository.create({
    email: invitation.email,
    fullName: null,
    organizationId,
    role: invitation.role,
    ...
  });
  ```
  The user is created with `fullName: null`.
- When `GET /api/chat/conversations` is called:
  ```typescript
  otherParticipant: other ? { id: other.id, fullName: other.fullName, email: other.email } : null
  ```
  If `other.fullName` is null, the object only contains `{ id, fullName: null, email: "user@example.com" }`.
- When `POST /api/chat/conversations` is called, `getConversationForActor` returns the raw conversation without the `otherParticipant` helper property.

### Missing Capability
1. Guaranteed human display name or full name on all organization members.
2. Profile update endpoint allowing teammates to complete or edit their profile display names after accepting an invite.

### Why Frontend Cannot Implement the Feature Completely
The frontend now resolves contact names across all available profile sources (`displayName`, `fullName`, `firstName` + `lastName`, `name`) and provides a neutral fallback (`"Teammate"`) instead of displaying the raw email address as a heading or fabricating arbitrary names. However, if a user record has never had a name entered in the database, the backend cannot provide a real name until the user or administrator assigns one.

### Expected Backend Behavior
1. Require or default full names during invitation or profile completion (e.g., fallback prompt during first login).
2. Expose `displayName` or ensure `fullName` is populated across user profile endpoints.
3. Return `otherParticipant` consistently on both `GET /api/chat/conversations` and `POST /api/chat/conversations`.

### Recommended Implementation
1. Add an optional or required `fullName` field to the invitation endpoint (`POST /api/users/invite`).
2. Add a profile update endpoint (`PATCH /api/users/me`) allowing users to set `fullName`.
3. Ensure `getConversationForActor` populates `otherParticipant` or eager-loads member user profiles.

---

## Issue 5: Dedicated Cross-Project "My Tasks" Query Endpoint

### Feature Affected
"My Tasks" View, Global Task Counts, Workspace Sidebar Badge.

### Current API Behavior
- Current work items endpoint: `GET /api/work-items/project/:projectId`
- There is currently no cross-project endpoint to fetch all tasks assigned to the requesting user across all projects they belong to.
- The frontend currently iterates over all accessible projects in parallel (`loadCrossProjectTasks`), deduplicating tasks by ID.

### Missing Capability
`GET /api/work-items/assigned-to-me` (or `GET /api/work-items/assigned?status=...&page=...&limit=...`).

### Expected Backend Behavior
A single query joining `work_items` with `work_item_assignees` (and matching `workItem.assigneeId = :currentUserId OR assignee.userId = :currentUserId`) across all projects where the user is an active member or organization admin.

### Recommended Implementation
1. Add route `GET /api/work-items/assigned-to-me` to `work.item.routes.ts`.
2. Add controller and service method `getAssignedWorkItems(userId, paginationParams)`.
3. Filter by `(wi.assigneeId = :userId OR wia.userId = :userId)` with project authorization check.

---

## Issue 6: Top-Level `startDate` on `WorkItem` Entity and Validation Schema

### Feature Affected
Gantt Charts, Timeline View, Project Cascade Rescheduling.

### Current API Behavior
- `createWorkItemSchema` and `updateWorkItemSchema` in `backend/validations/work.item.validations.ts` strictly enforce `.unknown(false)`.
- While assignees can receive `startDate` and `endDate` inside the `assignees` array, the top-level `WorkItem` entity only persists `dueDate`.
- Sending top-level `startDate` to `PATCH /api/work-items/:workItemId` fails with Joi validation error: `"startDate" is not allowed`.

### Frontend Handling
The frontend normalizes `startDate` in client state and sends `dueDate` to the server for cascade rescheduling shifts, avoiding schema rejection.

### Recommended Implementation
1. Add `startDate: Joi.date().iso().allow(null).optional()` to `createWorkItemSchema` and `updateWorkItemSchema`.
2. Add `@Column({ name: 'start_date', type: 'timestamptz', nullable: true }) startDate: Date | null;` to `WorkItem` entity.
3. Update service mapping to persist `startDate`.

---

## Issue 7: Whiteboards Architecture vs Wiki/Yjs Documentation Clarification

### Feature Affected
Whiteboards, Visual Documentation, and Collaborative Editing.

### Clarification
- The codebase uses **Excalidraw** alongside Socket.IO websocket rooms for collaborative whiteboard canvas rendering and revision snapshots.
- There is **no Yjs CRDT or Wiki document module** in the codebase.
- Any legacy documentation or comments referring to "Yjs Wiki integration" are historical artifacts and do not reflect the current system architecture.
- For collaborative rich-text documentation in the future, the backend team should consider integrating a block editor (such as Tiptap or BlockNote) backed by PostgreSQL or Yjs WebSocket provider.

