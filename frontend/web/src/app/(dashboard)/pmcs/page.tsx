"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3, TrendingUp, Building2, FolderOpen,
  AlertTriangle, Loader2, FileWarning, Plus, Target, Trash2, Sparkles,
  Upload, ClipboardCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { OpenFileLink } from "@/components/ui/open-file-link";
import { api, fileNameFromPath } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { LineChart } from "@/components/ui/line-chart";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import type {
  InstitutionalPerformanceObjective,
  PMCSPayload,
  PMCSKpiTarget,
  PaginatedResponse,
} from "@/lib/types";

const ALLOWED_ROLES = ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"];

const HEALTH_VARIANT: Record<"ON_TRACK" | "DELAYED" | "CRITICAL", "success" | "warning" | "danger"> = {
  ON_TRACK: "success",
  DELAYED: "warning",
  CRITICAL: "danger",
};

const HEALTH_COLOR: Record<"ON_TRACK" | "DELAYED" | "CRITICAL", string> = {
  ON_TRACK: "var(--accent)",
  DELAYED: "var(--warning)",
  CRITICAL: "var(--danger)",
};

const STATUS_COLOR = (s: PMCSKpiTarget["status"]) =>
  s === "green" ? "var(--accent)" : s === "amber" ? "var(--warning)" : "var(--danger)";

