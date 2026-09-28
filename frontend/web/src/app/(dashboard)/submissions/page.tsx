"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  FileCheck,
  Clock,
  CheckCircle2,
  CornerDownLeft,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useToast } from "@/components/ui/toast";
import TaskOutputCard from "@/components/task-output-card";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Task, TaskOutput, PaginatedResponse } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const priorityVariant: Record<string, "danger" | "warning" | "orange" | "info"> = {
  URGENT: "danger",
  HIGH: "warning",
  MEDIUM: "orange",
  LOW: "info",
};

const MANAGER_ROLES = ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Row type ─────────────────────────────────────────────────────────────────

interface SubmissionRow extends Record<string, unknown> {
  id: number;
  task_id: string;
  title: string;
  assigned_to_name: string;
  priority: string;
  deadline: string | null;
  submitted_at: string;
}

// =============================================================================
// Main Component
// =============================================================================

export default function SubmissionsPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Review modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskOutputs, setTaskOutputs] = useState<TaskOutput[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState(false);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchSubmissions = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<Task>>(
        "/api/v1/tasks/tasks/?status=SUBMITTED&ordering=-updated_at"
      );
      setTasks(res.results);
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  // ── Open review modal ─────────────────────────────────────────────────────

  const openReview = useCallback(
    async (taskId: number) => {
      try {
        const task = await api.get<Task>(`/api/v1/tasks/tasks/${taskId}/`);
        setSelectedTask(task);
        setTaskOutputs(task.outputs || []);
        setReviewComment("");
        setReviewModalOpen(true);
      } catch {
        toast.error("Failed to load task details");
      }
    },
    [toast]
  );

  // ── Handle review action ──────────────────────────────────────────────────

  const handleReview = async (action: "APPROVED" | "RETURNED" | "REJECTED") => {
    if (!selectedTask) return;
    setReviewing(true);
    try {
      await api.post(`/api/v1/tasks/tasks/${selectedTask.id}/review/`, {
        action,
        comment: reviewComment,
      });
      const label = action === "APPROVED" ? "approved" : action === "RETURNED" ? "returned" : "rejected";
      toast.success(`Task ${label} successfully`);
      setReviewModalOpen(false);
      setSelectedTask(null);
      fetchSubmissions();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to review task");
    } finally {
      setReviewing(false);
    }
  };

  // ── Role gate ─────────────────────────────────────────────────────────────

  if (!MANAGER_ROLES.includes(user?.role || "")) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-10 w-10 mb-3" style={{ color: "var(--warning)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          You do not have permission to view this page.
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          Only managers and above can review task submissions.
        </p>
      </div>
    );
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const pendingCount = tasks.length;

  // ── Table rows ────────────────────────────────────────────────────────────

  const rows: SubmissionRow[] = tasks.map((t) => {
    const latestOutput = t.outputs?.length ? t.outputs[t.outputs.length - 1] : null;
    return {
      id: t.id,
      task_id: t.task_id,
      title: t.title,
      assigned_to_name: t.assigned_to_name || "Unassigned",
      priority: t.priority,
      deadline: t.deadline,
      submitted_at: latestOutput?.created_at || t.updated_at,
    };
  });

  const columns: Column<SubmissionRow>[] = [
    { key: "task_id", header: "ID", className: "w-24" },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          {row.title.length > 50 ? row.title.slice(0, 50) + "..." : row.title}
        </span>
      ),
    },
    { key: "assigned_to_name", header: "Assignee" },
    {
      key: "submitted_at",
      header: "Submitted",
      render: (row) => (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {fmtDateTime(row.submitted_at)}
        </span>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      className: "w-24",
      render: (row) => (
        <Badge variant={priorityVariant[row.priority] || "info"}>
          {row.priority}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={(e) => {
            e.stopPropagation();
            openReview(row.id);
          }}
        >
          <FileCheck className="h-3.5 w-3.5" />
          Review
        </Button>
      ),
    },
  ];

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
          Submissions for Review
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Review task outputs submitted by your team
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Pending Review"
          value={pendingCount}
          icon={Clock}
          labelColor="var(--warning)"
        />
        <StatsCard
          label="Status"
          value={pendingCount === 0 ? "All Clear" : `${pendingCount} awaiting`}
          icon={FileCheck}
          labelColor="var(--info)"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => openReview(row.id)}
      />

      {pendingCount === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircle2 className="h-10 w-10 mb-3" style={{ color: "var(--accent)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            No pending submissions
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            All task submissions have been reviewed.
          </p>
        </div>
      )}

      {/* Review Modal */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setSelectedTask(null);
        }}
        title="Review Submission"
      >
        {selectedTask && (
          <div className="space-y-5">
            {/* Task info header */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {selectedTask.task_id}
                </span>
                <Badge variant={priorityVariant[selectedTask.priority] || "info"}>
                  {selectedTask.priority}
                </Badge>
              </div>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedTask.title}
              </h3>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Assigned to: <strong>{selectedTask.assigned_to_name || "Unassigned"}</strong>
                </span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  Deadline: <strong>{fmtDate(selectedTask.deadline)}</strong>
                </span>
              </div>
            </div>

            {/* Description */}
            {selectedTask.description && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Description
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {selectedTask.description}
                </p>
              </div>
            )}

            {/* Objectives */}
            {selectedTask.objectives && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                  Objectives
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                  {selectedTask.objectives}
                </p>
              </div>
            )}

            {/* Submitted Outputs */}
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

            {/* Review form */}
            <div
              className="rounded-lg p-4"
              style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--purple)" }}>
                <FileCheck className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                Your Review
              </p>
              <FormTextarea
                label="Review Comment"
                name="review_comment"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add your review comments..."
              />
              <div className="flex justify-end gap-2 mt-3">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleReview("REJECTED")}
                  disabled={reviewing}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReview("RETURNED")}
                  disabled={reviewing}
                >
                  <CornerDownLeft className="h-3.5 w-3.5" />
                  Return for Revision
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReview("APPROVED")}
                  disabled={reviewing}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {reviewing ? "Processing..." : "Approve"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
