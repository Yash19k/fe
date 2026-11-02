# Chat Attachment Backend Analysis

## Scope and verification notes

This report analyzes the backend in [`backend/`](./backend/). It is based on the checked-in source and documentation, plus a presence-only check of Cloudinary and chat-upload setting names in [`backend/.env`](./backend/.env). No credential values are reproduced. No source files, environment files, migrations, or database state were changed or inspected by executing a migration.

The chat attachment feature is already substantially implemented. The main open questions are deployment/runtime facts that cannot be established from source alone, such as whether the database migration has been applied and whether the configured Cloudinary account accepts the selected authenticated-delivery settings.

## 1. Executive Summary

The backend already supports chat messages with images, PDFs, and a defined set of document and archive formats. It has a dedicated `ChatAttachment` entity and migration, disk-backed Multer upload middleware with extension/MIME/content checks, a reusable Cloudinary service, private signed access URLs, authorization checks, message-history serialization, and WebSocket broadcasts.

Text-only chat remains supported through the existing JSON message endpoint and WebSocket `message:send` event. Attachment messages are sent over HTTP multipart; attachment files are not sent over WebSocket.

No new entity, upload controller, upload service, or migration is required for the currently implemented feature. Before treating it as production-ready, address or explicitly accept the following verified gaps:

1. Temporary upload files can be left in the OS temp directory when the controller rejects an invalid multipart body or conversation ID before entering its cleanup `finally` block.
2. The attachment migration's `down` path drops the attachment table before dropping its indexes; PostgreSQL removes table-owned indexes with the table, so the subsequent `DROP INDEX` statements can fail. The migration also creates a unique index on `chat_messages` which must be removed during rollback.
3. Cloudinary deletion occurs before the database row is deleted. A subsequent database failure leaves metadata pointing to a deleted asset; there is no durable cleanup/retry queue.
4. Upload rollback is best-effort. If the database commit outcome cannot be read during recovery, uploaded Cloudinary assets can be removed even if the transaction committed.

The `.env` file contains non-empty entries for `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. None of the chat size/count overrides is set there, so the middleware defaults apply. Whether the attachment migration is applied in the target database is **not verified**.

## 2. Existing Chat Architecture

The main request path is:

```text
HTTP request
  -> app.ts mount
  -> routes/chat.routes.ts
  -> isLoggedIn
  -> (attachment upload only) requireConversationAccess
  -> uploadChatAttachments Multer middleware
  -> chat.controller.ts controller
  -> chat-attachment.service.ts / chat.service.ts
  -> TypeORM entities and PostgreSQL
  -> chat.service.ts broadcaster registration
  -> websocket/chat.gateway.ts rooms and WebSocket event delivery
