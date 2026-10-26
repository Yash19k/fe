import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Plus, Send, Users } from 'lucide-react';
import { useApp } from '../../hooks/useApp';
import {
  API_BASE_URL,
  ChatConversation,
  ChatMessage,
  createChatConversationApi,
  getChatConversationsApi,
  getChatMessagesApi,
} from '../../services/api';

function websocketUrl(): string {
  const url = new URL(API_BASE_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/chat';
  return url.toString();
}

export function ChatView() {
  const { currentUser, currentCompany, allUsers, showToast } = useApp();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [memberId, setMemberId] = useState('');
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const selectedIdRef = useRef<string | undefined>(undefined);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [conversations, selectedId],
  );

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    void getChatConversationsApi()
      .then((response) => {
        if (cancelled) return;
        setConversations(response.data);
        if (response.data[0]) setSelectedId(response.data[0].id);
      })
      .catch((error: Error) => showToast(error.message, 'error'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [showToast]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setMessages([]);
    void getChatMessagesApi(selectedId)
      .then((response) => { if (!cancelled) setMessages(response.data); })
      .catch((error: Error) => showToast(error.message, 'error'));

    const socket = new WebSocket(websocketUrl());
    socketRef.current = socket;
    socket.onopen = () => socket.send(JSON.stringify({ event: 'conversation:join', conversationId: selectedId }));
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { event: string; data?: ChatMessage; message?: string };
      if (payload.event === 'message:new' && payload.data?.conversationId === selectedIdRef.current) {
        setMessages((current) => current.some((message) => message.id === payload.data?.id) ? current : [...current, payload.data!]);
      }
      if (payload.event === 'chat:error') showToast(payload.message || 'Chat error', 'error');
    };
    socket.onerror = () => showToast('Chat connection failed. Check that the backend is running.', 'error');
    return () => {
      cancelled = true;
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ event: 'conversation:leave', conversationId: selectedId }));
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [selectedId, showToast]);

  async function createConversation(event: FormEvent) {
    event.preventDefault();
    if (!currentCompany?.id || !memberId) return;
    try {
      const response = await createChatConversationApi({
        organizationId: currentCompany.id,
        type: 'DIRECT',
        memberIds: [memberId],
      });
      setConversations((current) => [response.data, ...current]);
      setSelectedId(response.data.id);
      setMemberId('');
      setShowCreate(false);
    } catch (error) {
      showToast((error as Error).message, 'error');
    }
  }

  function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedId || socketRef.current?.readyState !== WebSocket.OPEN) return;
    socketRef.current.send(JSON.stringify({ event: 'message:send', conversationId: selectedId, content }));
    setDraft('');
  }

  const displayName = (conversation: ChatConversation) =>
    conversation.otherParticipant?.fullName ||
    conversation.otherParticipant?.email ||
    conversation.name ||
    conversation.members?.find((member) => member.userId !== currentUser.id)?.user?.fullName ||
    conversation.members?.find((member) => member.userId !== currentUser.id)?.user?.email ||
    'Conversation';

  return (
    <div className="h-full min-h-[560px] flex bg-canvas">
      <aside className="w-72 border-r border-border bg-surface flex flex-col">
        <div className="p-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2"><MessageCircle size={18} /><h1 className="font-semibold">Chat</h1></div>
          <button className="p-2 rounded-lg hover:bg-surface-hover" onClick={() => setShowCreate((value) => !value)} title="New conversation"><Plus size={16} /></button>
        </div>
        {showCreate && (
          <form onSubmit={createConversation} className="p-3 border-b border-border space-y-2">
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="w-full rounded-lg border border-border bg-canvas px-2 py-2 text-sm" required>
              <option value="">Choose a teammate</option>
              {allUsers.filter((user) => user.id !== currentUser.id).map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
            </select>
            <button className="w-full rounded-lg bg-brand-primary text-white py-2 text-sm font-medium" type="submit">Create chat</button>
          </form>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? <p className="p-3 text-sm text-text-muted">Loading conversations...</p> : conversations.map((conversation) => (
            <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full text-left p-3 rounded-lg mb-1 ${selectedId === conversation.id ? 'bg-brand-subtle text-brand-text' : 'hover:bg-surface-hover'}`}>
              <p className="text-sm font-medium truncate">{displayName(conversation)}</p>
              <p className="text-xs text-text-muted">{conversation.type.toLowerCase()}</p>
            </button>
          ))}
          {!loading && conversations.length === 0 && <p className="p-3 text-sm text-text-muted">No conversations yet.</p>}
        </div>
      </aside>
      <section className="flex-1 flex flex-col">
        <header className="p-4 border-b border-border flex items-center gap-2">
          <Users size={17} className="text-text-muted" /><span className="font-semibold">{selected ? displayName(selected) : 'Select a conversation'}</span>
        </header>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.map((message) => <div key={message.id} className={`max-w-[70%] rounded-xl px-3 py-2 text-sm ${message.senderId === currentUser.id ? 'ml-auto bg-brand-primary text-white' : 'bg-surface border border-border'}`}><p>{message.content}</p><time className="text-[10px] opacity-70">{new Date(message.createdAt).toLocaleTimeString()}</time></div>)}
        </div>
        {selected && <form onSubmit={sendMessage} className="p-4 border-t border-border flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Write a message..." className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm" /><button className="rounded-lg bg-brand-primary text-white px-4" type="submit" aria-label="Send message"><Send size={16} /></button></form>}
      </section>
    </div>
  );
}
