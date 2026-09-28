"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Upload,
  ShieldCheck,
  FileText,
  Users,
  Loader2,
  Check,
  Search,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { RequestDeletionButton } from "@/components/document/request-deletion-button";
import { OpenFileLink } from "@/components/ui/open-file-link";
import { api, fileNameFromPath } from "@/lib/api";
import type {
  Policy,
  PolicyCategory,
  PolicyVersion,
  User,
  PaginatedResponse,
} from "@/lib/types";
import clsx from "clsx";

// ─── Types for acknowledgment status endpoint ────────────────────────────────

interface AckUser {
  user_id: number;
  user_name: string;
  acknowledged_at?: string;
}

interface AcknowledgmentStatus {
  acknowledged: AckUser[];
  not_acknowledged: AckUser[];
}

// ─── Role check helper ──────────────────────────────────────────────────────

const MANAGER_ROLES = ["ADMIN", "MANAGER", "DEPT_HEAD"];

function isManagerRole(role: string | undefined): boolean {
  return !!role && MANAGER_ROLES.includes(role);
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const toast = useToast();

  // User state
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Data state
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create policy modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    category: "",
  });
  const [createFile, setCreateFile] = useState<File | null>(null);
  const [analyzingDescription, setAnalyzingDescription] = useState(false);
  const [descriptionAiGenerated, setDescriptionAiGenerated] = useState(false);
  const analyzeRequestRef = useRef(0);

  // Upload version modal
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionPolicyId, setVersionPolicyId] = useState<number | null>(null);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  // Acknowledgment
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [acknowledgedVersions, setAcknowledgedVersions] = useState<Set<number>>(new Set());

  // Version history expansion
  const [expandedPolicies, setExpandedPolicies] = useState<Set<number>>(new Set());

  // Acknowledgment status modal
  const [ackStatusModalOpen, setAckStatusModalOpen] = useState(false);
  const [ackStatus, setAckStatus] = useState<AcknowledgmentStatus | null>(null);
  const [ackStatusLoading, setAckStatusLoading] = useState(false);
  const [ackStatusPolicyTitle, setAckStatusPolicyTitle] = useState("");

  // ─── Fetch current user ────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchUser() {
      try {
        const user = await api.get<User>("/api/v1/accounts/users/me/");
        setCurrentUser(user);
      } catch {
        // silently fail
      }
    }
    fetchUser();
  }, []);

  // ─── Fetch categories ──────────────────────────────────────────────────────

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await api.get<PaginatedResponse<PolicyCategory>>(
          "/api/v1/policies/policy-categories/"
        );
        setCategories(res.results);
      } catch {
        // silently fail
      }
    }
    fetchCategories();
  }, []);

  // ─── Fetch policies ────────────────────────────────────────────────────────

  const fetchPolicies = useCallback(async (search?: string, categoryId?: number | null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryId) params.set("category", String(categoryId));
      const qs = params.toString();
      const url = `/api/v1/policies/policies/${qs ? `?${qs}` : ""}`;
      const res = await api.get<PaginatedResponse<Policy>>(url);
      setPolicies(res.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // ─── Derived data ──────────────────────────────────────────────────────────

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const categoryIdMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));
  const categoryTabs = ["All", ...categories.map((c) => c.name)];

  const canManage = isManagerRole(currentUser?.role);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleCategoryChange = (tab: string) => {
    setActiveCategory(tab);
    const catId = tab === "All" ? null : categoryIdMap[tab] ?? null;
    fetchPolicies(searchQuery || undefined, catId);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      const catId = activeCategory === "All" ? null : categoryIdMap[activeCategory] ?? null;
      fetchPolicies(value || undefined, catId);
    }, 400);
  };

  const resetCreateModal = () => {
    setCreateModalOpen(false);
    setCreateForm({ title: "", description: "", category: "" });
    setCreateFile(null);
    setAnalyzingDescription(false);
    setDescriptionAiGenerated(false);
    analyzeRequestRef.current += 1;
  };

  const handleCreateFileChange = async (file: File | null) => {
    setCreateFile(file);
    if (!file) {
      setCreateForm((prev) => ({ ...prev, description: "" }));
      setDescriptionAiGenerated(false);
      return;
    }

    const requestId = ++analyzeRequestRef.current;
    setAnalyzingDescription(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (createForm.title.trim()) {
        fd.append("title", createForm.title.trim());
      }
      const res = await api.upload<{ description: string; ai_output_id: number }>(
        "/api/v1/ai-tools/generate-policy-description/",
        fd
      );
      if (requestId !== analyzeRequestRef.current) return;
      setCreateForm((prev) => ({ ...prev, description: res.description }));
      setDescriptionAiGenerated(true);
    } catch (err: unknown) {
      if (requestId !== analyzeRequestRef.current) return;
      toast.error((err as Error).message || "AI could not analyze the document");
      setDescriptionAiGenerated(false);
    } finally {
      if (requestId === analyzeRequestRef.current) {
        setAnalyzingDescription(false);
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast.error("Document name is required");
      return;
    }
    if (!createFile) {
      toast.error("Please upload a policy document");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.post<Policy>("/api/v1/policies/policies/", {
        title: createForm.title,
        description: createForm.description,
        category: createForm.category ? Number(createForm.category) : null,
      });

      // Upload initial version file if provided
      if (createFile) {
        const fd = new FormData();
        fd.append("file", createFile);
        await api.upload(`/api/v1/policies/policies/${created.id}/upload-version/`, fd);
      }

      toast.success("Policy created successfully");
      resetCreateModal();
      const catId = activeCategory === "All" ? null : categoryIdMap[activeCategory] ?? null;
      fetchPolicies(searchQuery || undefined, catId);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create policy");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionPolicyId || !versionFile) return;
    setUploadingVersion(true);
    try {
      const fd = new FormData();
      fd.append("file", versionFile);
      await api.upload(`/api/v1/policies/policies/${versionPolicyId}/upload-version/`, fd);
      toast.success("New version uploaded");
      setVersionModalOpen(false);
      setVersionFile(null);
      setVersionPolicyId(null);
      const catId = activeCategory === "All" ? null : categoryIdMap[activeCategory] ?? null;
      fetchPolicies(searchQuery || undefined, catId);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload version");
    } finally {
      setUploadingVersion(false);
    }
  };

  const handleAcknowledge = async (policyId: number, currentVersionId: number) => {
    setAcknowledgingId(policyId);
    try {
      await api.post("/api/v1/policies/policy-acknowledgments/", {
        policy_version: currentVersionId,
      });
      toast.success("Policy acknowledged");
      setAcknowledgedVersions((prev) => new Set(prev).add(currentVersionId));
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to acknowledge policy");
    } finally {
      setAcknowledgingId(null);
    }
  };

  const toggleExpanded = (policyId: number) => {
    setExpandedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(policyId)) next.delete(policyId);
      else next.add(policyId);
      return next;
    });
  };

  const openAckStatus = async (policy: Policy) => {
    setAckStatusPolicyTitle(policy.title);
    setAckStatusModalOpen(true);
    setAckStatusLoading(true);
    setAckStatus(null);
    try {
      const data = await api.get<AcknowledgmentStatus>(
        `/api/v1/policies/policies/${policy.id}/acknowledgment-status/`
      );
      setAckStatus(data);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to load acknowledgment status");
      setAckStatusModalOpen(false);
    } finally {
      setAckStatusLoading(false);
    }
  };

  const openVersionUpload = (policyId: number) => {
    setVersionPolicyId(policyId);
    setVersionFile(null);
    setVersionModalOpen(true);
  };

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentVersionObj = (policy: Policy): PolicyVersion | undefined => {
    if (!policy.versions || policy.versions.length === 0) return undefined;
    return policy.versions.find((v) => v.version_number === policy.current_version)
      ?? policy.versions[policy.versions.length - 1];
  };

  const isAcknowledged = (policy: Policy): boolean => {
    const cv = getCurrentVersionObj(policy);
    return cv ? acknowledgedVersions.has(cv.id) : false;
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFileName = (url: string | null): string => fileNameFromPath(url);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading && policies.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Policy Vault
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {policies.length} {policies.length === 1 ? "policy" : "policies"}
          </p>
        </div>
        {canManage && (
          <Button size="md" onClick={() => setCreateModalOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Policy
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          placeholder="Search policies..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-11 w-full rounded-lg border pl-10 pr-4 text-sm outline-none transition-colors focus:ring-1"
          style={{
            backgroundColor: "var(--bg-input)",
            borderColor: "var(--border)",
            color: "var(--text-primary)",
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
      </div>

      {/* Category Tabs */}
      {categoryTabs.length > 1 && (
        <div
          className="flex gap-1 rounded-lg border p-1 w-fit flex-wrap"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          {categoryTabs.map((c) => (
            <button
              key={c}
              onClick={() => handleCategoryChange(c)}
              className={clsx(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer"
              )}
              style={
                activeCategory === c
                  ? { backgroundColor: "var(--accent-muted)", color: "var(--accent)" }
                  : { color: "var(--text-secondary)" }
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Loading indicator for refetches */}
      {loading && policies.length > 0 && (
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Policy Cards */}
      {!loading && policies.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl border"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
        >
          <ShieldCheck className="h-12 w-12 mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            No policies found
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {searchQuery ? "Try adjusting your search" : "Upload your first policy to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {policies.map((p) => {
            const currentVersionObj = getCurrentVersionObj(p);
            const acknowledged = isAcknowledged(p);
            const expanded = expandedPolicies.has(p.id);
            const ackCount = p.acknowledgment_count ?? 0;
            const totalStaff = p.total_staff ?? 0;
            const ackPercent = totalStaff > 0 ? Math.round((ackCount / totalStaff) * 100) : 0;

            return (
              <div
                key={p.id}
                className="rounded-xl border transition-all flex flex-col"
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
                {/* Card body */}
                <div className="p-6 flex-1">
                  {/* Top row: icon + title + badges */}
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "rgba(88, 166, 255, 0.1)" }}
                    >
                      <ShieldCheck className="h-5 w-5" style={{ color: "var(--info)" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                        {p.title}
                      </h3>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <Badge variant="info">{categoryMap[p.category ?? 0] || "Uncategorized"}</Badge>
                        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                          v{p.current_version}
                        </span>
                        {acknowledged && <Badge variant="success">Acknowledged</Badge>}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {p.description && (
                    <p className="mt-3 text-sm line-clamp-2" style={{ color: "var(--text-secondary)" }}>
                      {p.description}
                    </p>
                  )}

                  {/* Acknowledgment progress bar */}
                  {totalStaff > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          Acknowledgments
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {ackCount}/{totalStaff} acknowledged
                        </span>
                      </div>
                      <div
                        className="h-2 w-full rounded-full overflow-hidden"
                        style={{ backgroundColor: "var(--border)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${ackPercent}%`,
                            backgroundColor:
                              ackPercent === 100
                                ? "var(--accent)"
                                : ackPercent >= 50
                                ? "var(--warning)"
                                : "var(--info)",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions row */}
                <div
                  className="px-6 py-3 flex items-center justify-between flex-wrap gap-2 border-t"
                  style={{ borderColor: "var(--border)" }}
                >
                  <div className="flex items-center gap-2">
                    {/* Version history toggle */}
                    {p.versions && p.versions.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(p.id)}
                        className="flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer rounded-md px-2 py-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {expanded ? (
                          <ChevronDown className="h-3 w-3" />
                        ) : (
                          <ChevronRight className="h-3 w-3" />
                        )}
                        Versions ({p.versions.length})
                      </button>
                    )}

                    {/* Ack status button (managers) */}
                    {canManage && (
                      <button
                        onClick={() => openAckStatus(p)}
                        className="flex items-center gap-1 text-xs font-medium transition-colors cursor-pointer rounded-md px-2 py-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Users className="h-3 w-3" />
                        Status
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentVersionObj?.file && (
                      <OpenFileLink
                        file={currentVersionObj.file}
                        variant="pill"
                        label="View Policy"
                      />
                    )}

                    {/* Upload new version (managers) */}
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => openVersionUpload(p.id)}>
                        <Upload className="h-3 w-3" />
                        New Version
                      </Button>
                    )}

                    {/* Request deletion (board — current version) */}
                    {currentVersionObj && (
                      <RequestDeletionButton
                        variant="ghost"
                        documentType="policy_version"
                        documentId={currentVersionObj.id}
                        documentLabel={`${p.title} — v${currentVersionObj.version_number}`}
                      />
                    )}

                    {/* Acknowledge button */}
                    {!acknowledged ? (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={acknowledgingId === p.id}
                        onClick={() => {
                          const cv = currentVersionObj;
                          if (cv) handleAcknowledge(p.id, cv.id);
                        }}
                      >
                        {acknowledgingId === p.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        {acknowledgingId === p.id ? "Acknowledging..." : "Acknowledge"}
                      </Button>
                    ) : (
                      <Badge variant="success">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Acknowledged
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Expandable version history */}
                {expanded && p.versions && p.versions.length > 0 && (
                  <div className="border-t" style={{ borderColor: "var(--border)" }}>
                    <div className="px-6 py-3">
                      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                        Version History
                      </p>
                      <div className="space-y-2">
                        {[...p.versions]
                          .sort((a, b) => b.version_number - a.version_number)
                          .map((v) => (
                            <div
                              key={v.id}
                              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
                              style={{ backgroundColor: "var(--bg-secondary)" }}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span
                                  className="font-mono font-semibold shrink-0"
                                  style={{ color: "var(--accent)" }}
                                >
                                  v{v.version_number}
                                </span>
                                {v.file ? (
                                  <OpenFileLink
                                    file={v.file}
                                    label={getFileName(v.file)}
                                    className="flex-1"
                                  />
                                ) : (
                                  <span className="truncate flex-1" style={{ color: "var(--text-muted)" }}>
                                    No file
                                  </span>
                                )}
                                <span className="shrink-0 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                                  <Clock className="h-3 w-3" />
                                  {formatDate(v.created_at)}
                                </span>
                                {v.uploaded_by_name && (
                                  <span className="shrink-0" style={{ color: "var(--text-muted)" }}>
                                    by {v.uploaded_by_name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {v.file && (
                                  <OpenFileLink file={v.file} variant="pill" label="View" />
                                )}
                                <RequestDeletionButton
                                  variant="ghost"
                                  documentType="policy_version"
                                  documentId={v.id}
                                  documentLabel={`${p.title} — v${v.version_number}`}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create Policy Modal ────────────────────────────────────────────── */}
      <Modal isOpen={createModalOpen} onClose={resetCreateModal} title="Upload Policy">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormInput
            label="Name of Document"
            name="title"
            required
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="e.g. Remote Work Policy"
          />
          <div>
            <label
              htmlFor="policy-file"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Upload Document <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="policy-file"
              type="file"
              accept=".pdf,.docx,.doc"
              required
              onChange={(e) => void handleCreateFileChange(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg border px-3 py-2 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Accepted formats: PDF, DOCX, DOC. The AI Assistant will analyze the document and draft a description.
            </p>
          </div>

          {(createFile || analyzingDescription || createForm.description) && (
            <div className="space-y-2">
              {descriptionAiGenerated && (
                <div className="flex items-center gap-2">
                  <Badge variant="purple">
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI-Generated Description
                  </Badge>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Edit below before saving
                  </span>
                </div>
              )}
              <FormTextarea
                label="Description"
                name="description"
                value={createForm.description}
                onChange={(e) => {
                  setCreateForm({ ...createForm, description: e.target.value });
                  setDescriptionAiGenerated(false);
                }}
                placeholder={
                  analyzingDescription
                    ? "Analyzing document..."
                    : "Description will appear here after upload"
                }
                rows={5}
                disabled={analyzingDescription}
              />
              {analyzingDescription && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI Assistant is analyzing your document...
                </div>
              )}
            </div>
          )}

          <FormSelect
            label="Category"
            name="category"
            value={createForm.category}
            onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
            placeholder="Select category..."
            options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={resetCreateModal}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || analyzingDescription || !createFile}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Create Policy
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Upload Version Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        title="Upload New Version"
      >
        <form onSubmit={handleUploadVersion} className="space-y-4">
          <div>
            <label
              htmlFor="version-file"
              className="mb-1.5 block text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Document File <span style={{ color: "var(--danger)" }}>*</span>
            </label>
            <input
              id="version-file"
              type="file"
              accept=".pdf,.docx,.doc"
              required
              onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm rounded-lg border px-3 py-2 cursor-pointer"
              style={{
                backgroundColor: "var(--bg-input)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Accepted formats: PDF, DOCX, DOC
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setVersionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploadingVersion || !versionFile}>
              {uploadingVersion ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Version
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ─── Acknowledgment Status Modal ────────────────────────────────────── */}
      <Modal
        isOpen={ackStatusModalOpen}
        onClose={() => setAckStatusModalOpen(false)}
        title={`Acknowledgment Status - ${ackStatusPolicyTitle}`}
      >
        {ackStatusLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--accent)" }} />
          </div>
        ) : ackStatus ? (
          <div className="space-y-5 max-h-96 overflow-y-auto">
            {/* Acknowledged */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4" style={{ color: "var(--accent)" }} />
                <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Acknowledged ({ackStatus.acknowledged.length})
                </h4>
              </div>
              {ackStatus.acknowledged.length === 0 ? (
                <p className="text-xs pl-6" style={{ color: "var(--text-muted)" }}>
                  No one has acknowledged yet.
                </p>
              ) : (
                <div className="space-y-1 pl-6">
                  {ackStatus.acknowledged.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: "var(--bg-secondary)" }}
                    >
                      <span style={{ color: "var(--text-primary)" }}>{u.user_name}</span>
                      {u.acknowledged_at && (
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {formatDate(u.acknowledged_at)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Not Acknowledged */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="h-4 w-4" style={{ color: "var(--danger)" }} />
                <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  Not Acknowledged ({ackStatus.not_acknowledged.length})
                </h4>
              </div>
              {ackStatus.not_acknowledged.length === 0 ? (
                <p className="text-xs pl-6" style={{ color: "var(--text-muted)" }}>
                  Everyone has acknowledged.
                </p>
              ) : (
                <div className="space-y-1 pl-6">
                  {ackStatus.not_acknowledged.map((u) => (
                    <div
                      key={u.user_id}
                      className="flex items-center rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: "var(--bg-secondary)", color: "var(--text-primary)" }}
                    >
                      {u.user_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