```

[`backend/app.ts`](./backend/app.ts) mounts the chat router at `/api/chat/conversations`, `/api/conversations`, and `/api/chat`. [`backend/server.ts`](./backend/server.ts) initializes `AppDataSource`, attaches the chat WebSocket gateway, and starts the HTTP server.

Core data model:

- A conversation belongs to an organization and may reference a project.
- Conversation membership is stored as rows in `chat_conversation_members`.
- A message belongs to a conversation and has a sender user ID and text content.
- Attachments are separate rows associated with both a message and a conversation, plus the uploading user.

Conversation access is checked by [`canAccessConversation`](./backend/services/chat.service.ts#L158). It checks that the conversation exists in the actor's organization, checks project access where applicable, and requires a conversation-member row for the actor. Attachment metadata and file access use this same authorization function.

## 3. Existing Chat Entities and Relationships

| Entity | Actual file | Important columns / relationships | Reuse and gap assessment |
|---|---|---|---|
| `ChatConversation` | [`backend/entities/chat-conversation.entity.ts`](./backend/entities/chat-conversation.entity.ts) | UUID `id`; `organizationId`; nullable `projectId`; `type` (`DIRECT`, `GROUP`, `PROJECT`); nullable `name`; timestamps; nullable `lastMessageAt`; one-to-many `members`. | Existing parent for chat messages and membership. No attachment-specific conversation change is required. |
| `ChatConversationMember` | [`backend/entities/chat-conversation-member.entity.ts`](./backend/entities/chat-conversation-member.entity.ts) | UUID `id`; `conversationId`; `userId`; `joinedAt`; nullable `lastReadAt`; many-to-one conversation and user; unique `(conversationId, userId)`. | Stores participants and the per-member read cursor. Reused for attachment authorization. |
| `ChatMessage` | [`backend/entities/chat-message.entity.ts`](./backend/entities/chat-message.entity.ts) | UUID `id`; `conversationId`; `senderId`; `content` varchar(4000); `createdAt`, `updatedAt`, nullable `editedAt` and `deletedAt`; many-to-one conversation and sender; one-to-many attachments. | Stores text and attachment-message metadata association. Empty content is used for attachment-only messages. No separate content-type field is required by the current design. |
| `ChatAttachment` | [`backend/entities/chat-attachment.entity.ts`](./backend/entities/chat-attachment.entity.ts) | UUID `id`; message, conversation, and uploader IDs; original/stored names; MIME type, extension, bigint size; Cloudinary public ID and URL; resource type; category; optional image dimensions; timestamps. | Existing dedicated attachment model. This is the appropriate design for zero-or-many attachments per message and is already registered in TypeORM. |
| `User` | [`backend/entities/user.entity.ts`](./backend/entities/user.entity.ts) | UUID ID, nullable organization ID, name/email, role, status; referenced by chat membership, sender, and uploader relationships. | Existing identity and tenant boundary. No chat attachment columns are needed on user. |
| `Organization` | [`backend/entities/organization.entity.ts`](./backend/entities/organization.entity.ts) | UUID ID and organization data; one-to-many users/projects. | Chat conversation FK provides organization ownership. No attachment-specific organization entity change is needed. |
| `WorkItemAttachment` | [`backend/entities/work.item.attachment.entity.ts`](./backend/entities/work.item.attachment.entity.ts) | Belongs to a `WorkItem`; has uploader, file metadata, storage key, and Cloudinary metadata. | Not suitable for direct reuse: its required foreign key and lifecycle belong to work items, not chat messages. Its Cloudinary service pattern is reusable. |

[`1793100000000-AddChatAttachments.ts`](./backend/migrations/1793100000000-AddChatAttachments.ts) creates `chat_attachments` and enforces a composite `(message_id, conversation_id)` foreign key to the matching message/conversation pair, cascading deletion with the message/conversation. It also constrains positive file size and `resource_type` to `image` or `raw`. The entity has indexes by message/created time and conversation/created time, and a unique Cloudinary public ID.

The migration also creates a unique index on `(chat_messages.id, chat_messages.conversation_id)` to support that composite foreign key. Migration application state is not verified.

## 4. Existing Controllers, Services, and Routes

| Actual file | Responsibility and important functions | Attachment capability |
|---|---|---|
| [`backend/routes/chat.routes.ts`](./backend/routes/chat.routes.ts) | Applies `isLoggedIn`; defines `requireConversationAccess`; wires create/list/read/member/message/attachment routes. | Already wires upload middleware and attachment metadata/access/delete controllers. |
| [`backend/controllers/chat.controller.ts`](./backend/controllers/chat.controller.ts) | `sendMessageController`, `getMessagesController`, `uploadChatAttachmentsController`, `getChatMessageAttachmentsController`, `getChatAttachmentAccessController`, `deleteChatAttachmentController`, and conversation/read controllers. | Existing text API remains separate; multipart endpoint accepts content, optional message ID, and files from `req.files`. |
| [`backend/services/chat.service.ts`](./backend/services/chat.service.ts) | Conversation membership/access, message save/history, listing, read cursor, response serialization, and broadcaster registration. | `getMessages` loads attachments; `listConversations` loads attachments for each last-message summary; `serializeChatMessage` includes attachment metadata. |
| [`backend/services/chat-attachment.service.ts`](./backend/services/chat-attachment.service.ts) | Upload/Cloudinary orchestration, transactional message/metadata persistence, signed URL access, metadata retrieval, and deletion. | Implements the core attachment lifecycle. |
| [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts) | Lazy Cloudinary initialization, upload, deletion, and private URL generation. | Shared by both chat and work-item attachment services. |
| [`backend/middleware/chat.attachment.upload.middleware.ts`](./backend/middleware/chat.attachment.upload.middleware.ts) | Multer disk upload, type/size/content validation, filename sanitization, temp cleanup. | Dedicated chat upload policy and middleware are already present. |
| [`backend/websocket/chat.gateway.ts`](./backend/websocket/chat.gateway.ts) | Authenticated `ws` connections, conversation rooms, text send/join/leave, and event broadcasts. | Broadcasts new messages including serialized attachment metadata and attachment deletion events. |
| [`backend/middleware/is.loggedin.ts`](./backend/middleware/is.loggedin.ts) | Validates bearer/cookie access tokens and resolves active user identity. | Applied router-wide before attachment routes. |
| [`backend/middleware/async.handler.ts`](./backend/middleware/async.handler.ts) and [`backend/middleware/error.handler.ts`](./backend/middleware/error.handler.ts) | Async route error forwarding and centralized HTTP error responses. | Multer and service errors are forwarded through this convention; service errors use `AppError`. |

[`backend/app.ts`](./backend/app.ts) exposes chat APIs through three router mounts. The documented canonical attachment endpoints use `/api/chat/conversations/...` and `/api/chat/attachments/...`. The router mounts also expose aliases; clients should use the documented canonical paths consistently.

## 5. Existing Cloudinary Integration

### Configuration and environment

- Dependency: `cloudinary` is already in [`backend/package.json`](./backend/package.json).
- [`backend/config/config.ts`](./backend/config/config.ts) calls `dotenv.config()`.
- [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts) reads `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` lazily when an operation is requested, configures the v2 client with `secure: true`, and raises a service-unavailable `AppError` if any value is absent.
- A presence-only inspection found non-empty entries for all three names in [`backend/.env`](./backend/.env). Their values are intentionally not included here.
- [`backend/README-INTEGRATION-NOTES.md`](./backend/README-INTEGRATION-NOTES.md) says these credentials are server-only. No Cloudinary values should be placed in frontend environment variables.

### Existing operations and capabilities

- `uploadToCloudinary(file, folder, options)` supports disk-backed files with `uploader.upload(file.path, ...)` and buffer-backed files through `uploader.upload_stream(...)`.
- It returns public ID, secure URL, resource type, byte count, format, and image dimensions when Cloudinary returns them.
- `deleteFromCloudinary(publicId, resourceType, deliveryType)` wraps Cloudinary destroy.
- `getPrivateCloudinaryUrl(...)` creates a signed authenticated-delivery URL with a 300-second expiry.
- Chat selects `image` for images and `raw` for its document/archive formats. It requests `deliveryType: "authenticated"` and uses server-generated public IDs.
- The generic helper can represent `image`, `video`, and `raw`; chat's allowlist only maps to `image` and `raw`. It does not configure Cloudinary `resource_type: "auto"` for chat.
- The persisted Cloudinary secure URL and public ID are internal metadata. The message serializer returns an application access endpoint, not the raw URL or public ID.

Cloudinary upload and deletion are integrated, but the code has no durable job queue or reconciliation process for failed compensating deletes. Actual Cloudinary account behavior, permissions, quotas, and production credential validity are not verified by source inspection.

## 6. Existing Upload Middleware and Validation

[`backend/middleware/chat.attachment.upload.middleware.ts`](./backend/middleware/chat.attachment.upload.middleware.ts) uses Multer `diskStorage` in `os.tmpdir()` with randomized names. The route accepts repeated multipart fields named `attachments`.

| Setting | Default / behavior |
|---|---|
| Maximum files | 10, configurable by `CHAT_MAX_ATTACHMENTS_PER_MESSAGE` |
| Image size | 10 MiB per file, configurable by `CHAT_IMAGE_MAX_FILE_SIZE_MB` |
| Document size | 25 MiB per file, configurable by `CHAT_DOCUMENT_MAX_FILE_SIZE_MB` |
| General-file size | 50 MiB per file, configurable by `CHAT_FILE_MAX_FILE_SIZE_MB` |
| Multer file size | The maximum of the three category limits; defaults to 50 MiB |
| Multipart fields | At most 2 fields; each field is limited to 4000 bytes |
| Optional extension restriction | `CHAT_ATTACHMENT_ALLOWED_EXTENSIONS`; can narrow but not expand the built-in allowlist |

None of the chat limit/extension overrides was set in the inspected `.env`, so the defaults above apply unless injected through the process environment.

Built-in extensions are `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `.txt`, `.csv`, `.zip`, `.rar`, `.json`, and `.xml`. The middleware checks extension and MIME pairing, then checks content signatures or text structure. It rejects empty files, sanitizes filenames, applies category-specific size limits, and rejects SVG and executable extensions.

