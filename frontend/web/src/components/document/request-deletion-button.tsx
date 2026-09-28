"use client";

import { useState } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { deletionTypeLabel, type DeletionDocumentType } from "@/lib/deletion-types";

interface RequestDeletionButtonProps {
  documentType: DeletionDocumentType;
  documentId: number;
  documentLabel?: string;
  variant?: "icon" | "ghost";
  onSuccess?: () => void;
}

export function RequestDeletionButton({
  documentType,
  documentId,
  documentLabel,
  variant = "icon",
  onSuccess,
}: RequestDeletionButtonProps) {
  const toast = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user?.role !== "BOARD_MEMBER") {
    return null;
  }

  const typeLabel = deletionTypeLabel(documentType);
  const displayLabel = documentLabel || `${typeLabel} #${documentId}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/api/v1/document-retention/deletion-requests/", {
        document_type: documentType,
        document_id: documentId,
        reason: reason.trim(),
      });
      toast.success("Deletion request submitted for board approval");
      setOpen(false);
      setReason("");
      onSuccess?.();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to submit deletion request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    setReason("");
  };

  return (
    <>
      {variant === "ghost" ? (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setOpen(true)}
          className="text-[var(--danger)] hover:text-[var(--danger)]"
        >
          <Trash2 className="h-4 w-4" />
          Request deletion
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Request deletion"
          aria-label="Request deletion"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer"
          style={{ color: "var(--danger)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(248, 113, 113, 0.12)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <Modal isOpen={open} onClose={handleClose} title="Request Document Deletion">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="rounded-lg px-4 py-3 text-sm"
            style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Document
            </p>
            <p className="mt-1 font-medium" style={{ color: "var(--text-primary)" }}>
              {displayLabel}
            </p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              {typeLabel} · ID {documentId}
            </p>
          </div>

          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Per the 10-year retention policy, this document remains accessible until a second Board Member
            approves the deletion request.
          </p>

          <FormTextarea
            label="Reason"
            name="reason"
            required
            placeholder="Explain why this document should be deleted before the retention period..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !reason.trim()}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
