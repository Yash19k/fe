# Chat Functionality and Business Logic

**Last reviewed:** 2026-11-03  
**Scope:** Current chat implementation in the TaskFlow backend and frontend. This guide describes behavior visible in source code; it is not a claim that every capability has been exercised against a production deployment.

## 1. Overview

TaskFlow chat is an organization-scoped messaging feature for authenticated, active users. The browser uses protected HTTP endpoints to load and create conversations and retrieve message history. A raw WebSocket connection delivers live messages and conversation membership events.

The current frontend supports direct messages and group conversations. The backend data model and API also recognize project-linked conversations, but the current chat screen does not provide a project-chat creation flow or member-administration controls.

### Main components

| Component                                                                                                      | Responsibility                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/features/chat/ChatView.tsx`                                                                      | Conversation list, search, direct/group creation, message history, composer, read state, socket lifecycle, and delivery recovery. |
| `frontend/src/features/chat/chatState.ts`                                                                      | Message merge/deduplication, conversation previews and ordering, unread state, and send-state helpers.                            |
| `frontend/src/services/api.ts`                                                                                 | Typed chat models and HTTP helpers used by the frontend.                                                                          |
| `backend/routes/chat.routes.ts`                                                                                | Authenticated HTTP route registration.                                                                                            |
| `backend/controllers/chat.controller.ts`                                                                       | Request validation, actor lookup, response envelopes, and service delegation.                                                     |
| `backend/services/chat.service.ts`                                                                             | Conversation rules, access checks, membership, persistence, history, unread counts, and message serialization.                    |
| `backend/websocket/chat.gateway.ts`                                                                            | WebSocket authentication, join/leave/send events, per-socket rate limiting, and room broadcasts.                                  |
| `backend/entities/chat-conversation.entity.ts`, `chat-conversation-member.entity.ts`, `chat-message.entity.ts` | Conversation, membership/read state, and message persistence models.                                                              |

## 2. Authentication and Access Rules

- Every chat HTTP route uses the `isLoggedIn` middleware. It accepts a valid access JWT from the bearer header or the `token` cookie, then reloads the user and requires `ACTIVE` status.
- The WebSocket endpoint is `/ws/chat`. During upgrade, it validates the access token, checks the user is active, and enforces the configured allowed-origin policy.
- The WebSocket gateway rechecks the actor's active status for incoming events and before broadcasting to each room member. A user who becomes inactive or loses conversation access is removed from the room.
- Conversations are scoped to the actor's organization and require explicit conversation membership. Knowing a conversation ID is not sufficient to access it.
- A project-linked conversation additionally checks project access. Organization `ADMIN` and `MANAGER` roles pass the project-level check; other users must have project access. For a `PUBLIC` project, a user can pass the project visibility check, but still must be a member of the conversation.
- Conversation and message history requests that fail the conversation access check return a not-found response, avoiding disclosure of inaccessible conversation IDs.
- Chat membership creation only accepts active users belonging to the conversation's organization.

## 3. Conversation Types and Business Rules

The backend enum defines `DIRECT`, `GROUP`, and `PROJECT` conversation types.

### Direct conversations

- A direct conversation contains exactly two distinct users: the requesting actor and one other active user from the same organization.
- Direct conversations cannot be linked to a project.
- The service constructs a stable pair key from the two user IDs and the database enforces uniqueness per organization. Repeated create requests return the existing direct conversation rather than creating another one.
- Direct conversation membership is locked: the add-member route rejects additions and the remove-member route rejects removals.

### Group conversations

- A group contains at least three users total: the requesting actor and at least two other active organization users.
- The group name is optional, trimmed, and limited to 150 characters.
- The frontend exposes group creation and participant selection. It uses the current organization user directory; the backend independently validates the selected IDs and status.

### Project-linked conversations

- The backend accepts a `projectId` and `PROJECT` conversation type, and checks that the project belongs to the actor's organization.
- Creating a project-linked conversation requires project membership for non-`ADMIN`/`MANAGER` actors, even if a project is public. Later conversation access checks allow public-project access, but still require conversation membership.
- Project-linked conversation membership can be managed by organization `ADMIN`/`MANAGER` users or, for other users, project members whose project role is `ADMIN` or `LEAD`.
- The frontend currently has no project conversation creation or membership management screen.

### Member management

- `POST /:conversationId/members` adds an active organization user to an eligible group/project conversation.
- `DELETE /:conversationId/members/:userId` removes a member. The backend deletes the membership and evicts that user's connected sockets from the conversation room; the removed user receives `conversation:removed` and the frontend removes the conversation from its local list.
- Direct conversations cannot be changed through these operations.

## 4. Message Rules and Persistence

- Message content is trimmed and must contain 1 to 4,000 characters. The frontend enforces a 4,000-character maximum; the backend remains authoritative.
- A message is only persisted if the actor still has access to the conversation.
- Message creation and the conversation's `lastMessageAt` update occur in one database transaction.
- Messages are ordered by server creation time, with message ID as a stable tie-breaker. History is returned oldest-first for display.
- Message history excludes rows with `deletedAt` set. The latest-message preview and unread count also exclude deleted messages.
- `clientMessageId` is optional at the API level. When supplied, it is unique per conversation and sender. Repeating the same ID returns the existing message, including in the concurrent-insert recovery path; this supports safe client retries.
- The chat screen creates a UUID for each new send and reuses that ID when retrying the same pending content. The sender confirms delivery from the `message:new` echo rather than a separate acknowledgement event.
- `editedAt` and `deletedAt` columns exist, but there are no chat edit/delete endpoints or UI actions in the current implementation.

## 5. Unread State and Conversation Ordering

- Each conversation membership row stores its own `lastReadAt` value.
- The unread count is the number of non-deleted messages from other senders created after that member's `lastReadAt`. The user's own messages do not count as unread.
- Selecting a conversation causes the frontend to call the mark-read endpoint. Incoming messages in the selected conversation trigger another read update so a message arriving during an earlier read request is not silently left unread.
- After a successful read update, the frontend clears that conversation's local unread badge.
- The conversation list is ordered by `lastMessageAt`, falling back to conversation creation time, descending. New socket messages update the local preview, unread count, and list order.
- The UI loads conversations in pages of 50 and can request more pages. The backend accepts a page size up to 100.

## 6. HTTP API

Canonical base path: `/api/chat/conversations`. All routes require authentication. The chat router is also mounted at `/api/conversations` and `/api/chat` for compatibility.

| Method and path                                                                   | Purpose                                                                           | Important inputs / response                                                                                                                                       |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/chat/conversations?page=1&limit=50`                                     | List conversations for the current actor.                                         | Returns conversation data with participant, latest-message, read timestamp, and unread-count fields. Limit is 1-100.                                              |
| `POST /api/chat/conversations`                                                    | Create or retrieve a direct conversation, or create a group/project conversation. | `type` is required. Supply `participantId` or `memberIds`; optional `organizationId`, `projectId`, and `name` are validated. Returns `201` and conversation data. |
| `GET /api/chat/members`                                                           | List other active users in the actor's organization.                              | Returns selected profile fields for choosing participants.                                                                                                        |
| `GET /api/chat/conversations/:conversationId`                                     | Fetch one conversation for an authorized member.                                  | Returns `{ success, data }`.                                                                                                                                      |
| `POST /api/chat/conversations/:conversationId/members`                            | Add a member where the actor has management permission.                           | Body: `{ "userId": "<uuid>" }`.                                                                                                                                   |
| `DELETE /api/chat/conversations/:conversationId/members/:userId`                  | Remove a member where permitted.                                                  | Returns HTTP `204` on success.                                                                                                                                    |
| `GET /api/chat/conversations/:conversationId/messages?limit=50&before=&beforeId=` | Fetch the latest or an older history page.                                        | `beforeId` must accompany `before`; limit is 1-100. Messages are returned oldest-first within the page.                                                           |
| `POST /api/chat/conversations/:conversationId/messages`                           | Send a message over HTTP.                                                         | Body: `{ "content": "...", "clientMessageId": "<optional uuid>" }`. Returns `201`; successful saves are broadcast to joined WebSocket clients.                    |
| `PATCH /api/chat/conversations/:conversationId/read`                              | Mark the current member's conversation as read.                                   | Returns HTTP `204`.                                                                                                                                               |

