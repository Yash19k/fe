# Chat backend requirement

## Issue

Issue 3, sending a message while preserving the draft until that exact send is accepted, needs a correlated server acknowledgement. The other reported fixes use existing backend capabilities and do not require backend changes.

## Current behavior

- `PATCH /api/chat/conversations/:conversationId/read` is authenticated by the chat router, checks conversation access, updates the current member's `lastReadAt`, and returns HTTP 204.
- The WebSocket gateway accepts `conversation:join` and confirms it with `conversation:joined`, including the `conversationId`.
- A successful `message:send` is persisted and broadcast as `message:new`. The payload includes the server message ID, conversation ID, sender ID, content, and server timestamp.
- Invalid or failed WebSocket operations emit `chat:error` with a message, but no conversation or request identifier.
- `message:send` has no client-generated message/request identifier, and the sender receives no acknowledgement uniquely tied to the submitted send.

## Missing capability

The frontend cannot reliably distinguish confirmation of its pending send from another message with the same sender, conversation, and content. It also cannot reliably associate a generic `chat:error` with a particular send or join request.

## Affected backend files

- `backend/websocket/chat.gateway.ts`
  - `ClientEvent` currently has no client message ID.
  - The `message:send` handler broadcasts `message:new` without a client correlation ID.
  - `sendError` emits only a message string.

## Proposed contract

Have the client include a unique `clientMessageId` in each `message:send` event:

```json
{
  "event": "message:send",
  "conversationId": "conversation-uuid",
  "clientMessageId": "client-generated-uuid",
  "content": "Message text"
}
```

On success, return an acknowledgement to the sending socket containing the same conversation and client IDs plus the persisted message:

```json
{
  "event": "message:accepted",
  "conversationId": "conversation-uuid",
  "clientMessageId": "client-generated-uuid",
  "data": {
    "id": "server-message-uuid",
    "conversationId": "conversation-uuid",
    "senderId": "sender-uuid",
    "content": "Message text",
    "createdAt": "2026-10-30T10:00:00.000Z"
  }
}
```

Include `conversationId` and `clientMessageId` in send-related error responses. Reusing the client ID for a retry should be idempotent, or the server should explicitly reject duplicate IDs without creating a second message.

## Reason

The current frontend can wait for the sender's `message:new` echo, but the payload has no identifier linking that echo to a specific submission. Matching by message text is ambiguous across browser tabs and repeated identical messages. The generic error also cannot distinguish a failed send from another operation on the same connection.

## Frontend workaround

The frontend allows only one pending send at a time, waits for the server's own `message:new` echo, and matches it by current sender, conversation, and content. A timeout or disconnect unlocks sending but preserves the draft and never automatically resends it.

This prevents common draft loss and duplicate-click cases, but a separate session sending identical text can be mistaken for the pending message; an uncertain result may also leave a draft that was actually persisted. A correlated acknowledgement and idempotency support are required to remove those limitations.

## Future backend action

Add client-message correlation to the WebSocket send contract, acknowledge accepted messages to the originating socket, correlate send errors, and define idempotent retry behavior. The frontend can then clear or retry only the exact submission whose outcome the server confirmed.
