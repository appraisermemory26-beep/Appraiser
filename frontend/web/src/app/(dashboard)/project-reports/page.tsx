"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, FileText, Sparkles, Save, Eye, Pencil, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Markdown } from "@/components/ui/markdown";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Project, ProjectReport, PaginatedResponse } from "@/lib/types";

export default function ProjectReportsPage() {
  const toast = useToast();
  const [reports, setReports] = useState<ProjectReport[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "drafts" | "final">("all");
  const [active, setActive] = useState<ProjectReport | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [r, p] = await Promise.all([
        api.get<PaginatedResponse<ProjectReport>>("/api/v1/projects/project-reports/"),
        api.get<PaginatedResponse<Project>>("/api/v1/projects/projects/"),
      ]);
      setReports(r.results || []);
      setProjects(p.results || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const visible = reports.filter((r) =>
    filter === "all" ? true : filter === "drafts" ? r.is_draft : !r.is_draft,
  );

  const open = (r: ProjectReport) => {
    setActive(r);
    setEditing(false);
    setEditForm({ title: r.title, content: r.content });
  };

  const save = async () => {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await api.patch<ProjectReport>(`/api/v1/projects/project-reports/${active.id}/`, {
        title: editForm.title,
        content: editForm.content,
      });
      toast.success("Report updated");
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActive(updated);
      setEditing(false);
    } catch (err) {
      toast.error((err as Error).message || "Failed to update report");
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!active) return;
    try {
      const updated = await api.patch<ProjectReport>(`/api/v1/projects/project-reports/${active.id}/`, {
        is_draft: false,
      });
      toast.success("Report marked final");
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActive(updated);
    } catch (err) {
      toast.error((err as Error).message || "Failed to finalise report");
    }
  };

  const remove = async () => {
    if (!active) return;
    if (!confirm("Delete this report? This cannot be undone.")) return;
    try {
      await api.delete(`/api/v1/projects/project-reports/${active.id}/`);
      toast.success("Report deleted");
      setReports((prev) => prev.filter((r) => r.id !== active.id));
      setActive(null);
    } catch (err) {
      toast.error((err as Error).message || "Failed to delete report");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Project Reports
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {reports.length} report{reports.length !== 1 ? "s" : ""} · including AI-generated drafts
          </p>
        </div>
        <div className="flex gap-1 rounded-lg p-1" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {(["all", "drafts", "final"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors cursor-pointer"
              style={{
                backgroundColor: filter === k ? "var(--accent-muted)" : "transparent",
                color: filter === k ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <FileText className="h-12 w-12 mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            {filter === "all"
              ? "No project reports yet."
              : filter === "drafts"
                ? "No draft reports."
                : "No finalised reports."}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Generate an AI draft from the Projects page to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((r) => (
            <button
              key={r.id}
              onClick={() => open(r)}
              className="group text-left rounded-xl border p-5 transition-all cursor-pointer"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                e.currentTarget.style.borderColor = "var(--accent-muted)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--bg-card)";
                e.currentTarget.style.borderColor = "var(--border)";
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <FileText className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                <div className="flex flex-wrap gap-1">
                  {r.is_ai_generated && (
                    <Badge variant="purple">
                      <Sparkles className="h-3 w-3 mr-1" />
                      AI
                    </Badge>
                  )}
                  <Badge variant={r.is_draft ? "warning" : "success"}>
                    {r.is_draft ? "Draft" : "Final"}
                  </Badge>
                </div>
              </div>
              <h3 className="text-sm font-semibold line-clamp-2" style={{ color: "var(--text-primary)" }}>
                {r.title}
              </h3>
              <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                {projectMap[r.project] || `Project #${r.project}`}
              </p>
              <p className="mt-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {r.period_start} → {r.period_end}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* ── Detail/edit modal ── */}
      <Modal
        isOpen={!!active}
        onClose={() => setActive(null)}
        title={active ? active.title : "Report"}
        className="max-w-3xl"
      >
        {active && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{projectMap[active.project] || `Project #${active.project}`}</Badge>
              <Badge variant={active.is_draft ? "warning" : "success"}>
                {active.is_draft ? "Draft" : "Final"}
              </Badge>
              {active.is_ai_generated && (
                <Badge variant="purple">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-generated
                </Badge>
              )}
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {active.period_start} → {active.period_end}
              </span>
            </div>

            {editing ? (
              <>
                <FormInput
                  label="Title"
                  name="report_title"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
                <FormTextarea
                  label="Content (markdown)"
                  name="report_content"
                  rows={16}
                  value={editForm.content}
                  onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save changes
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg p-4 max-h-96 overflow-y-auto" style={{ backgroundColor: "var(--bg-hover)" }}>
                  <Markdown>{active.content}</Markdown>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={remove}
                    className="flex items-center gap-1 text-xs font-medium cursor-pointer"
                    style={{ color: "var(--danger)" }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={() => setEditing(true)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {active.is_draft && (
                      <Button onClick={finalize}>
                        <Eye className="h-3.5 w-3.5" />
                        Mark final
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
