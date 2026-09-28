"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, FolderKanban, Pause, CheckCircle2, BarChart3, Loader2, Sparkles, FileText, ListChecks, Wand2, Trash2, Pencil, Check, X } from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { Markdown } from "@/components/ui/markdown";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Project, Department, PaginatedResponse, ProjectMilestone } from "@/lib/types";

const statusVariant: Record<string, "success" | "warning" | "info" | "neutral" | "danger"> = {
  ACTIVE: "success",
  ON_HOLD: "warning",
  COMPLETED: "info",
  CANCELLED: "danger",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const progressColor = (status: string) => {
  if (status === "COMPLETED") return "var(--info)";
  if (status === "ON_HOLD") return "var(--warning)";
  if (status === "CANCELLED") return "var(--danger)";
  return "var(--accent)";
};

const avatarColors = ["#f85149", "#4ade80", "#bc8cff", "#58a6ff", "#d29922", "#f0b429", "#8b949e"];

export default function ProjectsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    start_year: new Date().getFullYear().toString(),
    end_year: (new Date().getFullYear() + 1).toString(),
    department: "",
    status: "ACTIVE",
  });

  // Detail modal + AI tools state
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "ai">("overview");
  const [aiTab, setAiTab] = useState<"milestones" | "summary" | "report">("milestones");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string>("");
  const [aiMilestones, setAiMilestones] = useState<{ title: string; description?: string; deadline?: string }[]>([]);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [reportPeriod, setReportPeriod] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
    title: "Progress Report",
  });
  const [savingMilestones, setSavingMilestones] = useState(false);

  // Milestones list + editing
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", description: "", deadline: "" });
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);

  // Project edit
  const [editingProject, setEditingProject] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", start_year: "", end_year: "", department: "", status: "ACTIVE" });

  const fetchProjects = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<Project>>("/api/v1/projects/projects/");
      setProjects(res.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    async function fetchDepts() {
      try {
        const res = await api.get<PaginatedResponse<Department>>("/api/v1/organisations/departments/");
        setDepartments(res.results);
      } catch {
        // silently fail
      }
    }
    fetchDepts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/projects/projects/", {
        name: form.name,
        start_year: Number(form.start_year),
        end_year: Number(form.end_year),
        department: form.department ? Number(form.department) : null,
        status: form.status,
      });
      toast.success("Project created successfully");
      setModalOpen(false);
      setForm({ name: "", start_year: new Date().getFullYear().toString(), end_year: (new Date().getFullYear() + 1).toString(), department: "", status: "ACTIVE" });
      fetchProjects();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  const loadMilestones = useCallback(async (projectId: number) => {
    setMilestonesLoading(true);
    try {
      const res = await api.get<PaginatedResponse<ProjectMilestone>>(
        `/api/v1/projects/project-milestones/?project=${projectId}`,
      );
      setMilestones(res.results.filter((m) => m.project === projectId));
    } catch {
      setMilestones([]);
    } finally {
      setMilestonesLoading(false);
    }
  }, []);

  const openDetail = (p: Project) => {
    setDetailProject(p);
    setDetailTab("overview");
    setAiTab("milestones");
    setAiResult("");
    setAiMilestones([]);
    setAiFile(null);
    setEditingProject(false);
    setEditForm({
      name: p.name,
      start_year: String(p.start_year),
      end_year: String(p.end_year),
      department: p.department ? String(p.department) : "",
      status: p.status,
    });
    loadMilestones(p.id);
  };

  const closeDetail = () => {
    setDetailProject(null);
    setAiResult("");
    setAiMilestones([]);
    setAiFile(null);
    setMilestones([]);
    setEditingProject(false);
    setEditingMilestoneId(null);
    setShowMilestoneForm(false);
  };

  const saveProjectEdits = async () => {
    if (!detailProject) return;
    try {
      const updated = await api.patch<Project>(`/api/v1/projects/projects/${detailProject.id}/`, {
        name: editForm.name,
        start_year: Number(editForm.start_year),
        end_year: Number(editForm.end_year),
        department: editForm.department ? Number(editForm.department) : null,
        status: editForm.status,
      });
      toast.success("Project updated");
      setEditingProject(false);
      setDetailProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      toast.error((err as Error).message || "Failed to update project");
    }
  };

  const deleteProject = async () => {
    if (!detailProject) return;
    if (!confirm(`Delete project "${detailProject.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/projects/projects/${detailProject.id}/`);
      toast.success("Project deleted");
      setProjects((prev) => prev.filter((p) => p.id !== detailProject.id));
      closeDetail();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete project");
    }
  };

  const startAddMilestone = () => {
    setEditingMilestoneId(null);
    setMilestoneForm({ title: "", description: "", deadline: "" });
    setShowMilestoneForm(true);
  };

  const startEditMilestone = (m: ProjectMilestone) => {
    setEditingMilestoneId(m.id);
    setMilestoneForm({ title: m.title, description: m.description, deadline: m.deadline });
    setShowMilestoneForm(true);
  };

  const cancelMilestoneEdit = () => {
    setEditingMilestoneId(null);
    setShowMilestoneForm(false);
    setMilestoneForm({ title: "", description: "", deadline: "" });
  };

  const saveMilestone = async () => {
    if (!detailProject) return;
    if (!milestoneForm.title || !milestoneForm.deadline) {
      toast.error("Title and deadline are required");
      return;
    }
    try {
      if (editingMilestoneId) {
        await api.patch(`/api/v1/projects/project-milestones/${editingMilestoneId}/`, {
          title: milestoneForm.title,
          description: milestoneForm.description,
          deadline: milestoneForm.deadline,
        });
        toast.success("Milestone updated");
      } else {
        await api.post(`/api/v1/projects/project-milestones/`, {
          project: detailProject.id,
          title: milestoneForm.title,
          description: milestoneForm.description,
          deadline: milestoneForm.deadline,
          is_completed: false,
        });
        toast.success("Milestone added");
      }
      cancelMilestoneEdit();
      loadMilestones(detailProject.id);
      fetchProjects();
    } catch (err) {
      toast.error((err as Error).message || "Failed to save milestone");
    }
  };

  const toggleMilestoneComplete = async (m: ProjectMilestone) => {
    if (!detailProject) return;
    try {
      await api.patch(`/api/v1/projects/project-milestones/${m.id}/`, {
        is_completed: !m.is_completed,
        completed_at: !m.is_completed ? new Date().toISOString() : null,
      });
      loadMilestones(detailProject.id);
      fetchProjects();
    } catch (err) {
      toast.error((err as Error).message || "Failed to update milestone");
    }
  };

  const deleteMilestone = async (m: ProjectMilestone) => {
    if (!detailProject) return;
    if (!confirm(`Delete milestone "${m.title}"?`)) return;
    try {
      await api.delete(`/api/v1/projects/project-milestones/${m.id}/`);
      toast.success("Milestone deleted");
      loadMilestones(detailProject.id);
      fetchProjects();
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete milestone");
    }
  };

  const runExtractMilestones = async () => {
    if (!detailProject) return;
    if (!aiFile) {
      toast.error("Upload a workplan or result framework first");
      return;
    }
    setAiLoading(true);
    setAiResult("");
    setAiMilestones([]);
    try {
      const fd = new FormData();
      fd.append("file", aiFile);
      fd.append("project_id", String(detailProject.id));
      const res = await api.upload<{ milestones: { title: string; description?: string; deadline?: string }[]; raw: string }>(
        "/api/v1/ai-tools/extract-milestones/",
        fd,
      );
      setAiMilestones(res.milestones || []);
      setAiResult(res.raw || "");
      if ((res.milestones || []).length === 0) {
        toast.error("No milestones could be extracted from this document");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to extract milestones");
    } finally {
      setAiLoading(false);
    }
  };

  const saveExtractedMilestones = async () => {
    if (!detailProject || aiMilestones.length === 0) return;
    setSavingMilestones(true);
    try {
      let saved = 0;
      for (const m of aiMilestones) {
        await api.post("/api/v1/projects/project-milestones/", {
          project: detailProject.id,
          title: m.title,
          description: m.description || "",
          deadline: m.deadline || null,
          is_completed: false,
        }).catch(() => {});
        saved += 1;
      }
      toast.success(`Saved ${saved} milestones`);
      setAiMilestones([]);
    } finally {
      setSavingMilestones(false);
    }
  };

  const runProgressSummary = async () => {
    if (!detailProject) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const res = await api.post<{ summary: string }>(
        "/api/v1/ai-tools/project-progress-summary/",
        { project_id: detailProject.id },
      );
      setAiResult(res.summary);
    } catch (err) {
      toast.error((err as Error).message || "Failed to summarise project");
    } finally {
      setAiLoading(false);
    }
  };

  const runDraftReport = async () => {
    if (!detailProject) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const res = await api.post<{ content: string; report_id: number }>(
        "/api/v1/ai-tools/draft-project-report/",
        {
          project_id: detailProject.id,
          period_start: reportPeriod.start,
          period_end: reportPeriod.end,
          title: reportPeriod.title,
        },
      );
      setAiResult(res.content);
      toast.success("Draft saved as a Project Report");
    } catch (err) {
      toast.error((err as Error).message || "Failed to draft report");
    } finally {
      setAiLoading(false);
    }
  };

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const onHoldCount = projects.filter((p) => p.status === "ON_HOLD").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;

  const stats = [
    { label: "Active", value: activeCount, icon: FolderKanban, labelColor: "var(--accent)" },
    { label: "On Hold", value: onHoldCount, icon: Pause, labelColor: "var(--warning)" },
    { label: "Completed", value: completedCount, icon: CheckCircle2, labelColor: "var(--info)" },
    { label: "Total", value: projects.length, icon: BarChart3, labelColor: "var(--text-secondary)" },
  ];

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
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Projects</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{projects.length} projects</p>
        </div>
        <Button size="md" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value} icon={s.icon} labelColor={s.labelColor} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p, idx) => {
          const color = avatarColors[idx % avatarColors.length];
          const progress = p.progress_percentage ?? 0;
          return (
            <div
              key={p.id}
              onClick={() => openDetail(p)}
              className="cursor-pointer rounded-xl border p-6 transition-all"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--accent-muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{p.name}</h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Badge variant="neutral">{deptMap[p.department ?? 0] || "No Dept"}</Badge>
                    <Badge variant={statusVariant[p.status] || "neutral"}>
                      <span
                        className="mr-1 inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: progressColor(p.status) }}
                      />
                      {statusLabel[p.status] || p.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{p.start_year}</span>
                <span style={{ color: "var(--border)" }}>&mdash;</span>
                <span>{p.end_year}</span>
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-secondary)" }}>Progress</span>
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--bg-primary)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: progressColor(p.status) }}
                  />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ backgroundColor: color + "20", color }}
                >
                  {p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p.owner_name || `Owner #${p.owner}`}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Project">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormInput
            label="Project Name"
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Start Year"
              name="start_year"
              type="number"
              required
              value={form.start_year}
              onChange={(e) => setForm({ ...form, start_year: e.target.value })}
            />
            <FormInput
              label="End Year"
              name="end_year"
              type="number"
              required
              value={form.end_year}
              onChange={(e) => setForm({ ...form, end_year: e.target.value })}
            />
          </div>
          <FormSelect
            label="Department"
            name="department"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            placeholder="Select department..."
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          />
          <FormSelect
            label="Status"
            name="status"
            required
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "ON_HOLD", label: "On Hold" },
              { value: "COMPLETED", label: "Completed" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Project detail + AI tools modal ─────────────────────────── */}
      <Modal
        isOpen={!!detailProject}
        onClose={closeDetail}
        title={detailProject?.name || "Project"}
        className="max-w-3xl"
      >
        {detailProject && (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="neutral">{deptMap[detailProject.department ?? 0] || "No Dept"}</Badge>
                <Badge variant={statusVariant[detailProject.status] || "neutral"}>
                  {statusLabel[detailProject.status] || detailProject.status}
                </Badge>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {detailProject.start_year} – {detailProject.end_year}
                </span>
                <span className="text-xs font-semibold" style={{ color: "var(--accent)" }}>
                  {detailProject.progress_percentage ?? 0}% complete
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingProject((v) => !v)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs cursor-pointer"
                  style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
                  onClick={deleteProject}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs cursor-pointer"
                  style={{ color: "var(--danger)", border: "1px solid var(--border)" }}
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>

            {/* Project edit form */}
            {editingProject && (
              <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
                <FormInput
                  label="Project Name"
                  name="edit_name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormInput
                    label="Start Year"
                    name="edit_start"
                    type="number"
                    value={editForm.start_year}
                    onChange={(e) => setEditForm({ ...editForm, start_year: e.target.value })}
                  />
                  <FormInput
                    label="End Year"
                    name="edit_end"
                    type="number"
                    value={editForm.end_year}
                    onChange={(e) => setEditForm({ ...editForm, end_year: e.target.value })}
                  />
                </div>
                <FormSelect
                  label="Department"
                  name="edit_dept"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  placeholder="Select department..."
                  options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
                />
                <FormSelect
                  label="Status"
                  name="edit_status"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "ON_HOLD", label: "On Hold" },
                    { value: "COMPLETED", label: "Completed" },
                    { value: "CANCELLED", label: "Cancelled" },
                  ]}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onMouseDown={(e) => { e.preventDefault(); setEditingProject(false); }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); saveProjectEdits(); }}
                  >
                    Save
                  </Button>
                </div>
              </div>
            )}

            {/* Top-level tabs: Overview vs AI */}
            <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--bg-hover)" }}>
              {[
                { key: "overview", label: "Overview & Milestones" },
                { key: "ai", label: "AI Tools" },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDetailTab(t.key as typeof detailTab)}
                  className="flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer"
                  style={{
                    backgroundColor: detailTab === t.key ? "var(--bg-card)" : "transparent",
                    color: detailTab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Overview & Milestones tab */}
            {detailTab === "overview" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Milestones</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                      {detailProject.completed_milestones ?? 0}/{detailProject.total_milestones ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Tasks</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                      {detailProject.total_tasks ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Owner</p>
                    <p className="mt-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                      {detailProject.owner_name || `#${detailProject.owner}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Milestones</h3>
                  {!showMilestoneForm && (
                    <Button type="button" size="sm" onClick={startAddMilestone}>
                      <Plus className="h-3 w-3" /> Add milestone
                    </Button>
                  )}
                </div>

                {showMilestoneForm && (
                  <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {editingMilestoneId ? "Edit milestone" : "New milestone"}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onMouseDown={(e) => { e.preventDefault(); cancelMilestoneEdit(); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onMouseDown={(e) => { e.preventDefault(); saveMilestone(); }}
                        >
                          {editingMilestoneId ? "Update" : "Add"}
                        </Button>
                      </div>
                    </div>
                    <FormInput
                      label="Title"
                      name="ms_title"
                      required
                      value={milestoneForm.title}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                    />
                    <FormInput
                      label="Description"
                      name="ms_desc"
                      value={milestoneForm.description}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, description: e.target.value })}
                    />
                    <FormInput
                      label="Deadline (YYYY-MM-DD)"
                      name="ms_deadline"
                      type="text"
                      placeholder="2026-12-31"
                      required
                      value={milestoneForm.deadline}
                      onChange={(e) => setMilestoneForm({ ...milestoneForm, deadline: e.target.value })}
                    />
                  </div>
                )}

                {milestonesLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--accent)" }} />
                  </div>
                ) : milestones.length === 0 ? (
                  <p className="text-center text-xs py-4" style={{ color: "var(--text-muted)" }}>
                    No milestones yet. Add one or use AI to extract them.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {milestones.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-start gap-3 rounded-lg border p-3"
                        style={{ borderColor: "var(--border)", backgroundColor: m.is_completed ? "var(--bg-hover)" : "transparent" }}
                      >
                        <button
                          type="button"
                          onClick={() => toggleMilestoneComplete(m)}
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border cursor-pointer"
                          style={{
                            borderColor: m.is_completed ? "var(--accent)" : "var(--border)",
                            backgroundColor: m.is_completed ? "var(--accent)" : "transparent",
                          }}
                          aria-label={m.is_completed ? "Mark incomplete" : "Mark complete"}
                        >
                          {m.is_completed && <Check className="h-3 w-3" style={{ color: "var(--accent-on)" }} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium"
                            style={{ color: "var(--text-primary)", textDecoration: m.is_completed ? "line-through" : "none" }}
                          >
                            {m.title}
                          </p>
                          {m.description && (
                            <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>{m.description}</p>
                          )}
                          <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Due {m.deadline}
                            {m.completed_at && ` · Completed ${new Date(m.completed_at).toLocaleDateString()}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditMilestone(m)}
                            className="flex h-7 w-7 items-center justify-center rounded cursor-pointer"
                            style={{ color: "var(--text-secondary)" }}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMilestone(m)}
                            className="flex h-7 w-7 items-center justify-center rounded cursor-pointer"
                            style={{ color: "var(--danger)" }}
                            aria-label="Delete"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI tools tab strip */}
            {detailTab === "ai" && (
            <div className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1 border-b p-1.5" style={{ borderColor: "var(--border)" }}>
                {[
                  { key: "milestones", label: "Extract Milestones", icon: ListChecks },
                  { key: "summary", label: "Progress Summary", icon: Sparkles },
                  { key: "report", label: "Draft Report", icon: FileText },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setAiTab(t.key as typeof aiTab);
                      setAiResult("");
                      setAiMilestones([]);
                    }}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: aiTab === t.key ? "var(--accent-muted)" : "transparent",
                      color: aiTab === t.key ? "var(--accent)" : "var(--text-secondary)",
                    }}
                  >
                    <t.icon className="h-3.5 w-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Tab: extract milestones */}
                {aiTab === "milestones" && (
                  <div className="space-y-4">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      Upload a workplan or result framework (PDF, DOCX, or text). The AI will extract milestones with deadlines.
                    </p>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                      className="block w-full text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    />
                    <Button type="button" onClick={runExtractMilestones} disabled={aiLoading || !aiFile}>
                      {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                      Extract milestones
                    </Button>

                    {aiMilestones.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                            {aiMilestones.length} milestone{aiMilestones.length === 1 ? "" : "s"} extracted
                          </p>
                          <Button type="button" size="sm" onClick={saveExtractedMilestones} disabled={savingMilestones}>
                            {savingMilestones ? "Saving..." : "Save all to project"}
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto rounded-lg p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
                          {aiMilestones.map((m, i) => (
                            <div key={i} className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{m.title}</p>
                              {m.description && (
                                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{m.description}</p>
                              )}
                              {m.deadline && (
                                <p className="mt-1 text-[10px] font-medium" style={{ color: "var(--accent)" }}>
                                  Due {m.deadline}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {aiResult && aiMilestones.length === 0 && (
                      <details>
                        <summary className="cursor-pointer text-[11px] font-medium" style={{ color: "var(--accent)" }}>
                          View raw AI output
                        </summary>
                        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg p-3 text-[11px]" style={{ backgroundColor: "var(--bg-hover)" }}>
                          {aiResult}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {/* Tab: progress summary */}
                {aiTab === "summary" && (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      One-click AI summary of the project&apos;s status from tasks and milestones.
                    </p>
                    <Button type="button" onClick={runProgressSummary} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Generate summary
                    </Button>
                    {aiResult && (
                      <div className="rounded-lg p-4 max-h-80 overflow-y-auto" style={{ backgroundColor: "var(--bg-hover)" }}>
                        <Markdown>{aiResult}</Markdown>
                        <p className="mt-3 text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                          AI-Generated Draft
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: draft report */}
                {aiTab === "report" && (
                  <div className="space-y-3">
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      Generate a structured draft report for a reporting period. Saved automatically as a Project Report draft.
                    </p>
                    <Button type="button" onClick={runDraftReport} disabled={aiLoading}>
                      {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                      Generate draft
                    </Button>
                    <FormInput
                      label="Report title"
                      name="report_title"
                      value={reportPeriod.title}
                      onChange={(e) => setReportPeriod({ ...reportPeriod, title: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormInput
                        label="Period start (YYYY-MM-DD)"
                        name="period_start"
                        type="text"
                        placeholder="2026-01-01"
                        value={reportPeriod.start}
                        onChange={(e) => setReportPeriod({ ...reportPeriod, start: e.target.value })}
                      />
                      <FormInput
                        label="Period end (YYYY-MM-DD)"
                        name="period_end"
                        type="text"
                        placeholder="2026-12-31"
                        value={reportPeriod.end}
                        onChange={(e) => setReportPeriod({ ...reportPeriod, end: e.target.value })}
                      />
                    </div>
                    {aiResult && (
                      <div className="rounded-lg p-4 max-h-80 overflow-y-auto" style={{ backgroundColor: "var(--bg-hover)" }}>
                        <Markdown>{aiResult}</Markdown>
                        <p className="mt-3 text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                          AI-Generated Draft · saved to Project Reports
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
