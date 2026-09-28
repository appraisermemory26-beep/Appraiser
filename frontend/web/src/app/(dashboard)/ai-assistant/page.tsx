"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Bot, User, Sparkles, FileText, ClipboardList, ShieldCheck,
  BarChart3, Search, Plus, MessageSquare, Trash2, Pencil, Check, X,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PaginatedResponse } from "@/lib/types";
import clsx from "clsx";

const suggestions = [
  { icon: FileText, label: "Generate Job Description", desc: "Create a JD for any role", prompt: "Generate a professional Job Description for a Senior Software Engineer in the Engineering department. Include responsibilities, qualifications, and skills required." },
  { icon: ClipboardList, label: "Write Performance Review", desc: "Draft a performance evaluation", prompt: "Draft a quarterly performance review template that managers can use to evaluate their team members. Include sections for achievements, areas of improvement, and goals." },
  { icon: ShieldCheck, label: "Draft Policy Document", desc: "Generate a policy template", prompt: "Draft an Information Security Policy for the organization. Include sections on data handling, access control, incident response, and employee responsibilities." },
  { icon: BarChart3, label: "Summarize Project Status", desc: "Get an AI summary of any project", prompt: "Generate a project status summary template that includes milestones achieved, current progress, risks and issues, and next steps for the upcoming quarter." },
  { icon: Sparkles, label: "Productivity Coaching Tips", desc: "Get personalized advice", prompt: "Provide 5 productivity coaching tips for a manager who is handling multiple projects with tight deadlines. Focus on task prioritization, delegation, and time management." },
  { icon: Search, label: "Natural Language Search", desc: "Find anything with plain English", prompt: "Help me understand how to search for overdue tasks across all departments and identify patterns in delayed deliverables." },
];

interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface ThreadSummary {
  id: number;
  title: string;
  last_message_preview: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

interface ThreadDetail extends ThreadSummary {
  messages: ChatMessage[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString();
}

export default function AIAssistantPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ── Fetch threads ── */
  const fetchThreads = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<ThreadSummary>>("/api/v1/ai-tools/chat-threads/");
      setThreads(res.results || []);
    } catch {
      // silent
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  /* ── Open a thread ── */
  const openThread = useCallback(async (id: number) => {
    setActiveThreadId(id);
    setLoadingThread(true);
    try {
      const res = await api.get<ThreadDetail>(`/api/v1/ai-tools/chat-threads/${id}/`);
      setMessages(res.messages || []);
    } catch {
      toast.error("Failed to load conversation.");
      setMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }, [toast]);

  /* ── New chat ── */
  const newChat = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setInput("");
  }, []);

  /* ── Send a message ── */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;
    setInput("");
    setSending(true);

    // Optimistic user turn
    const optimistic: ChatMessage = { role: "user", content };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const result = await api.post<{
        thread_id: number;
        user_message: ChatMessage;
        assistant_message: ChatMessage;
      }>("/api/v1/ai-tools/chat/", {
        thread_id: activeThreadId ?? undefined,
        content,
      });

      // If we just created a new thread, set it active
      if (!activeThreadId) setActiveThreadId(result.thread_id);

      setMessages((prev) => {
        // Replace last optimistic user msg with real id, append assistant turn
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx].role === "user" && !next[lastIdx].id) {
          next[lastIdx] = result.user_message;
        }
        next.push(result.assistant_message);
        return next;
      });

      // Refresh thread list (sorting + new thread)
      fetchThreads();
    } catch {
      toast.error("Failed to get AI response. Please try again.");
      setMessages((prev) => prev.filter((m) => m !== optimistic));
    } finally {
      setSending(false);
    }
  }, [activeThreadId, sending, toast, fetchThreads]);

  const handleSend = () => sendMessage(input);
  const handleSuggestion = (prompt: string) => sendMessage(prompt);

  /* ── Rename ── */
  const startRename = (t: ThreadSummary) => {
    setRenamingId(t.id);
    setRenameValue(t.title);
  };
  const submitRename = async (id: number) => {
    const title = renameValue.trim();
    if (!title) {
      setRenamingId(null);
      return;
    }
    try {
      await api.patch(`/api/v1/ai-tools/chat-threads/${id}/`, { title });
      setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    } catch {
      toast.error("Failed to rename conversation.");
    } finally {
      setRenamingId(null);
    }
  };

  /* ── Delete ── */
  const deleteThread = async (id: number) => {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    try {
      await api.delete(`/api/v1/ai-tools/chat-threads/${id}/`);
      setThreads((prev) => prev.filter((t) => t.id !== id));
      if (activeThreadId === id) newChat();
    } catch {
      toast.error("Failed to delete conversation.");
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
          AI Assistant
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Powered by AI — generate JDs, draft policies, summarise projects, and more
        </p>
      </div>

      <div
        className="flex flex-1 overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        {/* ── Thread sidebar ── */}
        <div
          className="flex w-64 shrink-0 flex-col border-r"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center justify-between border-b px-3 py-3" style={{ borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              History
            </span>
            <button
              onClick={newChat}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingThreads ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
              </div>
            ) : threads.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
                No conversations yet. Start your first chat below.
              </p>
            ) : (
              threads.map((t) => {
                const isActive = activeThreadId === t.id;
                const isRenaming = renamingId === t.id;
                return (
                  <div
                    key={t.id}
                    className="group relative cursor-pointer border-l-2 px-3 py-2.5 transition-colors"
                    style={{
                      borderLeftColor: isActive ? "var(--accent)" : "transparent",
                      backgroundColor: isActive ? "rgba(74, 222, 128, 0.05)" : "transparent",
                    }}
                    onClick={() => !isRenaming && openThread(t.id)}
                    onMouseEnter={(e) => {
                      if (!isActive && !isRenaming) e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !isRenaming) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}
                      />
                      <div className="min-w-0 flex-1">
                        {isRenaming ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") submitRename(t.id);
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="h-6 flex-1 rounded border px-2 text-xs outline-none"
                              style={{
                                borderColor: "var(--border)",
                                backgroundColor: "var(--bg-input)",
                                color: "var(--text-primary)",
                              }}
                            />
                            <button
                              onClick={() => submitRename(t.id)}
                              className="cursor-pointer"
                              style={{ color: "var(--accent)" }}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              className="cursor-pointer"
                              style={{ color: "var(--text-muted)" }}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <p
                              className="truncate text-xs font-semibold"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {t.title || `Conversation #${t.id}`}
                            </p>
                            {t.last_message_preview && (
                              <p
                                className="mt-0.5 truncate text-[10px]"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {t.last_message_preview}
                              </p>
                            )}
                            <p
                              className="mt-0.5 text-[10px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {t.message_count} message{t.message_count !== 1 ? "s" : ""} · {relativeTime(t.updated_at)}
                            </p>
                          </>
                        )}
                      </div>
                      {!isRenaming && (
                        <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(t);
                            }}
                            className="cursor-pointer"
                            style={{ color: "var(--text-muted)" }}
                            title="Rename"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteThread(t.id);
                            }}
                            className="cursor-pointer"
                            style={{ color: "var(--danger)" }}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat panel ── */}
        <div className="flex flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Welcome / suggestions when no active thread */}
            {!activeThreadId && messages.length === 0 && (
              <>
                <div className="flex gap-3 justify-start">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: "var(--accent-muted)" }}
                  >
                    <Bot className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  </div>
                  <div
                    className="max-w-[70%] rounded-xl px-4 py-3 text-sm leading-relaxed border"
                    style={{
                      backgroundColor: "var(--bg-primary)",
                      borderColor: "var(--border)",
                      color: "var(--text-primary)",
                    }}
                  >
                    Hello{user ? `, ${user.first_name}` : ""}! I&apos;m your{" "}
                    <strong style={{ color: "var(--accent)" }}>Appraiser AI Assistant</strong>.
                    Pick a suggestion below or ask anything.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-6">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => handleSuggestion(s.prompt)}
                      className="flex items-start gap-3 rounded-xl border p-4 text-left transition-all cursor-pointer group"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--accent-muted)";
                        e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.backgroundColor = "var(--bg-primary)";
                      }}
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "var(--accent-muted)" }}
                      >
                        <s.icon className="h-5 w-5" style={{ color: "var(--accent)" }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {s.label}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {s.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {loadingThread && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            )}

            {!loadingThread &&
              messages.map((m, i) => (
                <div
                  key={m.id ?? `${m.role}-${i}`}
                  className={clsx("flex gap-3", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  {m.role === "assistant" && (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--accent-muted)" }}
                    >
                      <Bot className="h-4 w-4" style={{ color: "var(--accent)" }} />
                    </div>
                  )}
                  <div
                    className="max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed"
                    style={
                      m.role === "user"
                        ? { backgroundColor: "var(--accent-muted)", color: "var(--text-primary)" }
                        : {
                            backgroundColor: "var(--bg-primary)",
                            borderWidth: "1px",
                            borderStyle: "solid",
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                          }
                    }
                  >
                    {m.role === "assistant" ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    )}
                    {m.role === "assistant" && (
                      <p
                        className="mt-2 text-[10px] uppercase tracking-widest"
                        style={{ color: "var(--text-muted)" }}
                      >
                        AI-Generated Draft
                      </p>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "rgba(88, 166, 255, 0.15)" }}
                    >
                      <User className="h-4 w-4" style={{ color: "var(--info)" }} />
                    </div>
                  )}
                </div>
              ))}

            {sending && (
              <div className="flex gap-3 justify-start">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "var(--accent-muted)" }}
                >
                  <Bot className="h-4 w-4 animate-pulse" style={{ color: "var(--accent)" }} />
                </div>
                <div
                  className="rounded-xl px-4 py-3 border text-sm"
                  style={{
                    backgroundColor: "var(--bg-primary)",
                    borderColor: "var(--border)",
                    color: "var(--text-muted)",
                  }}
                >
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: "0ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "150ms" }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: "300ms" }}>●</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-4" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask the AI assistant anything..."
                disabled={sending}
                className="h-11 flex-1 rounded-lg border px-4 text-sm outline-none transition-colors disabled:opacity-50"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: "var(--bg-input)",
                  color: "var(--text-primary)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="flex h-11 w-11 items-center justify-center rounded-lg transition-all cursor-pointer disabled:opacity-50"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-on)",
                  boxShadow: "var(--shadow)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
              All AI outputs are clearly labelled as AI-generated drafts requiring human review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
