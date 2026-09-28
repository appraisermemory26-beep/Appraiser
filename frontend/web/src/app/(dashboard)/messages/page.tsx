"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Search, Plus, Loader2, Megaphone, MessageSquare, Users, ListTodo, Pencil, Check, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { useMessagingWs, type WsEvent } from "@/lib/use-messaging-ws";
import { canEditMessage } from "@/lib/message-edit";
import type { Conversation, Message, User, PaginatedResponse } from "@/lib/types";
import clsx from "clsx";

/* ── Constants ─────────────────────────────────────────────────────────────── */

const MANAGER_ROLES = ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "ADMIN"];


const TYPE_LABELS: Record<string, string> = {
  TASK_THREAD: "Task Thread",
  DIRECT: "Direct",
  GROUP: "Group",
};

const TYPE_ICONS: Record<string, typeof MessageSquare> = {
  TASK_THREAD: ListTodo,
  DIRECT: MessageSquare,
  GROUP: Users,
};

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function participantNames(convo: Conversation, selfId: number | undefined): string {
  if (!convo.participants_detail || convo.participants_detail.length === 0) {
    if (convo.conversation_type === "TASK_THREAD") return `Task #${convo.task}`;
    return `Conversation #${convo.id}`;
  }
  const others = convo.participants_detail.filter((p) => p.id !== selfId);
  if (others.length === 0) return "You";
  if (others.length <= 2) return others.map((p) => p.name).join(", ");
  return `${others[0].name}, ${others[1].name} +${others.length - 2}`;
}

/** Merge a server message, replacing a matching optimistic placeholder if present. */
function upsertMessage(prev: Message[], incoming: Message): Message[] {
  const existingIdx = prev.findIndex((m) => m.id === incoming.id);
  if (existingIdx >= 0) {
    const existing = prev[existingIdx];
    const merged = { ...existing, ...incoming };
    // Prefer a definitive true from either payload (e.g. REST before WS).
    if (existing.is_editable === true || incoming.is_editable === true) {
      merged.is_editable = true;
    } else if (incoming.is_editable == null && existing.is_editable != null) {
      merged.is_editable = existing.is_editable;
    }
    if (
      merged.id === existing.id &&
      merged.content === existing.content &&
      merged.is_editable === existing.is_editable &&
      merged.updated_at === existing.updated_at
    ) {
      return prev;
    }
    const next = [...prev];
    next[existingIdx] = merged;
    return next;
  }

  const optimisticIdx = prev.findIndex(
    (m) =>
      m.id < 0 &&
      m.sender === incoming.sender &&
      m.conversation === incoming.conversation &&
      m.content === incoming.content
  );
  if (optimisticIdx >= 0) {
    const next = [...prev];
    next[optimisticIdx] = incoming;
    return next;
  }

  return [...prev, incoming];
}

