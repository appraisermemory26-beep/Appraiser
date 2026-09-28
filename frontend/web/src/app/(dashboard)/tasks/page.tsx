"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  CheckSquare,
  Clock,
  Loader2,
  CheckCircle2,
  PlayCircle,
  Send,
  FileCheck,
  MoreHorizontal,
  Download,
  FileText,
  Upload,
  X,
  Calendar,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SelectFilter } from "@/components/ui/select-filter";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Markdown } from "@/components/ui/markdown";
import { useToast } from "@/components/ui/toast";
import TaskOutputCard from "@/components/task-output-card";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type {
  Task,
  TaskOutput,
  TaskReview,
  TaskStatus,
  User,
  Department,
  JobDescription,
  PaginatedResponse,
} from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const priorityVariant: Record<string, "danger" | "warning" | "orange" | "info" | "neutral"> = {
  URGENT: "danger",
  HIGH: "warning",
  MEDIUM: "orange",
  LOW: "info",
};

const statusVariant: Record<string, "info" | "danger" | "success" | "warning" | "neutral" | "purple"> = {
  CREATED: "neutral",
  ASSIGNED: "warning",
  IN_PROGRESS: "info",
  SUBMITTED: "purple",
  REVIEWED: "info",
  CLOSED: "success",
};

const statusLabel: Record<string, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  CLOSED: "Closed",
};

const reviewActionLabel: Record<string, string> = {
  APPROVED: "Approved",
  REJECTED: "Rejected",
  RETURNED: "Returned for Revision",
};

const reviewActionVariant: Record<string, "success" | "danger" | "warning"> = {
  APPROVED: "success",
  REJECTED: "danger",
  RETURNED: "warning",
};

