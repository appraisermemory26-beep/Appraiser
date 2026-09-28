"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Bell, Check } from "lucide-react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { api, mediaUrl, formatFullName, userInitials } from "@/lib/api";
import type { Notification, PaginatedResponse } from "@/lib/types";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/tasks": "Tasks",
  "/submissions": "Submissions",
  "/projects": "Projects",
  "/team": "Team",
  "/departments": "Departments",
  "/job-descriptions": "Job Descriptions",
  "/policies": "Policy Vault",
  "/pmcs": "PMCS",
  "/accountability": "PMCS",
  "/project-documents": "Project Documents",
  "/ai-assistant": "AI Assistant",
  "/audit-trail": "Audit Trail",
  "/billing": "Billing",
  "/settings": "Settings",
  "/messages": "Messages",
  "/notifications": "Notifications",
};

export function Header() {
  const pathname = usePathname();
  const title = pageTitles[pathname] || "Dashboard";
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchNotifications() {
      try {
        const data = await api.get<PaginatedResponse<Notification>>("/api/v1/notifications/notifications/");
        if (!cancelled) {
          setNotifications(data.results.slice(0, 10));
          setUnreadCount(data.results.filter((n) => !n.is_read).length);
        }
      } catch { /* non-critical */ }
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function markAsRead(id: number) {
    try {
      await api.patch<Notification>(`/api/v1/notifications/notifications/${id}/`, { is_read: true });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* */ }
  }

  async function markAllRead() {
    try {
      await api.post("/api/v1/notifications/notifications/mark_all_read/");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* */ }
  }

  const displayName = formatFullName(user) || "User";
  const displayEmail = user?.email ?? "";
  const initials = user ? userInitials(user) : "U";
  const avatarSrc = mediaUrl(user?.avatar);

  return (
    <header
      className="relative z-50 flex h-14 shrink-0 items-center justify-between px-6"
      style={{ backgroundColor: "var(--bg-primary)", borderBottom: "1px solid var(--border)" }}
    >
      <div>
        <h1 className="text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer"
          style={{ color: "var(--text-secondary)" }}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Notifications */}
        <div className="relative z-[9999]" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "var(--danger)" }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div
              className="absolute right-0 top-11 z-[9999] w-80 rounded-xl shadow-2xl"
              style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs font-medium cursor-pointer" style={{ color: "var(--accent)" }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No notifications</div>
                ) : (
                  notifications.map((n) => {
                    const isExpanded = expandedId === n.id;
                    return (
                      <div
                        key={n.id}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors"
                        style={{ backgroundColor: !n.is_read ? "var(--accent-muted)" : "transparent" }}
                      >
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => !n.is_read && markAsRead(n.id)}
                            className="block w-full text-left cursor-pointer"
                          >
                            <p className="text-sm leading-tight" style={{ color: n.is_read ? "var(--text-secondary)" : "var(--text-primary)", fontWeight: n.is_read ? 400 : 500 }}>
                              {n.title}
                            </p>
                            <p
                              className={`mt-0.5 text-xs ${isExpanded ? "whitespace-pre-wrap break-words" : "truncate"}`}
                              style={{ color: "var(--text-muted)" }}
                            >
                              {n.message}
                            </p>
                          </button>
                          {isExpanded && (
                            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                              {new Date(n.created_at).toLocaleString()}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : n.id)}
                            className="mt-1 text-[11px] font-medium cursor-pointer"
                            style={{ color: "var(--accent)" }}
                          >
                            {isExpanded ? "Show less" : "View full"}
                          </button>
                        </div>
                        {!n.is_read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--accent)" }} />}
                        {n.is_read && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User info */}
        <div className="ml-3 flex items-center gap-3 pl-4" style={{ borderLeft: "1px solid var(--border)" }}>
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarSrc}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover"
              style={{ border: "1px solid var(--border)" }}
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}>
              {initials}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none" style={{ color: "var(--text-primary)" }}>{displayName}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{displayEmail}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