function replaceMessage(prev: Message[], updated: Message): Message[] {
  const idx = prev.findIndex((m) => m.id === updated.id);
  if (idx < 0) return prev;
  const next = [...prev];
  next[idx] = updated;
  return next;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function MessagesPage() {
  const toast = useToast();
  const { user } = useAuth();

  /* ── State ── */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [convoSearch, setConvoSearch] = useState("");
  const [msgSearch, setMsgSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Message[] | null>(null);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  // New DM modal
  const [dmModalOpen, setDmModalOpen] = useState(false);
  const [dmRecipient, setDmRecipient] = useState("");
  const [dmContent, setDmContent] = useState("");
  const [dmSending, setDmSending] = useState(false);

  // Broadcast modal
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastContent, setBroadcastContent] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);

  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [, setEditTick] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number | null>(null);

  // Keep activeRef in sync for WS event handlers
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  /* Re-evaluate edit button availability as the 2-hour window expires */
  useEffect(() => {
    const timer = window.setInterval(() => setEditTick((t) => t + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  /* ── Fetch conversations ── */
  const fetchConversations = useCallback(async (silent = false) => {
    try {
      const res = await api.get<PaginatedResponse<Conversation>>("/api/v1/messaging/conversations/");
      setConversations(res.results);
      if (!silent && res.results.length > 0 && !activeRef.current) {
        setActive(res.results[0].id);
      }
    } catch {
      // silently fail on polls
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /* ── Fetch unread count ── */
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ unread_count: number }>("/api/v1/messaging/conversations/unread-count/");
      setTotalUnread(res.unread_count);
    } catch {
      // silently fail
    }
  }, []);

  /* ── Fetch users (for new DM modal) ── */
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await api.get<PaginatedResponse<User>>("/api/v1/accounts/users/");
        setUsers(res.results);
      } catch {
        // silently fail
      }
    }
    fetchUsers();
  }, []);

  /* ── Initial load ── */
  useEffect(() => {
    fetchConversations();
    fetchUnreadCount();
  }, [fetchConversations, fetchUnreadCount]);

  /* ── Fetch messages for active conversation ── */
  const fetchMessages = useCallback(async (conversationId: number, silent = false) => {
    if (!silent) setMsgLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Message>>(`/api/v1/messaging/messages/?conversation=${conversationId}`);
      setMessages(res.results);
    } catch {
      // silently fail
    } finally {
      if (!silent) setMsgLoading(false);
    }
  }, []);

  /* ── WebSocket: live updates for new messages and conversations ── */
  const handleWsEvent = useCallback((evt: WsEvent) => {
    if (evt.type === "message_new") {
      const m = evt.message as unknown as Message;
      const currentActive = activeRef.current;
      if (m.conversation === currentActive) {
        setMessages((prev) => upsertMessage(prev, m));
        if (m.sender !== user?.id) {
          api.post("/api/v1/messaging/messages/mark-conversation-read/", {
            conversation_id: m.conversation,
          }).catch(() => { /* ignore */ });
        }
      }
      // Update conversation list (last message + unread count)
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === m.conversation);
        if (!exists) return prev;
        return prev
          .map((c) =>
            c.id === m.conversation
              ? {
                  ...c,
                  updated_at: m.created_at,
                  last_message: {
                    content: m.content.slice(0, 100),
                    sender_name: m.sender_name,
                    created_at: m.created_at,
                  },
                  unread_count:
                    m.sender !== user?.id && c.id !== currentActive
                      ? (c.unread_count || 0) + 1
                      : c.unread_count,
                }
              : c
          )
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      });
      if (m.sender !== user?.id && m.conversation !== currentActive) {
        setTotalUnread((n) => n + 1);
      }
    } else if (evt.type === "message_updated") {
      const m = evt.message as unknown as Message;
      const currentActive = activeRef.current;
      if (m.conversation === currentActive) {
        setMessages((prev) => replaceMessage(prev, m));
        setEditingMessageId((id) => {
          if (id === m.id) setEditDraft("");
          return id === m.id ? null : id;
        });
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === m.conversation && c.last_message
            ? {
                ...c,
                last_message: {
                  ...c.last_message,
                  content: m.content.slice(0, 100),
                  sender_name: m.sender_name,
                },
              }
            : c
        )
      );
    } else if (evt.type === "conversation_new") {
      const c = evt.conversation as unknown as Conversation;
      setConversations((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
    }
  }, [user?.id]);

  const { subscribe: wsSubscribe } = useMessagingWs(handleWsEvent);

  /* ── Mark conversation as read ── */
  const markConversationRead = useCallback(async (conversationId: number) => {
    try {
      await api.post("/api/v1/messaging/messages/mark-conversation-read/", { conversation_id: conversationId });
      fetchUnreadCount();
      // Update unread_count locally
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
      );
    } catch {
      // silently fail
    }
  }, [fetchUnreadCount]);

  /* ── When active conversation changes ── */
  useEffect(() => {
    if (active) {
      fetchMessages(active);
      markConversationRead(active);
      wsSubscribe(active);
      setSearchResults(null);
      setMsgSearch("");
    }
  }, [active, fetchMessages, markConversationRead, wsSubscribe]);

  /* ── Auto-scroll to bottom ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Edit message (2-hour window) ── */
  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditDraft(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditDraft("");
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editDraft.trim()) return;
    setEditSaving(true);
    try {
      const updated = await api.patch<Message>(`/api/v1/messaging/messages/${editingMessageId}/`, {
        content: editDraft.trim(),
      });
      setMessages((prev) => replaceMessage(prev, updated));
      setEditingMessageId(null);
      setEditDraft("");
      toast.success("Message updated");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to edit message");
    } finally {
      setEditSaving(false);
    }
  };

  /* ── Send message ── */
  const handleSend = async () => {
    if (!input.trim() || !active) return;
    const content = input.trim();
    setSending(true);

    // Optimistic update
    const optimisticMsg: Message = {
      id: -Date.now(),
      conversation: active,
      sender: user?.id ?? 0,
      sender_name: user ? `${user.first_name} ${user.last_name}` : "You",
      content,
      is_read: true,
      organisation: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput("");

    try {
      const created = await api.post<Message>("/api/v1/messaging/messages/", {
        conversation: active,
        content,
      });
      setMessages((prev) => upsertMessage(prev, created));
      // Live updates also arrive via WebSocket; upsertMessage dedupes both paths.
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to send message");
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  /* ── New Direct Message ── */
  const handleSendDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmRecipient || !dmContent.trim()) return;
    setDmSending(true);
    try {
      const res = await api.post<Conversation>("/api/v1/messaging/direct/", {
        recipient_id: Number(dmRecipient),
        content: dmContent.trim(),
      });
      toast.success("Message sent");
      setDmModalOpen(false);
      setDmRecipient("");
      setDmContent("");
      await fetchConversations();
      setActive(res.id);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to send direct message");
    } finally {
      setDmSending(false);
    }
  };

  /* ── Broadcast ── */
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastContent.trim()) return;
    setBroadcastSending(true);
    try {
      await api.post("/api/v1/messaging/broadcast/", {
        content: broadcastContent.trim(),
      });
      toast.success("Broadcast sent");
      setBroadcastModalOpen(false);
      setBroadcastContent("");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to send broadcast");
    } finally {
      setBroadcastSending(false);
    }
  };

  /* ── Message search ── */
  const handleMessageSearch = useCallback(async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchingMessages(true);
    try {
      const res = await api.get<PaginatedResponse<Message>>(
        `/api/v1/messaging/messages/?search=${encodeURIComponent(keyword.trim())}`
      );
      setSearchResults(res.results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchingMessages(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      handleMessageSearch(msgSearch);
    }, 400);
    return () => clearTimeout(timeout);
  }, [msgSearch, handleMessageSearch]);

  /* ── Derived ── */
  const isManager = user?.role && MANAGER_ROLES.includes(user.role);

  const filteredConversations = convoSearch.trim()
    ? conversations.filter((c) => {
        const search = convoSearch.toLowerCase();
        return (
          c.participants_detail?.some((p) => p.name.toLowerCase().includes(search)) ||
          participantNames(c, user?.id).toLowerCase().includes(search)
        );
      })
    : conversations;

  const activeConvo = conversations.find((c) => c.id === active);

  const displayMessages = searchResults !== null ? searchResults : messages;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Messages
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Team conversations
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isManager && (
            <Button variant="secondary" size="md" onClick={() => setBroadcastModalOpen(true)}>
              <Megaphone className="h-4 w-4" />
              Broadcast
            </Button>
          )}
          <Button size="md" onClick={() => setDmModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Message
          </Button>
        </div>
      </div>

      {/* ── Immutability notice ── */}
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ backgroundColor: "var(--accent-muted)", border: "1px solid var(--border)" }}
      >
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          All messages are stored as permanent institutional records — messages cannot be edited or deleted and are part of the audit trail
        </span>
      </div>

      {/* ── Main layout ── */}
      <div
        className="flex h-[calc(100vh-14rem)] overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {/* ── Left panel: Conversation list ── */}
        <div className="w-80 shrink-0 border-r flex flex-col" style={{ borderColor: "var(--border)" }}>
          {/* Conversation list header */}
          <div className="border-b px-4 py-3 flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Conversations
            </span>
          </div>

          {/* Search conversations */}
          <div className="border-b p-3" style={{ borderColor: "var(--border)" }}>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                placeholder="Search by name..."
                value={convoSearch}
                onChange={(e) => setConvoSearch(e.target.value)}
                className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none transition-colors"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
            </div>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                {convoSearch ? "No matching conversations" : "No conversations yet"}
              </div>
            )}
            {filteredConversations.map((c) => {
              const Icon = TYPE_ICONS[c.conversation_type] || MessageSquare;
              const names = participantNames(c, user?.id);
              const lastMsg = c.last_message;
              const timeStr = lastMsg ? relativeTime(lastMsg.created_at) : relativeTime(c.updated_at);
              const isActive = active === c.id;

              return (
                <button
                  key={c.id}
                  onClick={() => setActive(c.id)}
                  className={clsx(
                    "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer border-l-2"
                  )}
                  style={
                    isActive
                      ? { backgroundColor: "rgba(74, 222, 128, 0.05)", borderLeftColor: "var(--accent)" }
                      : { borderLeftColor: "transparent" }
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Icon */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--bg-primary)" }}
                  >
                    <Icon className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={clsx("text-sm truncate", c.unread_count > 0 ? "font-bold" : "font-medium")}
                        style={{ color: "var(--text-primary)" }}
                      >
                        {names}
                      </span>
                      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {timeStr}
                      </span>
                    </div>

                    {/* Type badge */}
                    <span
                      className="inline-block mt-0.5 text-[10px] font-medium rounded px-1.5 py-0.5"
                      style={{
                        backgroundColor: "var(--bg-primary)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {TYPE_LABELS[c.conversation_type] || c.conversation_type}
                    </span>

                    {/* Last message preview */}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p className="truncate text-xs" style={{ color: "var(--text-secondary)" }}>
                        {lastMsg
                          ? `${lastMsg.sender_name}: ${lastMsg.content}`
                          : "No messages yet"}
                      </p>
                      {c.unread_count > 0 && (
                        <span
                          className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                          style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
                        >
                          {c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right panel: Message thread ── */}
        <div className="flex flex-1 flex-col">
          {/* Thread header */}
          <div
            className="flex items-center justify-between gap-3 border-b px-5 py-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {activeConvo ? (
                <>
                  <span className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {participantNames(activeConvo, user?.id)}
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-medium rounded px-1.5 py-0.5"
                    style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-secondary)" }}
                  >
                    {TYPE_LABELS[activeConvo.conversation_type] || activeConvo.conversation_type}
                  </span>
                </>
              ) : (
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Select a conversation
                </span>
              )}
            </div>

            {/* Message search */}
            <div className="relative w-56 shrink-0">
              <Search
                className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                placeholder="Search messages..."
                value={msgSearch}
                onChange={(e) => setMsgSearch(e.target.value)}
                className="h-9 w-full rounded-lg border pl-8 pr-3 text-xs outline-none transition-colors"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
              {searchingMessages && (
                <Loader2
                  className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin"
                  style={{ color: "var(--text-muted)" }}
                />
              )}
            </div>
          </div>

          {/* Search results banner */}
          {searchResults !== null && (
            <div
              className="flex items-center justify-between px-5 py-2 text-xs"
              style={{ backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              <span>
                {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &quot;{msgSearch}&quot;
              </span>
              <button
                onClick={() => {
                  setMsgSearch("");
                  setSearchResults(null);
                }}
                className="underline cursor-pointer"
                style={{ color: "var(--accent)" }}
              >
                Clear search
              </button>
            </div>
          )}

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!active && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <MessageSquare className="h-12 w-12" style={{ color: "var(--text-muted)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Select a conversation or start a new message
                </p>
              </div>
            )}
            {active && msgLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            )}
            {active && !msgLoading && displayMessages.length === 0 && (
              <div className="text-center py-12 text-sm" style={{ color: "var(--text-muted)" }}>
                {searchResults !== null
                  ? "No messages found matching your search."
                  : "No messages yet. Start the conversation!"}
              </div>
            )}
            {active &&
              !msgLoading &&
              displayMessages.map((m) => {
                const isMe = m.sender === user?.id;
                const isEditing = editingMessageId === m.id;
                const editable = isMe && canEditMessage(m, user?.id);
                return (
                  <div key={m.id} className={clsx("flex", isMe ? "justify-end" : "justify-start")}>
                    <div
                      className="max-w-[70%] rounded-xl px-4 py-3"
                      style={
                        isMe
                          ? {
                              backgroundColor: "var(--accent-muted)",
                              color: "var(--text-primary)",
                            }
                          : {
                              backgroundColor: "var(--bg-primary)",
                              borderWidth: "1px",
                              borderStyle: "solid",
                              borderColor: "var(--border)",
                              color: "var(--text-primary)",
                            }
                      }
                    >
                      {!isMe && (
                        <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                          {m.sender_name}
                        </p>
                      )}
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y"
                            style={{
                              backgroundColor: "var(--bg-input)",
                              borderColor: "var(--border)",
                              color: "var(--text-primary)",
                            }}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              disabled={editSaving}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium cursor-pointer disabled:opacity-50"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSaveEdit()}
                              disabled={editSaving || !editDraft.trim()}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold cursor-pointer disabled:opacity-50"
                              style={{ color: "var(--accent)" }}
                            >
                              {editSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {new Date(m.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {m.edited && <span className="ml-1.5 italic">(edited)</span>}
                          {searchResults !== null && (
                            <button
                              className="ml-2 underline cursor-pointer"
                              style={{ color: "var(--accent)" }}
                              onClick={() => {
                                setActive(m.conversation);
                                setMsgSearch("");
                                setSearchResults(null);
                              }}
                            >
                              Go to conversation
                            </button>
                          )}
                        </p>
                        {isMe && !isEditing && (
                          <button
                            type="button"
                            onClick={() => editable && handleStartEdit(m)}
                            disabled={!editable}
                            title={
                              editable
                                ? "Edit message (available for 2 hours after sending)"
                                : "Edit window expired (2 hours after sending)"
                            }
                            className={clsx(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-opacity",
                              editable ? "cursor-pointer opacity-80 hover:opacity-100" : "cursor-not-allowed opacity-40"
                            )}
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder={active ? "Type a message..." : "Select a conversation first"}
                disabled={!active}
                className="h-11 flex-1 rounded-lg border px-4 text-sm outline-none transition-colors disabled:opacity-50"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !active || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-lg transition-all cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-on)",
                  boxShadow: "var(--shadow)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--accent-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--accent)";
                }}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── New Direct Message Modal ── */}
      <Modal isOpen={dmModalOpen} onClose={() => setDmModalOpen(false)} title="New Direct Message">
        <form onSubmit={handleSendDM} className="space-y-4">
          <FormSelect
            label="Send to"
            name="recipient"
            required
            value={dmRecipient}
            onChange={(e) => setDmRecipient(e.target.value)}
            placeholder="Select user..."
            options={users
              .filter((u) => u.id !== user?.id)
              .map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name}` }))}
          />
          <FormTextarea
            label="Message"
            name="dm_content"
            required
            value={dmContent}
            onChange={(e) => setDmContent(e.target.value)}
            placeholder="Write your message..."
            rows={4}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setDmModalOpen(false);
                setDmRecipient("");
                setDmContent("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={dmSending || !dmRecipient || !dmContent.trim()}>
              {dmSending ? "Sending..." : "Send Message"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Broadcast Modal ── */}
      <Modal isOpen={broadcastModalOpen} onClose={() => setBroadcastModalOpen(false)} title="Broadcast Message">
        <form onSubmit={handleBroadcast} className="space-y-4">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            This message will be sent to all members in your organisation.
          </p>
          <FormTextarea
            label="Message"
            name="broadcast_content"
            required
            value={broadcastContent}
            onChange={(e) => setBroadcastContent(e.target.value)}
            placeholder="Write your broadcast message..."
            rows={5}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setBroadcastModalOpen(false);
                setBroadcastContent("");
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={broadcastSending || !broadcastContent.trim()}>
              {broadcastSending ? "Sending..." : "Send Broadcast"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
