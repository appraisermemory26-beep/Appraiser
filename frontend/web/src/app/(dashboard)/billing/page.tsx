"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { BillingProfile, PaginatedResponse } from "@/lib/types";

const planFeatures: Record<string, string[]> = {
  BASIC: [
    "Up to 10 team members",
    "Basic task management",
    "Policy Vault",
    "Email support",
  ],
  PROFESSIONAL: [
    "Up to 50 team members",
    "AI Assistant (200 queries/mo)",
    "Policy Vault with versioning",
    "Audit Trail",
    "Priority support",
  ],
  ENTERPRISE: [
    "Unlimited team members",
    "AI Assistant (unlimited)",
    "Full Policy Vault & versioning",
    "Audit Trail with export",
    "Custom departments & roles",
    "Dedicated support",
  ],
};

const planPrices: Record<string, { monthly: string; annual: string }> = {
  BASIC: { monthly: "$19", annual: "$190" },
  PROFESSIONAL: { monthly: "$49", annual: "$490" },
  ENTERPRISE: { monthly: "$99", annual: "$990" },
};

const statusVariant: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ACTIVE: "success",
  PENDING: "warning",
  OVERDUE: "danger",
  CANCELLED: "neutral",
};

export default function BillingPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);

  const [formData, setFormData] = useState({
    contact_name: "",
    billing_email: "",
    address: "",
  });

  const [planForm, setPlanForm] = useState({
    plan_tier: "",
    billing_cycle: "",
    payment_status: "",
  });

  const isAdmin = user?.role === "ADMIN";

  useEffect(() => {
    async function fetchBilling() {
      try {
        const res = await api.get<PaginatedResponse<BillingProfile>>("/api/v1/billing/billing-profiles/");
        if (res.results.length > 0) {
          const bp = res.results[0];
          setProfile(bp);
          setFormData({ contact_name: bp.contact_name, billing_email: bp.billing_email, address: bp.address });
          setPlanForm({ plan_tier: bp.plan_tier, billing_cycle: bp.billing_cycle, payment_status: bp.payment_status });
        }
      } catch { /* */ } finally { setLoading(false); }
    }
    fetchBilling();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.patch<BillingProfile>(`/api/v1/billing/billing-profiles/${profile.id}/`, formData);
      setProfile(updated);
      toast.success("Billing profile updated");
    } catch { toast.error("Failed to update"); } finally { setSaving(false); }
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingPlan(true);
    try {
      const updated = await api.patch<BillingProfile>(`/api/v1/billing/billing-profiles/${profile.id}/`, planForm);
      setProfile(updated);
      setPlanModalOpen(false);
      toast.success("Subscription updated");
    } catch { toast.error("Failed to update subscription"); } finally { setSavingPlan(false); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} /></div>;
  }

  const tier = profile?.plan_tier || "BASIC";
  const cycle = profile?.billing_cycle || "MONTHLY";
  const prices = planPrices[tier] || planPrices.BASIC;
  const features = planFeatures[tier] || planFeatures.BASIC;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Billing & Subscription</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Manage your organisation&apos;s subscription and billing details</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Current Plan Card */}
        <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Current Plan</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{tier}</h3>
            </div>
            <Badge variant={statusVariant[profile?.payment_status || "PENDING"]}>
              {profile?.payment_status || "N/A"}
            </Badge>
          </div>

          <p className="mt-3 text-3xl font-bold" style={{ color: "var(--accent)" }}>
            {cycle === "ANNUAL" ? prices.annual : prices.monthly}
            <span className="text-sm font-normal" style={{ color: "var(--text-secondary)" }}>
              {cycle === "ANNUAL" ? "/year" : "/month"}
            </span>
          </p>

          <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Billing cycle: <span className="font-medium" style={{ color: "var(--text-secondary)" }}>{cycle}</span>
          </div>

          <div className="mt-5 space-y-2.5">
            {features.map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
                <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
                {f}
              </div>
            ))}
          </div>

          {isAdmin && (
            <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border)" }}>
              <Button variant="secondary" size="md" onClick={() => setPlanModalOpen(true)}>
                Manage Subscription
              </Button>
            </div>
          )}

          {!isAdmin && (
            <p className="mt-6 border-t pt-5 text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
              Contact your organisation admin to change the subscription plan.
            </p>
          )}
        </div>

        {/* Billing Profile Form */}
        <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Building2 className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>Billing Profile</p>
          </div>

          {profile ? (
            <form className="space-y-4" onSubmit={handleSaveProfile}>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Billing Email</label>
                <input
                  type="email"
                  value={formData.billing_email}
                  onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Billing Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border px-4 py-3 text-sm outline-none transition-colors resize-none"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                />
              </div>

              <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Payment processing is not yet enabled. When ready, a payment gateway will be integrated without changes to this billing structure.
                </p>
                <Button size="md" type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No billing profile found. It will be created automatically when your organisation was set up.
            </p>
          )}
        </div>
      </div>

      {/* Plan Tiers Comparison */}
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-5" style={{ color: "var(--text-muted)" }}>Available Plans</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {(["BASIC", "PROFESSIONAL", "ENTERPRISE"] as const).map((plan) => {
            const isActive = plan === tier;
            return (
              <div
                key={plan}
                className="rounded-xl p-5 transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--accent-muted)" : "var(--bg-primary)",
                  border: isActive ? "2px solid var(--accent)" : "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold" style={{ color: "var(--text-primary)" }}>{plan}</h4>
                  {isActive && <Badge variant="success">Current</Badge>}
                </div>
                <p className="text-2xl font-bold" style={{ color: isActive ? "var(--accent)" : "var(--text-primary)" }}>
                  {planPrices[plan].monthly}<span className="text-xs font-normal" style={{ color: "var(--text-secondary)" }}>/mo</span>
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  or {planPrices[plan].annual}/year (save ~17%)
                </p>
                <div className="mt-4 space-y-2">
                  {planFeatures[plan].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage Subscription Modal (Admin only) */}
      <Modal isOpen={planModalOpen} onClose={() => setPlanModalOpen(false)} title="Manage Subscription">
        <form onSubmit={handleSavePlan} className="space-y-4">
          <FormSelect
            label="Plan Tier"
            name="plan_tier"
            value={planForm.plan_tier}
            onChange={(e) => setPlanForm({ ...planForm, plan_tier: e.target.value })}
            options={[
              { value: "BASIC", label: "Basic — $19/mo" },
              { value: "PROFESSIONAL", label: "Professional — $49/mo" },
              { value: "ENTERPRISE", label: "Enterprise — $99/mo" },
            ]}
          />
          <FormSelect
            label="Billing Cycle"
            name="billing_cycle"
            value={planForm.billing_cycle}
            onChange={(e) => setPlanForm({ ...planForm, billing_cycle: e.target.value })}
            options={[
              { value: "MONTHLY", label: "Monthly" },
              { value: "ANNUAL", label: "Annual (save ~17%)" },
            ]}
          />
          <FormSelect
            label="Payment Status"
            name="payment_status"
            value={planForm.payment_status}
            onChange={(e) => setPlanForm({ ...planForm, payment_status: e.target.value })}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "PENDING", label: "Pending" },
              { value: "OVERDUE", label: "Overdue" },
              { value: "CANCELLED", label: "Cancelled" },
            ]}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Note: No live payment processing is included in this MVP. Plan changes are tracked manually.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setPlanModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={savingPlan}>{savingPlan ? "Saving..." : "Update Subscription"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
