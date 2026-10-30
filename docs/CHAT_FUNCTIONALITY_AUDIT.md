# TaskFlow Chat Functionality Audit

**Audit date:** 2026-10-30  
**Scope:** Current working tree in `interns_project_2026`; source review, automated tests, TypeScript checks, and frontend lint. No source code or application configuration was changed.

## A. Executive summary

The Chat module is **not reliable or production-ready end to end**. The principal concerns are a confirmed exposure of credential-related user columns through chat responses, a send-before-join race that can discard a user's draft, unread state that is never marked read by the UI, and incomplete real-time synchronization/recovery.

| Measure | Result |
|---|---:|
| Confirmed findings (including incomplete user-facing capabilities) | 11 |
| Potential findings | 1 |
| Security findings | 3 (2 confirmed, 1 potential) |
| Backend full-suite tests | 69 passed, 0 failed, 0 skipped |
| Frontend full-suite tests | 323 passed, 6 failed, 0 skipped |
| TypeScript checks | Backend and frontend passed |
| Frontend lint | Passed with 126 warning occurrences |
| Live database/browser scenarios | Not run |

Two high-severity issues should be addressed before production release: chat relation queries return sensitive user columns, and WebSocket sends are not gated on server join confirmation and clear the draft before success is known. The full frontend test suite also has six failures: three missing `BACKEND_TEAM_HANDOFF.md` documentation assertions (one chat-specific) and three unrelated list-view assertions.

The project is using **raw WebSocket (`ws`)**, not Socket.IO, for chat. The browser and backend event names are generally aligned, and the used conversation-list, conversation-create, and message-history HTTP paths match the mounted Express routes. However, the UI does not wire the existing mark-read endpoint, does not consume join confirmation/removal events, and does not update the conversation sidebar from incoming messages.

The report is based on source and automated-test evidence. No live PostgreSQL instance, browser journey, or production account was used, and no existing database rows were changed. The build commands were not run because they emit or overwrite compiled `dist` artifacts, which would violate the audit's “only create the report” constraint.

## B. Architecture overview

### Frontend