The policy is substantially stronger than trusting a client-supplied MIME type alone. However:

- Category limits are checked after Multer has written files to disk. At the parser limit, up to 10 files of 50 MiB each could be temporarily accepted by the default Multer limits before category checks reject oversized image/document files.
- The code reads file content for validation from temp storage; no malware/antivirus scanning is present.
- XML validation checks for basic text/markup markers rather than parsing or schema-validating XML.
- The router-level authentication and conversation access middleware run before Multer, preventing unauthorized requests from reaching file parsing.

The separate [`backend/middleware/work.item.attachment.upload.middleware.ts`](./backend/middleware/work.item.attachment.upload.middleware.ts) is not a direct replacement: it implements work-item-specific upload rules and should not be substituted for the chat-specific policy.

## 7. Authentication and Authorization Analysis

1. `router.use(isLoggedIn)` authenticates all chat routes using a verified access token from bearer authorization or the `token` cookie and reloads the user, requiring active status.
2. The upload route runs `requireConversationAccess` before Multer. It validates the conversation UUID and calls `canAccessConversation`.
3. `canAccessConversation` requires the conversation to exist in the actor's organization, applies project access rules, and requires the actor to have a conversation membership row.
4. `uploadChatMessageWithAttachments` repeats the conversation access check before upload/persistence.
5. `getChatMessageAttachments`, `getChatAttachmentAccess`, and `deleteChatAttachment` also check conversation access. Attachment retrieval additionally rejects deleted messages.
6. Deletion is restricted to the original `uploadedById`; being a conversation administrator alone does not bypass this ownership requirement.

