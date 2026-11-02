import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markChatConversationReadApi } from '../src/services/api';

test('marking a chat conversation read uses PATCH and accepts the backend 204 response', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestMethod = '';
  let credentials: RequestCredentials | undefined;

  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestMethod = init?.method || '';
    credentials = init?.credentials;
    return new Response(null, { status: 204 });
  };

  try {
    await markChatConversationReadApi('conversation-123');
    assert.equal(new URL(requestUrl).pathname, '/api/chat/conversations/conversation-123/read');
    assert.equal(requestMethod, 'PATCH');
    assert.equal(credentials, 'include');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