function fmtReviewDate(d: string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusOptions = [
  { value: "CREATED", label: "Created" },
  { value: "ASSIGNED", label: "Assigned" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "CLOSED", label: "Closed" },
];

const priorityOptions = [
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
  { value: "LOW", label: "Low" },
];

const deadlineTypeOptions = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

// ─── Status transition map ──────────────────────────────────────────────────

interface TransitionAction {
  label: string;
  targetStatus: TaskStatus;
  variant: "primary" | "secondary" | "danger";
  managerOnly?: boolean;
}

const statusTransitions: Record<string, TransitionAction[]> = {
  CREATED: [{ label: "Assign", targetStatus: "ASSIGNED", variant: "primary" }],
  ASSIGNED: [{ label: "Start", targetStatus: "IN_PROGRESS", variant: "primary" }],
  IN_PROGRESS: [{ label: "Submit Output", targetStatus: "SUBMITTED", variant: "primary" }],
  SUBMITTED: [
    { label: "Approve", targetStatus: "REVIEWED", variant: "primary", managerOnly: true },
    { label: "Return for Revision", targetStatus: "IN_PROGRESS", variant: "secondary", managerOnly: true },
    { label: "Reject", targetStatus: "CLOSED", variant: "danger", managerOnly: true },
  ],
  REVIEWED: [{ label: "Close", targetStatus: "CLOSED", variant: "primary" }],
  CLOSED: [],
};

// ─── Row type for DataTable ─────────────────────────────────────────────────

interface TaskRow extends Record<string, unknown> {
  id: number;
  task_id: string;
  title: string;
  description: string;
  objectives: string;
  priority: string;
  status: string;
  deadline: string | null;
  deadline_type: string;
  assigned_to: number | null;
  assigned_to_name: string;
  linked_jd: number | null;
  progress_percentage: number;
  is_inherited: boolean;
  inherited_from_name: string | null;
  created_at: string;
}

// ─── Helper: format date ────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return "No deadline";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Helper: is manager role ────────────────────────────────────────────────

function isManager(role: string | undefined): boolean {
  return ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"].includes(role || "");
}

function canActOnTask(task: Task, user: { id: number; role: string } | null | undefined): boolean {
  if (!user) return false;
  if (isManager(user.role)) return true;
  if (task.is_inherited) return true;
  return task.assigned_to === user.id;
}

function getTransitionActions(
  task: Task,
  user: { id: number; role: string } | null | undefined,
): TransitionAction[] {
  if (!canActOnTask(task, user)) return [];

  const base = statusTransitions[task.status] || [];

  // Staff already listed as assignee (or inheriting) should start work, not "Assign".
  if (
    user?.role === "STAFF" &&
    task.status === "CREATED" &&
    (task.assigned_to === user.id || task.is_inherited)
  ) {
    return [{ label: "Start", targetStatus: "IN_PROGRESS", variant: "primary" }];
  }

  if (user?.role === "STAFF") {
    return base.filter((action) => !(task.status === "CREATED" && action.label === "Assign"));
  }

  return base;
}

// =============================================================================
// Main Component
// =============================================================================

export default function TasksPage() {
  const toast = useToast();
  const { user } = useAuth();

  // ── Data state ──────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Filter state ────────────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // ── Create modal state ──────────────────────────────────────────────────
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    objectives: "",
    priority: "MEDIUM",
    deadline_type: "DAILY",
    deadline: "",
    assigned_to: "",
    department: "",
    linked_jd: "",
  });

  // ── Detail modal state ─────────────────────────────────────────────────
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [taskOutputs, setTaskOutputs] = useState<TaskOutput[]>([]);
  const [taskReviews, setTaskReviews] = useState<TaskReview[]>([]);
  const [activeTaskSession, setActiveTaskSession] = useState<number | null>(null);
  const [progressDraft, setProgressDraft] = useState(0);
  const [progressSaving, setProgressSaving] = useState(false);
  const [transitionComment, setTransitionComment] = useState("");
  const [transitioning, setTransitioning] = useState(false);

  // ── Submit output state ────────────────────────────────────────────────
  const [outputFile, setOutputFile] = useState<File | null>(null);
  const [outputText, setOutputText] = useState("");
  const [submittingOutput, setSubmittingOutput] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Review state ───────────────────────────────────────────────────────
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // ── AI summary state ───────────────────────────────────────────────────
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiSummarising, setAiSummarising] = useState(false);

  // ── Action menu state ──────────────────────────────────────────────────
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);

  // ── User lookup map ────────────────────────────────────────────────────
  const userMap = new Map(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`]));

  // =========================================================================
  // Data Fetching
  // =========================================================================

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      const qs = params.toString();
      const res = await api.get<PaginatedResponse<Task>>(
        `/api/v1/tasks/tasks/${qs ? `?${qs}` : ""}`
      );
      setTasks(res.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const [usersRes, deptsRes, jdRes] = await Promise.all([
          api.get<PaginatedResponse<User>>("/api/v1/accounts/users/"),
          api.get<PaginatedResponse<Department>>("/api/v1/organisations/departments/"),
          api.get<PaginatedResponse<JobDescription>>("/api/v1/jd-management/job-descriptions/"),
        ]);
        setUsers(usersRes.results);
        setDepartments(deptsRes.results);
        setJobDescriptions(jdRes.results);
      } catch {
        // silently fail
      }
    }
    fetchMeta();
  }, []);

  // =========================================================================
  // Task Detail + Outputs
  // =========================================================================

  const openTaskDetail = useCallback(
    async (taskId: number) => {
      try {
        const task = await api.get<Task>(
          `/api/v1/tasks/tasks/${taskId}/`
        );
        try {
          const session = await api.post<{ time_log_id?: number }>(
            `/api/v1/tasks/tasks/${taskId}/start-work/`
          );
          if (session?.time_log_id) setActiveTaskSession(session.time_log_id);
        } catch {
          // non-blocking for detail view
        }
        setDetailTask(task);
        setProgressDraft(task.progress_percentage);
        setTaskOutputs(task.outputs || []);
        setTaskReviews(task.reviews || []);
        setDetailModalOpen(true);
        setTransitionComment("");
        setReviewComment("");
        setOutputFile(null);
        setOutputText("");
        setSubmissionSuccess(false);
        setAiSummary("");
      } catch {
        toast.error("Failed to load task details");
      }
    },
    [toast]
  );

  const closeTaskDetail = useCallback(async () => {
    if (detailTask && activeTaskSession) {
      try {
        await api.post(`/api/v1/tasks/tasks/${detailTask.id}/stop-work/`);
      } catch {
        // non-blocking on close
      }
    }
    setDetailModalOpen(false);
    setDetailTask(null);
    setActiveTaskSession(null);
  }, [detailTask, activeTaskSession]);

  const runTaskSummary = useCallback(async () => {
    if (!detailTask) return;
    setAiSummarising(true);
    setAiSummary("");
    try {
      const res = await api.post<{ summary: string }>(
        "/api/v1/ai-tools/task-summary/",
        { task_id: detailTask.id },
      );
      setAiSummary(res.summary);
    } catch (err) {
      toast.error((err as Error).message || "Failed to summarise task");
    } finally {
      setAiSummarising(false);
    }
  }, [detailTask, toast]);

  // =========================================================================
  // Create Task
  // =========================================================================

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/tasks/tasks/", {
        title: form.title,
        description: form.description,
        objectives: form.objectives,
        priority: form.priority,
        deadline_type: form.deadline_type,
        deadline: form.deadline || null,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        department: form.department ? Number(form.department) : null,
        linked_jd: form.linked_jd ? Number(form.linked_jd) : null,
      });
      toast.success("Task created successfully");
      setCreateModalOpen(false);
      setForm({
        title: "",
        description: "",
        objectives: "",
        priority: "MEDIUM",
        deadline_type: "DAILY",
        deadline: "",
        assigned_to: "",
        department: "",
        linked_jd: "",
      });
      fetchTasks();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Status Transition
  // =========================================================================

  const handleTransition = async (targetStatus: TaskStatus) => {
    if (!detailTask) return;
    setTransitioning(true);
    try {
      await api.post(`/api/v1/tasks/tasks/${detailTask.id}/transition/`, {
        status: targetStatus,
        comment: transitionComment,
      });
      toast.success(`Task status changed to ${statusLabel[targetStatus]}`);
      await openTaskDetail(detailTask.id);
      fetchTasks();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to transition task");
    } finally {
      setTransitioning(false);
    }
  };

  // =========================================================================
  // Submit Output
  // =========================================================================

  const handleSubmitOutput = async () => {
    if (!detailTask) return;
    if (!outputFile && !outputText.trim()) {
      toast.error("Please provide a file or text content");
      return;
    }
    setSubmittingOutput(true);
    try {
      const fd = new FormData();
      if (outputFile) fd.append("file", outputFile);
      if (outputText.trim()) fd.append("text_content", outputText.trim());
      await api.upload(`/api/v1/tasks/tasks/${detailTask.id}/submit-output/`, fd);
      toast.success("Output submitted successfully");
      setOutputFile(null);
      setOutputText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSubmissionSuccess(true);
      fetchTasks();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to submit output");
    } finally {
      setSubmittingOutput(false);
    }
  };

  // =========================================================================
  // Review
  // =========================================================================

  const handleReview = async (action: "APPROVED" | "RETURNED" | "REJECTED") => {
    if (!detailTask) return;
    setReviewing(true);
    try {
      await api.post(`/api/v1/tasks/tasks/${detailTask.id}/review/`, {
        action,
        comment: reviewComment,
      });
      const actionLabel =
        action === "APPROVED" ? "approved" : action === "RETURNED" ? "returned" : "rejected";
      toast.success(`Task ${actionLabel} successfully`);
      setReviewComment("");
      await openTaskDetail(detailTask.id);
      fetchTasks();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to review task");
    } finally {
      setReviewing(false);
    }
  };

  const handleSaveProgress = async () => {
    if (!detailTask) return;
    setProgressSaving(true);
    try {
      const updated = await api.post<Task>(`/api/v1/tasks/tasks/${detailTask.id}/update-progress/`, {
        progress_percentage: progressDraft,
      });
      setDetailTask(updated);
      toast.success("Progress updated");
      fetchTasks();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update progress");
    } finally {
      setProgressSaving(false);
    }
  };

  // =========================================================================
  // Stats
  // =========================================================================

  const totalTasks = tasks.length;
  const createdCount = tasks.filter((t) => t.status === "CREATED").length;
  const assignedCount = tasks.filter((t) => t.status === "ASSIGNED").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const submittedCount = tasks.filter((t) => t.status === "SUBMITTED").length;
  const closedCount = tasks.filter((t) => t.status === "CLOSED").length;

  const stats = [
    { label: "Total", value: totalTasks, icon: CheckSquare, labelColor: "var(--text-secondary)" },
    { label: "Created", value: createdCount, icon: FileText, labelColor: "var(--text-secondary)" },
    { label: "Assigned", value: assignedCount, icon: Clock, labelColor: "var(--warning)" },
    { label: "In Progress", value: inProgressCount, icon: PlayCircle, labelColor: "var(--info)" },
    { label: "Submitted", value: submittedCount, icon: Send, labelColor: "var(--purple)" },
    { label: "Closed", value: closedCount, icon: CheckCircle2, labelColor: "var(--accent)" },
  ];

  // =========================================================================
  // Table columns
  // =========================================================================

  const columns: Column<TaskRow>[] = [
    {
      key: "task_id",
      header: "ID",
      className: "w-28",
      render: (row) => (
        <span className="font-mono text-xs" style={{ color: "var(--text-muted)" }}>
          {row.task_id as string}
        </span>
      ),
    },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium" style={{ color: "var(--text-primary)" }}>
              {row.title as string}
            </p>
            {(row.is_inherited as boolean) && (
              <span
                title={
                  row.inherited_from_name
                    ? `Inherited from ${row.inherited_from_name as string}`
                    : "Inherited from predecessor"
                }
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--purple-muted)",
                  color: "var(--purple)",
                  border: "1px solid var(--purple-muted)",
                }}
              >
                Inherited
                {row.inherited_from_name ? ` · ${row.inherited_from_name as string}` : ""}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {row.deadline_type as string}
          </p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (row) => (
        <Badge variant={priorityVariant[row.priority as string] || "neutral"}>
          {row.priority as string}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={statusVariant[row.status as string] || "neutral"}>
          {statusLabel[row.status as string] || (row.status as string)}
        </Badge>
      ),
    },
    {
      key: "assigned_to_name",
      header: "Assigned To",
      render: (row) => (
        <span style={{ color: row.assigned_to_name ? "var(--text-primary)" : "var(--text-muted)" }}>
          {(row.assigned_to_name as string) || "Unassigned"}
        </span>
      ),
    },
    {
      key: "deadline",
      header: "Deadline",
      render: (row) => {
        const deadline = row.deadline as string | null;
        const isOverdue =
          deadline && new Date(deadline) < new Date() && row.status !== "CLOSED";
        return (
          <span style={{ color: isOverdue ? "var(--danger)" : "var(--text-primary)" }}>
            {fmtDate(deadline)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (row) => (
        <div className="relative">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onClick={(e) => {
              e.stopPropagation();
              setActionMenuId(actionMenuId === (row.id as number) ? null : (row.id as number));
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--bg-primary)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {actionMenuId === (row.id as number) && (
            <div
              className="absolute right-0 top-9 z-50 min-w-[160px] rounded-lg py-1 shadow-xl"
              style={{
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border)",
              }}
            >
              <button
                className="w-full px-4 py-2 text-left text-sm transition-colors cursor-pointer"
                style={{ color: "var(--text-primary)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                onClick={(e) => {
                  e.stopPropagation();
                  setActionMenuId(null);
                  openTaskDetail(row.id as number);
                }}
              >
                View Details
              </button>
              {(statusTransitions[row.status as string] || []).map((action) => {
                if (action.managerOnly && !isManager(user?.role)) return null;
                return (
                  <button
                    key={action.label}
                    className="w-full px-4 py-2 text-left text-sm transition-colors cursor-pointer"
                    style={{
                      color:
                        action.variant === "danger"
                          ? "var(--danger)"
                          : "var(--text-primary)",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = "var(--bg-hover)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.backgroundColor = "transparent")
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionMenuId(null);
                      openTaskDetail(row.id as number);
                    }}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ),
    },
  ];

  const tableData: TaskRow[] = tasks.map((t) => ({
    id: t.id,
    task_id: t.task_id,
    title: t.title,
    description: t.description,
    objectives: t.objectives,
    priority: t.priority,
    status: t.status,
    deadline: t.deadline,
    deadline_type: t.deadline_type,
    assigned_to: t.assigned_to,
    assigned_to_name: t.assigned_to ? userMap.get(t.assigned_to) || `User #${t.assigned_to}` : "",
    linked_jd: t.linked_jd,
    progress_percentage: t.progress_percentage,
    is_inherited: t.is_inherited ?? false,
    inherited_from_name: t.inherited_from_name ?? null,
    created_at: t.created_at,
  }));

  // =========================================================================
  // Close action menu on outside click
  // =========================================================================

  useEffect(() => {
    if (actionMenuId === null) return;
    const handler = () => setActionMenuId(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [actionMenuId]);

  // =========================================================================
  // Render
  // =========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Tasks
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {totalTasks} total tasks
          </p>
        </div>
        <Button size="md" onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value} icon={s.icon} labelColor={s.labelColor} />
        ))}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-3 rounded-xl p-3 theme-glass"
        style={{ border: "1px solid var(--border)" }}
      >
        <SearchInput placeholder="Search tasks..." value={search} onChange={setSearch} className="w-72" />
        <SelectFilter label="All Statuses" options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        <SelectFilter label="All Priorities" options={priorityOptions} value={priorityFilter} onChange={setPriorityFilter} />
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={tableData}
        onRowClick={(row) => openTaskDetail(row.id as number)}
      />

      {/* ================================================================ */}
      {/* CREATE TASK MODAL                                                */}
      {/* ================================================================ */}
      <Modal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} title="New Task" className="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormInput
            label="Title"
            name="title"
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <FormTextarea
            label="Description"
            name="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <FormTextarea
            label="Objectives"
            name="objectives"
            rows={3}
            value={form.objectives}
            onChange={(e) => setForm({ ...form, objectives: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Priority"
              name="priority"
              required
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={priorityOptions}
            />
            <FormSelect
              label="Deadline Type"
              name="deadline_type"
              required
              value={form.deadline_type}
              onChange={(e) => setForm({ ...form, deadline_type: e.target.value })}
              options={deadlineTypeOptions}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Deadline</label>
            <div className="relative">
              <input
                type="date"
                name="deadline"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors cursor-pointer"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)", colorScheme: "dark" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
              <Calendar
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Assigned To"
              name="assigned_to"
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
              placeholder="Select user..."
              options={users.map((u) => ({
                value: String(u.id),
                label: `${u.first_name} ${u.last_name}`,
              }))}
            />
            <FormSelect
              label="Department"
              name="department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Select department..."
              options={departments.map((d) => ({
                value: String(d.id),
                label: d.name,
              }))}
            />
          </div>

          <FormSelect
            label="Linked Job Description"
            name="linked_jd"
            value={form.linked_jd}
            onChange={(e) => setForm({ ...form, linked_jd: e.target.value })}
            placeholder="Select JD (optional)..."
            options={jobDescriptions.map((jd) => ({
              value: String(jd.id),
              label: jd.title,
            }))}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ================================================================ */}
      {/* TASK DETAIL MODAL                                                */}
      {/* ================================================================ */}
      <Modal
        isOpen={detailModalOpen}
        onClose={closeTaskDetail}
        title={detailTask ? detailTask.title : "Task Detail"}
        className="max-w-3xl"
      >
        {detailTask && (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
            {detailTask.is_inherited && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  backgroundColor: "var(--purple-muted)",
                  color: "var(--purple)",
                  border: "1px solid var(--purple-muted)",
                }}
              >
                <span className="font-semibold uppercase tracking-wider">Inherited</span>
                <span>
                  This task is part of your institutional memory
                  {detailTask.inherited_from_name
                    ? ` from ${detailTask.inherited_from_name}`
                    : " from a predecessor"}
                  .
                </span>
              </div>
            )}

            {(() => {
              const latestRevision = taskReviews.find(
                (r) => r.action === "REJECTED" || r.action === "RETURNED",
              );
              if (detailTask.status !== "IN_PROGRESS" || !latestRevision) return null;
              const isRejected = latestRevision.action === "REJECTED";
              return (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: isRejected ? "var(--danger-muted)" : "var(--warning-muted)",
                    border: `1px solid ${isRejected ? "rgba(248, 81, 73, 0.35)" : "rgba(251, 191, 36, 0.35)"}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="h-5 w-5 shrink-0 mt-0.5"
                      style={{ color: isRejected ? "var(--danger)" : "var(--warning)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          Submission {isRejected ? "Rejected" : "Returned for Revision"}
                        </p>
                        <Badge variant={reviewActionVariant[latestRevision.action]}>
                          {reviewActionLabel[latestRevision.action]}
                        </Badge>
                      </div>
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        Reviewed by{" "}
                        {latestRevision.reviewer_name || `User #${latestRevision.reviewer}`}
                        {" · "}
                        {fmtReviewDate(latestRevision.created_at)}
                      </p>
                      {latestRevision.comment ? (
                        <p
                          className="mt-2 text-sm whitespace-pre-wrap rounded-lg px-3 py-2"
                          style={{
                            backgroundColor: "var(--bg-card)",
                            color: "var(--text-primary)",
                            borderLeft: `3px solid ${isRejected ? "var(--danger)" : "var(--warning)"}`,
                          }}
                        >
                          {latestRevision.comment}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm italic" style={{ color: "var(--text-muted)" }}>
                          No written feedback was provided. Contact your reviewer if you need clarification.
                        </p>
                      )}
                      <p className="mt-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                        Revise your work and submit updated output below.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* ── Info Grid ───────────────────────────────────────────── */}
            <div
              className="grid grid-cols-2 gap-4 rounded-lg p-4"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Task ID
                </p>
                <p className="mt-1 font-mono text-sm" style={{ color: "var(--text-primary)" }}>
                  {detailTask.task_id}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Status
                </p>
                <div className="mt-1">
                  <Badge variant={statusVariant[detailTask.status] || "neutral"}>
                    {statusLabel[detailTask.status] || detailTask.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Priority
                </p>
                <div className="mt-1">
                  <Badge variant={priorityVariant[detailTask.priority] || "neutral"}>
                    {detailTask.priority}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Assigned To
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {detailTask.assigned_to
                    ? userMap.get(detailTask.assigned_to) || `User #${detailTask.assigned_to}`
                    : "Unassigned"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Deadline
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                  {fmtDate(detailTask.deadline)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                  Progress
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div
                    className="h-2 flex-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: "var(--bg-input)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${detailTask.progress_percentage}%`,
                        backgroundColor: "var(--accent)",
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    {detailTask.progress_percentage}%
                  </span>
                </div>
                {canActOnTask(detailTask, user) ? (
                  <div className="mt-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={progressDraft}
                      onChange={(e) => setProgressDraft(Number(e.target.value))}
                      className="w-full cursor-pointer"
                    />
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Draft: {progressDraft}%
                      </span>
                      <Button size="sm" onClick={handleSaveProgress} disabled={progressSaving || progressDraft === detailTask.progress_percentage}>
                        {progressSaving ? "Saving..." : "Save Progress"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
              {detailTask.linked_jd && (
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    Linked JD
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-primary)" }}>
                    {jobDescriptions.find((jd) => jd.id === detailTask.linked_jd)?.title || `JD #${detailTask.linked_jd}`}
                  </p>
                </div>
              )}
            </div>

            {/* ── Description ─────────────────────────────────────────── */}
            {detailTask.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Description
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {detailTask.description}
                </p>
              </div>
            )}

            {/* ── Objectives ──────────────────────────────────────────── */}
            {detailTask.objectives && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Objectives
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {detailTask.objectives}
                </p>
              </div>
            )}

            {/* ── AI Task Summary ──────────────────────────────────────── */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    AI Task Summary
                  </p>
                </div>
                <Button size="sm" onClick={runTaskSummary} disabled={aiSummarising}>
                  {aiSummarising ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {aiSummary ? "Regenerate" : "Summarise"}
                </Button>
              </div>
              {aiSummary && (
                <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <Markdown>{aiSummary}</Markdown>
                  <p className="mt-2 text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                    AI-Generated Draft
                  </p>
                </div>
              )}
              {!aiSummary && !aiSummarising && (
                <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Generate a plain-language summary covering status history, time logs, and submitted outputs.
                </p>
              )}
            </div>

            {/* ── Review History ──────────────────────────────────────── */}
            {taskReviews.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                  Review History ({taskReviews.length})
                </p>
                <div className="space-y-3">
                  {taskReviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-lg overflow-hidden"
                      style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                        style={{ backgroundColor: "var(--bg-hover)" }}
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant={reviewActionVariant[review.action] || "neutral"}>
                            {reviewActionLabel[review.action] || review.action}
                          </Badge>
                          <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
                            {review.reviewer_name || `User #${review.reviewer}`}
                          </span>
                        </div>
                        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                          {fmtReviewDate(review.created_at)}
                        </span>
                      </div>
                      {review.comment && (
                        <p
                          className="px-4 py-3 text-sm whitespace-pre-wrap"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Task Outputs ────────────────────────────────────────── */}
            {taskOutputs.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                  Submitted Outputs ({taskOutputs.length})
                </p>
                <div className="space-y-3">
                  {taskOutputs.map((output) => (
                    <TaskOutputCard key={output.id} output={output} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Submit Output (IN_PROGRESS only) ────────────────────── */}
            {detailTask.status === "IN_PROGRESS" && canActOnTask(detailTask, user) && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
              >
                {submissionSuccess ? (
                  <div className="flex flex-col items-center py-6">
                    <div
                      className="flex h-14 w-14 items-center justify-center rounded-full mb-4"
                      style={{ backgroundColor: "var(--accent-muted)" }}
                    >
                      <CheckCircle2 className="h-7 w-7" style={{ color: "var(--accent)" }} />
                    </div>
                    <h4 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                      Task Submitted for Review
                    </h4>
                    <p className="text-sm mt-1 text-center max-w-xs" style={{ color: "var(--text-secondary)" }}>
                      Your output has been submitted and is now awaiting manager review.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-5"
                      onClick={async () => {
                        setSubmissionSuccess(false);
                        await openTaskDetail(detailTask.id);
                      }}
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--info)" }}>
                      <Upload className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                      {taskReviews.some((r) => r.action === "REJECTED" || r.action === "RETURNED")
                        ? "Resubmit Output"
                        : "Submit Output"}
                    </p>
                    {taskReviews.some((r) => r.action === "REJECTED" || r.action === "RETURNED") && (
                      <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
                        Address the reviewer feedback above before submitting again.
                      </p>
                    )}
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          Upload File
                        </label>
                        <div className="flex items-center gap-3">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.gif"
                            onChange={(e) => setOutputFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Choose File
                          </Button>
                          {outputFile && (
                            <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                              <span>{outputFile.name}</span>
                              <button
                                type="button"
                                className="cursor-pointer"
                                style={{ color: "var(--text-muted)" }}
                                onClick={() => {
                                  setOutputFile(null);
                                  if (fileInputRef.current) fileInputRef.current.value = "";
                                }}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                          PDF, DOCX, PNG, JPG accepted
                        </p>
                      </div>
                      <FormTextarea
                        label="Or Text Content"
                        name="output_text"
                        rows={3}
                        value={outputText}
                        onChange={(e) => setOutputText(e.target.value)}
                        placeholder="Enter text output..."
                      />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          onClick={handleSubmitOutput}
                          disabled={submittingOutput}
                        >
                          <Send className="h-3.5 w-3.5" />
                          {submittingOutput ? "Submitting..." : "Submit for Review"}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Review Section (SUBMITTED + manager only) ───────────── */}
            {detailTask.status === "SUBMITTED" && isManager(user?.role) && (
              <div
                className="rounded-lg p-4"
                style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--purple)" }}>
                  <FileCheck className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                  Review Submission
                </p>
                <div className="space-y-3">
                  <FormTextarea
                    label="Review Comment"
                    name="review_comment"
                    rows={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Add your review comments..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleReview("REJECTED")}
                      disabled={reviewing}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleReview("RETURNED")}
                      disabled={reviewing}
                    >
                      Return for Revision
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReview("APPROVED")}
                      disabled={reviewing}
                    >
                      {reviewing ? "Processing..." : "Approve"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Status Transition Buttons ───────────────────────────── */}
            {getTransitionActions(detailTask, user).length > 0 && (
              <div
                className="rounded-lg p-4"
                style={{
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                  Transition Status
                </p>
                <FormTextarea
                  label="Comment (optional)"
                  name="transition_comment"
                  rows={2}
                  value={transitionComment}
                  onChange={(e) => setTransitionComment(e.target.value)}
                  placeholder="Add a comment for this transition..."
                />
                <div className="flex flex-wrap gap-2 mt-3">
                  {getTransitionActions(detailTask, user).map((action) => {
                    if (action.managerOnly && !isManager(user?.role)) return null;
                    // Skip submit-output button here since we handle it above
                    if (
                      detailTask.status === "IN_PROGRESS" &&
                      action.targetStatus === "SUBMITTED"
                    )
                      return null;
                    // Skip review actions here since we handle them above
                    if (detailTask.status === "SUBMITTED" && action.managerOnly) return null;
                    return (
                      <Button
                        key={action.label}
                        variant={action.variant}
                        size="sm"
                        onClick={() => handleTransition(action.targetStatus)}
                        disabled={transitioning}
                      >
                        {transitioning ? "Processing..." : action.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
