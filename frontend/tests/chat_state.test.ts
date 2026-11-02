import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { ChatConversation, ChatMessage } from '../src/services/api';
import {
  canSendChatMessage,
  clearConversationUnread,
  matchesPendingChatMessage,
  mergeChatMessages,
  shouldClearSubmittedDraft,
  updateConversationFromMessage,
} from '../src/features/chat/chatState';

function conversation(
  id: string,
  timestamp: string,
  unreadCount = 0,
): ChatConversation {
  return {
    id,
    type: 'DIRECT',
    updatedAt: timestamp,
    members: [],
    lastMessage: {
      id: `${id}-last`,
      content: `Latest in ${id}`,
      createdAt: timestamp,
      senderId: 'other-user',
    },
    unreadCount,
  };
}

function message(
  id: string,
  conversationId: string,
  senderId: string,
  content: string,
  createdAt: string,
): ChatMessage {
  return { id, conversationId, senderId, content, createdAt };
}

describe('chat state synchronization', () => {
  test('allows sending only after the selected conversation is confirmed ready', () => {
    assert.equal(canSendChatMessage('connecting', 'one', false, false), false);
    assert.equal(canSendChatMessage('joining', 'one', false, false), false);
    assert.equal(canSendChatMessage('ready', undefined, false, false), false);
    assert.equal(canSendChatMessage('ready', 'one', true, false), false);
    assert.equal(canSendChatMessage('ready', 'one', false, true), false);
    assert.equal(canSendChatMessage('ready', 'one', false, false), true);
  });

  test('requires a ready chat socket to send text messages', () => {
    assert.equal(canSendChatMessage('disconnected', 'one', true, false), false);
    assert.equal(canSendChatMessage('connecting', 'one', false, false), false);
    assert.equal(canSendChatMessage('ready', 'one', false, false), true);
  });

  test('confirms only the matching sender, conversation, and content and preserves edited drafts', () => {
    const pending = { conversationId: 'one', content: 'hello', draft: 'hello' };
    const confirmation = message(
      'confirmed',
      'one',
      'current-user',
      'hello',
      '2026-10-30T12:00:00.000Z',
    );

    assert.equal(matchesPendingChatMessage(pending, confirmation, 'current-user'), true);
    assert.equal(matchesPendingChatMessage(pending, confirmation, 'other-user'), false);
    assert.equal(
      matchesPendingChatMessage(pending, { ...confirmation, conversationId: 'two' }, 'current-user'),
      false,
    );
    assert.equal(
      matchesPendingChatMessage(
        { ...pending, clientMessageId: 'client-message-1' },
        { ...confirmation, clientMessageId: 'client-message-2' },
        'current-user',
      ),
      false,
    );
    assert.equal(shouldClearSubmittedDraft('hello', pending.draft), true);
    assert.equal(shouldClearSubmittedDraft('new text', pending.draft), false);
  });

  test('clears only the conversation confirmed by the mark-read request', () => {
    const updated = clearConversationUnread(
      [conversation('one', '2026-10-30T10:00:00.000Z', 4), conversation('two', '2026-10-30T11:00:00.000Z', 2)],
      'one',
    );

    assert.equal(updated[0].unreadCount, 0);
    assert.equal(updated[1].unreadCount, 2);
  });

  test('updates one conversation preview and orders it by the server message timestamp', () => {
    const conversations = [
      conversation('older', '2026-10-30T10:00:00.000Z'),
      conversation('target', '2026-10-30T11:00:00.000Z'),
      conversation('newer', '2026-10-30T12:00:00.000Z'),
    ];
    const received = message(
      'message-1',
      'target',
      'other-user',
      'Live preview',
      '2026-10-30T13:00:00.000Z',
    );

    const updated = updateConversationFromMessage(conversations, received, 'current-user');

    assert.deepEqual(updated.map((item) => item.id), ['target', 'newer', 'older']);
    assert.deepEqual(updated[0].lastMessage, {
      id: 'message-1',
      content: 'Live preview',
      createdAt: '2026-10-30T13:00:00.000Z',
      senderId: 'other-user',
    });
    assert.equal(updated[0].unreadCount, 1);
    assert.equal(updated.length, conversations.length);
  });

  test('does not increase unread counts for the current user or replace a newer preview', () => {
    const current = [conversation('target', '2026-10-30T13:00:00.000Z', 2)];
    const ownMessage = message(
      'own-message',
      'target',
      'current-user',
      'Sent by me',
      '2026-10-30T14:00:00.000Z',
    );
    const staleMessage = message(
      'stale-message',
      'target',
      'other-user',
      'Delayed event',
      '2026-10-30T12:30:00.000Z',
    );

    const afterOwn = updateConversationFromMessage(current, ownMessage, 'current-user');
    assert.equal(afterOwn[0].unreadCount, 2);
    assert.equal(afterOwn[0].lastMessage?.id, 'own-message');

    const afterStale = updateConversationFromMessage(afterOwn, staleMessage, 'current-user');
    assert.equal(afterStale[0].unreadCount, 3);
    assert.equal(afterStale[0].lastMessage?.id, 'own-message');
  });

  test('merges fetched and live messages without duplicating IDs', () => {
    const initial = [
      message('one', 'target', 'other-user', 'First', '2026-10-30T10:00:00.000Z'),
      message('two', 'target', 'other-user', 'Second', '2026-10-30T11:00:00.000Z'),
    ];
    const merged = mergeChatMessages(initial, [
      message('two', 'target', 'other-user', 'Second', '2026-10-30T11:00:00.000Z'),
      message('three', 'target', 'current-user', 'Third', '2026-10-30T12:00:00.000Z'),
    ]);

    assert.deepEqual(merged.map((item) => item.id), ['one', 'two', 'three']);
  });

  test('orders equal-timestamp messages consistently across paginated history', () => {
    const sameTimestamp = '2026-10-30T12:00:00.000Z';
    const latestPage = [
      message('00000000-0000-0000-0000-000000000003', 'target', 'other-user', 'Third', sameTimestamp),
      message('00000000-0000-0000-0000-000000000004', 'target', 'other-user', 'Fourth', sameTimestamp),
    ];
    const olderPage = [
      message('00000000-0000-0000-0000-000000000001', 'target', 'other-user', 'First', sameTimestamp),
      message('00000000-0000-0000-0000-000000000002', 'target', 'other-user', 'Second', sameTimestamp),
    ];

    assert.deepEqual(
      mergeChatMessages(latestPage, olderPage).map((item) => item.id),
      [
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000004',
      ],
    );
  });
});