For project conversations, project access does not replace conversation membership: the actor must still be a conversation member. `hasProjectAccess` recognizes organization managers/admins, public-project access, or project membership, while `canAccessConversation` then checks chat membership.

The application returns a temporary signed Cloudinary URL after authorization. A signed URL is a bearer capability until expiration, as the integration notes also warn; clients should not store or share it beyond the download/view operation.

## 8. Current Message Creation and Retrieval Flow

### Text-only messages

`POST /api/chat/conversations/:conversationId/messages` validates a non-empty 1–4000-character `content` string in `sendMessageController`. `saveMessage` trims and validates content, checks conversation access, saves the message and updates `lastMessageAt` in a database transaction, reloads sender/attachments, and returns a serialized message. The controller broadcasts it through `broadcastChatMessage`.

WebSocket clients can also send a text-only `message:send` event after joining an authorized room. The gateway validates content and calls the same `saveMessage` function.

### Messages with attachments

`POST /api/chat/conversations/:conversationId/attachments` accepts multipart form data. The upload controller accepts optional `content` (empty is allowed) and optional UUID `messageId`; it passes the uploaded files to `uploadChatMessageWithAttachments`.

The service validates that either text or at least one file exists, checks access, handles a matching prior message ID as a retry, uploads all files, then transactionally saves the message, attachment metadata, and conversation `lastMessageAt`. It reloads the saved message with attachments and triggers a non-blocking `message:new` broadcast.

### History, unread counts, and read state

- `GET /api/chat/conversations/:conversationId/messages` retrieves up to 100 messages, optionally older than an ISO `before` timestamp, ordered newest-first in SQL and reversed for chronological response. It joins sender and attachment rows and omits soft-deleted messages.
- Conversation listing includes the latest message and its attachments, plus `unreadCount` and the actor's `lastReadAt`.
- `PATCH /api/chat/conversations/:conversationId/read` updates the member's `lastReadAt`.
- There are no per-message delivery states or per-message read receipts in the inspected chat implementation. Read state is conversation-member timestamp based.
- `ChatMessage` has `editedAt` and `deletedAt` columns, but no message edit/delete route or service function was found in the chat controller/service. The current attachment delete endpoint removes one attachment, not the message.

## 9. Required Database Changes

For the implemented attachment feature, the required schema migration already exists: [`backend/migrations/1793100000000-AddChatAttachments.ts`](./backend/migrations/1793100000000-AddChatAttachments.ts).

It creates:

- `chat_attachments` with metadata, Cloudinary identifiers, type, and timestamps.
- Foreign keys to `(chat_messages.id, chat_messages.conversation_id)`, `chat_conversations.id`, and `users.id`.
- Cascading cleanup for message/conversation deletion and restrictive deletion for the uploader.
- A positive-file-size check and allowed Cloudinary resource-type check.
- Message/time and conversation/time indexes, plus unique Cloudinary public ID.
- A unique `(chat_messages.id, chat_messages.conversation_id)` index needed by the composite FK.

