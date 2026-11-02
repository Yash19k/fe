import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  MessageCircle,
  Plus,
  Send,
  Users,
  ChevronLeft,
  Search,
  X,
  Smile,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import {
  API_BASE_URL,
  ChatConversation,
  ChatMessage,
  createChatConversationApi,
  getChatConversationsApi,
  getChatMessagesApi,
  markChatConversationReadApi,
} from '../../services/api';
import type { User } from '../../types';
import {
  canSendChatMessage,
  clearConversationUnread,
  matchesPendingChatMessage,
  mergeChatMessages,
  shouldClearSubmittedDraft,
  updateConversationFromMessage,
  type ChatConnectionStatus,
} from './chatState';

function websocketUrl(): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/chat';
  return url.toString();
}

/**
 * Validates whether a candidate string is an email address.
 * Used to ensure email strings (like "a@gmail.com") are never used as a person's name.
 */
function isEmailString(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Resolves the primary contact name, email, avatar initials, and color for a conversation.
 * Strictly derives the display name from actual user profile fields (displayName, fullName,
 * firstName + lastName, name) in existing application data.
 * Never uses an email address (such as "a@gmail.com") as the primary title.
 */
function resolveConversationParticipant(
  conversation: ChatConversation,
  currentUserId?: string,
  allUsers: User[] = []
): {
  displayName: string;
  email?: string;
  initials: string;
  avatarColor: string;
  role?: string;
  user?: User;
} {
  // If it's a designated CHANNEL or PROJECT with a custom title (not an email)
  if (conversation.type !== 'DIRECT' && conversation.name?.trim()) {
    const rawTitle = conversation.name.trim();
    if (!isEmailString(rawTitle)) {
      return {
        displayName: rawTitle,
        initials: rawTitle.slice(0, 2).toUpperCase(),
        avatarColor: '#7465F6',
      };
    }
  }
  if (conversation.type === 'GROUP') {
    return {
      displayName: 'Group chat',
      initials: 'GC',
      avatarColor: '#7465F6',
    };
  }

  // 1. Identify the other participant's ID and email from conversation metadata
  let otherId: string | undefined = conversation.otherParticipant?.id;
  let otherEmail: string | undefined = conversation.otherParticipant?.email;

  if (!otherId && Array.isArray(conversation.members)) {
    const otherMember = conversation.members.find((m) => {
      const mId = m.userId || m.user?.id;
      return mId && mId !== currentUserId;
    });
    if (otherMember) {
      otherId = otherMember.userId || otherMember.user?.id;
      if (!otherEmail) otherEmail = otherMember.user?.email;
    }
  }

  // 2. Look up the contact in the existing allUsers directory (by ID or email)
  const matchedUser = allUsers.find((u) => {
    if (otherId && u.id === otherId) return true;
    if (otherEmail && u.email && u.email.toLowerCase() === otherEmail.toLowerCase()) return true;
    return false;
  });

  // 3. Resolve display name preferring profile fields in order:
  //    1. Display name, if provided
  //    2. Full name, if provided
  //    3. Existing first-name and last-name fields, if supported
  //    4. Profile name field (if not an email)
  //    5. Conversation participant metadata full name
  const candidateNames = [
    matchedUser?.displayName,
    matchedUser?.fullName,
    (matchedUser as any)?.firstName && (matchedUser as any)?.lastName
      ? `${(matchedUser as any).firstName} ${(matchedUser as any).lastName}`
      : (matchedUser as any)?.firstName,
    matchedUser?.name,
    conversation.otherParticipant?.fullName,
    conversation.members?.find((m) => (m.userId || m.user?.id) !== currentUserId)?.user?.fullName,
    conversation.members?.find((m) => (m.userId || m.user?.id) !== currentUserId)?.user?.name,
  ];

  let resolvedDisplayName = '';
  for (const candidate of candidateNames) {
    if (candidate && typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed && !isEmailString(trimmed)) {
        resolvedDisplayName = trimmed;
        break;
      }
    }
  }

  // If conversation has a non-email name
  if (!resolvedDisplayName && conversation.name && !isEmailString(conversation.name)) {
    resolvedDisplayName = conversation.name.trim();
  }

  // Neutral fallback if no profile name is available (never fabricate or map email to initial)
  if (!resolvedDisplayName) {
    resolvedDisplayName = conversation.type === 'DIRECT' ? 'Teammate' : 'Group chat';
  }

  // 4. Resolve Initials from the human display name
  let initials = 'TM';
  if (matchedUser?.initials && !isEmailString(matchedUser.initials)) {
    initials = matchedUser.initials;
  } else if (resolvedDisplayName && resolvedDisplayName !== 'Teammate') {
    const parts = resolvedDisplayName.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      initials = resolvedDisplayName.slice(0, 2).toUpperCase();
    }
  }

  const avatarColor = matchedUser?.avatarColor || matchedUser?.color || '#7465F6';

  const finalEmail =
    otherEmail ||
    matchedUser?.email ||
    conversation.otherParticipant?.email ||
    conversation.members?.find((m) => (m.userId || m.user?.id) !== currentUserId)?.user?.email;

  return {
    displayName: resolvedDisplayName,
    email: finalEmail,
    initials,
    avatarColor,
    role: matchedUser?.role,
    user: matchedUser,
  };
}

/**
 * Formats a message timestamp into a compact, human-readable string.
 */
function formatMessageTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) return timeStr;

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${timeStr}`;
    }

    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  } catch {
    return '';
  }
}

/**
 * Curated list of universal, lightweight emojis for quick selection.
 */
const EMOJI_PALETTE = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣',
  '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😋',
  '😎', '🤩', '🥳', '🤔', '🤫', '😴', '🤯', '👍',
  '👎', '👌', '✌️', '🤞', '👏', '🙌', '🤝', '🤙',
  '🔥', '✨', '🌟', '💡', '🚀', '🎉', '🏆', '🎯',
  '📌', '📎', '✉️', '📢', '⏰', '💻', '📈', '❤️',
];

interface PendingChatSend {
  conversationId: string;
  content: string;
  draft: string;
  clientMessageId: string;
}

interface ConversationRemovedEvent {
  conversationId: string;
}

interface ChatSocketPayload {
  event: string;
  conversationId?: string;
  data?: unknown;
  message?: string;
}

function isChatSocketPayload(value: unknown): value is ChatSocketPayload {
  return typeof value === 'object' && value !== null && 'event' in value &&
    typeof value.event === 'string';
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) return false;
  const message = value as Record<string, unknown>;
  return typeof message.id === 'string' &&
    typeof message.conversationId === 'string' &&
    typeof message.senderId === 'string' &&
    typeof message.content === 'string' &&
    typeof message.createdAt === 'string' &&
    !Number.isNaN(Date.parse(message.createdAt));
}

function isConversationRemoved(value: unknown): value is ConversationRemovedEvent {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Record<string, unknown>).conversationId === 'string';
}

export function ChatView() {
  const { currentUser, currentCompany, allUsers, showToast } = useApp();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ChatConnectionStatus>('disconnected');
  const [isSending, setIsSending] = useState(false);
  const [joinRequestPending, setJoinRequestPending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [conversationType, setConversationType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);

  // Composer controls state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const selectedIdRef = useRef<string | undefined>(selectedId);
  const conversationsRef = useRef(conversations);
  const currentUserIdRef = useRef(currentUser?.id);
  const draftRef = useRef(draft);
  const conversationDraftsRef = useRef(new Map<string, string>());
  const conversationPageRef = useRef(1);
  const textRetryRef = useRef<PendingChatSend | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef(messages);
  const loadingOlderMessagesRef = useRef(false);
  const hasOlderMessagesRef = useRef(false);
  const scrollAdjustmentRef = useRef<{ height: number; top: number; conversationId: string } | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const showToastRef = useRef(showToast);
  const markReadCompletedRef = useRef(new Set<string>());
  const markReadInFlightRef = useRef(new Map<string, Promise<void>>());
  const markReadAgainRef = useRef(new Set<string>());
  const messageVersionsRef = useRef(new Map<string, number>());
  const seenMessageIdsRef = useRef(new Set<string>());
  const joinedConversationIdsRef = useRef(new Set<string>());
  const requestedConversationIdsRef = useRef(new Set<string>());
  const removedConversationIdsRef = useRef(new Set<string>());
  const joinQueueRef = useRef<string[]>([]);
  const joinInFlightRef = useRef<string | undefined>(undefined);
  const queueJoinRef = useRef<(conversationId: string, prioritize?: boolean) => void>(() => {});
  const processJoinQueueRef = useRef<() => void>(() => {});
  const pendingSendRef = useRef<PendingChatSend | null>(null);
  const pendingSendTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    conversationsRef.current = conversations;
    selectedIdRef.current = selectedId;
    currentUserIdRef.current = currentUser?.id;
    draftRef.current = draft;
    messagesRef.current = messages;
    showToastRef.current = showToast;
  }, [conversations, selectedId, currentUser?.id, draft, messages, showToast]);

  const markConversationRead = useCallback(function markConversationReadRequest(
    conversationId: string,
    force = false,
  ) {
    const inFlight = markReadInFlightRef.current.get(conversationId);
    if (inFlight) {
      if (force) markReadAgainRef.current.add(conversationId);
      return;
    }
    if (!force && markReadCompletedRef.current.has(conversationId)) return;
    const messageVersion = messageVersionsRef.current.get(conversationId) ?? 0;

    const request = markChatConversationReadApi(conversationId)
      .then(() => {
        markReadCompletedRef.current.add(conversationId);
        if (
          messageVersionsRef.current.get(conversationId) === messageVersion ||
          selectedIdRef.current === conversationId
        ) {
          setConversations((current) => clearConversationUnread(current, conversationId));
        }
      })
      .catch((error: Error) => {
        markReadCompletedRef.current.delete(conversationId);
        showToastRef.current(error.message, 'error');
      })
      .finally(() => {
        markReadInFlightRef.current.delete(conversationId);
        const shouldMarkAgain = markReadAgainRef.current.delete(conversationId);
        if (shouldMarkAgain && selectedIdRef.current === conversationId) {
          void markConversationReadRequest(conversationId, true);
        }
      });

    markReadInFlightRef.current.set(conversationId, request);
  }, []);

  const selectConversation = (conversationId?: string) => {
    const previousConversationId = selectedIdRef.current;
    if (previousConversationId && previousConversationId !== conversationId) {
      if (draftRef.current) conversationDraftsRef.current.set(previousConversationId, draftRef.current);
      else conversationDraftsRef.current.delete(previousConversationId);
    }
    if (selectedIdRef.current !== conversationId) setMessages([]);
    selectedIdRef.current = conversationId;
    setSelectedId(conversationId);
    draftRef.current = conversationId ? conversationDraftsRef.current.get(conversationId) ?? '' : '';
    setDraft(draftRef.current);
    loadingOlderMessagesRef.current = false;
    hasOlderMessagesRef.current = false;
    setLoadingOlderMessages(false);
    setHasOlderMessages(false);
    scrollAdjustmentRef.current = null;
    shouldAutoScrollRef.current = true;
    if (!conversationId) {
      setConnectionStatus('disconnected');
    } else if (joinedConversationIdsRef.current.has(conversationId)) {
      setConnectionStatus('ready');
    } else {
      setConnectionStatus(socketRef.current?.readyState === WebSocket.OPEN ? 'joining' : 'connecting');
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        queueJoinRef.current(conversationId, true);
      }
    }
  };

  function clearPendingSendTimer() {
    if (pendingSendTimerRef.current) clearTimeout(pendingSendTimerRef.current);
    pendingSendTimerRef.current = undefined;
  }

  function resetJoinedRooms() {
    joinedConversationIdsRef.current.clear();
    requestedConversationIdsRef.current.clear();
    joinQueueRef.current = [];
    joinInFlightRef.current = undefined;
  }

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [conversations, selectedId],
  );

  const selectedParticipant = useMemo(() => {
    if (!selected) return null;
    return resolveConversationParticipant(selected, currentUser?.id, allUsers);
  }, [selected, currentUser?.id, allUsers]);

  // Adjust textarea height smoothly based on content
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = 40; // compact height for single-line message
    const maxHeight = 135; // ~5-6 lines before scrolling internally
    const scrollH = el.scrollHeight;
    const newHeight = Math.min(Math.max(scrollH, minHeight), maxHeight);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = scrollH > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [draft, adjustTextareaHeight]);

  // Scroll to bottom when messages update
  useEffect(() => {
    const scrollAdjustment = scrollAdjustmentRef.current;
    const container = messagesContainerRef.current;
    if (scrollAdjustment && container && scrollAdjustment.conversationId === selectedIdRef.current) {
      container.scrollTop = scrollAdjustment.top + (container.scrollHeight - scrollAdjustment.height);
      scrollAdjustmentRef.current = null;
    } else if (shouldAutoScrollRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    shouldAutoScrollRef.current = false;
  }, [messages]);

  // Close emoji picker on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Initial load of conversations
  useEffect(() => {
    let cancelled = false;
    void getChatConversationsApi()
      .then((response) => {
        if (cancelled) return;
        const convs: ChatConversation[] = response.data || [];
        conversationPageRef.current = 1;
        setHasMoreConversations(convs.length === 50);
        setConversations(convs);
        if (convs[0] && !selectedIdRef.current) {
          selectedIdRef.current = convs[0].id;
          setSelectedId(convs[0].id);
        }
      })
      .catch((error: Error) => showToastRef.current(error.message, 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Load messages and mark the selected conversation read.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    loadingOlderMessagesRef.current = false;
    hasOlderMessagesRef.current = false;
    setLoadingOlderMessages(false);
    setHasOlderMessages(false);
    void getChatMessagesApi(selectedId)
      .then((response) => {
        if (!cancelled) {
          const page = response.data || [];
          hasOlderMessagesRef.current = page.length === 50;
          setHasOlderMessages(hasOlderMessagesRef.current);
          setMessages((current) => mergeChatMessages(current, page));
        }
      })
      .catch((error: Error) => {
        if (!cancelled) showToastRef.current(error.message, 'error');
      });
    markReadCompletedRef.current.delete(selectedId);
    markConversationRead(selectedId);
    return () => {
      cancelled = true;
    };
  }, [selectedId, markConversationRead]);

  async function loadOlderMessages() {
    const conversationId = selectedIdRef.current;
    const oldestMessage = messagesRef.current[0];
    if (
      !conversationId ||
      !oldestMessage ||
      loadingOlderMessagesRef.current ||
      !hasOlderMessagesRef.current
    ) return;

    loadingOlderMessagesRef.current = true;
    setLoadingOlderMessages(true);
    try {
      const response = await getChatMessagesApi(
        conversationId,
        50,
        oldestMessage.createdAt,
        oldestMessage.id,
      );
      if (selectedIdRef.current !== conversationId) return;
      const olderMessages = response.data || [];
      hasOlderMessagesRef.current = olderMessages.length === 50;
      setHasOlderMessages(hasOlderMessagesRef.current);
      if (olderMessages.length) {
        const container = messagesContainerRef.current;
        if (container) {
          scrollAdjustmentRef.current = {
            height: container.scrollHeight,
            top: container.scrollTop,
            conversationId,
          };
        }
        shouldAutoScrollRef.current = false;
        setMessages((current) => mergeChatMessages(current, olderMessages));
      }
    } catch (error) {
      if (selectedIdRef.current === conversationId) {
        showToastRef.current((error as Error).message, 'error');
      }
    } finally {
      if (selectedIdRef.current === conversationId) {
        loadingOlderMessagesRef.current = false;
        setLoadingOlderMessages(false);
      }
    }
  }

  function handleMessagesScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    shouldAutoScrollRef.current =
      container.scrollHeight - container.clientHeight - container.scrollTop < 80;
    if (container.scrollTop < 24) void loadOlderMessages();
  }

  async function loadMoreConversations() {
    if (loadingMoreConversations) return;
    setLoadingMoreConversations(true);
    const requestedPage = conversationPageRef.current + 1;
    try {
      const response = await getChatConversationsApi(requestedPage);
      const page = response.data || [];
      conversationPageRef.current = requestedPage;
      setHasMoreConversations(page.length === 50);
      setConversations((current) => {
        const seen = new Set(current.map((conversation) => conversation.id));
        return [...current, ...page.filter((conversation) => !seen.has(conversation.id))];
      });
    } catch (error) {
      showToastRef.current((error as Error).message, 'error');
    } finally {
      setLoadingMoreConversations(false);
    }
  }

  useEffect(() => {
    for (const conversation of conversations) {
      queueJoinRef.current(conversation.id);
    }
    if (selectedId) queueJoinRef.current(selectedId, true);
  }, [conversations, selectedId]);

  useEffect(() => {
    if (loading || !currentUser?.id) return;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let joinPacingTimer: ReturnType<typeof setTimeout> | undefined;
    let lastJoinSentAt = 0;
    let retryAttempt = 0;
    let activeSocket: WebSocket | null = null;

    const processJoinQueue = () => {
      const socket = activeSocket;
      if (
        disposed ||
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        joinInFlightRef.current ||
        pendingSendRef.current
      ) {
        return;
      }

      const conversationId = joinQueueRef.current.length ? joinQueueRef.current.shift() : undefined;
      if (!conversationId) {
        return;
      }

      const pacingDelay = Math.max(0, 450 - (Date.now() - lastJoinSentAt));
      if (pacingDelay > 0) {
        joinQueueRef.current.unshift(conversationId);
        if (!joinPacingTimer) {
          joinPacingTimer = setTimeout(() => {
            joinPacingTimer = undefined;
            processJoinQueue();
          }, pacingDelay);
        }
        return;
      }

      joinInFlightRef.current = conversationId;
      requestedConversationIdsRef.current.add(conversationId);
      setJoinRequestPending(true);
      if (selectedIdRef.current === conversationId) setConnectionStatus('joining');
      try {
        socket.send(JSON.stringify({ event: 'conversation:join', conversationId }));
        lastJoinSentAt = Date.now();
      } catch (error) {
        joinInFlightRef.current = undefined;
        requestedConversationIdsRef.current.delete(conversationId);
        setJoinRequestPending(false);
        if (selectedIdRef.current === conversationId) setConnectionStatus('error');
        showToastRef.current((error as Error).message, 'error');
        processJoinQueue();
      }
    };

    const queueJoin = (conversationId: string, prioritize = false) => {
      if (
        joinedConversationIdsRef.current.has(conversationId) ||
        requestedConversationIdsRef.current.has(conversationId)
      ) {
        return;
      }
      const queuedIndex = joinQueueRef.current.indexOf(conversationId);
      if (queuedIndex >= 0) {
        if (prioritize && queuedIndex > 0) {
          joinQueueRef.current.splice(queuedIndex, 1);
          joinQueueRef.current.unshift(conversationId);
        }
        processJoinQueue();
        return;
      }
      if (prioritize) joinQueueRef.current.unshift(conversationId);
      else joinQueueRef.current.push(conversationId);
      processJoinQueue();
    };

    queueJoinRef.current = queueJoin;
    processJoinQueueRef.current = processJoinQueue;

    const connect = () => {
      if (disposed) return;
      setConnectionStatus(selectedIdRef.current ? 'connecting' : 'disconnected');
      try {
        const socket = new WebSocket(websocketUrl());
        activeSocket = socket;
        socketRef.current = socket;
        socket.onopen = () => {
          if (disposed || activeSocket !== socket) return;
          retryAttempt = 0;
          resetJoinedRooms();
          setJoinRequestPending(false);
          setConnectionStatus(selectedIdRef.current ? 'joining' : 'disconnected');

          const selectedConversationId = selectedIdRef.current;
          if (selectedConversationId) queueJoin(selectedConversationId, true);
          for (const conversation of conversationsRef.current) queueJoin(conversation.id);
        };
        socket.onmessage = (event) => {
          if (disposed || activeSocket !== socket || typeof event.data !== 'string') return;
          let payload: unknown;
          try {
            payload = JSON.parse(event.data);
          } catch {
            showToastRef.current('Received an invalid chat response.', 'error');
            return;
          }
          if (!isChatSocketPayload(payload)) return;

          if (payload.event === 'conversation:joined' && payload.conversationId) {
            const conversationId = payload.conversationId;
            removedConversationIdsRef.current.delete(conversationId);
            joinedConversationIdsRef.current.add(conversationId);
            requestedConversationIdsRef.current.delete(conversationId);
            if (joinInFlightRef.current === conversationId) {
              joinInFlightRef.current = undefined;
              setJoinRequestPending(false);
            }
            if (selectedIdRef.current === conversationId) setConnectionStatus('ready');
            if (selectedIdRef.current === conversationId) {
              void getChatMessagesApi(conversationId)
                .then((response) => {
                  if (selectedIdRef.current === conversationId) {
                    const page = response.data || [];
                    hasOlderMessagesRef.current = page.length === 50;
                    setHasOlderMessages(hasOlderMessagesRef.current);
                    setMessages((current) => mergeChatMessages(current, page));
                  }
                })
                .catch((error: Error) => showToastRef.current(error.message, 'error'));
            }
            processJoinQueue();
            return;
          }

          if (payload.event === 'message:new' && isChatMessage(payload.data)) {
            const message = payload.data;
            console.info(JSON.stringify({
              scope: 'chat',
              event: 'message_new_received',
              conversationId: message.conversationId,
              messageId: message.id,
            }));
            if (seenMessageIdsRef.current.has(message.id)) return;
            seenMessageIdsRef.current.add(message.id);
            if (seenMessageIdsRef.current.size > 2000) {
              const oldestId = seenMessageIdsRef.current.values().next().value;
              if (oldestId) seenMessageIdsRef.current.delete(oldestId);
            }

            setConversations((current) =>
              updateConversationFromMessage(current, message, currentUserIdRef.current),
            );
            const isActiveConversation = selectedIdRef.current === message.conversationId;
            if (isActiveConversation) {
              setMessages((current) => mergeChatMessages(current, [message]));
            }

            if (message.senderId !== currentUserIdRef.current) {
              messageVersionsRef.current.set(
                message.conversationId,
                (messageVersionsRef.current.get(message.conversationId) ?? 0) + 1,
              );
              markReadCompletedRef.current.delete(message.conversationId);
              if (isActiveConversation) markConversationRead(message.conversationId, true);
            }

            const pendingSend = pendingSendRef.current ?? textRetryRef.current;
            if (
              pendingSend &&
              matchesPendingChatMessage(pendingSend, message, currentUserIdRef.current)
            ) {
              pendingSendRef.current = null;
              textRetryRef.current = null;
              clearPendingSendTimer();
              setIsSending(false);
              const storedDraft = conversationDraftsRef.current.get(pendingSend.conversationId);
              const storedText = storedDraft ??
                (selectedIdRef.current === pendingSend.conversationId ? draftRef.current : '');
              if (shouldClearSubmittedDraft(storedText, pendingSend.draft)) {
                conversationDraftsRef.current.delete(pendingSend.conversationId);
                if (selectedIdRef.current === pendingSend.conversationId) {
                  draftRef.current = '';
                  setDraft('');
                }
              }
              if (selectedIdRef.current === pendingSend.conversationId) {
                setShowEmojiPicker(false);
                if (textareaRef.current) {
                  textareaRef.current.style.height = '40px';
                  textareaRef.current.focus();
                }
              }
              processJoinQueue();
            }
            return;
          }

          if (
            payload.event === 'conversation:removed' &&
            (payload.conversationId || isConversationRemoved(payload.data))
          ) {
            const conversationId = payload.conversationId ??
              (isConversationRemoved(payload.data) ? payload.data.conversationId : '');
            if (!conversationId) return;
            removedConversationIdsRef.current.add(conversationId);
            if (joinInFlightRef.current === conversationId) {
              joinInFlightRef.current = undefined;
              setJoinRequestPending(false);
            }
            if (pendingSendRef.current?.conversationId === conversationId) {
              pendingSendRef.current = null;
              clearPendingSendTimer();
              setIsSending(false);
            }
            if (textRetryRef.current?.conversationId === conversationId) {
              textRetryRef.current = null;
            }
            if (selectedIdRef.current === conversationId) {
              hasOlderMessagesRef.current = false;
              loadingOlderMessagesRef.current = false;
              scrollAdjustmentRef.current = null;
              setHasOlderMessages(false);
              setLoadingOlderMessages(false);
              shouldAutoScrollRef.current = true;
              setShowEmojiPicker(false);
            }
            conversationDraftsRef.current.delete(conversationId);
            joinedConversationIdsRef.current.delete(conversationId);
            requestedConversationIdsRef.current.delete(conversationId);
            joinQueueRef.current = joinQueueRef.current.filter((id) => id !== conversationId);
            setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
            processJoinQueue();
            if (selectedIdRef.current === conversationId) {
              selectedIdRef.current = undefined;
              setSelectedId(undefined);
              setMessages([]);
              draftRef.current = '';
              setDraft('');
              setConnectionStatus('disconnected');
            }
            showToastRef.current('You were removed from this conversation.', 'error');
            return;
          }

          if (payload.event === 'chat:error') {
            showToastRef.current(payload.message || 'Chat error', 'error');
            const failedJoinId = joinInFlightRef.current;
            if (failedJoinId) {
              joinInFlightRef.current = undefined;
              requestedConversationIdsRef.current.delete(failedJoinId);
              setJoinRequestPending(false);
              if (selectedIdRef.current === failedJoinId) setConnectionStatus('error');
              processJoinQueue();
            } else if (pendingSendRef.current) {
              pendingSendRef.current = null;
              clearPendingSendTimer();
              setIsSending(false);
              processJoinQueue();
            } else if (selectedIdRef.current) {
              setConnectionStatus('error');
            }
          }
        };
        socket.onclose = () => {
          if (disposed || activeSocket !== socket) return;
          activeSocket = null;
          if (socketRef.current === socket) socketRef.current = null;
          joinedConversationIdsRef.current.clear();
          requestedConversationIdsRef.current.clear();
          joinQueueRef.current = [];
          joinInFlightRef.current = undefined;
          if (joinPacingTimer) clearTimeout(joinPacingTimer);
          joinPacingTimer = undefined;
          setJoinRequestPending(false);
          setConnectionStatus('disconnected');
          if (pendingSendRef.current) {
            pendingSendRef.current = null;
            clearPendingSendTimer();
            setIsSending(false);
            showToastRef.current('Chat disconnected before delivery was confirmed. Your draft was kept.', 'error');
          }
          retryAttempt += 1;
          const delay = Math.min(1000 * 2 ** (retryAttempt - 1), 15000);
          retryTimer = setTimeout(connect, delay);
        };
        socket.onerror = () => {
          if (!disposed && activeSocket === socket) {
            setConnectionStatus('disconnected');
          }
        };
      } catch (error) {
        showToastRef.current((error as Error).message, 'error');
        retryAttempt += 1;
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** (retryAttempt - 1), 15000));
      }
    };

    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (joinPacingTimer) clearTimeout(joinPacingTimer);
      queueJoinRef.current = () => {};
      processJoinQueueRef.current = () => {};
      clearPendingSendTimer();
      if (activeSocket) {
        activeSocket.close();
      }
      resetJoinedRooms();
    };
  }, [loading, currentUser?.id, markConversationRead]);

  async function createConversation(event: FormEvent) {
    event.preventDefault();
    const selectedMemberIds = conversationType === 'DIRECT' ? [memberId] : groupMemberIds;
    if (
      !currentCompany?.id ||
      selectedMemberIds.some((id) => !id) ||
      new Set(selectedMemberIds).size !== selectedMemberIds.length ||
      (conversationType === 'GROUP' && selectedMemberIds.length < 2)
    ) return;
    setIsSubmitting(true);
    try {
      const response = await createChatConversationApi({
        organizationId: currentCompany.id,
        type: conversationType,
        ...(conversationType === 'DIRECT'
          ? { memberIds: selectedMemberIds }
          : {
              memberIds: selectedMemberIds,
              name: groupName.trim() || null,
            }),
      });
      const createdConv = response.data;
      removedConversationIdsRef.current.delete(createdConv.id);
      setConversations((current) => {
        const existingIdx = current.findIndex((c) => c.id === createdConv.id);
        if (existingIdx >= 0) return current;
        return [createdConv, ...current];
      });
      selectConversation(createdConv.id);
      setMemberId('');
      setGroupMemberIds([]);
      setGroupName('');
      setConversationType('DIRECT');
      setShowCreate(false);
      showToast('Conversation ready', 'success');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateDraftText(text: string) {
    draftRef.current = text;
    setDraft(text);
    const conversationId = selectedIdRef.current;
    if (!conversationId) return;
    if (text) conversationDraftsRef.current.set(conversationId, text);
    else conversationDraftsRef.current.delete(conversationId);
  }

  function handleSendMessage(event?: FormEvent) {
    if (event) event.preventDefault();
    const conversationId = selectedIdRef.current;
    if (!conversationId) return;
    const socket = socketRef.current;
    const submittedDraft = conversationId === selectedIdRef.current
      ? draftRef.current
      : conversationDraftsRef.current.get(conversationId) ?? '';
    const content = submittedDraft.trim();
    if (
      !content ||
      isSending ||
      pendingSendRef.current
    ) {
      return;
    }

    if (
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !canSendChatMessage(
        connectionStatus,
        conversationId,
        joinRequestPending,
        isSending,
      ) ||
      !joinedConversationIdsRef.current.has(conversationId)
    ) {
      return;
    }

    const existingRetry = textRetryRef.current;
    const pendingSend: PendingChatSend = {
      conversationId,
      content,
      draft: submittedDraft,
      clientMessageId: existingRetry?.conversationId === conversationId &&
          existingRetry.content === content
        ? existingRetry.clientMessageId
        : crypto.randomUUID(),
    };
    textRetryRef.current = pendingSend;
    pendingSendRef.current = pendingSend;
    setIsSending(true);
    try {
      socket.send(JSON.stringify({
        event: 'message:send',
        conversationId,
        content,
        clientMessageId: pendingSend.clientMessageId,
      }));
    } catch (error) {
      pendingSendRef.current = null;
      setIsSending(false);
      showToast((error as Error).message, 'error');
      return;
    }

    pendingSendTimerRef.current = setTimeout(() => {
      if (pendingSendRef.current !== pendingSend) return;
      pendingSendRef.current = null;
      setIsSending(false);
      showToastRef.current(
        'Message delivery could not be confirmed. Your draft was kept; check the conversation before retrying.',
        'error',
      );
      processJoinQueueRef.current();
    }, 15000);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  function handleEmojiSelect(emoji: string) {
    const el = textareaRef.current;
    if (el) {
      const start = el.selectionStart ?? draft.length;
      const end = el.selectionEnd ?? draft.length;
      const newText = draft.slice(0, start) + emoji + draft.slice(end);
      updateDraftText(newText);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      const newText = `${draftRef.current}${emoji}`;
      updateDraftText(newText);
    }
    setShowEmojiPicker(false);
  }

  // Filter conversations by search term
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase().trim();
    return conversations.filter((conv) => {
      const p = resolveConversationParticipant(conv, currentUser?.id, allUsers);
      return (
        p.displayName.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (conv.lastMessage?.content && conv.lastMessage.content.toLowerCase().includes(q))
      );
    });
  }, [conversations, searchQuery, currentUser?.id, allUsers]);

  const sendStatusLabel = isSending
    ? 'Sending...'
    : connectionStatus === 'connecting' || connectionStatus === 'disconnected'
      ? 'Reconnecting...'
      : connectionStatus === 'joining'
        ? 'Preparing...'
        : connectionStatus === 'error'
          ? 'Chat unavailable'
          : joinRequestPending
            ? 'Syncing chats...'
            : 'Send';

  return (
    <div className="h-full flex overflow-hidden bg-canvas select-none">
      {/* ========================================================= */}
      {/* 1. LEFT PANEL: Conversations Sidebar                     */}
      {/* ========================================================= */}
      <aside
        className={`w-full lg:w-80 border-r border-border bg-surface flex flex-col flex-shrink-0 transition-all ${
          selectedId ? 'hidden lg:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-primary/15 border border-brand-primary/30 flex items-center justify-center text-brand-primary">
              <MessageCircle size={16} />
            </div>
            <h1 className="font-semibold text-sm text-text-primary tracking-tight">Messages</h1>
          </div>
          <button
            className={`p-1.5 rounded-lg transition-colors ${
              showCreate
                ? 'bg-brand-primary text-white'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            }`}
            onClick={() => setShowCreate((prev) => !prev)}
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            {showCreate ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>

        {/* New Conversation Form Drawer */}
        {showCreate && (
          <form
            onSubmit={createConversation}
            className="p-3.5 border-b border-border bg-surface-elevated/70 space-y-2.5 animate-fadeIn"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">New Message</span>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-[11px] text-text-muted hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
            <select
              value={conversationType}
              onChange={(event) => {
                setConversationType(event.target.value as 'DIRECT' | 'GROUP');
                setMemberId('');
                setGroupMemberIds([]);
              }}
              className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
              aria-label="Conversation type"
            >
              <option value="DIRECT">Direct message</option>
              <option value="GROUP">Group conversation</option>
            </select>
            {conversationType === 'GROUP' && (
              <input
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                maxLength={150}
                placeholder="Group name (optional)"
                aria-label="Group name"
                className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
              />
            )}
            {conversationType === 'DIRECT' ? (
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                required
              >
                <option value="">Select a teammate...</option>
                {allUsers
                  .filter((u) => u.id !== currentUser.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName || u.fullName || u.name || 'Teammate'}{' '}
                      {u.email ? `(${u.email})` : ''} — {u.role || 'Member'}
                    </option>
                  ))}
              </select>
            ) : (
              <label className="block space-y-1 text-[11px] text-text-muted">
                <span>Choose at least two teammates</span>
                <select
                  multiple
                  value={groupMemberIds}
                  onChange={(event) => setGroupMemberIds(
                    Array.from(event.target.selectedOptions, (option) => option.value),
                  )}
                  className="h-28 w-full rounded-lg border border-border bg-canvas px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                  aria-label="Group participants"
                  required
                >
                  {allUsers
                    .filter((user) => user.id !== currentUser.id)
                    .map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName || user.fullName || user.name || 'Teammate'}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <button
              className="w-full rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              type="submit"
              disabled={
                isSubmitting ||
                (conversationType === 'DIRECT' ? !memberId : groupMemberIds.length < 2)
              }
            >
              {isSubmitting ? 'Starting chat...' : `Start ${conversationType === 'GROUP' ? 'Group' : 'Conversation'}`}
            </button>
          </form>
        )}

        {/* Search bar */}
        <div className="p-2.5 border-b border-border/70">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-canvas border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary transition-colors"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-8 space-y-2 text-text-muted">
              <div className="w-5 h-5 rounded-full border-2 border-brand-primary border-t-transparent animate-spin" />
              <span className="text-xs">Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted space-y-2">
              <Users size={28} className="opacity-40" />
              <p className="text-xs font-medium text-text-secondary">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="text-[11px] text-text-muted max-w-[200px]">
                {searchQuery
                  ? 'Try searching by a different name.'
                  : 'Start a direct message with a teammate.'}
              </p>
              {!searchQuery && !showCreate && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="mt-2 px-3 py-1 rounded-md bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors"
                >
                  Start chat
                </button>
              )}
              {!loading && hasMoreConversations && (
                <button
                  type="button"
                  onClick={() => void loadMoreConversations()}
                  disabled={loadingMoreConversations}
                  className="w-full rounded-lg px-3 py-2 text-[11px] text-brand-primary hover:bg-surface-hover disabled:opacity-50"
                >
                  {loadingMoreConversations ? 'Loading conversations...' : 'Load more conversations'}
                </button>
              )}
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedId === conv.id;
              const participant = resolveConversationParticipant(conv, currentUser?.id, allUsers);
              const preview = conv.lastMessage?.content ||
              (conv.lastMessage ? 'Message without text' : '');
              const timeFormatted = conv.lastMessage?.createdAt
                ? formatMessageTimestamp(conv.lastMessage.createdAt)
                : '';

              return (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-3 group relative ${
                    isSelected
                      ? 'bg-brand-subtle text-brand-text border border-brand-primary/30 shadow-xs'
                      : 'hover:bg-surface-hover/80 text-text-secondary'
                  }`}
                >
                  {/* Contact Avatar with Initials */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 text-xs border border-white/10 ring-2 ring-surface shadow-xs select-none"
                    style={{ backgroundColor: participant.avatarColor }}
                  >
                    {participant.initials}
                  </div>

                  {/* Contact Information: Actual Person Name Primary, Email / Preview Secondary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isSelected
                            ? 'text-text-primary'
                            : 'text-text-primary group-hover:text-brand-primary'
                        }`}
                        title={participant.displayName}
                      >
                        {participant.displayName}
                      </span>
                      {timeFormatted && (
                        <span className="text-[10px] text-text-muted font-mono flex-shrink-0">
                          {timeFormatted}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-text-muted truncate">
                        {preview ? (
                          preview
                        ) : participant.email ? (
                          <span className="text-text-muted/80">{participant.email}</span>
                        ) : (
                          <span className="italic opacity-60">No messages yet</span>
                        )}
                      </p>

                      {conv.unreadCount != null && conv.unreadCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-brand-primary text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* 2. RIGHT PANEL: Active Conversation & Messages            */}
      {/* ========================================================= */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-canvas">
        {selected && selectedParticipant ? (
          <>
            {/* Active Header: Real Contact Name Primary, Secondary Email */}
            <header className="h-14 px-4 sm:px-6 border-b border-border bg-surface flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back button to conversation list */}
                <button
                  onClick={() => selectConversation(undefined)}
                  className="lg:hidden p-1.5 -ml-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
                  title="Back to conversations"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Contact Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-white flex-shrink-0 text-xs border border-white/10 ring-2 ring-surface shadow-xs select-none"
                  style={{ backgroundColor: selectedParticipant.avatarColor }}
                >
                  {selectedParticipant.initials}
                </div>

                {/* Contact Name & Secondary Details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2
                      className="text-xs sm:text-sm font-semibold text-text-primary truncate"
                      title={selectedParticipant.displayName}
                    >
                      {selectedParticipant.displayName}
                    </h2>
                    {selected?.type !== 'DIRECT' ? (
                      <span className="text-[10px] text-text-muted">
                        {selected?.members?.length ?? 0} participants
                      </span>
                    ) : selectedParticipant.role && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-surface-elevated border border-border text-text-muted">
                        {selectedParticipant.role}
                      </span>
                    )}
                  </div>
                  {selectedParticipant.email && (
                    <p className="text-[11px] text-text-muted truncate">
                      {selectedParticipant.email}
                    </p>
                  )}
                </div>
              </div>
            </header>

            {/* Message History Container with Avatars beside Message Bubbles */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3"
            >
              {loadingOlderMessages && (
                <div className="py-2 text-center text-[11px] text-text-muted" role="status">
                  Loading older messages...
                </div>
              )}
              {!loadingOlderMessages && hasOlderMessages && messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => void loadOlderMessages()}
                  className="mx-auto block rounded-lg px-3 py-1.5 text-[11px] text-brand-primary hover:bg-surface-hover"
                >
                  Load older messages
                </button>
              )}
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center text-text-muted space-y-3">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-xs border border-white/10 select-none"
                    style={{ backgroundColor: selectedParticipant.avatarColor }}
                  >
                    {selectedParticipant.initials}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-text-primary">
                      {selectedParticipant.displayName}
                    </h3>
                    <p className="text-xs text-text-muted max-w-sm">
                      This is the start of your direct conversation with{' '}
                      {selectedParticipant.displayName}.
                    </p>
                  </div>
                </div>
              ) : (
                messages.map((message, idx) => {
                  const isMe = message.senderId === currentUser?.id;
                  const senderUser = isMe
                    ? currentUser
                    : allUsers.find((u) => u.id === message.senderId);

                  const senderName = isMe
                    ? 'You'
                    : senderUser?.displayName ||
                      senderUser?.fullName ||
                      senderUser?.name ||
                      message.sender?.fullName ||
                      message.sender?.name ||
                      selectedParticipant.displayName;

                  const senderColor = isMe
                    ? currentUser?.avatarColor || currentUser?.color || '#7465F6'
                    : senderUser?.avatarColor || senderUser?.color || selectedParticipant.avatarColor;

                  const senderInitials = isMe
                    ? currentUser?.initials ||
                      (currentUser?.name || currentUser?.fullName || 'U').slice(0, 2).toUpperCase()
                    : senderUser?.initials ||
                      (senderName.length >= 2
                        ? senderName.slice(0, 2).toUpperCase()
                        : senderName.toUpperCase() || 'U');

                  const prevMsg = idx > 0 ? messages[idx - 1] : null;
                  const isSameSenderAsPrev = prevMsg?.senderId === message.senderId;

                  return (
                    <div
                      key={message.id || idx}
                      className={`flex items-end gap-2.5 group ${
                        isMe ? 'justify-end' : 'justify-start'
                      } ${isSameSenderAsPrev ? 'mt-1' : 'mt-3.5'}`}
                    >
                      {/* Received Message Avatar (Left-aligned) */}
                      {!isMe && (
                        <div className="w-7 h-7 flex-shrink-0 self-end mb-1">
                          {!isSameSenderAsPrev ? (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shadow-xs border border-white/10 select-none ring-1 ring-surface"
                              style={{ backgroundColor: senderColor }}
                              title={senderName}
                            >
                              {senderInitials}
                            </div>
                          ) : (
                            <div className="w-7 h-7" />
                          )}
                        </div>
                      )}

                      {/* Bubble & Timestamp Column */}
                      <div
                        className={`flex flex-col ${
                          isMe ? 'items-end' : 'items-start'
                        } max-w-[78%] sm:max-w-[65%]`}
                      >
                        {/* Received Sender Name Header */}
                        {!isMe && !isSameSenderAsPrev && (
                          <span className="text-[10px] font-medium text-text-muted mb-1 ml-1 select-none">
                            {senderName}
                          </span>
                        )}

                        {/* Message Content Bubble: Compact for short text, wider for long */}
                        <div
                          className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap shadow-xs select-text w-fit ${
                            isMe
                              ? 'bg-brand-primary text-white rounded-br-xs'
                              : 'bg-surface border border-border text-text-primary rounded-bl-xs'
                          }`}
                        >
                          <p>{message.content || 'This message has no text.'}</p>
                        </div>

                        {/* Timestamp */}
                        <time
                          className={`text-[9px] text-text-muted mt-1 px-1 font-mono opacity-70 group-hover:opacity-100 transition-opacity select-none ${
                            isMe ? 'text-right' : 'text-left'
                          }`}
                        >
                          {formatMessageTimestamp(message.createdAt)}
                        </time>
                      </div>

                      {/* Sent Message Avatar (Right-aligned beside user's bubble) */}
                      {isMe && (
                        <div className="w-7 h-7 flex-shrink-0 self-end mb-1">
                          {!isSameSenderAsPrev ? (
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shadow-xs border border-white/10 select-none ring-1 ring-surface"
                              style={{ backgroundColor: senderColor }}
                              title="You"
                            >
                              {senderInitials}
                            </div>
                          ) : (
                            <div className="w-7 h-7" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ========================================================= */}
            {/* 3. MESSAGE COMPOSER WITH CONTROLS                         */}
            {/* ========================================================= */}
            <div className="border-t border-border bg-surface flex-shrink-0 relative">
              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full left-4 mb-2 p-2.5 rounded-2xl bg-surface border border-border shadow-overlay z-50 w-72 max-w-[calc(100vw-2rem)] animate-fadeIn select-none"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/80">
                    <span className="text-[11px] font-semibold text-text-primary">
                      Select Emoji
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(false)}
                      className="text-text-muted hover:text-text-primary p-0.5 rounded"
                      aria-label="Close emoji picker"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto p-1">
                    {EMOJI_PALETTE.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleEmojiSelect(emoji)}
                        className="w-7 h-7 flex items-center justify-center text-base hover:bg-surface-hover rounded-lg transition-transform hover:scale-115 active:scale-95"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Composer Controls Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 flex items-end gap-1.5 sm:gap-2"
              >
                {/* Control 1: Emoji Picker Button */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
                    showEmojiPicker
                      ? 'bg-brand-primary text-white'
                      : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                  }`}
                  title="Emoji"
                  aria-label="Emoji"
                >
                  <Smile size={18} />
                </button>

                {/* Control 4: Auto-resizing Multiline Message Textarea */}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => updateDraftText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={4000}
                  rows={1}
                  placeholder={`Message ${selectedParticipant.displayName}...`}
                  className="flex-1 min-h-[40px] max-h-[135px] resize-none py-2 px-3.5 rounded-xl border border-border bg-canvas text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-colors leading-relaxed"
                  autoComplete="off"
                  aria-label="Message text"
                />

                {/* Control 5: Send Message Button */}
                <button
                  type="submit"
                  disabled={
                    !draft.trim() ||
                    isSending ||
                    !canSendChatMessage(
                      connectionStatus,
                      selectedId,
                      joinRequestPending,
                      isSending,
                    )
                  }
                  className="h-10 px-3.5 sm:px-4 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs flex-shrink-0"
                  title={sendStatusLabel}
                  aria-label={sendStatusLabel}
                >
                  <Send size={14} />
                  <span className="hidden sm:inline">{sendStatusLabel}</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty state when no conversation is selected */
          <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-canvas text-text-muted">
            <div className="w-14 h-14 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted mb-3 shadow-xs">
              <MessageCircle size={26} className="text-brand-primary" />
            </div>
            <h2 className="text-sm font-semibold text-text-primary mb-1">
              Select a conversation
            </h2>
            <p className="text-xs text-text-muted max-w-sm mb-4 leading-relaxed">
              Choose a conversation from the left or start a new direct message with a teammate.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3.5 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary/90 transition-colors shadow-xs"
            >
              Start new message
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
