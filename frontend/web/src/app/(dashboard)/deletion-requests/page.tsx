"use client";

import { useState, useEffect, useCallback } from "react";
import { Trash2, Plus, Loader2, FileWarning, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSelect } from "@/components/ui/form-select";
import { DeletionDocumentPicker } from "@/components/document/deletion-document-picker";
import { useToast } from "@/components/ui/toast";
import { DELETION_TYPE_OPTIONS, deletionTypeLabel, type DeletionDocumentType } from "@/lib/deletion-types";
import type { DeletionRequest, PaginatedResponse } from "@/lib/types";

const ALLOWED_ROLES = ["BOARD_MEMBER", "ADMIN"];

const statusVariant: Record<string, "warning" | "success" | "danger" | "info"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  EXECUTED: "info",
};

export default function DeletionRequestsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [form, setForm] = useState({
    document_type: "policy_version",
    document_id: "",
    reason: "",
  });

  const role = user?.role || "";
  const isBoardMember = role === "BOARD_MEMBER";

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<DeletionRequest>>("/api/v1/document-retention/deletion-requests/");
      setRequests(res.results);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.document_id) {
      toast.error("Please select a document");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/v1/document-retention/deletion-requests/", {
        document_type: form.document_type,
        document_id: Number(form.document_id),
        reason: form.reason,
      });
      toast.success("Deletion request submitted");
      setModalOpen(false);
      setForm({ document_type: "policy_version", document_id: "", reason: "" });
      fetchRequests();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to submit request");
    }
    setSubmitting(false);
  };

  const handleAction = async (id: number, action: "approve" | "reject") => {
    setActionLoading(id);
    try {
      await api.post(`/api/v1/document-retention/deletion-requests/${id}/${action}/`);
      toast.success(`Request ${action === "approve" ? "approved" : "rejected"}`);
      fetchRequests();
    } catch (err: unknown) {
      toast.error((err as Error).message || `Failed to ${action} request`);
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const resolvedRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Deletion Requests
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {requests.length} total requests
          </p>
        </div>
        {isBoardMember && (
          <Button size="md" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Request
          </Button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending", val: pendingRequests.length, color: "#fbbf24", icon: Clock },
          { label: "Approved", val: requests.filter((r) => r.status === "APPROVED").length, color: "#4ade80", icon: CheckCircle2 },
          { label: "Rejected", val: requests.filter((r) => r.status === "REJECTED").length, color: "#f87171", icon: XCircle },
          { label: "Total", val: requests.length, color: "#60a5fa", icon: Trash2 },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl mb-3" style={{ backgroundColor: `${s.color}14` }}>
              <s.icon className="h-4 w-4" style={{ color: s.color }} />
            </div>
            <p className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>{s.val}</p>
            <p className="text-[11px] font-semibold mt-1" style={{ color: s.color }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Pending ({pendingRequests.length})
          </h3>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl p-5"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant="warning">PENDING</Badge>
                      <Badge variant="neutral">{deletionTypeLabel(req.document_type)}</Badge>
                      {req.document_description && (
                        <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                          {req.document_description}
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{req.reason}</p>
                    <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                      Requested on {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {req.requested_by_name && <> &middot; {req.requested_by_name}</>}
                    </p>
                  </div>
                  {/* Only show approve/reject if user is not the requester */}
                  {user?.id !== req.requested_by && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={actionLoading === req.id}
                        onClick={() => handleAction(req.id, "approve")}
                      >
                        {actionLoading === req.id ? "..." : "Approve"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={actionLoading === req.id}
                        onClick={() => handleAction(req.id, "reject")}
                      >
                        {actionLoading === req.id ? "..." : "Reject"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolved Requests */}
      {resolvedRequests.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Resolved ({resolvedRequests.length})
          </h3>
          <div className="space-y-3">
            {resolvedRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-xl p-5"
                style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)", opacity: 0.75 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge variant={statusVariant[req.status] || "neutral"}>{req.status}</Badge>
                      <Badge variant="neutral">{deletionTypeLabel(req.document_type)}</Badge>
                      {req.document_description && (
                        <span className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
                          {req.document_description}
                        </span>
                      )}
                    </div>
                    <p className="text-sm" style={{ color: "var(--text-primary)" }}>{req.reason}</p>
                    <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
                      Requested on {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {req.requested_by_name && <> &middot; {req.requested_by_name}</>}
                      {req.resolved_at && (
                        <> &middot; Resolved {new Date(req.resolved_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Trash2 className="h-12 w-12 mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>No deletion requests yet.</p>
        </div>
      )}

      {/* New Request Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Deletion Request">
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label="Document Type"
            name="document_type"
            required
            value={form.document_type}
            onChange={(e) => setForm({ ...form, document_type: e.target.value, document_id: "" })}
            options={DELETION_TYPE_OPTIONS}
          />
          <DeletionDocumentPicker
            documentType={form.document_type as DeletionDocumentType}
            value={form.document_id}
            onChange={(documentId) => setForm({ ...form, document_id: documentId })}
            required
          />
          <FormTextarea
            label="Reason"
            name="reason"
            required
            placeholder="Explain why this document should be deleted..."
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            rows={4}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