No extra message columns are needed. A separate attachment entity is preferable to adding columns directly to `ChatMessage`, because the current API supports multiple attachments and the metadata has its own lifecycle. Reusing `WorkItemAttachment` would incorrectly bind chat files to a work item.

**Not verified:** whether this migration was run against any specific database. [`backend/config/data.source.ts`](./backend/config/data.source.ts) registers `ChatAttachment` and loads migration files, but TypeORM schema synchronization is not proof of migration application. The repository documentation instructs operators to apply migrations through the normal migration command.

**Rollback issue:** the migration's `down()` drops `chat_attachments` before dropping indexes owned by that table. PostgreSQL drops those indexes with the table, making the later explicit `DROP INDEX` statements fail unless made conditional or reordered. Keep the separately created message composite index until after the attachment table is removed, then drop it. Validate a rollback against a disposable database before relying on `down()`.

## 10. Required Backend Implementation

The requested attachment flow is already present:

1. The client submits `content` and repeated `attachments` multipart fields.
2. `isLoggedIn` authenticates and loads an active user.
3. `requireConversationAccess` checks organization, project, and explicit membership before Multer.
4. The middleware checks file count, size, extension/MIME pairing, file content, and filename.
5. `uploadChatFiles` uploads each accepted file to Cloudinary as an authenticated asset.
6. `uploadChatMessageWithAttachments` persists the message, metadata rows, and conversation timestamp in one database transaction.
7. The service reloads and serializes the saved message.
8. The service broadcasts `message:new` to authorized sockets in the conversation.
9. Recipients receive the message and its attachment metadata; the metadata contains an `accessUrl` that can be used to request a short-lived signed URL.

Therefore the implementation plan is primarily a hardening/verification plan rather than a greenfield build:

- Fix controller temp-file cleanup for validation/UUID early returns.
- Correct and test the migration rollback order.
- Decide on a durable Cloudinary cleanup/reconciliation policy for failed deletes and uncertain database commits.
- Confirm production environment values and apply/verify the migration through deployment operations.
- Extend focused tests around controller cleanup, partial Cloudinary failure, transaction failure, deletion failure, and access denial.

## 11. Recommended API Design

The current route design is compatible with text-only clients and supports multiple attachments.

| Purpose | Current method and path | Content type / request | Response and authorization |
|---|---|---|---|
| Send text-only message | `POST /api/chat/conversations/:conversationId/messages` | JSON: `{ "content": "..." }` | `201`, `{ success, data: message }`; authenticated conversation member. |
| Send text plus files or attachment-only message | `POST /api/chat/conversations/:conversationId/attachments` | `multipart/form-data`; optional `content`, optional UUID `messageId`, repeated `attachments` file fields. At least one file is required by the route middleware; content may be empty. | `201`, `{ success, data: message }`; authenticated conversation member. |
| Retrieve paginated message history | `GET /api/chat/conversations/:conversationId/messages?limit=50&before=<ISO-date>` | Query parameters `limit` (1–100, default 50) and optional ISO `before`. | `{ success, data: message[] }`; authenticated conversation member. Each message includes attachment metadata. |
| Retrieve message attachment metadata | `GET /api/chat/conversations/:conversationId/messages/:messageId/attachments` | No body. | `{ success, data: attachment[] }`; authenticated conversation member. |
| Obtain temporary attachment URL | `GET /api/chat/attachments/:attachmentId/access[?download=true]` | No body. | `{ success, data: { url, expiresInSeconds: 300 } }`; authenticated member of the attachment's conversation. |
| Delete an individual attachment | `DELETE /api/chat/attachments/:attachmentId` | No body. | `204`; authenticated conversation member who uploaded that attachment. |

Attachment metadata contains `id`, `uploadedById`, `originalName`, `mimeType`, `fileExtension`, `fileSize`, `attachmentType`, optional `width`/`height`, `createdAt`, and an application `accessUrl`. It does not expose `cloudinaryPublicId` or the stored Cloudinary URL. The access endpoint returns a short-lived signed URL.

The optional `messageId` is used by the service to reuse a message on retry. A client that needs retry idempotency should generate and reuse it for the same logical upload; when omitted, the service generates a new UUID.

`app.ts` has multiple chat router mounts. Use the documented `/api/chat/...` paths as canonical rather than relying on aliases.

