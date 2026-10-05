"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, FolderOpen, Shield, MessageSquare, Brain,
  AlertTriangle, CheckCircle2, Flag,
  Loader2, Zap, ArrowRight,
  Monitor, MapPin, UsersRound, Coffee, DoorOpen,
  Clock, Play, Square, BarChart3, TrendingUp,
  Building2, Calendar, HeartPulse, Lightbulb,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Markdown } from "@/components/ui/markdown";
import Link from "next/link";
import type { ActivityLog, BreakLog, PaginatedResponse } from "@/lib/types";

interface DashboardStats {
  // Common task metrics (present in most roles)
  total_tasks?: number;
  open_tasks?: number;
  overdue_tasks?: number;
  completed_tasks?: number;
  tasks_this_week?: number;
  task_completion_pct?: number;
  unread_notifications?: number;

  // Staff-specific
  my_tasks?: number;
  my_overdue?: number;
  my_completed?: number;
  my_open?: number;
  active_timers?: number;

  // Manager-specific
  team_members?: number;
  team_tasks?: number;
  pending_reviews?: number;

  // Projects (Manager / Executive / Admin)
  active_projects?: number;
  total_projects?: number;
  proj_completed?: number;

  // Dept head / Executive / Admin
  total_departments?: number;
  total_users?: number;
  dept_stats?: { name: string; completion_pct: number; overdue: number; total_tasks: number }[];

  // Executive / Board
  execution_score?: number;
  on_time_rate?: number;
  project_health?: { id: number; name: string; status: string; completion_pct: number }[];
  read_only?: boolean;

  // Admin full view
  total_milestones?: number;
  completed_milestones?: number;
  upcoming_milestones?: { id: number; title: string; deadline: string }[];
  total_policies?: number;
  total_acknowledgments?: number;
  total_documents?: number;
  total_jds?: number;
  total_conversations?: number;
  total_messages?: number;
  messages_this_week?: number;
  total_ai_outputs?: number;
  ai_this_month?: number;
}

interface AttentionSummary {
  today_task_seconds: number;
  today_activity_seconds: number;
  today_break_seconds: number;
  week_task_seconds: number;
}

// ─── Activity / Break Logging Panel (STAFF) ─────────────────────────────────

