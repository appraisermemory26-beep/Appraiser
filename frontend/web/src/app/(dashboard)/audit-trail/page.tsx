"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Loader2, Search, Calendar, Filter, Activity, Clock, TrendingUp, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { AuditLog, AuditEventCategory, PaginatedResponse } from "@/lib/types";

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const EVENT_CATEGORIES: { label: string; value: string }[] = [
  { label: "All Categories", value: "" },
  { label: "Task", value: "TASK" },
  { label: "Project", value: "PROJECT" },
  { label: "Document", value: "DOCUMENT" },
  { label: "Policy", value: "POLICY" },
  { label: "User Management", value: "USER_MANAGEMENT" },
  { label: "Authentication", value: "AUTHENTICATION" },
  { label: "Administrative", value: "ADMINISTRATIVE" },
];

const categoryBadgeVariant: Record<string, "info" | "purple" | "orange" | "success" | "warning" | "danger" | "neutral"> = {
  TASK: "info",
  PROJECT: "purple",
  DOCUMENT: "orange",
  POLICY: "success",
  USER_MANAGEMENT: "warning",
  AUTHENTICATION: "danger",
  ADMINISTRATIVE: "neutral",
};

const categoryColor: Record<string, string> = {
  TASK: "var(--info)",
  PROJECT: "var(--purple)",
  DOCUMENT: "var(--orange)",
  POLICY: "var(--accent)",
  USER_MANAGEMENT: "var(--warning)",
  AUTHENTICATION: "var(--danger)",
  ADMINISTRATIVE: "var(--text-secondary)",
};

const avatarColors = ["#58a6ff", "#bc8cff", "#4ade80", "#f0b429", "#f85149", "#d29922", "#8b949e"];

const PAGE_SIZE = 20;

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function getInitials(name: string | undefined): string {
  if (!name || name.trim() === "") return "SY";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisWeek(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}

function buildCsv(logs: AuditLog[]): string {
  const header = "ID,Event Type,Category,Description,User,Timestamp\n";
  const rows = logs.map((l) => {
    const desc = `"${l.description.replace(/"/g, '""')}"`;
    const ts = new Date(l.timestamp).toISOString();
    return `${l.id},${l.event_type},${l.event_category},${desc},${l.user ?? "System"},${ts}`;
  });
  return header + rows.join("\n");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─── Shared input styles ────────────────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--bg-primary)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
  borderRadius: "0.5rem",
  height: "2.75rem",
  padding: "0 0.75rem",
  fontSize: "0.875rem",
  outline: "none",
  transition: "border-color 0.15s",
};

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function AuditTrailPage() {
  // Filter state
  const [search, setSearch] = useState("");
  const [eventCategory, setEventCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Data state
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Build query string
  const buildUrl = useCallback(
    (offset = 0) => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (eventCategory) params.set("event_category", eventCategory);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("ordering", "-timestamp");
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      return `/api/v1/audit/audit-logs/?${params.toString()}`;
    },
    [debouncedSearch, eventCategory, dateFrom, dateTo]
  );

  // Fetch logs (initial / filter change)
  useEffect(() => {
    let cancelled = false;

    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await api.get<PaginatedResponse<AuditLog>>(buildUrl(0));
        if (!cancelled) {
          setLogs(res.results);
          setTotalCount(res.count);
          setNextUrl(res.next);
        }
      } catch {
        if (!cancelled) {
          setLogs([]);
          setTotalCount(0);
          setNextUrl(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  // Load more
  const handleLoadMore = async () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get<PaginatedResponse<AuditLog>>(nextUrl);
      setLogs((prev) => [...prev, ...res.results]);
      setTotalCount(res.count);
      setNextUrl(res.next);
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  };

  // Stats
  const eventsToday = useMemo(() => logs.filter((l) => isToday(l.timestamp)).length, [logs]);
  const eventsThisWeek = useMemo(() => logs.filter((l) => isThisWeek(l.timestamp)).length, [logs]);

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, AuditLog[]> = {};
    for (const log of logs) {
      const date = formatDate(log.timestamp);
      if (!map[date]) map[date] = [];
      map[date].push(log);
    }
    return map;
  }, [logs]);

  // Export
  const handleExport = () => {
    if (logs.length === 0) return;
    const csv = buildCsv(logs);
    const dateSuffix = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `audit-trail-${dateSuffix}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Audit Trail
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Activity log across your organization
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={handleExport} disabled={logs.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* ── Filters Row ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Filters
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
          {/* Search */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Search</label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="text"
                placeholder="Search events..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="text-sm outline-none w-full"
                style={{ ...inputStyle, paddingLeft: "2.25rem", width: "100%" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>Category</label>
            <select
              value={eventCategory}
              onChange={(e) => setEventCategory(e.target.value)}
              className="text-sm outline-none w-full"
              style={{ ...inputStyle, width: "100%", cursor: "pointer", paddingRight: "1.75rem" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              {EVENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm outline-none w-full"
              style={{ ...inputStyle, width: "100%" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>

          {/* Date To */}
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm outline-none w-full"
              style={{ ...inputStyle, width: "100%" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            />
          </div>
        </div>
      </div>

      {/* ── Stats Summary ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Total Events", value: totalCount, icon: Activity, color: "var(--accent)" },
          { label: "Events Today", value: eventsToday, icon: Clock, color: "var(--info)" },
          { label: "This Week", value: eventsThisWeek, icon: TrendingUp, color: "var(--purple)" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-4 rounded-xl border px-5 py-4"
            style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 15%, transparent)` }}
            >
              <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Loading State ───────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────────────── */}
      {!loading && logs.length === 0 && (
        <div
          className="rounded-xl border p-16 text-center"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <FileText className="mx-auto h-12 w-12 mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            No audit logs found
          </h3>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {debouncedSearch || eventCategory || dateFrom || dateTo
              ? "Try adjusting your filters to find what you are looking for."
              : "There are no audit events recorded yet."}
          </p>
        </div>
      )}

      {/* ── Event List (Grouped by Date) ────────────────────────────────────── */}
      {!loading && logs.length > 0 && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />
                <h3
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--text-muted)" }}
                >
                  {date}
                </h3>
                <span
                  className="text-xs rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--text-muted) 15%, transparent)",
                    color: "var(--text-muted)",
                  }}
                >
                  {events.length} event{events.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2">
                {events.map((e, i) => {
                  const color = categoryColor[e.event_category] || avatarColors[i % avatarColors.length];
                  const displayName = e.user_name || "System";
                  const initials = getInitials(displayName);
                  const time = formatTime(e.timestamp);

                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-4 rounded-xl border px-5 py-3.5 transition-all"
                      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
                      onMouseEnter={(el) => {
                        el.currentTarget.style.backgroundColor = "var(--bg-hover)";
                      }}
                      onMouseLeave={(el) => {
                        el.currentTarget.style.backgroundColor = "var(--bg-card)";
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                          color,
                        }}
                      >
                        {initials}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">
                          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {displayName}
                          </span>{" "}
                          <span style={{ color: "var(--text-secondary)" }}>{e.description}</span>
                        </p>
                      </div>

                      {/* Category Badge */}
                      <Badge variant={categoryBadgeVariant[e.event_category] || "neutral"}>
                        {e.event_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </Badge>

                      {/* Timestamp */}
                      <span
                        className="shrink-0 text-xs font-medium tabular-nums"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {time}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Load More ───────────────────────────────────────────────────────── */}
      {!loading && nextUrl && (
        <div className="flex justify-center pt-2 pb-4">
          <Button variant="secondary" size="md" onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>Load More ({totalCount - logs.length} remaining)</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