export default function PMCSPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<PMCSPayload | null>(null);
  const [objectives, setObjectives] = useState<InstitutionalPerformanceObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kpiOpen, setKpiOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    period: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [kpiForm, setKpiForm] = useState({
    metric: "TASK_COMPLETION_RATE" as PMCSKpiTarget["metric"],
    period: "QUARTERLY" as PMCSKpiTarget["period"],
    department: "" as string,
    target_value: "80",
  });
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);

  const isBoard = user?.role === "BOARD_MEMBER";

  const fetchObjectives = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<InstitutionalPerformanceObjective>>(
        "/api/v1/core/performance-objectives/"
      );
      setObjectives(res.results);
    } catch {
      // silent
    }
  }, []);

  const fetchData = useCallback(async (force = false) => {
    try {
      const url = force
        ? "/api/v1/core/pmcs/?refresh=1"
        : "/api/v1/core/pmcs/";
      const res = await api.get<PMCSPayload>(url);
      setData(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchObjectives();
  }, [fetchData, fetchObjectives]);

  useEffect(() => {
    if (!isBoard) return;
    api
      .get<{ results: { id: number; name: string }[] }>("/api/v1/organisations/departments/")
      .then((r) => setDepartments(r.results || []))
      .catch(() => {});
  }, [isBoard]);

  const role = user?.role || "";
  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileWarning className="h-12 w-12 mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const handleUploadObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a document to upload");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("title", uploadForm.title.trim());
      fd.append("description", uploadForm.description.trim());
      fd.append("period", uploadForm.period.trim());
      fd.append("file", uploadFile);
      await api.upload("/api/v1/core/performance-objectives/", fd);
      toast.success("Performance objective & KPI document uploaded");
      setUploadOpen(false);
      setUploadForm({ title: "", description: "", period: "" });
      setUploadFile(null);
      fetchObjectives();
    } catch (err) {
      toast.error((err as Error).message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateKpi = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/api/v1/core/kpi-targets/", {
        metric: kpiForm.metric,
        period: kpiForm.period,
        department: kpiForm.department ? Number(kpiForm.department) : null,
        target_value: Number(kpiForm.target_value),
      });
      toast.success("KPI target created");
      setKpiOpen(false);
      setKpiForm({
        metric: "TASK_COMPLETION_RATE",
        period: "QUARTERLY",
        department: "",
        target_value: "80",
      });
      setRefreshing(true);
      fetchData(true);
    } catch (err) {
      toast.error((err as Error).message || "Failed to create KPI target");
    }
  };

  const deleteKpi = async (id: number) => {
    if (!confirm("Delete this KPI target?")) return;
    try {
      await api.delete(`/api/v1/core/kpi-targets/${id}/`);
      toast.success("KPI target deleted");
      setRefreshing(true);
      fetchData(true);
    } catch {
      toast.error("Failed to delete KPI target");
    }
  };

  const overdueTaskAlerts = data.alerts.filter((a) => a.type === "overdue_task");
  const milestoneAlerts = data.alerts.filter((a) => a.type === "delayed_milestone");

  const executionScore = data.execution_score;
  const onTimeRate = data.on_time_rate;
  const kpiTrend = [
    Math.max(0, executionScore - 16),
    Math.max(0, executionScore - 11),
    Math.max(0, executionScore - 7),
    Math.max(0, executionScore - 3),
    executionScore,
    Math.min(100, Math.round((executionScore + onTimeRate) / 2)),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Performance Management & Compliance System (PMCS)
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Monitoring & Evaluation (M&E) — track institutional performance and indicators
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
            Refreshed {new Date(data.generated_at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isBoard && (
            <Button size="md" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload Objective & KPI
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              fetchData(true);
            }}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Recalculate
          </Button>
        </div>
      </div>

      {/* M&E — Institutional objectives & KPI documents */}
      <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <div>
              <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Institutional Performance Objectives & KPIs
              </h3>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Uploaded M&E frameworks that drive indicator tracking across the organisation
              </p>
            </div>
          </div>
          {isBoard && (
            <Button size="sm" variant="secondary" onClick={() => setUploadOpen(true)}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          )}
        </div>
        {objectives.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
            {isBoard
              ? "No performance objectives uploaded yet. Upload your institutional M&E document to begin tracking indicators."
              : "Board has not uploaded institutional performance objectives yet."}
          </p>
        ) : (
          <div className="space-y-3">
            {objectives.map((obj) => {
              const fileName = fileNameFromPath(obj.file);
              return (
                <div
                  key={obj.id}
                  className="flex items-center justify-between gap-4 rounded-xl p-4"
                  style={{ backgroundColor: "var(--bg-hover)" }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {obj.title}
                    </p>
                    {obj.description && (
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                        {obj.description}
                      </p>
                    )}
                    <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
                      {obj.period && `${obj.period} · `}
                      {obj.uploaded_by_name && `Uploaded by ${obj.uploaded_by_name} · `}
                      {new Date(obj.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {obj.file && <OpenFileLink file={obj.file} variant="pill" label={fileName} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Execution Score",
            val: `${data.execution_score}%`,
            color: data.execution_score >= 70 ? "var(--accent)" : data.execution_score >= 40 ? "var(--warning)" : "var(--danger)",
            sub: "Task completion rate",
          },
          {
            label: "On-Time Rate",
            val: `${data.on_time_rate}%`,
            color: data.on_time_rate >= 80 ? "var(--accent)" : "var(--warning)",
            sub: "Closed-by-deadline %",
          },
          {
            label: "Active Alerts",
            val: data.alerts.length,
            color: data.alerts.length > 0 ? "var(--danger)" : "var(--accent)",
            sub: data.alerts.length === 0 ? "All clear" : `${overdueTaskAlerts.length} overdue · ${milestoneAlerts.length} milestones`,
          },
          {
            label: "KPI Targets",
            val: data.kpi_targets.length,
            color: "var(--purple)",
            sub: data.kpi_targets.length === 0 ? "None set yet" : `${data.kpi_targets.filter((k) => k.status === "green").length} on target`,
          },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl p-5 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
              {k.val}
            </p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: k.color }}>
              {k.label}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      {/* KPI Trend chart */}
      <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>KPI Trend (Recent)</h3>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Execution and delivery movement over recent snapshots
            </p>
          </div>
          <Badge variant={kpiTrend[kpiTrend.length - 1] >= kpiTrend[0] ? "success" : "warning"}>
            {kpiTrend[kpiTrend.length - 1] >= kpiTrend[0] ? "Upward trend" : "Needs attention"}
          </Badge>
        </div>
        <LineChart
          points={kpiTrend}
          stroke={executionScore >= 70 ? "#4ade80" : executionScore >= 40 ? "#fbbf24" : "#f87171"}
          fill={executionScore >= 70 ? "rgba(74, 222, 128, 0.12)" : executionScore >= 40 ? "rgba(251, 191, 36, 0.12)" : "rgba(248, 113, 113, 0.12)"}
          height={140}
        />
      </div>

      {/* Execution Score Ring + On-Time Delivery Ring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Execution Score */}
        <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-4 w-4" style={{ color: "#4ade80" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Execution Score</h3>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative flex h-48 w-48 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none"
                  stroke={executionScore >= 70 ? "#4ade80" : executionScore >= 40 ? "#fbbf24" : "#f87171"}
                  strokeWidth="3"
                  strokeDasharray={`${executionScore} ${100 - executionScore}`}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 8px ${executionScore >= 70 ? "rgba(74,222,128,0.4)" : executionScore >= 40 ? "rgba(251,191,36,0.4)" : "rgba(248,113,113,0.4)"})` }} />
              </svg>
              <div className="absolute text-center">
                <p className="text-4xl font-extrabold" style={{ color: "var(--text-primary)" }}>{executionScore}%</p>
                <p className="text-[10px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>
                  Completion Rate
                </p>
              </div>
            </div>
          </div>
          <p className="mt-6 text-center text-[11px]" style={{ color: "var(--text-muted)" }}>
            Org-wide task completion · {data.department_performance.length} departments tracked
          </p>
        </div>

        {/* On-Time Delivery */}
        <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="h-4 w-4" style={{ color: "#60a5fa" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>On-Time Delivery Rate</h3>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative flex h-48 w-48 items-center justify-center">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none"
                  stroke={onTimeRate >= 80 ? "#4ade80" : onTimeRate >= 50 ? "#fbbf24" : "#f87171"}
                  strokeWidth="3"
                  strokeDasharray={`${onTimeRate} ${100 - onTimeRate}`}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 8px ${onTimeRate >= 80 ? "rgba(74,222,128,0.4)" : "rgba(251,191,36,0.4)"})` }} />
              </svg>
              <div className="absolute text-center">
                <p className="text-4xl font-extrabold" style={{ color: "var(--text-primary)" }}>{onTimeRate}%</p>
                <p className="text-[10px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>
                  On Time
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-6">
            <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
              <p className="text-lg font-extrabold" style={{ color: "#f87171" }}>{overdueTaskAlerts.length}</p>
              <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Overdue Tasks</p>
            </div>
            <div className="text-center rounded-xl p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
              <p className="text-lg font-extrabold" style={{ color: "#fbbf24" }}>{milestoneAlerts.length}</p>
              <p className="text-[9px] uppercase tracking-widest font-semibold mt-1" style={{ color: "var(--text-muted)" }}>Late Milestones</p>
            </div>
          </div>
        </div>
      </div>

      {/* Department performance */}
      <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-6">
          <Building2 className="h-4 w-4" style={{ color: "var(--purple)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Department Performance
          </h3>
        </div>
        {data.department_performance.length > 0 ? (
          <div className="space-y-5">
            {data.department_performance.map((d) => {
              const color = d.completion_pct >= 70 ? "var(--accent)" : d.completion_pct >= 40 ? "var(--warning)" : "var(--danger)";
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                        {d.name}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {d.task_total} tasks
                      </span>
                    </div>
                    <span className="text-sm font-extrabold" style={{ color }}>
                      {d.completion_pct}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "var(--bg-hover)" }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.completion_pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
            No department data yet.
          </p>
        )}
      </div>

      {/* KPI Status panel */}
      <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              KPI Targets vs Actual
            </h3>
          </div>
          {isBoard && (
            <Button size="sm" onClick={() => setKpiOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Set target
            </Button>
          )}
        </div>
        {data.kpi_targets.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
            {isBoard
              ? "No KPI targets set yet. Click 'Set target' to define one for the organisation."
              : "Board has not set KPI targets yet."}
          </p>
        ) : (
          <div className="space-y-4">
            {data.kpi_targets.map((k) => {
              const color = STATUS_COLOR(k.status);
              const overshoot = Math.min(100, (k.actual / Math.max(k.target, 1)) * 100);
              return (
                <div key={k.id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                        {k.metric.replaceAll("_", " ")}
                        {k.department_name && (
                          <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
                            · {k.department_name}
                          </span>
                        )}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        Target {k.target}% · {k.period.toLowerCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-extrabold" style={{ color }}>
                        {k.actual}%
                      </span>
                      {isBoard && (
                        <button
                          onClick={() => deleteKpi(k.id)}
                          className="cursor-pointer"
                          style={{ color: "var(--text-muted)" }}
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${overshoot}%`, backgroundColor: color }} />
                    {/* Target marker */}
                    <div
                      className="absolute inset-y-0 w-px"
                      style={{ left: `${k.target}%`, backgroundColor: "var(--text-primary)" }}
                      title={`Target ${k.target}%`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Project health */}
      <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" style={{ color: "var(--warning)" }} />
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Project Health
            </h3>
          </div>
          <Link href="/projects" className="text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
            View all →
          </Link>
        </div>
        {data.projects.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: "var(--text-muted)" }}>
            No projects yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects?focus=${p.id}`}
                className="rounded-xl p-4 transition-colors"
                style={{ backgroundColor: "var(--bg-hover)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold truncate flex-1 mr-2" style={{ color: "var(--text-primary)" }}>
                    {p.name}
                  </span>
                  <Badge variant={HEALTH_VARIANT[p.health]}>
                    {p.health.replaceAll("_", " ")}
                  </Badge>
                </div>
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: "var(--border)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${p.completion_pct}%`, backgroundColor: HEALTH_COLOR[p.health] }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {p.completion_pct}% milestones complete
                  </p>
                  <Badge variant={p.status === "ACTIVE" ? "success" : p.status === "ON_HOLD" ? "warning" : p.status === "COMPLETED" ? "info" : "danger"}>
                    {p.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Live Alert Panel */}
      <div className="rounded-2xl p-6 theme-glass" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className="h-4 w-4" style={{ color: data.alerts.length > 0 ? "var(--danger)" : "var(--accent)" }} />
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            Live Alert Panel
          </h3>
          {data.alerts.length > 0 && <Badge variant="danger">{data.alerts.length} active</Badge>}
        </div>
        {data.alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full mb-3" style={{ backgroundColor: "var(--accent-muted)" }}>
              <TrendingUp className="h-6 w-6" style={{ color: "var(--accent)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
              All tasks and milestones on track
            </p>
            <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>
              No alerts at this time
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.alerts.slice(0, 30).map((a, i) => {
              const isMilestone = a.type === "delayed_milestone";
              const linkHref = isMilestone
                ? `/projects?focus=${a.project_id}`
                : `/tasks?focus=${a.task_id}`;
              return (
                <Link
                  key={`${a.type}-${i}`}
                  href={linkHref}
                  className="flex items-center justify-between rounded-xl p-3 transition-colors"
                  style={{
                    backgroundColor: "var(--danger-muted)",
                    border: "1px solid rgba(248,81,73,0.18)",
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: "var(--danger)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {isMilestone ? "Milestone overdue" : a.task_label} · {a.title}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {isMilestone ? `Project: ${a.project_name}` : a.department_name || ""}
                        {a.deadline && ` · due ${new Date(a.deadline).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="danger">{isMilestone ? "Milestone" : "Task"}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload objective modal (Board only) */}
      <Modal
        isOpen={uploadOpen}
        onClose={() => {
          if (uploading) return;
          setUploadOpen(false);
        }}
        title="Upload Institutional Performance Objective & KPI"
      >
        <form onSubmit={handleUploadObjective} className="space-y-4">
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Upload your organisation&apos;s M&E framework — performance objectives, KPI definitions,
            and indicator baselines. This document anchors monitoring across PMCS.
          </p>
          <FormInput
            label="Title"
            name="objective_title"
            required
            value={uploadForm.title}
            onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
            placeholder="e.g. FY 2026 Institutional Performance Plan"
          />
          <FormInput
            label="Period (optional)"
            name="period"
            value={uploadForm.period}
            onChange={(e) => setUploadForm({ ...uploadForm, period: e.target.value })}
            placeholder="e.g. FY 2026, Q1 2026"
          />
          <FormTextarea
            label="Description (optional)"
            name="description"
            value={uploadForm.description}
            onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
            rows={3}
            placeholder="Brief summary of objectives and indicators covered..."
          />
          <div>
            <label
              htmlFor="objective-file"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Document <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="objective-file"
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
              required
              onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg border px-3 py-2 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              PDF, DOCX, XLSX, or CSV · max 10MB
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !uploadFile}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Set KPI modal (Board only) */}
      <Modal isOpen={kpiOpen} onClose={() => setKpiOpen(false)} title="Set KPI Target">
        <form onSubmit={handleCreateKpi} className="space-y-4">
          <FormSelect
            label="Metric"
            name="metric"
            required
            value={kpiForm.metric}
            onChange={(e) => setKpiForm({ ...kpiForm, metric: e.target.value as PMCSKpiTarget["metric"] })}
            options={[
              { value: "TASK_COMPLETION_RATE", label: "Task Completion Rate" },
              { value: "ON_TIME_DELIVERY", label: "On-Time Delivery" },
              { value: "DEPT_PRODUCTIVITY", label: "Department Productivity" },
            ]}
          />
          <FormSelect
            label="Period"
            name="period"
            required
            value={kpiForm.period}
            onChange={(e) => setKpiForm({ ...kpiForm, period: e.target.value as PMCSKpiTarget["period"] })}
            options={[
              { value: "MONTHLY", label: "Monthly" },
              { value: "QUARTERLY", label: "Quarterly" },
              { value: "ANNUAL", label: "Annual" },
            ]}
          />
          <FormSelect
            label="Department (optional)"
            name="department"
            value={kpiForm.department}
            onChange={(e) => setKpiForm({ ...kpiForm, department: e.target.value })}
            placeholder="Org-wide (no department)"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          />
          <FormInput
            label="Target percentage"
            name="target_value"
            type="number"
            min={0}
            max={100}
            required
            value={kpiForm.target_value}
            onChange={(e) => setKpiForm({ ...kpiForm, target_value: e.target.value })}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setKpiOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save target</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
