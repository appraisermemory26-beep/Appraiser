"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Upload, Bot, FileText, Loader2, ChevronDown, ChevronRight, Clock, User as UserIcon, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Markdown } from "@/components/ui/markdown";
import { useToast } from "@/components/ui/toast";
import { RequestDeletionButton } from "@/components/document/request-deletion-button";
import { OpenFileLink } from "@/components/ui/open-file-link";
import { api, fileNameFromPath } from "@/lib/api";
import type { JobDescription, JDVersion, Department, User, PaginatedResponse } from "@/lib/types";

export default function JobDescriptionsPage() {
  const toast = useToast();
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({ title: "", role_title: "", department: "", linked_user: "" });

  // Upload form
  const [uploadForm, setUploadForm] = useState({ job_description: "", file: null as File | null });

  // AI Generate form
  const [aiForm, setAiForm] = useState({ role_title: "", department: "", seniority: "", key_responsibilities: "" });
  const [aiDraft, setAiDraft] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const fetchJDs = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<JobDescription>>("/api/v1/jd-management/job-descriptions/");
      setJds(res.results);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchJDs(); }, [fetchJDs]);

  useEffect(() => {
    async function fetchMeta() {
      try {
        const [dRes, uRes] = await Promise.all([
          api.get<PaginatedResponse<Department>>("/api/v1/organisations/departments/"),
          api.get<PaginatedResponse<User>>("/api/v1/accounts/users/"),
        ]);
        setDepartments(dRes.results);
        setUsers(uRes.results);
      } catch { /* */ }
    }
    fetchMeta();
  }, []);

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  // Create JD
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/jd-management/job-descriptions/", {
        title: createForm.title,
        role_title: createForm.role_title,
        department: createForm.department ? Number(createForm.department) : null,
        linked_user: createForm.linked_user ? Number(createForm.linked_user) : null,
      });
      toast.success("Job description created");
      setCreateOpen(false);
      setCreateForm({ title: "", role_title: "", department: "", linked_user: "" });
      fetchJDs();
    } catch { toast.error("Failed to create JD"); } finally { setSubmitting(false); }
  };

  // Upload version
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file || !uploadForm.job_description) {
      toast.error("Select a JD and file");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("job_description", uploadForm.job_description);
      fd.append("file", uploadForm.file);
      fd.append("version_number", String((jds.find(j => j.id === Number(uploadForm.job_description))?.current_version ?? 0) + 1));
      await api.upload("/api/v1/jd-management/jd-versions/", fd);
      toast.success("Version uploaded");
      setUploadOpen(false);
      setUploadForm({ job_description: "", file: null });
      fetchJDs();
    } catch { toast.error("Upload failed. Ensure file is PDF or DOCX and under 10MB."); } finally { setSubmitting(false); }
  };

  // AI Generate
  const handleGenerate = async () => {
    if (!aiForm.role_title) { toast.error("Role title is required"); return; }
    setAiGenerating(true);
    setAiDraft("");
    try {
      const res = await api.post<{ content: string; ai_output_id: number }>("/api/v1/ai-tools/generate-jd/", aiForm);
      setAiDraft(res.content);
    } catch { toast.error("AI generation failed"); } finally { setAiGenerating(false); }
  };

  // Save AI draft as JD + version
  const handleSaveDraft = async () => {
    if (!aiDraft.trim()) return;
    setSavingDraft(true);
    try {
      const jd = await api.post<JobDescription>("/api/v1/jd-management/job-descriptions/", {
        title: `${aiForm.role_title} - ${aiForm.department || "General"}`,
        role_title: aiForm.role_title,
        department: departments.find(d => d.name.toLowerCase().includes(aiForm.department.toLowerCase()))?.id || null,
      });
      await api.post("/api/v1/jd-management/jd-versions/", {
        job_description: jd.id,
        version_number: 1,
        content_text: aiDraft,
        is_ai_generated: true,
      });
      toast.success("AI-generated JD saved");
      setAiOpen(false);
      setAiForm({ role_title: "", department: "", seniority: "", key_responsibilities: "" });
      setAiDraft("");
      fetchJDs();
    } catch { toast.error("Failed to save draft"); } finally { setSavingDraft(false); }
  };

  // Files open via OpenFileLink (mediaUrl)

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Job Descriptions</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{jds.length} descriptions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Upload Version
          </Button>
          <Button variant="secondary" onClick={() => setAiOpen(true)}>
            <Bot className="h-4 w-4" /> AI Generate
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New JD
          </Button>
        </div>
      </div>

      {/* JD List */}
      <div className="space-y-3">
        {jds.length === 0 && (
          <div className="rounded-xl p-12 text-center" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <FileText className="mx-auto h-10 w-10 mb-3" style={{ color: "var(--text-muted)" }} />
            <p style={{ color: "var(--text-muted)" }}>No job descriptions yet. Create one or use AI to generate.</p>
          </div>
        )}
        {jds.map((jd) => {
          const isExpanded = expandedId === jd.id;
          const versions = jd.versions || [];
          const currentVersion = versions.find((v) => v.version_number === jd.current_version) ?? versions[0];
          return (
            <div key={jd.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
              {/* JD Row */}
              <div className="flex items-center gap-2 px-5 py-4">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : jd.id)}
                  className="flex flex-1 items-center gap-4 text-left transition-colors cursor-pointer min-w-0"
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "rgba(88,166,255,0.1)" }}>
                    <FileText className="h-5 w-5" style={{ color: "var(--info)" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>{jd.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {jd.role_title} · {deptMap[jd.department ?? 0] || "No department"}
                      {jd.linked_user_name && <> · Linked to <span className="font-medium">{jd.linked_user_name}</span></>}
                    </p>
                  </div>
                  <Badge variant="info">v{jd.current_version}</Badge>
                  <span className="text-xs shrink-0" style={{ color: "var(--text-muted)" }}>{new Date(jd.created_at).toLocaleDateString()}</span>
                  {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
                </button>
                {currentVersion?.file && (
                  <OpenFileLink
                    file={currentVersion.file}
                    variant="pill"
                    label="View"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
              </div>

              {/* Version History (expandable) */}
              {isExpanded && (
                <div className="px-5 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
                  <p className="py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Version History</p>
                  {versions.length === 0 ? (
                    <p className="py-4 text-sm" style={{ color: "var(--text-muted)" }}>No versions uploaded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((v: JDVersion) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-4 rounded-lg px-4 py-3"
                          style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold" style={{ color: "var(--info)" }}>v{v.version_number}</span>
                              {v.is_ai_generated && <Badge variant="purple"><Sparkles className="h-3 w-3 mr-1" />AI Generated</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(v.created_at).toLocaleString()}</span>
                              {v.uploaded_by_name && <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{v.uploaded_by_name}</span>}
                              {v.file && (
                                <OpenFileLink
                                  file={v.file}
                                  label={fileNameFromPath(v.file)}
                                  className="max-w-[200px]"
                                />
                              )}
                            </div>
                            {v.content_text && !v.file && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs font-medium" style={{ color: "var(--accent)" }}>View content</summary>
                                <div className="mt-2 max-h-72 overflow-auto rounded-lg p-3" style={{ backgroundColor: "var(--bg-hover)" }}>
                                  <Markdown>{v.content_text}</Markdown>
                                </div>
                              </details>
                            )}
                          </div>
                          {v.file && <OpenFileLink file={v.file} variant="pill" label="View" />}
                          <RequestDeletionButton
                            variant="ghost"
                            documentType="jd_version"
                            documentId={v.id}
                            documentLabel={`${jd.title} — v${v.version_number}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create JD Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Job Description">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormInput label="Title" name="title" required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
          <FormInput label="Role Title" name="role_title" required value={createForm.role_title} onChange={(e) => setCreateForm({ ...createForm, role_title: e.target.value })} />
          <FormSelect label="Department" name="department" value={createForm.department} onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })} placeholder="Select department..." options={departments.map((d) => ({ value: String(d.id), label: d.name }))} />
          <FormSelect label="Link to User" name="linked_user" value={createForm.linked_user} onChange={(e) => setCreateForm({ ...createForm, linked_user: e.target.value })} placeholder="Optional - link to a staff member..." options={users.map((u) => ({ value: String(u.id), label: `${u.first_name} ${u.last_name} (${u.email})` }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create JD"}</Button>
          </div>
        </form>
      </Modal>

      {/* Upload Version Modal */}
      <Modal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload JD Version">
        <form onSubmit={handleUpload} className="space-y-4">
          <FormSelect label="Job Description" name="job_description" required value={uploadForm.job_description} onChange={(e) => setUploadForm({ ...uploadForm, job_description: e.target.value })} placeholder="Select JD..." options={jds.map((j) => ({ value: String(j.id), label: `${j.title} (v${j.current_version})` }))} />
          <div>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              File <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={(e) => setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })}
              className="w-full rounded-lg border px-3 py-2.5 text-sm cursor-pointer"
              style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>PDF or DOCX only, max 10MB</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}><Upload className="h-4 w-4" />{submitting ? "Uploading..." : "Upload"}</Button>
          </div>
        </form>
      </Modal>

      {/* AI Generate JD Modal */}
      <Modal isOpen={aiOpen} onClose={() => { setAiOpen(false); setAiDraft(""); }} title="AI-Assisted JD Generation">
        <div className="space-y-4">
          {!aiDraft ? (
            <>
              <FormInput label="Role Title" name="ai_role" required value={aiForm.role_title} onChange={(e) => setAiForm({ ...aiForm, role_title: e.target.value })} placeholder="e.g. Senior Software Engineer" />
              <FormInput label="Department" name="ai_dept" value={aiForm.department} onChange={(e) => setAiForm({ ...aiForm, department: e.target.value })} placeholder="e.g. Engineering" />
              <FormSelect label="Seniority" name="ai_seniority" value={aiForm.seniority} onChange={(e) => setAiForm({ ...aiForm, seniority: e.target.value })} placeholder="Select level..." options={[
                { value: "Junior", label: "Junior" },
                { value: "Mid-Level", label: "Mid-Level" },
                { value: "Senior", label: "Senior" },
                { value: "Lead", label: "Lead" },
                { value: "Director", label: "Director" },
                { value: "VP", label: "VP" },
              ]} />
              <FormTextarea label="Key Responsibilities" name="ai_resp" value={aiForm.key_responsibilities} onChange={(e) => setAiForm({ ...aiForm, key_responsibilities: e.target.value })} placeholder="Describe the main duties and responsibilities..." rows={4} />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setAiOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={aiGenerating}>
                  {aiGenerating ? <><Loader2 className="h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4" />Generate JD</>}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="purple"><Sparkles className="h-3 w-3 mr-1" />AI-Generated Draft</Badge>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Edit below before saving</span>
              </div>
              <textarea
                value={aiDraft}
                onChange={(e) => setAiDraft(e.target.value)}
                rows={16}
                className="w-full rounded-lg border px-4 py-3 text-sm font-mono leading-relaxed outline-none resize-y"
                style={{ backgroundColor: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
              <div className="flex justify-between pt-2">
                <Button variant="secondary" onClick={() => setAiDraft("")}>
                  Regenerate
                </Button>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => { setAiOpen(false); setAiDraft(""); }}>Discard</Button>
                  <Button onClick={handleSaveDraft} disabled={savingDraft}>
                    {savingDraft ? "Saving..." : "Save as JD"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