| File | Responsibility |
|---|---|
| [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L206) | Single chat route/view: conversation list, direct-message creation, history loading, raw WebSocket lifecycle, message composer, unread badges, and local attachment previews. It owns state locally; no chat-specific query cache/store is used. |
| [api.ts](../frontend/src/services/api.ts#L865) | Shared HTTP/auth client, chat interfaces, and chat conversation/history API helpers. The chat helpers currently return `any`, so the response shape is not checked by TypeScript. |
| [App.tsx](../frontend/src/App.tsx#L39) | Lazy-loads `ChatView` and renders it for the `/chat` route. |
| [AppContext.tsx](../frontend/src/state/AppContext.tsx) | Supplies current user, organization, user directory, and toast handling used by the chat view. |
| [WorkspaceSidebar.tsx](../frontend/src/components/navigation/WorkspaceSidebar.tsx) | Navigation link to Chat; no chat unread total/badge is wired here. |
| [chat_and_sidebar_refinement.test.ts](../frontend/tests/chat_and_sidebar_refinement.test.ts#L1) | Static source-content tests for selected UI/design expectations. It does not exercise a live browser, HTTP service, or WebSocket. |

### Backend

| File | Responsibility |
|---|---|
| [app.ts](../backend/app.ts#L63) | Mounts the chat router at `/api/chat/conversations`, `/api/conversations`, and `/api/chat`. |
| [chat.routes.ts](../backend/routes/chat.routes.ts#L17) | Applies `isLoggedIn` to chat HTTP routes and maps list/create/detail/member/message/read operations. |
| [chat.controller.ts](../backend/controllers/chat.controller.ts#L18) | Joi validation, authenticated actor extraction, and `{ success, data }` response envelopes. |
| [chat.service.ts](../backend/services/chat.service.ts#L49) | Conversation authorization, creation, listing, member management, message persistence/history, unread-count query, and last-read update. |
| [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L33) | Raw `ws` upgrade authentication, event parsing/rate limiting, per-process room membership, authorization, persistence, and event broadcasts. |
| [chat-conversation.entity.ts](../backend/entities/chat-conversation.entity.ts#L1) | Conversation type, organization/project IDs, direct-pair key, activity timestamps, and member relation. |
| [chat-conversation-member.entity.ts](../backend/entities/chat-conversation-member.entity.ts#L1) | Conversation/user membership and per-member `lastReadAt`. |
| [chat-message.entity.ts](../backend/entities/chat-message.entity.ts#L1) | Message sender/content/timestamps and soft-delete/edit columns. |
| [AddChatTables migration](../backend/migrations/1792400000000-AddChatTables.ts#L1) | Creates conversation, member, and message tables and their basic keys/indexes. |
| [AddDirectChatConstraints migration](../backend/migrations/1792700000000-AddDirectChatConstraints.ts#L1) | Adds direct-pair uniqueness, `last_message_at`, `last_read_at`, and message edit/delete fields/index. |
| [data.source.ts](../backend/config/data.source.ts#L1) | Registers chat entities and migration discovery with TypeORM. |
| [server.ts](../backend/server.ts#L27) | Initializes PostgreSQL and attaches the chat WebSocket server to the HTTP server. |
| [auth-session.service.ts](../backend/services/auth-session.service.ts#L9), [is.loggedin.ts](../backend/middleware/is.loggedin.ts#L1) | Access-token creation/cookies and HTTP authentication. |

### End-to-end data flow

1. `App.tsx` renders `ChatView`; it loads conversations with `GET /api/chat/conversations`. The API helper sends the shared client's credentials and bearer token; the browser also has the backend's HttpOnly `token` cookie.
2. The backend router requires `isLoggedIn`. The controller validates inputs and derives the actor from `req.user`; the service scopes list and detail queries by organization, membership, and applicable project access.
3. Selecting a conversation causes `ChatView` to request the latest 50 messages and open `ws(s)://<API host>/ws/chat`.
4. On socket open, the frontend sends `conversation:join`. The backend verifies the access cookie/bearer token at upgrade, rechecks active-user status and conversation membership on events, adds the socket to an in-process room, and emits `conversation:joined`.
5. The frontend sends `message:send` over the socket. The backend checks membership and room join state, persists the message and updates `last_message_at` in a transaction, then broadcasts `message:new` to the room. A failed operation emits `chat:error`; there is no dedicated send acknowledgement.
6. Conversation unread counts are calculated from messages after the member's `last_read_at`, excluding the actor's messages. A protected PATCH route updates that timestamp, but the frontend never calls it.

### Implemented versus absent capabilities

- Implemented: direct conversation create/list/detail; backend group/project conversation types and member management; text message history/send; conversation-level last-read timestamp; authenticated raw WebSocket join/leave/send; basic rate limit; direct-pair uniqueness.
- Partially implemented: group/project chat is available in backend service/routes but not exposed by `ChatView`; the frontend has attachment selection/previews but no upload API; message-history cursor support exists in API/backend but is not used by the UI.
- Not found in the chat implementation: typing indicators, presence, chat-specific notifications, per-message read receipts, attachment persistence/download, message edit/delete APIs, conversation archive/delete UI, or Socket.IO event handling. The `socket.io` dependencies are not used by this chat path.

## C. Detailed findings

### Finding CHAT-001

**Finding ID:** CHAT-001

**Title:** Chat responses expose credential-related columns from related users.

**Severity:** High.

**Status:** Confirmed.

**Affected area:** Security / Backend / Integration.

**Affected files:** [chat.service.ts](../backend/services/chat.service.ts#L58) (`getConversationForActor`, `listConversations`, `getMessages`); [user.entity.ts](../backend/entities/user.entity.ts#L50) (`passwordHash`, `inviteTokenHash`, `inviteExpiresAt`); [chat.controller.ts](../backend/controllers/chat.controller.ts#L87) (`getConversationController`).

**Problem:** Chat responses load related `User` entities without a safe-field projection. The `User` entity's password and invite-token hashes are ordinary selected columns; they are not marked `select: false`. Chat controllers serialize these entities directly.

**Evidence:** `getConversationForActor` loads `{ members: { user: true } }`; `listConversations` uses `leftJoinAndSelect("member.user", "user")`; `getMessages` uses `leftJoinAndSelect("message.sender", "sender")`. `getConversationController` returns the result in `res.json({ success: true, data: ... })`. No chat response DTO removes `passwordHash` or invite fields.

**Steps to reproduce:** With a valid account that belongs to a conversation, call `GET /api/chat/conversations` and/or `GET /api/chat/conversations/:conversationId`, then inspect `data.members[*].user`. Call `GET /api/chat/conversations/:conversationId/messages` and inspect `data[*].sender`. These steps are source-derived; they were not run against a live database.

**Expected behavior:** Chat responses include only profile fields required by the UI (for example ID, full name, email, and perhaps role/avatar metadata), never credential, invitation, or unrelated account fields.

**Actual behavior:** TypeORM selects all mapped scalar columns for joined/related users unless configured otherwise, so credential-related fields can be serialized to every authorized conversation participant.

**Root cause:** Relation loading is used as the response model and the user entity does not hide sensitive columns from ordinary selects.

**Impact:** A participant can obtain other conversation members' password hashes and invitation-token hashes. Password hashes enable offline guessing; this violates confidentiality even though the caller is an authenticated conversation member.

**Recommended fix:** Return explicit chat response DTOs/projections with an allowlist of user fields. Consider `select: false` for sensitive entity columns as defense in depth, and add tests asserting sensitive keys never appear in list/detail/history responses.

**Fix location:** Backend / Shared response contract.

**Test recommendation:** Mock or integration-test each chat response and assert that nested users contain only approved keys; also verify the query never selects secret columns.

### Finding CHAT-002

**Finding ID:** CHAT-002

**Title:** Message drafts are cleared before conversation join or message acceptance is confirmed.

**Severity:** High.

**Status:** Confirmed (the race window is present in code; not manually exercised).

**Affected area:** Frontend / WebSocket / Integration.

**Affected files:** [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L301) (`selectedId` socket effect and `handleSendMessage`); [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L179) (join acknowledgement and send guard).

**Problem:** The frontend treats `WebSocket.OPEN` as proof that the selected conversation has been joined. It sends immediately after opening the connection, does not wait for `conversation:joined`, and clears the draft immediately after `socket.send`. The backend processes events asynchronously and rejects a send until that socket has joined the conversation.

**Evidence:** The frontend's `onopen` sends `conversation:join`, but the `onmessage` handler only handles `message:new` and `chat:error`; it ignores `conversation:joined`. `handleSendMessage` checks only `readyState === OPEN`, sends `message:send`, and calls `setDraft('')`. The gateway emits `conversation:joined` only after membership lookup/room insertion and emits `chat:error` if `socket.joined` does not yet contain the conversation. Errors are only displayed as toasts; the draft is not restored.

**Steps to reproduce:** Open or switch to a conversation, enter a message immediately as the socket opens, and submit before the asynchronous join authorization finishes. The source path allows the send to overtake join completion. This race was not exercised against a live server.

**Expected behavior:** Disable sending until the matching conversation join acknowledgement arrives; retain the draft until a success acknowledgement or confirmed `message:new` for the submitted message; surface failures with a retry path.

**Actual behavior:** A send can reach the backend before join completion, be rejected, and still have its draft cleared locally.

**Root cause:** Connection readiness and room-join readiness are treated as the same state, and the send protocol has no correlated success acknowledgement/idempotency key.

**Impact:** Users can lose a message draft during initial connection or conversation switching. Manual retries can also create duplicates because sends are not idempotent.

**Recommended fix:** Track per-conversation join state from `conversation:joined`; reject/disable submit until confirmed. Add a request/message ID and explicit send success/failure acknowledgement, and clear the draft only after success.

**Fix location:** Frontend and WebSocket/shared event contract.

**Test recommendation:** Add deterministic tests that delay join authorization and message persistence, assert the composer remains disabled/draft-preserved, and verify failed sends can be retried without duplication.

### Finding CHAT-003

**Finding ID:** CHAT-003

**Title:** Opening a conversation never marks it read.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Frontend / Integration.

**Affected files:** [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L301); [api.ts](../frontend/src/services/api.ts#L921); [chat.routes.ts](../backend/routes/chat.routes.ts#L28); [chat.service.ts](../backend/services/chat.service.ts#L303).

**Problem:** The backend has a protected mark-read endpoint and persists `last_read_at`, but no frontend API helper or call exists when a conversation is selected or opened.

**Evidence:** `ChatView` loads history and starts the socket on selection but does not call a read operation. The API service has helpers only for list/create/history. The backend exposes `PATCH /:conversationId/read`, whose service updates the authenticated member's `lastReadAt`.

**Steps to reproduce:** Have another participant send a message, open that conversation in the UI, and return to the conversation list. Source inspection confirms no mark-read request is issued; no live account was used to observe the badge.

**Expected behavior:** Opening/reading a conversation updates the authenticated user's read marker and promptly clears the corresponding unread badge.

**Actual behavior:** The database marker remains unchanged, so the list endpoint continues calculating those messages as unread.

**Root cause:** Backend capability was implemented without a frontend API call/state update.

**Impact:** Read conversations continue to appear unread after refresh and can accumulate misleading badges.

**Recommended fix:** Add a typed API helper, invoke it at the intended read boundary, and update the conversation's unread count only after successful response (with sensible handling for newly arriving messages).

**Fix location:** Frontend / Shared API integration.

**Test recommendation:** Verify opening a conversation sends the correct PATCH, unread count becomes zero, and messages arriving during the request are not accidentally cleared.

### Finding CHAT-004

**Finding ID:** CHAT-004

**Title:** Incoming messages update the thread but leave conversation previews and ordering stale.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Frontend / WebSocket.

**Affected files:** [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L316) (`socket.onmessage` and conversation-list rendering).

**Problem:** The `message:new` handler appends to `messages` only. It never updates `conversations`, the matching conversation's `lastMessage`, `lastMessageAt`/timestamp, `unreadCount`, or list order.

**Evidence:** The only state update for a received message is `setMessages(...)`. The sidebar renders `conv.lastMessage` and `conv.unreadCount` from the initially loaded conversation state. The list is not refetched or invalidated after a socket event.

**Steps to reproduce:** Keep the chat route open and receive a message in the active conversation or another listed conversation. The thread event handler updates only an active matching message list; sidebar values continue using the original API response. No browser session was used.

**Expected behavior:** A received message updates the corresponding preview, timestamp, ordering, and unread state; messages for a non-active thread increment unread state.

**Actual behavior:** The open thread can show the new message while the sidebar preview/order/badge stays stale until a later full reload or remount.

**Root cause:** Conversation-list state and message-thread state are separate local arrays with no shared update/reconciliation path.

**Impact:** Users may miss activity, see incorrect ordering, and rely on stale unread counts.

**Recommended fix:** Apply each accepted message to the matching conversation state and sort using the server activity timestamp; update unread state according to the active/read state or invalidate/refetch safely.

**Fix location:** Frontend.

**Test recommendation:** Simulate socket events for active and inactive conversations and assert preview, timestamp, sort order, and unread state.

### Finding CHAT-005

**Finding ID:** CHAT-005

**Title:** Chat sockets do not reconnect or recover messages after disconnect.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Frontend / WebSocket.

**Affected files:** [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L301).

**Problem:** The view creates a native WebSocket per selected conversation. It handles `open`, `message`, and `error`, but has no `close` handler, retry/reconnect loop, rejoin logic, or catch-up history request after a connection loss.

**Evidence:** The socket is created once in the selection effect and closed only by effect cleanup. No code re-creates it when it closes; the history request is run only when `selectedId` changes. Native browser WebSocket does not reconnect automatically.

**Steps to reproduce:** While a conversation is open, interrupt the network or stop the backend and restore it without changing the selected conversation. Source inspection shows no reconnect or history reconciliation path. Not manually tested.

**Expected behavior:** Reconnect with bounded backoff, reauthenticate, rejoin the active conversation after server confirmation, and fetch messages since the last known cursor.

**Actual behavior:** The current connection remains closed; live events stop. The current thread is not refetched unless the selection/view changes.

**Root cause:** Socket lifecycle is scoped to the selected-conversation effect but has no recovery state machine.

**Impact:** Users miss real-time updates during network instability; persisted messages may remain unseen until manual navigation or reload.

**Recommended fix:** Implement a managed reconnect lifecycle, restore the active join after acknowledgement, and reconcile history with a cursor before resuming live updates.

**Fix location:** Frontend / WebSocket integration.

**Test recommendation:** Add tests for disconnect/reconnect, rejoin ordering, and recovery of messages persisted during the outage.

### Finding CHAT-006

**Finding ID:** CHAT-006

**Title:** Project-chat membership can be created for users who cannot access that private project.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Backend / Authorization / Integration.

**Affected files:** [chat.service.ts](../backend/services/chat.service.ts#L49) (`canAccessConversation`), [chat.service.ts](../backend/services/chat.service.ts#L255) (`addMember`), [chat.service.ts](../backend/services/chat.service.ts#L65) (`createConversation`).

**Problem:** Adding or creating members for a project-linked conversation validates that users are active in the organization, but does not require each target to have access to the private project. Later conversation access checks do require project access for non-admin/non-manager users.

**Evidence:** `addMember` loads a target by user ID, organization ID, and active status, then inserts the membership. `canAccessConversation` separately rejects a project conversation when `hasProjectAccess` returns false. `createConversation` similarly validates organization status but not project membership for every requested member.

**Steps to reproduce:** As a user authorized to manage a private-project conversation, add an active teammate from the same organization who is not a project member. The member row can be inserted, while that teammate's subsequent list/detail/history/socket access is rejected by project-access checks. Not executed against a live database.

**Expected behavior:** Either reject targets without private-project access or perform the required project-membership change in a properly authorized operation.

**Actual behavior:** Conversation membership can exist while the target cannot access the conversation.

**Root cause:** Member creation's validation predicate is weaker than the access predicate used on reads and socket events.

**Impact:** Administrators/managers can create unusable memberships; invitees do not see the conversation, and membership state becomes inconsistent with application expectations.

**Recommended fix:** Apply the same project access policy to all requested members at create/add time, or explicitly coordinate a project-member grant and audit it. Add tests for private and public project cases.

**Fix location:** Backend.

**Test recommendation:** Verify a non-project member cannot be added silently to a private project conversation and that valid project members can be added.

### Finding CHAT-007

**Finding ID:** CHAT-007

**Title:** The UI cannot load messages older than the first 50.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Frontend / API integration.

**Affected files:** [api.ts](../frontend/src/services/api.ts#L940) (`getChatMessagesApi`); [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L305); [chat.service.ts](../backend/services/chat.service.ts#L280).

**Problem:** The backend and API helper support a `before` cursor and bounded history pages, but `ChatView` makes one request with the default limit and has no load-older control, scroll pagination, or subsequent cursor request.

**Evidence:** `getChatMessagesApi` defaults to 50 and accepts `before`; the backend returns a bounded page. The only invocation in `ChatView` is `getChatMessagesApi(selectedId)` and messages are rendered from that one result.

**Steps to reproduce:** Open a conversation with more than 50 messages and attempt to reach the oldest message. The UI has no operation to request the previous page. This was not exercised with live data.

**Expected behavior:** Older messages remain accessible through pagination or an equivalent history-loading behavior.

**Actual behavior:** Only the latest page is loaded; messages older than that page cannot be reached in the UI.

**Root cause:** Cursor support exists in the transport/backend but is not integrated into view state or scroll behavior.

**Impact:** Users cannot review full conversation history in long-running chats.

**Recommended fix:** Track the oldest loaded cursor and `hasMore`, request earlier pages on demand, and preserve scroll position while prepending results.

**Fix location:** Frontend.

**Test recommendation:** Use a fixture with more than 50 messages and verify every page can be reached without duplicates or gaps.

### Finding CHAT-008

**Finding ID:** CHAT-008

**Title:** Existing WebSocket sessions are not revalidated when the access token expires or is revoked.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Security / WebSocket.

**Affected files:** [auth-session.service.ts](../backend/services/auth-session.service.ts#L9) (15-minute token lifetime); [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L33) (`authenticateUpgrade`); [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L55) (`isActiveActor`).

**Problem:** The access token is verified only during the WebSocket upgrade. For later events, `isActiveActor` checks that the user row is still active, but does not reverify token expiry or session/revocation state.

**Evidence:** Access tokens have `expiresIn: "15m"`. `authenticateUpgrade` calls `jwt.verify` at connection time. Subsequent event handling calls `isActiveActor`, which selects only user ID and status.

**Steps to reproduce:** Establish a socket with a valid token, leave it open past the token's expiry (or revoke/clear credentials from another tab), then send a chat event. The source event path does not check the token again. This was not run against a live server.

**Expected behavior:** Expired/revoked authentication should terminate or reauthenticate the socket before accepting further operations.

**Actual behavior:** If the user remains `ACTIVE`, the established socket continues passing the per-event user-status check.

**Root cause:** The socket retains a `ChatActor` derived at handshake, with no expiry timer, token/session identifier, or per-event revalidation.

**Impact:** A still-open connection can continue sending/receiving chat after the access token's intended lifetime or logout/revocation in another client context.

**Recommended fix:** Bind socket lifetime to token expiry/session state, close on expiry/revocation, and ensure logout/session revocation invalidates relevant live sockets.

**Fix location:** Backend / Authentication-WebSocket contract.

**Test recommendation:** Test post-expiry sends and logout/revocation across multiple tabs; assert the server closes or rejects the connection.

### Finding CHAT-009

**Finding ID:** CHAT-009

**Title:** Attachment controls accept local files but no attachment is uploaded or persisted.

**Severity:** Medium.

**Status:** Confirmed.

**Affected area:** Frontend / Backend / Integration.

**Affected files:** [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L432) (file/media selection), [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L381) (send/clear behavior), [chat.routes.ts](../backend/routes/chat.routes.ts#L18) (available routes), [chat-message.entity.ts](../backend/entities/chat-message.entity.ts#L1).

**Problem:** The UI exposes file/media selection and preview, but there is no chat upload route, attachment entity, persistence, or download flow. Sending a text message while an attachment is queued sends only the text, displays a notice, revokes the preview URL, and clears the queued file.

**Evidence:** The UI itself states that the attachment “was not sent” because upload integration is pending. Chat routes contain no upload/download endpoint and the chat message schema has only content and timestamps, with no attachment relation.

**Steps to reproduce:** Select a file or media item, type text, and send. The source path sends only the text message and clears the selected attachment. No live upload was attempted.

**Expected behavior:** Either upload and persist the attachment and associate it with the message, or disable attachment controls until that capability exists.

**Actual behavior:** The file remains local only and is discarded on send; no recipient can access it.

**Root cause:** The UI controls were added without a corresponding chat file API/storage contract.

**Impact:** Users may believe a file was attached; the toast is explicit, but the selected file is still cleared and must be reselected.

**Recommended fix:** Implement validated, authorized upload/storage/download and message metadata end to end, or remove/disable the controls until implemented. Do not silently clear an attachment without a clear retry path.

**Fix location:** Shared API contract / Backend / Frontend.

**Test recommendation:** Verify upload restrictions, persistence, authorized download, preview, failure retention, and attachment-aware conversation preview.

### Finding CHAT-010

**Finding ID:** CHAT-010

**Title:** The frontend ignores the server's `conversation:removed` event.

**Severity:** Low.

**Status:** Confirmed.

**Affected area:** Frontend / WebSocket.

**Affected files:** [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L79) (`evictUserFromConversationRoom`); [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L316) (`socket.onmessage`).

**Problem:** The backend removes sockets from a room and emits `conversation:removed`, but the frontend's message handler has no branch for that event.

**Evidence:** The gateway sends `conversation:removed` when a manager removes a member. The client handles only `message:new` and `chat:error`.

**Steps to reproduce:** Keep the conversation open in one client and remove that user from a group/project conversation from another authorized client. This workflow was not manually run.

**Expected behavior:** The removed user's UI should clear the active conversation/history, remove the conversation from its list, close or leave the socket, and display an access-removed message.

**Actual behavior:** The event is ignored, so the removed user continues to see the previously loaded conversation and messages in local UI state. Backend APIs and subsequent event authorization still reject fresh access.

**Root cause:** The backend event is not part of the frontend's event handling contract.

**Impact:** Stale private content remains visible on screen after membership removal; it is not a new server-side read, but the client fails to reflect revoked access.

**Recommended fix:** Add a typed handler for `conversation:removed` that clears local sensitive state and updates the list.

**Fix location:** Frontend / Shared event contract.

**Test recommendation:** Add a socket/UI test that emits the event and asserts the active thread and list entry are cleared.

### Finding CHAT-011

**Finding ID:** CHAT-011

**Title:** Group and project conversations are backend-only; the UI creates direct chats only.

**Severity:** Low.

**Status:** Confirmed.

**Affected area:** Frontend / Integration.

**Affected files:** [ChatView.tsx](../frontend/src/features/chat/ChatView.tsx#L359) (`createConversation`); [chat.controller.ts](../backend/controllers/chat.controller.ts#L18) (accepted conversation types); [chat.service.ts](../backend/services/chat.service.ts#L65) (backend creation and membership support).

**Problem:** The backend accepts `DIRECT`, `GROUP`, and `PROJECT` and provides add/remove member routes, while the visible creation form always sends `type: 'DIRECT'` with one selected teammate. There is no group member selection or group-management UI.

**Evidence:** The frontend creation payload is hard-coded to `DIRECT`; no frontend helper/call exists for add/remove member operations. Backend schemas/services/routes support the other types.

**Steps to reproduce:** Use the Chat UI and start a conversation. The form only permits selecting one teammate and submits a direct conversation. Group/project creation is not exposed.

**Expected behavior:** If group/project chat is a supported product feature, users should be able to create and manage it; otherwise those backend capabilities should be documented as API-only.

**Actual behavior:** Group/project operations are available only to API callers; the view's participant resolver has limited group handling but there is no corresponding creation/member-management UX.

**Root cause:** Backend support and frontend scope are incomplete/misaligned.

**Impact:** Users cannot use backend-supported group/project chat capabilities through the application.

**Recommended fix:** Confirm product scope; implement group/project creation/member management or explicitly mark these types unsupported in the UI/API contract.

**Fix location:** Frontend / Shared API contract.

**Test recommendation:** Add UI journeys for group creation, membership changes, and project access boundaries if the feature is in scope.

### Finding CHAT-012

**Finding ID:** CHAT-012

**Title:** A concurrent member removal can race with room join and leave a removed socket subscribed.

**Severity:** Medium.

**Status:** Potential (race is evident in code; not reproduced).

**Affected area:** Security / WebSocket.

**Affected files:** [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L170) (asynchronous access check and room insertion); [chat.gateway.ts](../backend/websocket/chat.gateway.ts#L79) (room eviction); [chat.service.ts](../backend/services/chat.service.ts#L270) (membership deletion/eviction).

**Problem:** Join authorization is asynchronous and room insertion occurs after the check. Member removal deletes the row and evicts only sockets already present in the room. If removal/eviction completes after the join access check but before the join inserts the socket, eviction sees no socket; the pending join can then add the removed user to the room.

**Evidence:** The event callback awaits `canAccessConversation`, then separately updates `socket.joined` and `rooms`. `removeMember` deletes the membership and calls the evictor; the gateway broadcasts `message:new` to room members without rechecking each recipient. These operations are not serialized or protected by a shared lock/transaction.

**Steps to reproduce:** Requires controlled concurrency: pause a join after its membership query succeeds, remove that user and complete room eviction, then resume the join and send a message from another participant. This was not attempted against a running server.

**Expected behavior:** Once removal commits, no later room insertion or broadcast can include the removed user.

**Actual behavior:** The interleaving above can leave the socket in the room after eviction and expose subsequent message broadcasts until another cleanup.

**Root cause:** Authorization check and room mutation are not atomic with the membership-removal/eviction operation; broadcast recipients are trusted from the in-memory set.

**Impact:** A recently removed user could receive new private conversation messages over WebSocket despite API/send authorization denying further access.

**Recommended fix:** Serialize room membership changes with removal or revalidate membership immediately before room insertion/broadcast; make eviction robust to in-flight joins and add a race regression test.

**Fix location:** Backend / WebSocket.

**Test recommendation:** Use a barrier-controlled test around access lookup, removal, and join completion; assert removed sockets receive no later broadcasts.

## D. API contract mismatch report

The three HTTP operations currently used by the frontend have matching mounted paths and response envelopes. The principal contract defects are missing frontend integration and weak `any` response typing, not wrong URLs or methods.

| Operation | Frontend API/service | Backend route/controller | Contract matches? | Finding |
|---|---|---|---|---|
| Get conversations | `GET /api/chat/conversations`; `getChatConversationsApi()` | `GET /` on router mounted at `/api/chat/conversations`; `listConversationsController` returns `{ success: true, data: [...] }` | Yes | Uses `any`; payload is not compile-time validated. Backend scopes by organization and member. |
| Get conversation details | No frontend call | `GET /:conversationId` → `getConversationController` | Not integrated | Backend returns nested members; CHAT-001 applies. |
| Get messages | `GET /api/chat/conversations/:id/messages?limit=50[&before=...]`; `getChatMessagesApi()` | `GET /:conversationId/messages` → `getMessagesController` | Yes | Response is `{ success: true, data: [...] }`; frontend uses only first page (CHAT-007). |
| Send message | Raw WebSocket `message:send` with `{ conversationId, content }` | `message:send` event in `chat.gateway.ts`; HTTP `POST /:conversationId/messages` also exists but is unused | Payload fields match | No send acknowledgement; join race can lose draft (CHAT-002). |
| Mark as read | No frontend helper or call | `PATCH /:conversationId/read` → `markReadController` | Not integrated | CHAT-003. |
| Create direct conversation | `POST /api/chat/conversations` with `{ organizationId, type: 'DIRECT', memberIds: [id] }` | `POST /` on `/api/chat/conversations`; Joi create schema and `createConversationController` | Yes | Backend verifies actor organization and active same-organization members; duplicate direct pairs are handled with a unique index. Response relation projection has CHAT-001. |
| List members | Uses `allUsers` from `AppContext`; no chat API helper | `GET /members` → `listMembersController` | Not integrated | Frontend source is the general user context, not the chat-specific member endpoint. |
| Add/remove member | No frontend call | `POST /:conversationId/members`; `DELETE /:conversationId/members/:userId` | Not integrated | Project membership mismatch is CHAT-006; group management UI is CHAT-011. |
| Upload/download attachment | Local `File` selection only | No chat upload/download route found | No | CHAT-009. |

Backend validation failures use `{ success: false, code: "VALIDATION_ERROR", message, errors }`; general errors use `{ success: false, code, message }`. The shared HTTP client parses `message`/`code`, so error-envelope handling is broadly compatible. No API request was executed against a live server.

## E. WebSocket event report

Chat uses a native browser `WebSocket` client and the backend `ws` package. There is no Socket.IO chat namespace/room adapter.

| Event | Emitted by | Received by | Purpose | Acknowledgement | Status |
|---|---|---|---|---|---|
| `conversation:join` | Frontend | Backend | Request membership in a conversation room | Backend emits `conversation:joined` | Authorization exists; frontend does not wait for the acknowledgement (CHAT-002). |
| `conversation:joined` | Backend | Frontend | Confirm access check and room insertion | This is the join acknowledgement | Implemented by backend; ignored by frontend. |
| `conversation:leave` | Frontend cleanup | Backend | Leave room on selection change/unmount | None | Backend handles it; frontend sends only when socket is open. |
| `message:send` | Frontend | Backend | Validate, persist, and publish text | No dedicated acknowledgement; success is visible only as room `message:new` | Backend persistence precedes broadcast, but sender can clear draft before acceptance (CHAT-002). |
| `message:new` | Backend | All sockets in in-process conversation room | Deliver persisted message fields (`id`, `conversationId`, `senderId`, `content`, `createdAt`) | Acts as an implicit success signal for joined clients | Frontend deduplicates by ID and appends to active thread, but does not update sidebar/unread state (CHAT-004). |
| `chat:error` | Backend | Requesting socket | Generic validation/access/processing error | Error event only; no request ID | Frontend shows a toast but does not restore a cleared draft. |
| `conversation:removed` | Backend | Removed user's sockets | Notify and evict removed member | None | Backend emits; frontend ignores (CHAT-010). |

No chat events for typing, presence, read receipts, or notification delivery were found. The gateway applies a limit of 30 incoming events per socket per 10-second window and a 64 KiB WebSocket payload limit. Room state is held in a process-local `Map`; there is no distributed adapter/pub/sub. Real-time delivery across multiple backend replicas is therefore deployment-dependent and was not verified. The in-flight join/removal race is CHAT-012.

## F. Database report

- The three chat entities are registered in TypeORM. The `AddChatTables` migration creates conversation, member, and message tables with foreign keys and base indexes. The follow-up migration adds `direct_pair_key`, `last_message_at`, member `last_read_at`, message `edited_at`/`deleted_at`, a partial unique direct-conversation index, and a message-history index.
- Direct conversations are normalized by sorted participant IDs and protected by a database unique index on organization/pair key. Service code handles a concurrent unique violation by retrieving the existing conversation.
- Message writes and activity timestamp updates occur in one TypeORM transaction. History excludes soft-deleted messages, sorts descending by timestamp and ID, then reverses the page for display.
- Unread counts are calculated per conversation from non-deleted messages authored by someone else with `created_at > member.last_read_at` (or no read timestamp). The member's last-read marker is not a per-message receipt; there is no read-receipt entity/table.
- No chat attachment table/relation exists. No archive/deleted-conversation mechanism is exposed; message entity soft-delete columns have no matching chat delete endpoint/UI.
- The list query uses a conversation/member/user join plus separate latest-message and unread-count queries; it does not appear to issue per-conversation N+1 lookups. Message history has conversation/timestamp indexes. The activity-ordering query has no dedicated `last_message_at` index in the chat migrations, which could become a scale concern, but no production query plan was available to measure it.
- The user relation selection creates the credential-column exposure in CHAT-001. Member creation can produce project memberships that fail later project access checks (CHAT-006).
- Entity/migration structure is consistent for the inspected chat columns. No migration was executed and no live schema was inspected; deployed schema parity remains unverified.

## G. Security report

1. **High, confirmed — CHAT-001:** Related user entities can return password/invitation hashes to conversation participants.
2. **Medium, confirmed — CHAT-008:** An established WebSocket remains authorized after the 15-minute access token expires or a session is revoked elsewhere, as long as the account remains active.
3. **Medium, potential — CHAT-012:** A member-removal race can leave a removed socket in a room and expose subsequent broadcasts.

Positive controls observed: all HTTP chat routes use `isLoggedIn`; actor identity is derived from the verified request user, not a client-supplied sender ID; WebSocket upgrade verifies an HS256 access token from bearer auth or the `token` cookie; browser origins are checked against configured origins; conversation reads/sends are scoped to organization and membership; message content is trimmed and limited to 4,000 characters; rendered message content is React text rather than HTML; and WebSocket event rate/payload limits are present.

These controls do not address credential-field serialization, expired-socket lifetime, or the in-flight room-membership race above. Attachment authorization/storage could not be assessed because chat attachments are not implemented.

## H. Test results

Commands were run from the respective package directories.

| Command | Scope | Passed | Failed | Skipped | Result / limitation |
|---|---|---:|---:|---:|---|
| `pnpm test` (backend) | All backend Node tests | 69 | 0 | 0 | Passed. Chat-list tests inspect TypeORM query behavior with test doubles/metadata; no live PostgreSQL chat integration was run. |
| `pnpm test` (frontend) | All frontend Node/tsx tests | 323 | 6 | 0 | Failed. Three failures are assertions that root `BACKEND_TEAM_HANDOFF.md` exists (including one chat attachment assertion); three are unrelated list-view layout/date assertions in `targeted_ui_fixes.test.ts`. |
| `node --require ts-node/register --test tests/chat-list-conversations.test.ts` (backend) | Focused chat list query tests | 2 | 0 | 0 | Passed. These tests do not exercise live HTTP, database, or WebSocket behavior. |
| `pnpm exec tsx --test tests/chat_and_sidebar_refinement.test.ts` (frontend) | Focused Chat UI static tests | 22 | 1 | 0 | Failed only because `BACKEND_TEAM_HANDOFF.md` is absent; the other assertions passed. |
| `pnpm typecheck` (backend) | Backend TypeScript, no emit | — | — | — | Passed (exit code 0). |
| `pnpm typecheck` (frontend) | Frontend TypeScript, no emit | — | — | — | Passed (exit code 0). |
| `pnpm lint` (frontend) | Frontend Oxlint | — | — | — | Passed with 126 warning occurrences. `ChatView.tsx` has a `set-state-in-effect` warning at line 304. |
| Backend lint | Backend | — | — | — | No backend lint script is defined in `backend/package.json`. |
| Build | Frontend/backend | — | — | — | Not run; normal build scripts emit/overwrite `dist` artifacts, which were out of scope under the audit-only create-file constraint. Typechecks passed but are not a build result. |
| Browser journeys / live API / live database | Runtime behavior | — | — | — | Not run. No isolated test database or browser test harness was used; no existing or production data was changed. |

The full frontend suite's three chat-related documentation assertions fail because `BACKEND_TEAM_HANDOFF.md` is absent. This includes the attachment-specific assertion at `frontend/tests/chat_and_sidebar_refinement.test.ts:239`; the other three failures concern unrelated list-view UI assertions.

## I. Recommended fix priority

1. **Critical:** None confirmed at this severity.
2. **High:**
   - **CHAT-001:** Remove sensitive user columns from chat responses — backend/shared response DTO.
   - **CHAT-002:** Gate sends on join acknowledgement and preserve drafts until confirmed — frontend/WebSocket contract.
3. **Medium:**
   - **CHAT-003:** Wire mark-read request and unread-state update — frontend/API integration.
   - **CHAT-004:** Reconcile conversation list from incoming events — frontend.
   - **CHAT-005:** Reconnect and catch up messages — frontend/WebSocket.
   - **CHAT-006:** Align project-member creation with project-access rules — backend authorization.
   - **CHAT-007:** Implement older-history pagination — frontend.
   - **CHAT-008:** Enforce token/session expiry for live sockets — backend authentication.
   - **CHAT-009:** Implement or disable attachment controls — shared API/backend/frontend.
   - **CHAT-012 (potential):** Make room removal and join atomic/revalidated — backend WebSocket.
4. **Low:**
   - **CHAT-010:** Handle `conversation:removed` in the UI — frontend/shared event contract.
   - **CHAT-011:** Implement group/project chat UI or document those capabilities as API-only — frontend/product contract.

Before production release, prioritize CHAT-001 and CHAT-002, then address socket authorization lifetime and removal races, unread correctness, and reconnect/sidebar recovery. Attachment and group support should be explicitly scoped rather than implied by visible controls/backend types.

## J. Final conclusion

1. **Is Chat working correctly end to end?** No. Basic direct text conversations are implemented, but draft loss is possible during initial join, unread state is not cleared by the UI, and real-time/sidebar recovery is incomplete.
2. **Where are the major problems?** Primarily frontend/backend integration, plus a backend response-data exposure and WebSocket authorization-lifecycle gap.
3. **Are frontend/backend API contracts consistent?** The HTTP paths and success envelopes used for listing, direct creation, and history match. Read/member/detail/upload operations are absent from frontend integration; chat helpers also return `any`. The WebSocket event names mostly align, but the client ignores server join/removal events.
4. **Is WebSocket communication reliable?** Not sufficiently. Persistence occurs before broadcast and room membership is checked, but there is no explicit send acknowledgement, reconnect/catch-up, or sidebar synchronization; a join/send race can drop a draft.
5. **Can messages be lost, duplicated, or delivered to unauthorized users?** A send rejected before room join can be lost from the user's composer. No automatic retry exists, and manual retries have no idempotency key. A potential join/removal race can deliver future broadcasts to a removed socket. No live runtime reproduction was performed.
6. **Are unread counts/read receipts reliable?** Backend unread calculation and conversation-level `last_read_at` are present, but the frontend never calls mark-read and does not update unread state from socket events. There are no per-message receipts.
7. **Most urgent issues?** Sensitive user-column exposure (CHAT-001) and send-before-join draft loss (CHAT-002).
8. **What must be fixed before production?** Safe response projections, acknowledged join/send handling, socket expiry/revocation, and room-removal race protection; then unread/read integration and reconnect/event reconciliation.
9. **Which issues can be fixed on the frontend without backend changes?** Mark-read wiring to the existing endpoint, sidebar synchronization, history pagination using existing cursor support, reconnect/catch-up, removal-event handling, and disabling attachment controls until the API exists.
10. **Which genuinely require backend changes?** Safe response projections, WebSocket token/session revalidation, room-removal race protection, project membership validation, and attachment persistence/API if attachments remain in scope. CHAT-002 benefits from a shared send acknowledgement/idempotency contract, not just a UI adjustment.

## Audit-only worktree note

The repository already had a modified `frontend/src/services/api.ts` and an untracked `frontend/docs/NOTIFICATION_FEATURE.md` before the report was created. Those pre-existing changes were left untouched. No application source or configuration file was modified during this audit.
