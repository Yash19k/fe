import type { ChatConversation, ChatMessage } from '../../services/api';

export type ChatConnectionStatus = 'disconnected' | 'connecting' | 'joining' | 'ready' | 'error';

export function canSendChatMessage(
  status: ChatConnectionStatus,
  conversationId: string | undefined,
  joinRequestPending: boolean,
  isSending: boolean,
): boolean {
  return Boolean(
    conversationId &&
      status === 'ready' &&
      !joinRequestPending &&
      !isSending,
  );
}

export function matchesPendingChatMessage(
  pending: { conversationId: string; content: string },
  message: ChatMessage,
  currentUserId?: string,
): boolean {
  return Boolean(
    currentUserId &&
      pending.conversationId === message.conversationId &&
      pending.content === message.content &&
      currentUserId === message.senderId,
  );
}

export function shouldClearSubmittedDraft(
  currentDraft: string,
  submittedDraft: string,
): boolean {
  return currentDraft === submittedDraft;
}

function activityTimestamp(conversation: ChatConversation): number {
  const timestamp =
    conversation.lastMessage?.createdAt || conversation.updatedAt || conversation.createdAt;
  const parsed = timestamp ? Date.parse(timestamp) : Number.NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function updateConversationFromMessage(
  conversations: ChatConversation[],
  message: ChatMessage,
  currentUserId?: string,
): ChatConversation[] {
  const index = conversations.findIndex((conversation) => conversation.id === message.conversationId);
  if (index < 0) return conversations;

  const updated = [...conversations];
  const conversation = conversations[index];
  const messageTimestamp = Date.parse(message.createdAt);
  const previousTimestamp = conversation.lastMessage
    ? Date.parse(conversation.lastMessage.createdAt)
    : Number.NEGATIVE_INFINITY;
  updated[index] = {
    ...conversation,
    lastMessage:
      Number.isNaN(messageTimestamp) || messageTimestamp < previousTimestamp
        ? conversation.lastMessage
        : {
            id: message.id,
            content: message.content,
            createdAt: message.createdAt,
            senderId: message.senderId,
          },
    unreadCount:
      message.senderId === currentUserId
        ? conversation.unreadCount
        : (conversation.unreadCount ?? 0) + 1,
  };

  return updated
    .map((item, currentIndex) => ({ item, currentIndex }))
    .sort((left, right) => {
      const timeDifference = activityTimestamp(right.item) - activityTimestamp(left.item);
      return timeDifference || left.currentIndex - right.currentIndex;
    })
    .map(({ item }) => item);
}

export function mergeChatMessages(
  current: ChatMessage[],
  incoming: ChatMessage[],
): ChatMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((left, right) => {
    const timeDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return Number.isNaN(timeDifference) || timeDifference === 0 ? 0 : timeDifference;
  });
}

export function clearConversationUnread(
  conversations: ChatConversation[],
  conversationId: string,
): ChatConversation[] {
  return conversations.map((conversation) =>
    conversation.id === conversationId
      ? { ...conversation, unreadCount: 0 }
      : conversation,
  );
}