## 12. Real-Time Attachment Delivery

The gateway is a `ws` WebSocket implementation from the `ws` package, not Socket.IO. It serves `/ws/chat`, authenticates a cookie or bearer token at handshake, limits frames to 64 KiB, and limits events to 30 per 10-second window.

Clients join with `conversation:join`; only joined, authorized, active members receive room broadcasts. After the HTTP upload persists the message, the existing broadcaster emits `message:new` with the same serialized message shape used by the REST response, including attachment metadata. Deletion emits `attachment:deleted` with conversation, message, and attachment IDs.

The WebSocket layer rechecks active-user and conversation access for each recipient. Broadcast failures are logged and swallowed; the attachment HTTP response does not wait for socket delivery. There is no durable event queue or guaranteed replay for offline participants, so message history remains the recovery path.

No file bytes or upload request are sent through WebSocket. The client obtains a temporary Cloudinary URL from the HTTP access endpoint.

## 13. Attachment Deletion and Cleanup Strategy

Current behavior:

- Partial Cloudinary upload failure: successful assets from that batch are passed to `deleteFromCloudinary`; cleanup failures are logged.
- Database transaction failure: uploaded assets are deleted as compensation; the service also checks for a message that may have committed during a retry/race.
- Attachment deletion: Cloudinary is deleted first; `"ok"` and `"not found"` are accepted; then the metadata row is deleted and `attachment:deleted` is broadcast.
- Message/conversation database deletion cascades attachment metadata. No corresponding Cloudinary cascade is possible from PostgreSQL alone.

Gaps and recommended behavior:

- Cloudinary and PostgreSQL cannot share an atomic transaction. Use a durable cleanup/outbox record or periodic reconciliation if orphan prevention is a production requirement.
- If Cloudinary deletion succeeds but the database delete fails, the row remains but the Cloudinary object is gone. Record a retryable state or make the operation idempotently reconcilable.
- If the database commit result is uncertain and the recovery query also fails, current code deletes the uploaded assets and rethrows. A committed message could then reference missing Cloudinary files. Prefer deferring destructive compensation until the commit outcome is resolved or a reconciliation worker can safely decide.
- Cascading database deletion of a message/conversation does not call Cloudinary. If a message deletion feature is added, it must explicitly schedule Cloudinary cleanup.
- The upload controller's `finally` removes temp files only after control reaches its `try` block. Joi validation and conversation UUID checks occur before that block; invalid input can therefore leave Multer-created files in `os.tmpdir()`.

## 14. File-by-File Implementation Matrix