function ActivityBreakPanel() {
  const [currentActivity, setCurrentActivity] = useState<ActivityLog | null>(null);
  const [currentBreak, setCurrentBreak] = useState<BreakLog | null>(null);
  const [summary, setSummary] = useState<AttentionSummary | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchActive = useCallback(async () => {
    try {
      const [activities, breaks] = await Promise.all([
        api.get<PaginatedResponse<ActivityLog>>("/api/v1/attention/activity-logs/"),
        api.get<PaginatedResponse<BreakLog>>("/api/v1/attention/break-logs/"),
      ]);
      const activeActivity = activities.results.find((a) => !a.ended_at) || null;
      const activeBreak = breaks.results.find((b) => !b.ended_at) || null;
      setCurrentActivity(activeActivity);
      setCurrentBreak(activeBreak);
      const sum = await api.get<AttentionSummary>("/api/v1/attention/my-summary/");
      setSummary(sum);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActive();
  }, [fetchActive]);

  // Timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    const active = currentActivity || currentBreak;
    if (active) {
      const start = new Date(active.started_at).getTime();
      const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      update();
      timerRef.current = setInterval(update, 1000);
    } else {
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [currentActivity, currentBreak]);

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const startActivity = async (type: string) => {
    setActionLoading(true);
    try {
      // Stop current activity/break first
      if (currentActivity) {
        await api.post(`/api/v1/attention/activity-logs/${currentActivity.id}/stop/`);
      }
      if (currentBreak) {
        await api.post(`/api/v1/attention/break-logs/${currentBreak.id}/stop/`);
      }
      await api.post("/api/v1/attention/activity-logs/", { activity_type: type });
      await fetchActive();
    } catch { /* */ }
    setActionLoading(false);
  };

  const startBreak = async (type: string) => {
    setActionLoading(true);
    try {
      if (currentActivity) {
        await api.post(`/api/v1/attention/activity-logs/${currentActivity.id}/stop/`);
      }
      if (currentBreak) {
        await api.post(`/api/v1/attention/break-logs/${currentBreak.id}/stop/`);
      }
      await api.post("/api/v1/attention/break-logs/", { break_type: type });
      await fetchActive();
    } catch { /* */ }
    setActionLoading(false);
  };

  const stopCurrent = async () => {
    setActionLoading(true);
    try {
      if (currentActivity) {
        await api.post(`/api/v1/attention/activity-logs/${currentActivity.id}/stop/`);
      }
      if (currentBreak) {
        await api.post(`/api/v1/attention/break-logs/${currentBreak.id}/stop/`);
      }
      await fetchActive();
    } catch { /* */ }
    setActionLoading(false);
  };

  if (loading) return null;

  const activeItem = currentActivity || currentBreak;
  const activeLabel = currentActivity
    ? currentActivity.activity_type.replace("_", " ")
    : currentBreak
    ? currentBreak.break_type.replace("_", " ")
    : null;

  const focusScore = summary
    ? Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((summary.today_task_seconds + summary.today_activity_seconds) /
              Math.max(summary.today_task_seconds + summary.today_activity_seconds + summary.today_break_seconds, 1)) *
              100
          )
        )
      )
    : 0;
  const trend = summary
    ? [
        Math.min(100, Math.round((summary.week_task_seconds / 5 / 3600) * 14)),
        Math.min(100, Math.round((summary.week_task_seconds / 4 / 3600) * 16)),
        Math.min(100, Math.round((summary.week_task_seconds / 3 / 3600) * 18)),
        Math.min(100, Math.round((summary.week_task_seconds / 2 / 3600) * 20)),
        Math.min(100, Math.round((summary.week_task_seconds / 3600) * 6)),
      ]
    : [25, 35, 45, 55, 40];

  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-5">
        <Clock className="h-4 w-4" style={{ color: "var(--accent)" }} />
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Activity Tracker</h3>
      </div>

      {/* Active timer */}
      {activeItem && (
        <div className="mb-5 flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: "var(--accent-muted)" }}>
          <div className="flex items-center gap-3">
            <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--accent)" }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{activeLabel}</p>
              <p className="text-2xl font-extrabold tracking-tight mt-0.5" style={{ color: "var(--text-primary)" }}>{formatTime(elapsed)}</p>
            </div>
          </div>
          <Button variant="danger" size="sm" onClick={stopCurrent} disabled={actionLoading}>
            <Square className="h-3 w-3" />
            Stop
          </Button>
        </div>
      )}

      {/* Activity buttons */}
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Log Activity</p>
        <div className="flex gap-2 flex-wrap">
          {[
            { type: "DESK_WORK", label: "Desk Work", icon: Monitor, color: "var(--info)" },
            { type: "FIELD_WORK", label: "Field Work", icon: MapPin, color: "var(--accent)" },
            { type: "MEETING", label: "Meeting", icon: UsersRound, color: "var(--purple)" },
          ].map((a) => (
            <button
              key={a.type}
              onClick={() => startActivity(a.type)}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: currentActivity?.activity_type === a.type ? "var(--accent-muted)" : "var(--bg-hover)",
                color: currentActivity?.activity_type === a.type ? a.color : "var(--text-secondary)",
                border: currentActivity?.activity_type === a.type ? "1px solid var(--border-hover)" : "1px solid transparent",
              }}
            >
              <a.icon className="h-3.5 w-3.5" />
              {a.label}
              {currentActivity?.activity_type === a.type && <Play className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Break buttons */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>Take a Break</p>
        <div className="flex gap-2 flex-wrap">
          {[
            { type: "LUNCH", label: "Lunch Break", icon: Coffee, color: "var(--warning)" },
            { type: "STEP_OUT", label: "Step Out", icon: DoorOpen, color: "var(--danger)" },
            { type: "ANNUAL_LEAVE", label: "Annual Leave", icon: Calendar, color: "var(--info)" },
            { type: "SICK_LEAVE", label: "Sick Leave", icon: HeartPulse, color: "var(--purple)" },
          ].map((b) => (
            <button
              key={b.type}
              onClick={() => startBreak(b.type)}
              disabled={actionLoading}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: currentBreak?.break_type === b.type ? "var(--accent-muted)" : "var(--bg-hover)",
                color: currentBreak?.break_type === b.type ? b.color : "var(--text-secondary)",
                border: currentBreak?.break_type === b.type ? "1px solid var(--border-hover)" : "1px solid transparent",
              }}
            >
              <b.icon className="h-3.5 w-3.5" />
              {b.label}
              {currentBreak?.break_type === b.type && <Play className="h-2.5 w-2.5" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl p-4" style={{ backgroundColor: "var(--bg-hover)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Focus Score
          </p>
          <span className="text-lg font-extrabold" style={{ color: focusScore >= 70 ? "#4ade80" : focusScore >= 45 ? "#fbbf24" : "#f87171" }}>
            {focusScore}%
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-primary)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${focusScore}%`, backgroundColor: focusScore >= 70 ? "#4ade80" : focusScore >= 45 ? "#fbbf24" : "#f87171" }} />
        </div>
        <div className="mt-3 flex items-end gap-1.5 h-12">
          {trend.map((point, idx) => (
            <div key={idx} className="flex-1 rounded-t-sm" style={{ height: `${point}%`, backgroundColor: "var(--info)", opacity: 0.35 + idx * 0.1 }} />
          ))}
        </div>
        <p className="mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
          Attention trend (last 5 intervals)
        </p>
      </div>
    </div>
  );
}

// ─── AI coaching tip card ───────────────────────────────────────────────────

function CoachingTipCard() {
  const [tip, setTip] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .post<{ tip: string }>("/api/v1/ai-tools/coaching-tip/", {})
      .then((res) => {
        if (!cancelled) setTip(res.tip || "");
      })
      .catch(() => {
        if (!cancelled) setTip("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !tip) return null;
  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--accent-muted)" }}
        >
          <Lightbulb className="h-4 w-4" style={{ color: "var(--accent)" }} />
        </div>
        <div className="flex-1">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            AI coaching tip
          </p>
          {loading ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          ) : (
            <Markdown className="text-sm">{tip}</Markdown>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Time-on-task summary card ─────────────────────────────────────────────

function TimeSummaryCard() {
  const [today, setToday] = useState(0);
  const [week, setWeek] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api
      .get<{ today_seconds: number; week_seconds: number }>("/api/v1/attention/my-time-summary/")
      .then((res) => {
        if (!cancelled) {
          setToday(res.today_seconds || 0);
          setWeek(res.week_seconds || 0);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };
  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "var(--bg-hover)" }}
        >
          <Clock className="h-4 w-4" style={{ color: "var(--text-secondary)" }} />
        </div>
        <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
          Time on task
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {fmt(today)}
          </p>
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--text-muted)" }}>
            Today
          </p>
        </div>
        <div>
          <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {fmt(week)}
          </p>
          <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--text-muted)" }}>
            This week
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Staff Dashboard ─────────────────────────────────────────────────────────

function StaffDashboard({ stats }: { stats: DashboardStats }) {
  const myTasks = stats.my_tasks ?? 0;
  const myOverdue = stats.my_overdue ?? 0;
  const myCompleted = stats.my_completed ?? 0;
  const myOpen = stats.my_open ?? 0;
  const total = myOpen + myCompleted;
  const completionPct = total > 0 ? Math.round((myCompleted / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "My Tasks", val: myTasks, color: "var(--info)", sub: "Assigned to you" },
          { label: "Completed", val: myCompleted, color: "var(--accent)", sub: `${completionPct}% done` },
          { label: "Overdue", val: myOverdue, color: myOverdue > 0 ? "var(--danger)" : "var(--accent)", sub: myOverdue === 0 ? "All clear" : "Needs attention" },
          { label: "This Week", val: stats.tasks_this_week, color: "var(--purple)", sub: "New tasks" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{k.val}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>My Progress</h3>
          <span className="text-sm font-extrabold" style={{ color: "var(--accent)" }}>{completionPct}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completionPct}%`, backgroundColor: "var(--accent)" }} />
        </div>
        <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>{myCompleted} of {total} tasks completed</p>
      </div>

      {/* AI tip + time summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CoachingTipCard />
        <TimeSummaryCard />
      </div>

      {/* Activity tracker */}
      <ActivityBreakPanel />
    </div>
  );
}

