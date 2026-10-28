import { FormEvent, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  MessageCircle,
  Plus,
  Send,
  Users,
  ChevronLeft,
  Search,
  X,
  Smile,
  Paperclip,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import {
  API_BASE_URL,
  ChatConversation,
  ChatMessage,
  createChatConversationApi,
  getChatConversationsApi,
  getChatMessagesApi,
} from '../../services/api';
import type { User } from '../../types';

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
    resolvedDisplayName = conversation.type === 'DIRECT' ? 'Teammate' : 'Conversation';
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

interface DraftAttachment {
  file: File;
  type: 'file' | 'media';
  previewUrl?: string;
}

export function ChatView() {
  const { currentUser, currentCompany, allUsers, showToast } = useApp();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Composer controls state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<DraftAttachment | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const selectedIdRef = useRef<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
        setConversations(convs);
        if (convs[0] && !selectedIdRef.current) {
          setSelectedId(convs[0].id);
        }
      })
      .catch((error: Error) => showToast(error.message, 'error'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Load messages and establish WebSocket for selected conversation
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setMessages([]);
    void getChatMessagesApi(selectedId)
      .then((response) => {
        if (!cancelled) setMessages(response.data || []);
      })
      .catch((error: Error) => showToast(error.message, 'error'));

    const socket = new WebSocket(websocketUrl());
    socketRef.current = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ event: 'conversation:join', conversationId: selectedId }));
    };
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as {
        event: string;
        data?: ChatMessage;
        message?: string;
      };
      if (payload.event === 'message:new' && payload.data?.conversationId === selectedIdRef.current) {
        setMessages((current) =>
          current.some((m) => m.id === payload.data?.id) ? current : [...current, payload.data!]
        );
      }
      if (payload.event === 'chat:error') {
        showToast(payload.message || 'Chat error', 'error');
      }
    };
    socket.onerror = () => {
      showToast('Chat connection failed. Check that the backend is running.', 'error');
    };

    return () => {
      cancelled = true;
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ event: 'conversation:leave', conversationId: selectedId }));
      }
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [selectedId, showToast]);

  // Cleanup pending object URL when component unmounts or attachment changes
  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  async function createConversation(event: FormEvent) {
    event.preventDefault();
    if (!currentCompany?.id || !memberId) return;
    setIsSubmitting(true);
    try {
      const response = await createChatConversationApi({
        organizationId: currentCompany.id,
        type: 'DIRECT',
        memberIds: [memberId],
      });
      const createdConv = response.data;
      setConversations((current) => {
        const existingIdx = current.findIndex((c) => c.id === createdConv.id);
        if (existingIdx >= 0) return current;
        return [createdConv, ...current];
      });
      setSelectedId(createdConv.id);
      setMemberId('');
      setShowCreate(false);
      showToast('Conversation ready', 'success');
    } catch (error) {
      showToast((error as Error).message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleSendMessage(event?: FormEvent) {
    if (event) event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || socketRef.current?.readyState !== WebSocket.OPEN) return;

    // Send text message through active WebSocket
    socketRef.current.send(
      JSON.stringify({ event: 'message:send', conversationId: selectedId, content })
    );

    // If an attachment was queued in the composer, inform user transparently
    if (pendingAttachment) {
      showToast(
        `Note: Message sent. Attachment "${pendingAttachment.file.name}" was not sent because chat file upload API is pending backend implementation (see BACKEND_TEAM_HANDOFF.md).`,
        'info'
      );
      if (pendingAttachment.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
      setPendingAttachment(null);
    }

    setDraft('');
    setShowEmojiPicker(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.focus();
    }
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
      setDraft(newText);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setDraft((prev) => prev + emoji);
    }
    setShowEmojiPicker(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment({ file, type: 'file' });
    e.target.value = '';
    showToast(
      `File "${file.name}" selected. Chat attachments require backend API integration (see BACKEND_TEAM_HANDOFF.md).`,
      'info'
    );
  }

  function handleMediaSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setPendingAttachment({ file, type: 'media', previewUrl });
    e.target.value = '';
    showToast(
      `Media "${file.name}" selected. Chat media uploads require backend API integration (see BACKEND_TEAM_HANDOFF.md).`,
      'info'
    );
  }

  function removeAttachment() {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
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
            <button
              className="w-full rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
              type="submit"
              disabled={!memberId || isSubmitting}
            >
              {isSubmitting ? 'Starting chat...' : 'Start Conversation'}
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
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedId === conv.id;
              const participant = resolveConversationParticipant(conv, currentUser?.id, allUsers);
              const preview = conv.lastMessage?.content;
              const timeFormatted = conv.lastMessage?.createdAt
                ? formatMessageTimestamp(conv.lastMessage.createdAt)
                : '';

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
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
                  onClick={() => setSelectedId(undefined)}
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
                    {selectedParticipant.role && (
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
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
                          {message.content}
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
              {/* Optional Attachment Preview Pill */}
              {pendingAttachment && (
                <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-elevated border border-border text-xs text-text-primary max-w-sm shadow-xs animate-fadeIn">
                    {pendingAttachment.previewUrl ? (
                      <img
                        src={pendingAttachment.previewUrl}
                        alt="attachment preview"
                        className="w-7 h-7 rounded object-cover border border-border flex-shrink-0"
                      />
                    ) : (
                      <FileText size={16} className="text-brand-primary flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">
                        {pendingAttachment.file.name}
                      </p>
                      <p className="text-[9px] text-text-muted">
                        {(pendingAttachment.file.size / 1024).toFixed(0)} KB • Draft Attachment
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors flex-shrink-0"
                      title="Remove attachment"
                      aria-label="Remove attachment"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

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

              {/* Hidden file inputs for Attach File & Attach Media */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                aria-label="File upload input"
              />
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={handleMediaSelect}
                aria-label="Media upload input"
              />

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

                {/* Control 2: File Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors flex-shrink-0"
                  title="Attach file"
                  aria-label="Attach file"
                >
                  <Paperclip size={18} />
                </button>

                {/* Control 3: Media Attachment Button */}
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors flex-shrink-0"
                  title="Attach media"
                  aria-label="Attach media"
                >
                  <ImageIcon size={18} />
                </button>

                {/* Control 4: Auto-resizing Multiline Message Textarea */}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
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
                  disabled={!draft.trim()}
                  className="h-10 px-3.5 sm:px-4 rounded-xl bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-xs flex-shrink-0"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send size={14} />
                  <span className="hidden sm:inline">Send</span>
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
