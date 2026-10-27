"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Button } from "@/components/ui/button";
import type { Timesheet } from "@/lib/types";

function monthLabel(periodStart: string) {
  const d = new Date(periodStart);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function TeamApprovalsPage() {
  useAuth();
  const toast = useToast();

  const [items, setItems] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const [reasonAction, setReasonAction] = useState<"REVISE" | "REJECT" | null>(null);
  const [reasonComment, setReasonComment] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Timesheet[]>("/api/v1/timesheets/pending-approvals/");
      setItems(data);
      setSelected(new Set(data.map((t) => t.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load pending approvals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allChecked = items.length > 0 && selected.size === items.length;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(items.map((t) => t.id)));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBatch(action: "APPROVE" | "REVISE" | "REJECT", comment: string) {
    if (selected.size === 0) {
      toast.error("Select at least one timesheet first.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.post<{ approved: number[]; failed: { id: number; error: string }[] }>(
        "/api/v1/timesheets/mass-approve/",
        { timesheet_ids: Array.from(selected), action, comment }
      );
      if (result.approved.length > 0) {
        const verb = action === "APPROVE" ? "approved" : action === "REVISE" ? "sent back for revision" : "rejected";
        toast.success(`${result.approved.length} timesheet(s) ${verb}.`);
      }
      if (result.failed.length > 0) {
        result.failed.forEach((f) => {
          const item = items.find((t) => t.id === f.id);
          toast.error(`${item?.user_name ?? "Timesheet #" + f.id}: ${f.error}`);
        });
      }
      setReasonAction(null);
      setReasonComment("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Batch action failed.");
    } finally {
      setBusy(false);
    }
  }

  function openReasonModal(action: "REVISE" | "REJECT") {
    if (selected.size === 0) {
      toast.error("Select at least one timesheet first.");
      return;
    }
    setReasonComment("");
    setReasonAction(action);
  }

  return (
    <div style={{ fontFamily: "-apple-system, system-ui, 'Segoe UI', Arial, sans-serif", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Team Approvals</h1>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>
            Every timesheet currently waiting on your approval, across all your direct reports and periods.
          </p>
        </div>
        <Link href="/timesheets" style={{ fontSize: 13, color: "#2563EB", textDecoration: "none" }}>
          Back to Timesheets
        </Link>
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "#6B7280" }}>Loading...</p>
      ) : items.length === 0 ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: 24,
            textAlign: "center",
            color: "#6B7280",
            fontSize: 13,
          }}
        >
          Nothing waiting on your approval right now.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 12,
              padding: "10px 14px",
              background: "#F3F4F6",
              borderRadius: 10,
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={allChecked} onChange={toggleAll} />
              {selected.size} of {items.length} selected
            </label>
            <div style={{ flex: 1 }} />
            <Button variant="secondary" size="sm" disabled={busy || selected.size === 0} onClick={() => openReasonModal("REVISE")}>
              Request Revision
            </Button>
            <Button variant="danger" size="sm" disabled={busy || selected.size === 0} onClick={() => openReasonModal("REJECT")}>
              Reject
            </Button>
            <Button variant="primary" size="sm" disabled={busy || selected.size === 0} onClick={() => runBatch("APPROVE", "")}>
              Approve Selected
            </Button>
          </div>

          <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px", width: 36 }}></th>
                  <th style={{ padding: "10px 14px" }}>Employee</th>
                  <th style={{ padding: "10px 14px" }}>Institution</th>
                  <th style={{ padding: "10px 14px" }}>Period</th>
                  <th style={{ padding: "10px 14px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id} style={{ borderTop: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} />
                    </td>
                    <td style={{ padding: "10px 14px", fontWeight: 600 }}>{t.user_name ?? `User #${t.user}`}</td>
                    <td style={{ padding: "10px 14px", color: "#6B7280" }}>{t.institution_name ?? "-"}</td>
                    <td style={{ padding: "10px 14px", color: "#6B7280" }}>{monthLabel(t.period_start)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <Link href={`/timesheets?approve=${t.id}`} style={{ fontSize: 12, color: "#2563EB", textDecoration: "none" }}>
                        Review individually
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        isOpen={reasonAction !== null}
        onClose={() => setReasonAction(null)}
        title={reasonAction === "REVISE" ? "Request Revision" : "Reject Timesheets"}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
            This reason will be applied to all {selected.size} selected timesheet(s).
          </p>
          <FormTextarea
            name="reason"
            label="Reason (required)"
            value={reasonComment}
            onChange={(e) => setReasonComment(e.target.value)}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" size="md" onClick={() => setReasonAction(null)}>
              Cancel
            </Button>
            <Button
              variant={reasonAction === "REJECT" ? "danger" : "primary"}
              size="md"
              disabled={busy || !reasonComment.trim()}
              onClick={() => reasonAction && runBatch(reasonAction, reasonComment)}
            >
              {reasonAction === "REVISE" ? "Send Back for Revision" : "Reject"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}