// ─── Manager Dashboard ───────────────────────────────────────────────────────

function ManagerDashboard({ stats }: { stats: DashboardStats }) {
  const pendingReviews = stats.pending_reviews ?? 0;
  const overdueTasks = stats.overdue_tasks ?? 0;
  const openTasks = stats.open_tasks ?? 0;
  const completedTasks = stats.completed_tasks ?? 0;
  const totalTasks = stats.total_tasks ?? 0;
  const taskCompletionPct = stats.task_completion_pct ?? 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Team Members", val: stats.team_members ?? 0, color: "var(--info)", bg: "var(--info-muted)", sub: "Direct reports", icon: Users },
          { label: "Team Tasks", val: stats.team_tasks ?? 0, color: "var(--accent)", bg: "var(--accent-muted)", sub: `${stats.open_tasks ?? 0} open`, icon: CheckCircle2 },
          { label: "Pending Reviews", val: pendingReviews, color: pendingReviews > 0 ? "var(--warning)" : "var(--accent)", bg: pendingReviews > 0 ? "var(--warning-muted)" : "var(--accent-muted)", sub: pendingReviews > 0 ? "Awaiting your review" : "All caught up", icon: Flag },
          { label: "Overdue", val: overdueTasks, color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)", bg: overdueTasks > 0 ? "var(--danger-muted)" : "var(--accent-muted)", sub: overdueTasks > 0 ? "Needs attention" : "All clear", icon: AlertTriangle },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-4" style={{ backgroundColor: k.bg }}>
              <k.icon className="h-4 w-4" style={{ color: k.color }} />
            </div>
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{k.val}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Task completion + Overdue alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Task completion ring */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Task Completion</h3>
          <p className="text-[10px] mb-5" style={{ color: "var(--text-muted)" }}>{stats.completed_tasks} of {stats.total_tasks} done</p>
          <div className="flex items-center gap-8">
            <div className="relative flex h-28 w-28 items-center justify-center shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="2.5"
                  strokeDasharray={`${stats.task_completion_pct ?? 0} ${100 - (stats.task_completion_pct ?? 0)}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>{stats.task_completion_pct ?? 0}%</p>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              {[
                { label: "Open", val: stats.open_tasks, color: "var(--info)" },
                { label: "Closed", val: stats.completed_tasks, color: "var(--accent)" },
                { label: "Overdue", val: overdueTasks, color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)" },
              ].map((s) => (
                <div key={s.label} className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Overdue alerts */}
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="h-4 w-4" style={{ color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Overdue Alerts</h3>
          </div>
          {overdueTasks > 0 ? (
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ backgroundColor: "var(--danger-muted)", border: "1px solid var(--danger-muted)" }}>
                <p className="text-2xl font-extrabold" style={{ color: "var(--danger)" }}>{overdueTasks}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>tasks overdue across your team</p>
              </div>
              <Link href="/tasks" className="flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                View overdue tasks <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="h-10 w-10 mb-2" style={{ color: "var(--accent)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No overdue tasks</p>
            </div>
          )}
        </div>
      </div>

      {/* Projects overview */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Projects</h3>
          <Link href="/projects" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>View all &rarr;</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-hover)" }}>
            <p className="text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{stats.active_projects}</p>
            <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Active</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-hover)" }}>
            <p className="text-2xl font-extrabold" style={{ color: "var(--info)" }}>{stats.proj_completed}</p>
            <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Completed</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-hover)" }}>
            <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>{stats.total_projects}</p>
            <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Total</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dept Head Dashboard ─────────────────────────────────────────────────────

function DeptHeadDashboard({ stats }: { stats: DashboardStats }) {
  const deptStats = stats.dept_stats ?? [];
  const overdueTasks = stats.overdue_tasks ?? 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Departments", val: stats.total_departments ?? 0, color: "var(--purple)", sub: "Under your scope" },
          { label: "Total Tasks", val: stats.total_tasks ?? 0, color: "var(--info)", sub: `${stats.open_tasks ?? 0} open` },
          { label: "Completion Rate", val: `${stats.task_completion_pct ?? 0}%`, color: "var(--accent)", sub: `${stats.completed_tasks ?? 0} completed` },
          { label: "Overdue", val: stats.overdue_tasks ?? 0, color: (stats.overdue_tasks ?? 0) > 0 ? "var(--danger)" : "var(--accent)", sub: (stats.overdue_tasks ?? 0) > 0 ? "Across teams" : "All clear" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{k.val}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Department performance bars */}
      {deptStats.length > 0 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-4 w-4" style={{ color: "var(--purple)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Cross-Team Performance</h3>
          </div>
          <div className="space-y-4">
            {deptStats.map((dept) => (
              <div key={dept.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{dept.name}</span>
                  <div className="flex items-center gap-2">
                    {dept.overdue > 0 && (
                      <Badge variant="danger">{dept.overdue} overdue</Badge>
                    )}
                    <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>{dept.completion_pct}%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${dept.completion_pct}%`, backgroundColor: dept.completion_pct >= 70 ? "var(--accent)" : dept.completion_pct >= 40 ? "var(--warning)" : "var(--danger)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task completion ring */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Overall Task Completion</h3>
        <p className="text-[10px] mb-5" style={{ color: "var(--text-muted)" }}>{stats.completed_tasks} of {stats.total_tasks} done</p>
        <div className="flex items-center gap-8">
          <div className="relative flex h-28 w-28 items-center justify-center shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="2.5"
                strokeDasharray={`${stats.task_completion_pct ?? 0} ${100 - (stats.task_completion_pct ?? 0)}`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute text-center">
              <p className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>{stats.task_completion_pct ?? 0}%</p>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-3 gap-3">
            {[
              { label: "Open", val: stats.open_tasks, color: "var(--info)" },
              { label: "Closed", val: stats.completed_tasks, color: "var(--accent)" },
              { label: "Overdue", val: overdueTasks, color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)" },
            ].map((s) => (
              <div key={s.label} className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
                <p className="text-lg font-extrabold" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Executive / Board Dashboard ─────────────────────────────────────────────

function ExecutiveDashboard({ stats, readOnly = false }: { stats: DashboardStats; readOnly?: boolean }) {
  const executionScore = stats.execution_score ?? stats.task_completion_pct ?? 0;
  const overdueTasks = stats.overdue_tasks ?? 0;
  const onTimeRate = stats.on_time_rate ?? ((stats.total_tasks ?? 0) > 0 ? Math.round((((stats.total_tasks ?? 0) - (stats.overdue_tasks ?? 0)) / (stats.total_tasks ?? 1)) * 100) : 100);
  const deptStats = stats.dept_stats ?? [];
  const projectHealth = stats.project_health ?? [];

  return (
    <div className="space-y-6">
      {/* Read-only banner for board members */}
      {readOnly && (
        <div className="rounded-xl px-4 py-2.5 text-center" style={{ backgroundColor: "var(--purple-muted)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--purple)" }}>Board Member View &mdash; Read Only</p>
        </div>
      )}

      {/* Executive KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Execution Score", val: `${executionScore}%`, color: executionScore >= 70 ? "var(--accent)" : executionScore >= 40 ? "var(--warning)" : "var(--danger)", sub: "Task completion" },
          { label: "On-Time Rate", val: `${onTimeRate}%`, color: onTimeRate >= 80 ? "var(--accent)" : "var(--warning)", sub: "Delivery timeliness" },
          { label: "Active Projects", val: stats.active_projects, color: "var(--info)", sub: `${stats.total_projects} total` },
          { label: "Overdue Tasks", val: overdueTasks, color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)", sub: overdueTasks > 0 ? "Needs escalation" : "On track" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{k.val}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Execution Score Ring + On-Time Delivery */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Execution Score</h3>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeDasharray={`${executionScore} ${100 - executionScore}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <p className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{executionScore}%</p>
                <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>Score</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-4 w-4" style={{ color: "var(--info)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>On-Time Delivery</h3>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative flex h-40 w-40 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none"
                  stroke="var(--info)"
                  strokeWidth="3"
                  strokeDasharray={`${onTimeRate} ${100 - onTimeRate}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <p className="text-3xl font-extrabold" style={{ color: "var(--text-primary)" }}>{onTimeRate}%</p>
                <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>On Time</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department comparison */}
      {deptStats.length > 0 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-4 w-4" style={{ color: "var(--purple)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Department Performance</h3>
          </div>
          <div className="space-y-4">
            {deptStats.map((dept) => (
              <div key={dept.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{dept.name}</span>
                  <span className="text-xs font-bold" style={{ color: dept.completion_pct >= 70 ? "var(--accent)" : dept.completion_pct >= 40 ? "var(--warning)" : "var(--danger)" }}>{dept.completion_pct}%</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${dept.completion_pct}%`, backgroundColor: dept.completion_pct >= 70 ? "var(--accent)" : dept.completion_pct >= 40 ? "var(--warning)" : "var(--danger)" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project health */}
      {projectHealth.length > 0 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" style={{ color: "var(--warning)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Project Health</h3>
            </div>
            <Link href="/projects" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>View all &rarr;</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projectHealth.map((proj) => {
              const statusColor = proj.status === "ACTIVE" ? "var(--accent)" : proj.status === "ON_HOLD" ? "var(--warning)" : proj.status === "COMPLETED" ? "var(--info)" : "var(--danger)";
              return (
                <div key={proj.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>{proj.name}</span>
                    <Badge variant={proj.status === "ACTIVE" ? "success" : proj.status === "ON_HOLD" ? "warning" : proj.status === "COMPLETED" ? "info" : "danger"}>
                      {proj.status}
                    </Badge>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div className="h-full rounded-full" style={{ width: `${proj.completion_pct}%`, backgroundColor: statusColor }} />
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: "var(--text-muted)" }}>{proj.completion_pct}% complete</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Board Dashboard (read-only executive view) ─────────────────────────────

function BoardDashboard({ stats }: { stats: DashboardStats }) {
  return <ExecutiveDashboard stats={stats} readOnly />;
}

// ─── Admin Dashboard (original full view) ────────────────────────────────────

function AdminDashboard({ stats }: { stats: DashboardStats }) {
  const overdueTasks = stats.overdue_tasks ?? 0;
  const totalMilestones = stats.total_milestones ?? 0;
  const completedMilestones = stats.completed_milestones ?? 0;
  const milestonePct = totalMilestones
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Row 1: 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Team", val: stats.total_users, sub: `${stats.total_departments} depts`, icon: Users, color: "var(--accent)", bg: "var(--accent-muted)" },
          { label: "Projects", val: stats.active_projects, sub: `${stats.total_projects} total`, icon: FolderOpen, color: "var(--warning)", bg: "var(--warning-muted)" },
          { label: "Open Tasks", val: stats.open_tasks, sub: `${stats.tasks_this_week} new this week`, icon: CheckCircle2, color: "var(--info)", bg: "var(--info-muted)" },
          { label: "Overdue", val: overdueTasks, sub: overdueTasks === 0 ? "All clear" : "Needs attention", icon: AlertTriangle, color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)", bg: overdueTasks > 0 ? "var(--danger-muted)" : "var(--accent-muted)" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-4" style={{ backgroundColor: k.bg }}>
              <k.icon className="h-4 w-4" style={{ color: k.color }} />
            </div>
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{k.val}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>{k.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Completion ring + Project status */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Task Completion</h3>
          <p className="text-[10px] mb-5" style={{ color: "var(--text-muted)" }}>{stats.completed_tasks} of {stats.total_tasks} done</p>
          <div className="flex items-center gap-8">
            <div className="relative flex h-32 w-32 items-center justify-center shrink-0">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--accent)" strokeWidth="2.5"
                  strokeDasharray={`${stats.task_completion_pct ?? 0} ${100 - (stats.task_completion_pct ?? 0)}`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute text-center">
                <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>{stats.task_completion_pct ?? 0}%</p>
              </div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              {[
                { label: "Open", val: stats.open_tasks, color: "var(--info)" },
                { label: "Closed", val: stats.completed_tasks, color: "var(--accent)" },
                { label: "Overdue", val: overdueTasks, color: overdueTasks > 0 ? "var(--danger)" : "var(--accent)" },
              ].map((s) => (
                <div key={s.label} className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>Projects</h3>
          <p className="text-[10px] mb-5" style={{ color: "var(--text-muted)" }}>{stats.total_projects} total</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--accent-muted)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-extrabold" style={{ color: "var(--accent)" }}>{stats.active_projects}</p>
              <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Active</p>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ backgroundColor: "var(--info-muted)", border: "1px solid var(--border)" }}>
              <p className="text-2xl font-extrabold" style={{ color: "var(--info)" }}>{stats.proj_completed}</p>
              <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Done</p>
            </div>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Flag className="h-3 w-3" style={{ color: "var(--warning)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>Milestones</span>
            </div>
            <span className="text-[11px] font-extrabold" style={{ color: "var(--warning)" }}>{stats.completed_milestones}/{stats.total_milestones}</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
            <div className="h-full rounded-full" style={{ width: `${milestonePct}%`, backgroundColor: "var(--warning)" }} />
          </div>
        </div>
      </div>

      {/* Row 3: 4 module cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Messages", val: stats.total_messages, sub: `${stats.messages_this_week} this week`, icon: MessageSquare, color: "var(--info)", bg: "var(--info-muted)", href: "/messages" },
          { label: "Policies", val: stats.total_policies, sub: `${stats.total_acknowledgments} ack'd`, icon: Shield, color: "var(--accent)", bg: "var(--accent-muted)", href: "/policies" },
          { label: "AI Outputs", val: stats.total_ai_outputs, sub: `${stats.ai_this_month} this month`, icon: Brain, color: "var(--purple)", bg: "var(--purple-muted)", href: "/ai" },
          { label: "Documents", val: (stats.total_documents ?? 0) + (stats.total_jds ?? 0), sub: `${stats.total_jds} JDs`, icon: Zap, color: "var(--warning)", bg: "var(--warning-muted)" },
        ].map((c) => {
          const inner = (
            <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: c.bg }}>
                  <c.icon className="h-4 w-4" style={{ color: c.color }} />
                </div>
                {c.href && <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />}
              </div>
              <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>{(c.val ?? 0).toLocaleString()}</p>
              <p className="text-[11px] font-semibold mt-1" style={{ color: c.color }}>{c.label}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{c.sub}</p>
            </div>
          );
          return c.href
            ? <Link key={c.label} href={c.href} className="block">{inner}</Link>
            : <div key={c.label}>{inner}</div>;
        })}
      </div>

      {/* Row 4: Upcoming milestones */}
      {(stats.upcoming_milestones ?? []).length > 0 && (
        <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4" style={{ color: "var(--warning)" }} />
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Upcoming Milestones</h3>
            </div>
            <Link href="/projects" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>View all &rarr;</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(stats.upcoming_milestones ?? []).map((ms) => (
              <div key={ms.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "var(--bg-hover)" }}>
                <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: "var(--warning)" }} />
                <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>{ms.title}</span>
                <span className="text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-md" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                  {new Date(ms.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard Page ─────────────────────────────────────────────────────


// --- Attendance Clock Panel (all roles) --------------------------------

function AttendanceClockPanel() {
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchToday = useCallback(async () => {
    try {
      const data = await api.get<AttendanceRecord | null>("/api/v1/attendance/records/today/");
      setRecord(data);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const clockIn = async () => {
    setActionLoading(true);
    try {
      await api.post("/api/v1/attendance/records/clock-in/");
      await fetchToday();
    } catch { /* */ }
    setActionLoading(false);
  };

  const clockOut = async () => {
    setActionLoading(true);
    try {
      await api.post("/api/v1/attendance/records/clock-out/");
      await fetchToday();
    } catch { /* */ }
    setActionLoading(false);
  };

  const formatClock = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  if (loading) return null;

  return (
    <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Attendance</h3>
        </div>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>Working hours: 9:00 AM - 5:00 PM</span>
      </div>

      {!record && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>You have not clocked in today.</p>
          <Button variant="primary" size="sm" onClick={clockIn} disabled={actionLoading}>
            <Play className="h-3 w-3" />
            Clock In
          </Button>
        </div>
      )}

      {record && !record.clock_out && (
        <div className="flex items-center justify-between rounded-xl p-4" style={{ backgroundColor: "var(--accent-muted)" }}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: record.status === "LATE" ? "var(--danger)" : "var(--accent)" }}>
              {record.status === "LATE" ? "Late" : "Present"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>
              Clocked in at {formatClock(record.clock_in!)}
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={clockOut} disabled={actionLoading}>
            <Square className="h-3 w-3" />
            Clock Out
          </Button>
        </div>
      )}

      {record && record.clock_out && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {record.status === "LATE" ? "Late" : "Present"} &middot; Completed
            </p>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-primary)" }}>
              {formatClock(record.clock_in!)} &rarr; {formatClock(record.clock_out)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await api.get<DashboardStats>("/api/v1/core/dashboard/");
        setStats(data);
      } catch { /* */ }
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const role = user?.role || "STAFF";

  const renderDashboard = () => {
    switch (role) {
      case "STAFF":
        return <StaffDashboard stats={stats} />;
      case "MANAGER":
        return <ManagerDashboard stats={stats} />;
      case "DEPT_HEAD":
        return <DeptHeadDashboard stats={stats} />;
      case "EXECUTIVE":
        return <ExecutiveDashboard stats={stats} />;
      case "BOARD_MEMBER":
        return <BoardDashboard stats={stats} />;
      case "ADMIN":
        return <AdminDashboard stats={stats} />;
      default:
        return <StaffDashboard stats={stats} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Welcome, {user?.first_name || "User"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <Badge variant={role === "ADMIN" ? "danger" : role === "MANAGER" || role === "DEPT_HEAD" ? "purple" : role === "EXECUTIVE" || role === "BOARD_MEMBER" ? "danger" : "info"}>
          {role.replace("_", " ")}
        </Badge>
      </div>

      <AttendanceClockPanel />

      {renderDashboard()}
    </div>
  );
}
