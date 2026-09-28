"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check, CheckCheck, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Notification, PaginatedResponse } from "@/lib/types";

export default function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<Notification>>("/api/v1/notifications/notifications/");
      setNotifications(res.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: number) => {
    try {
      await api.post(`/api/v1/notifications/notifications/${id}/mark_read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to mark notification as read");
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      const unread = notifications.filter((n) => !n.is_read);
      await Promise.all(
        unread.map((n) => api.post(`/api/v1/notifications/notifications/${n.id}/mark_read/`))
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  // Group by date
  const grouped: Record<string, Notification[]> = {};
  for (const n of notifications) {
    const date = new Date(n.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(n);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Notifications</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="md" onClick={handleMarkAllRead} disabled={markingAll}>
            <CheckCheck className="h-4 w-4" />
            {markingAll ? "Marking..." : "Mark All Read"}
          </Button>
        )}
      </div>

      {Object.keys(grouped).length === 0 && (
        <div className="rounded-xl border p-12 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <Bell className="mx-auto h-10 w-10 mb-3" style={{ color: "var(--border)" }} />
          <p style={{ color: "var(--text-muted)" }}>No notifications yet</p>
        </div>
      )}

      <div className="space-y-8">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>{date}</h3>
            <div className="space-y-2">
              {items.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all"
                  style={
                    n.is_read
                      ? { borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }
                      : { borderColor: "var(--accent-muted)", backgroundColor: "rgba(74, 222, 128, 0.05)" }
                  }
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = n.is_read ? "var(--bg-card)" : "rgba(74, 222, 128, 0.05)"; }}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(88, 166, 255, 0.15)" }}>
                    <Bell className="h-4 w-4" style={{ color: "var(--info)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{n.title}</p>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{n.message}</p>
                  </div>
                  <Badge variant={n.is_read ? "neutral" : "info"}>
                    {n.notification_type}
                  </Badge>
                  <span className="shrink-0 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {new Date(n.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer"
                      style={{ color: "var(--accent)" }}
                      title="Mark as read"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