| File Path | Existing Responsibility | Current Capability | Required Change / Recommendation | Action |
|---|---|---|---|---|
| [`backend/entities/chat-attachment.entity.ts`](./backend/entities/chat-attachment.entity.ts) | Chat attachment persistence | Full attachment metadata and TypeORM relations | No feature change required. | No change |
| [`backend/entities/chat-message.entity.ts`](./backend/entities/chat-message.entity.ts) | Message persistence | One-to-many attachment relation; soft-delete fields | No feature change required. | No change |
| [`backend/entities/chat-conversation.entity.ts`](./backend/entities/chat-conversation.entity.ts) | Conversation persistence | Organization/project ownership and membership relation | No feature change required. | No change |
| [`backend/entities/chat-conversation-member.entity.ts`](./backend/entities/chat-conversation-member.entity.ts) | Membership/read state | Explicit member relation and last-read timestamp | No feature change required. | No change |
| [`backend/config/data.source.ts`](./backend/config/data.source.ts) | TypeORM configuration | Registers `ChatAttachment`; includes migration glob | No feature change required; verify deployed migration separately. | Reuse |
| [`backend/migrations/1793100000000-AddChatAttachments.ts`](./backend/migrations/1793100000000-AddChatAttachments.ts) | Attachment schema migration | Creates attachment table, indexes, constraints, composite FK | Correct `down()` index-drop order and test rollback. | Modify |
| [`backend/services/cloudinary.service.ts`](./backend/services/cloudinary.service.ts) | Shared Cloudinary client | Authenticated upload/delete and signed private URLs; path and stream upload | No core feature change required; consider tighter resource-type validation if this API is expanded. | Reuse |
| [`backend/middleware/chat.attachment.upload.middleware.ts`](./backend/middleware/chat.attachment.upload.middleware.ts) | Multipart parsing and validation | Disk storage, allowlist, MIME/extension/content checks, count and size limits | Consider enforcing resource limits earlier and add tests for temp cleanup/aggregate upload behavior. | Reuse / harden |
| [`backend/routes/chat.routes.ts`](./backend/routes/chat.routes.ts) | Chat route authorization and wiring | Authentication, conversation guard, upload and attachment endpoints | No feature change required. | Reuse |
| [`backend/controllers/chat.controller.ts`](./backend/controllers/chat.controller.ts) | HTTP request validation/response | Text and attachment endpoints; file cleanup in upload `finally` | Ensure files are cleaned even when Joi or UUID validation returns before current `try/finally`. | Modify |
| [`backend/services/chat-attachment.service.ts`](./backend/services/chat-attachment.service.ts) | Attachment persistence and lifecycle | Upload, transactional metadata/message save, access signing, delete and compensating cleanup | Add durable/reconcilable cleanup for uncertain commit and post-Cloudinary DB-delete failures if required by reliability goals. | Modify / harden |
| [`backend/services/chat.service.ts`](./backend/services/chat.service.ts) | Chat access, messages, serialization, reads | Access checks; attachment-aware history/listing; broadcaster APIs | No feature change required. | Reuse |
| [`backend/websocket/chat.gateway.ts`](./backend/websocket/chat.gateway.ts) | WebSocket auth, rooms, message delivery | `message:new` with attachment metadata; `attachment:deleted` | No feature change required for delivery; durable offline delivery is not implemented. | Reuse |
| [`backend/middleware/is.loggedin.ts`](./backend/middleware/is.loggedin.ts) | REST authentication | Validates active authenticated users | No feature change required. | Reuse |
| [`backend/middleware/error.handler.ts`](./backend/middleware/error.handler.ts) | Central HTTP error responses | Handles forwarded `AppError` and generic failures | No feature change required. | Reuse |
| [`backend/entities/work.item.attachment.entity.ts`](./backend/entities/work.item.attachment.entity.ts) | Work-item attachment persistence | Separate work-item-specific relation and storage metadata | Do not reuse as the chat attachment entity. | No change |
| [`backend/services/work.item.attachment.service.ts`](./backend/services/work.item.attachment.service.ts) | Work-item Cloudinary workflow | Reuses shared Cloudinary upload and cleanup helper | Useful prior art only; chat-specific authorization and file policy remain separate. | No change |
| [`backend/tests/chat-attachment-upload.test.ts`](./backend/tests/chat-attachment-upload.test.ts) | Chat attachment unit tests | Allowlist/content checks, name sanitation, successful attachment-only persistence and retry | Extend for early validation cleanup, partial upload failure, uncertain commit, delete failure, and unauthorized access. | Modify tests |
| [`backend/README-INTEGRATION-NOTES.md`](./backend/README-INTEGRATION-NOTES.md) | Backend integration and chat documentation | Documents env names, migration, endpoints, limits, and private URL behavior | Existing coverage is substantially adequate; update if operational cleanup/retry behavior is added. | Reuse / update if behavior changes |

**New files required for the existing feature:** none. A durable cleanup worker/outbox would be a new capability, not a prerequisite for the current upload/API path; design and scope it separately if required.

## 15. Existing Features That Can Be Reused

- `isLoggedIn` for REST authentication.
- `canAccessConversation` for organization, project, and membership checks.
- `ChatAttachment` and its existing migration for attachment metadata persistence.
- `uploadToCloudinary`, `deleteFromCloudinary`, and `getPrivateCloudinaryUrl` for storage operations.
- `uploadChatAttachments` for chat-specific multipart policy.
- `serializeChatMessage` and `serializeChatAttachment` for consistent HTTP/WebSocket message shapes.
- `getMessages` and `listConversations` for attachment-aware history and last-message previews.
- `broadcastChatMessage` and `broadcastChatAttachmentDeleted` for real-time events.
- `AppError`, `asyncHandler`, and the central error handler for HTTP error propagation.
- `WorkItemAttachment` is not reusable as a chat row, but [`backend/services/work.item.attachment.service.ts`](./backend/services/work.item.attachment.service.ts) demonstrates the shared Cloudinary integration and best-effort compensation pattern.

## 16. Missing Features and Implementation Gaps

### Not missing for the core attachment path