The current chat screen uses the list, create, history, and mark-read HTTP operations. It sends messages through WebSocket; the HTTP send route is available to other clients.

## 7. WebSocket Protocol

The server attaches the chat gateway to the HTTP server at `/ws/chat`. The frontend derives `ws://` or `wss://` from the configured API base URL.

### Client events

```json
{ "event": "conversation:join", "conversationId": "<uuid>" }
{ "event": "conversation:leave", "conversationId": "<uuid>" }
{ "event": "message:send", "conversationId": "<uuid>", "content": "Hello", "clientMessageId": "<uuid>" }
```

### Server events

| Event                  | Meaning                                                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation:joined`  | Join authorization succeeded for the supplied conversation.                                                                                                                 |
| `message:new`          | A message was saved and broadcast to connected members. `data` contains the server message ID, conversation/sender IDs, content, timestamp, and optional `clientMessageId`. |
| `conversation:removed` | The socket's user has been removed or no longer has access.                                                                                                                 |
| `chat:error`           | The gateway rejected an event or could not process it. It currently carries a message, not a request correlation ID.                                                        |

The server requires a successful join before accepting a socket message send. It limits each socket to 30 events per 10-second window and caps WebSocket payload size at 64 KB. Message content has the stricter 4,000-character rule.

The frontend queues joins, prioritizes the selected conversation, waits for `conversation:joined` before enabling send, and paces join requests. It maintains membership for loaded conversations to update sidebar previews and unread badges in real time. On socket close it reconnects with exponential backoff capped at 15 seconds, rejoins conversations, and reloads the selected conversation's latest history page.

## 8. Frontend User Flows

1. **Open chat:** The screen loads the first conversation page and selects the newest conversation when one exists.
2. **Find a conversation:** Search filters the loaded conversation list by participant/group display name, email, or latest-message text. It does not search the full message history on the server.
3. **Start a direct message:** Choose one teammate and submit. The backend returns the existing direct thread if the pair already has one.
4. **Start a group:** Choose at least two other teammates and optionally enter a group name. The actor is added by the backend.
5. **Read history:** The screen loads the newest 50 messages. Scrolling to the top fetches older pages using the oldest message's timestamp and ID as a cursor.
6. **Send text:** Enter submits; Shift+Enter inserts a newline. The composer also supports a curated emoji picker. The draft stays in component memory per conversation when switching threads.
7. **Confirm delivery:** The composer remains pending until the server echoes the matching message. On timeout or disconnect, the draft remains and the retry keeps its client message ID. If the user edits the draft while a send is pending, the accepted earlier text does not clear the newer draft.
8. **Recover from access removal:** The frontend clears local state for that conversation and returns to the conversation list after `conversation:removed`.

Drafts are held in frontend memory only; they are not persisted across a full page reload. There is no separate delivery acknowledgement event; matching uses sender, conversation, content, and `clientMessageId` when present.

## 9. Data Model and Migrations

- `chat_conversations`: organization, optional project, type/name, direct-pair key, and latest activity timestamp.
- `chat_conversation_members`: conversation/user membership, join timestamp, and per-user read timestamp. A unique constraint prevents duplicate membership rows.
- `chat_messages`: conversation, sender, optional client message ID, text, timestamps, and edit/delete timestamps.
- Foreign keys cascade conversation deletion to members/messages and user deletion to memberships; message sender deletion is restricted.

The chat schema is introduced and extended by:

- `backend/migrations/1792400000000-AddChatTables.ts`
- `backend/migrations/1792700000000-AddDirectChatConstraints.ts`
- `backend/migrations/1793500000000-AddChatMessageIdempotency.ts`

## 10. Current Scope Boundaries and Follow-up Risks

- The frontend only creates direct and group conversations. Project-linked chat and add/remove-member operations are backend capabilities without matching controls in the current chat screen.
- Chat attachments are not persisted or sent through a chat attachment API. The current composer supports text and emoji only.
- Typing indicators, online presence, per-message read receipts, chat notifications, and message edit/delete workflows are not implemented.
- **Sensitive user fields need response allowlisting:** `getConversationForActor`, conversation listing, and `addMember` load related `User` entities and return them in response data. The `User` entity includes password/invitation fields that are not hidden from ordinary TypeORM selects. Treat those nested user objects as potentially exposing sensitive columns until chat responses use explicit safe DTOs. Message serialization itself allowlists sender fields.
- **Project type validation is permissive:** the backend validates project access when `projectId` is supplied, but does not require `projectId` whenever `type` is `PROJECT`, or forbid it for `GROUP`. Tightening this invariant would make project conversation semantics clearer.
- Generic `chat:error` events are not correlated to a send or join request. The client handles one pending send at a time; a request ID in errors would make concurrent operation recovery more precise.

## 11. Source and Test References

- Backend service rules: `backend/services/chat.service.ts`
- HTTP validation and handlers: `backend/controllers/chat.controller.ts`
- HTTP route definitions: `backend/routes/chat.routes.ts`
- Socket authentication and events: `backend/websocket/chat.gateway.ts`
- Frontend chat workflow: `frontend/src/features/chat/ChatView.tsx`
- Frontend state helpers: `frontend/src/features/chat/chatState.ts`
- Frontend API types/helpers: `frontend/src/services/api.ts`
- Conversation-list query tests: `backend/tests/chat-list-conversations.test.ts`
- Frontend state synchronization tests: `frontend/tests/chat_state.test.ts`
- Frontend mark-read API test: `frontend/tests/chat_api.test.ts`
