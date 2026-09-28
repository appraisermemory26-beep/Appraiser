"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Folder, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Modal } from "@/components/ui/modal";
import { FormSelect } from "@/components/ui/form-select";
import { RequestDeletionButton } from "@/components/document/request-deletion-button";
import { OpenFileLink } from "@/components/ui/open-file-link";
import { useToast } from "@/components/ui/toast";
import { api, fileNameFromPath } from "@/lib/api";
import type { Project, ProjectDocument, PaginatedResponse } from "@/lib/types";

const categoryLabels: Record<string, string> = {
  PD: "Project Document",
  BUDGET: "Budget",
  WORKPLAN: "Work Plan",
  SCHEDULE: "Schedule",
  RESULT_FRAMEWORK: "Result Framework",
  SUPPORTING: "Supporting",
};

interface DocRow extends Record<string, unknown> {
  id: number;
  file: string;
  category: string;
  categoryLabel: string;
  projectName: string;
  version: number;
  created_at: string;
}

export default function ProjectDocumentsPage() {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("PD");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [projRes, docRes] = await Promise.all([
        api.get<PaginatedResponse<Project>>("/api/v1/projects/projects/"),
        api.get<PaginatedResponse<ProjectDocument>>("/api/v1/projects/project-documents/"),
      ]);
      setProjects(projRes.results);
      setDocuments(docRes.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedProject) {
      toast.error("Please select a project and file");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("project", selectedProject);
      formData.append("category", selectedCategory);
      await api.upload("/api/v1/projects/project-documents/", formData);
      toast.success("Document uploaded successfully");
      setModalOpen(false);
      setSelectedProject("");
      setSelectedCategory("PD");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchData();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload document");
    } finally {
      setSubmitting(false);
    }
  };

  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  // Group documents by project for "folders"
  const folderCounts: Record<string, number> = {};
  for (const doc of documents) {
    const name = projectMap[doc.project] || `Project #${doc.project}`;
    folderCounts[name] = (folderCounts[name] || 0) + 1;
  }

  const columns: Column<DocRow>[] = [
    {
      key: "file",
      header: "Name",
      render: (row) => {
        const fileName = fileNameFromPath(row.file as string);
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(88, 166, 255, 0.1)" }}>
              <FileText className="h-4 w-4" style={{ color: "var(--info)" }} />
            </div>
            <OpenFileLink file={row.file as string} label={fileName} />
          </div>
        );
      },
    },
    { key: "categoryLabel", header: "Category" },
    { key: "projectName", header: "Project" },
    {
      key: "version",
      header: "Version",
      className: "font-mono text-xs",
      render: (row) => <span>v{row.version as number}</span>,
    },
    {
      key: "created_at",
      header: "Uploaded",
      render: (row) => <span>{new Date(row.created_at as string).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      header: "",
      className: "w-28",
      render: (row) => {
        const fileName = fileNameFromPath(row.file as string);
        return (
          <div className="flex items-center justify-end gap-1">
            <OpenFileLink file={row.file as string} variant="icon" />
            <RequestDeletionButton
              variant="ghost"
              documentType="project_document"
              documentId={row.id as number}
              documentLabel={`${row.projectName as string} — ${fileName}`}
            />
          </div>
        );
      },
    },
  ];

  const tableData: DocRow[] = documents.map((d) => ({
    id: d.id,
    file: d.file,
    category: d.category,
    categoryLabel: categoryLabels[d.category] || d.category,
    projectName: projectMap[d.project] || `Project #${d.project}`,
    version: d.version,
    created_at: d.created_at,
  }));

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
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Project Documents</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{documents.length} documents</p>
        </div>
        <Button size="md" onClick={() => setModalOpen(true)}>
          <Upload className="h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Folders */}
      {Object.keys(folderCounts).length > 0 && (
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Projects</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {Object.entries(folderCounts).map(([name, count]) => (
              <div
                key={name}
                className="flex flex-col items-center gap-2.5 rounded-xl border p-5 transition-all"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--accent-muted)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <Folder className="h-8 w-8" style={{ color: "var(--warning)" }} />
                <p className="text-xs font-medium text-center leading-tight" style={{ color: "var(--text-primary)" }}>{name}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{count} files</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>All Documents</h3>
        <DataTable columns={columns} data={tableData} />
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Upload Document">
        <form onSubmit={handleUpload} className="space-y-4">
          <FormSelect
            label="Project"
            name="project"
            required
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            placeholder="Select project..."
            options={projects.map((p) => ({ value: String(p.id), label: p.name }))}
          />
          <FormSelect
            label="Category"
            name="category"
            required
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={Object.entries(categoryLabels).map(([value, label]) => ({ value, label }))}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              File <span className="ml-1" style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              required
              className="w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-sm file:font-medium file:cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