- Separate attachment metadata entity and migration.
- Multiple attachments per message.
- Attachment-only messages.
- Image/PDF/document/archive allowlist and per-category limits.
- Authentication and conversation authorization before upload.
- Signed URL access rather than returning raw public Cloudinary URLs.
- Attachment-aware history and real-time message payloads.
- Individual attachment deletion.

### Verified gaps or not-verified operational requirements

- **Temp-file cleanup gap:** invalid multipart body fields or invalid conversation UUID can return before the controller's cleanup `finally`.
- **Migration rollback gap:** table-owned indexes are dropped by `DROP TABLE` before explicit `DROP INDEX`; down migration should be corrected and tested.
- **External-storage consistency:** cleanup is best-effort and not durable; a Cloudinary deletion followed by database failure leaves stale metadata.
- **Uncertain commit edge case:** a failed recovery read may trigger Cloudinary cleanup despite a possibly committed database transaction.
- **Resource-pressure concern:** Multer's default parser limit allows a maximum of 10 × 50 MiB before per-category rejection, while files are disk-backed and read for inspection.
- **No malware scanning:** no antivirus or content-disarm pipeline was found.
- **No durable WebSocket delivery:** a broadcast is best-effort; clients rely on message-history retrieval after reconnecting.
- **No message deletion workflow:** soft-delete columns exist, but no chat message deletion endpoint/service was found; future message deletion must coordinate Cloudinary cleanup.
- **Migration status not verified:** the migration is in source and documented, but no database was queried or altered.
- **Cloudinary service/account behavior not verified:** environment variable names are configured in `.env`, but remote connectivity, credentials, permissions, quotas, and authenticated asset retrieval were not tested.

## 17. Recommended Implementation Sequence

1. Verify the deployment's migration history and confirm `1793100000000-AddChatAttachments` is applied; do not infer this from entity registration.
2. Fix controller temp-file cleanup so every request path after Multer parsing releases files, including Joi/UUID validation failures.
3. Correct the migration `down()` ordering and verify up/down behavior using a disposable PostgreSQL database.
4. Add focused tests for file cleanup, partial Cloudinary failures, database rollback/uncertain commit, deletion failure, and membership denial.
5. Decide the required reliability level for Cloudinary cleanup. If orphan/stale objects are unacceptable, add a durable cleanup/outbox or reconciliation process.
6. Validate deployed Cloudinary authenticated upload, signed access, download disposition, and deletion using non-production assets.
7. Keep clients on the documented REST upload route; use `messageId` consistently for retries and request a fresh signed URL as needed.
8. Monitor upload, cleanup, and deletion error logs; ensure temporary storage capacity and cleanup policy are appropriate for the deployed environment.

## 18. Risks, Edge Cases, and Security Considerations

- Do not expose Cloudinary credentials or persist signed URLs on the client; signed URLs are temporary bearer links.
- Do not bypass `requireConversationAccess` or service-level access checks when changing route order. The access endpoint must continue checking conversation membership before signing.
- The controller logs upload event metadata but not file contents or Cloudinary credentials.
- Filename sanitation strips path components/control characters and caps stored display names at 255 characters.
- MIME and extension checks are backed by content checks for the supported formats, but these checks are not a substitute for malware scanning.
- Multer writes to the OS temp directory. Set appropriate host-level disk quotas/monitoring and ensure the early-return cleanup gap is fixed.
- Cloudinary operations happen outside the PostgreSQL transaction; database transactions cannot roll back remote uploads or deletes.
- `fileSize` uses a PostgreSQL `bigint` and is serialized as a string, avoiding JavaScript integer precision loss.
- Attachment metadata is scoped to its conversation, and the migration's composite foreign key prevents an attachment from claiming a different conversation than its message.
- A successful message persistence does not guarantee every WebSocket recipient received the event; history retrieval is the recovery mechanism.
- The exact application/database migration state and production storage settings remain **not verified**.

## 19. Final Recommendations

The backend already implements the requested Cloudinary chat attachment feature; do not create a second attachment entity, upload controller, Cloudinary helper, or parallel upload path. Preserve the existing text-only endpoint and use the separate multipart attachment endpoint for files.

Prioritize the confirmed temp-file cleanup issue and migration rollback ordering. Then add focused failure-path tests and decide whether best-effort cleanup is sufficient or a durable reconciliation mechanism is required. Finally, verify migration state and authenticated Cloudinary behavior in the target deployment without exposing environment values.
