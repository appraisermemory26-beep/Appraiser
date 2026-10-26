"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Receipt, Plus, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormSelect } from "@/components/ui/form-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Payslip, Timesheet, PaginatedResponse } from "@/lib/types";

const GENERATE_ROLES = ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"];

export default function PayslipsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canGenerate = !!user?.role && GENERATE_ROLES.includes(user.role);

  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedTimesheetId, setSelectedTimesheetId] = useState("");
  const [generating, setGenerating] = useState(false);

  const [viewing, setViewing] = useState<Payslip | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [payslipRes, timesheetRes] = await Promise.all([
        api.get<PaginatedResponse<Payslip>>("/api/v1/payslips/"),
        api.get<PaginatedResponse<Timesheet>>("/api/v1/timesheets/"),
      ]);
      setPayslips(payslipRes.results);
      setTimesheets(timesheetRes.results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payslips");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const eligibleTimesheets = useMemo(() => {
    const payslippedIds = new Set(payslips.map((p) => p.timesheet));
    return timesheets.filter((t) => t.status === "APPROVED" && !payslippedIds.has(t.id));
  }, [timesheets, payslips]);

  async function handleGenerate() {
    if (!selectedTimesheetId) {
      toast.error("Please select a timesheet");
      return;
    }
    setGenerating(true);
    try {
      await api.post("/api/v1/payslips/generate/", {
        timesheet: Number(selectedTimesheetId),
      });
      toast.success("Payslip generated");
      setGenerateModalOpen(false);
      setSelectedTimesheetId("");
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate payslip");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTogglePrivacy(payslip: Payslip) {
    setActingId(payslip.id);
    try {
      const updated = await api.post<Payslip>(`/api/v1/payslips/${payslip.id}/toggle-privacy/`, {});
      setPayslips((prev) => prev.map((p) => (p.id === payslip.id ? updated : p)));
      if (viewing?.id === payslip.id) setViewing(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update privacy");
    } finally {
      setActingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  const paydaySoon = payslips.filter((p) => p.is_payday_soon && !p.hidden_by_employee);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Payslips</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>View and manage payslip records</p>
        </div>
        {canGenerate && (
          <Button onClick={() => setGenerateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Generate Payslip
          </Button>
        )}
      </div>

      {paydaySoon.length > 0 && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: "var(--accent-soft)", color: "var(--text-primary)" }}
        >
          Payday is coming up for {paydaySoon.length} payslip{paydaySoon.length > 1 ? "s" : ""}.
        </div>
      )}

      {payslips.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center text-sm"
          style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
        >
          No payslips yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {payslips.map((p) => {
            const isSelf = p.user === user?.id;
            const hidden = isSelf && p.hidden_by_employee;
            return (
              <div
                key={p.id}
                className="rounded-lg border p-4 cursor-pointer transition-colors"
                style={{ borderColor: "var(--border-default)", background: "var(--surface-card)" }}
                onClick={() => setViewing(p)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {p.period_start} – {p.period_end}
                    </span>
                  </div>
                  {p.is_payday_soon && <Badge variant="warning">Payday soon</Badge>}
                </div>
                {!isSelf && (
                  <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{p.user_name}</p>
                )}
                {hidden ? (
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Figures hidden</p>
                ) : (
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                    {p.currency} {p.net_pay}
                  </p>
                )}
                {isSelf && (
                  <button
                    className="mt-2 flex items-center gap-1 text-xs"
                    style={{ color: "var(--text-muted)" }}
                    disabled={actingId === p.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePrivacy(p);
                    }}
                  >
                    {hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {hidden ? "Show figures" : "Hide figures"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Generate Payslip"
      >
        <div className="space-y-4">
          <FormSelect
            name="timesheet"
            label="Approved Timesheet"
            value={selectedTimesheetId}
            onChange={(e) => setSelectedTimesheetId(e.target.value)}
            options={[
              { value: "", label: "Select a timesheet..." },
              ...eligibleTimesheets.map((t) => ({
                value: String(t.id),
                label: `${t.user_name ?? "Employee"} — ${t.period_start} to ${t.period_end}`,
              })),
            ]}
          />
          {eligibleTimesheets.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No approved timesheets are available for payslip generation right now.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setGenerateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !selectedTimesheetId}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title="Payslip Detail"
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-muted)" }}>Period</span>
              <span style={{ color: "var(--text-primary)" }}>{viewing.period_start} – {viewing.period_end}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-muted)" }}>Gross Pay</span>
              <span style={{ color: "var(--text-primary)" }}>{viewing.currency} {viewing.gross_pay}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-muted)" }}>Total Tax</span>
              <span style={{ color: "var(--text-primary)" }}>{viewing.currency} {viewing.total_tax}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "var(--text-muted)" }}>Total Deductions</span>
              <span style={{ color: "var(--text-primary)" }}>{viewing.currency} {viewing.total_deductions}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span style={{ color: "var(--text-primary)" }}>Net Pay</span>
              <span style={{ color: "var(--text-primary)" }}>{viewing.currency} {viewing.net_pay}</span>
            </div>

            {viewing.breakdown?.statutory_schemes?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Statutory Schemes</p>
                {viewing.breakdown.statutory_schemes.map((s, i) => (
                  <div key={i} className="flex justify-between text-sm py-1" style={{ color: "var(--text-secondary)" }}>
                    <span>{s.name}</span>
                    <span>{viewing.currency} {s.employee_amount}</span>
                  </div>
                ))}
              </div>
            )}

            {viewing.breakdown?.tax_brackets?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Tax Brackets Applied</p>
                {viewing.breakdown.tax_brackets.map((b, i) => (
                  <div key={i} className="flex justify-between text-sm py-1" style={{ color: "var(--text-secondary)" }}>
                    <span>{b.lower_bound}–{b.upper_bound ?? "+"} @ {b.rate}%</span>
                    <span>{viewing.currency} {b.tax_amount}</span>
                  </div>
                ))}
              </div>
            )}

            {viewing.user === user?.id && (
              <Button
                variant="secondary"
                onClick={() => handleTogglePrivacy(viewing)}
                disabled={actingId === viewing.id}
              >
                {viewing.hidden_by_employee ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                {viewing.hidden_by_employee ? "Show figures" : "Hide figures"}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}