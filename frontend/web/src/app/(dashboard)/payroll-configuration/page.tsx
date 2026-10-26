"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, Plus, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { PayrollConfiguration, StatutoryScheme, TaxBracket, PaginatedResponse } from "@/lib/types";

const ALLOWED_ROLES = ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"];

export default function PayrollConfigurationPage() {
  const toast = useToast();
  const { user } = useAuth();
  const allowed = !!user?.role && ALLOWED_ROLES.includes(user.role);

  const [configs, setConfigs] = useState<PayrollConfiguration[]>([]);
  const [schemes, setSchemes] = useState<StatutoryScheme[]>([]);
  const [brackets, setBrackets] = useState<TaxBracket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");
  const [newFrequency, setNewFrequency] = useState("MONTHLY");
  const [savingCurrency, setSavingCurrency] = useState(false);

  const [schemeModalOpen, setSchemeModalOpen] = useState(false);
  const [schemeConfigId, setSchemeConfigId] = useState<number | null>(null);
  const [schemeName, setSchemeName] = useState("");
  const [schemeEmployeeRate, setSchemeEmployeeRate] = useState("");
  const [schemeEmployerRate, setSchemeEmployerRate] = useState("");
  const [schemeDate, setSchemeDate] = useState("");
  const [savingScheme, setSavingScheme] = useState(false);

  const [bracketModalOpen, setBracketModalOpen] = useState(false);
  const [bracketConfigId, setBracketConfigId] = useState<number | null>(null);
  const [bracketLower, setBracketLower] = useState("");
  const [bracketUpper, setBracketUpper] = useState("");
  const [bracketRate, setBracketRate] = useState("");
  const [bracketDate, setBracketDate] = useState("");
  const [savingBracket, setSavingBracket] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, schemeRes, bracketRes] = await Promise.all([
        api.get<PaginatedResponse<PayrollConfiguration>>("/api/v1/payroll/configuration/"),
        api.get<PaginatedResponse<StatutoryScheme>>("/api/v1/payroll/statutory-schemes/"),
        api.get<PaginatedResponse<TaxBracket>>("/api/v1/payroll/tax-brackets/"),
      ]);
      setConfigs(configRes.results);
      setSchemes(schemeRes.results);
      setBrackets(bracketRes.results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payroll configuration");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddCurrency() {
    if (!newCurrency.trim()) {
      toast.error("Currency code is required");
      return;
    }
    setSavingCurrency(true);
    try {
      await api.post("/api/v1/payroll/configuration/", {
        currency: newCurrency.toUpperCase(),
        pay_frequency: newFrequency,
      });
      toast.success("Currency added");
      setCurrencyModalOpen(false);
      setNewCurrency("");
      setNewFrequency("MONTHLY");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add currency");
    } finally {
      setSavingCurrency(false);
    }
  }

  function openSchemeModal(configId: number) {
    setSchemeConfigId(configId);
    setSchemeName("");
    setSchemeEmployeeRate("");
    setSchemeEmployerRate("");
    setSchemeDate("");
    setSchemeModalOpen(true);
  }

  async function handleAddScheme() {
    if (!schemeName.trim() || !schemeEmployeeRate || !schemeEmployerRate || !schemeDate) {
      toast.error("All fields are required");
      return;
    }
    setSavingScheme(true);
    try {
      await api.post("/api/v1/payroll/statutory-schemes/", {
        payroll_configuration: schemeConfigId,
        name: schemeName,
        employee_rate: schemeEmployeeRate,
        employer_rate: schemeEmployerRate,
        effective_date: schemeDate,
      });
      toast.success("Statutory scheme added");
      setSchemeModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add scheme");
    } finally {
      setSavingScheme(false);
    }
  }

  function openBracketModal(configId: number) {
    setBracketConfigId(configId);
    setBracketLower("");
    setBracketUpper("");
    setBracketRate("");
    setBracketDate("");
    setBracketModalOpen(true);
  }

  async function handleAddBracket() {
    if (!bracketLower || !bracketRate || !bracketDate) {
      toast.error("Lower bound, rate, and effective date are required");
      return;
    }
    setSavingBracket(true);
    try {
      await api.post("/api/v1/payroll/tax-brackets/", {
        payroll_configuration: bracketConfigId,
        lower_bound: bracketLower,
        upper_bound: bracketUpper || null,
        rate: bracketRate,
        effective_date: bracketDate,
      });
      toast.success("Tax bracket added");
      setBracketModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tax bracket");
    } finally {
      setSavingBracket(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="rounded-lg border p-8 text-center text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
        You don't have access to Payroll Configuration.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Payroll Configuration</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            One setup per currency. Institutions pick which currency applies by their default currency.
          </p>
        </div>
        <Button onClick={() => setCurrencyModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Currency
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
          No currencies set up yet. Add one to start generating Payslips.
        </div>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => {
            const isExpanded = expandedId === config.id;
            const configSchemes = schemes.filter((s) => s.payroll_configuration === config.id);
            const configBrackets = brackets.filter((b) => b.payroll_configuration === config.id);
            return (
              <div key={config.id} className="rounded-lg border" style={{ borderColor: "var(--border-default)" }}>
                <button
                  className="w-full flex items-center justify-between px-4 py-3"
                  onClick={() => setExpandedId(isExpanded ? null : config.id)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <Wallet className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
                    <span className="font-medium" style={{ color: "var(--text-primary)" }}>{config.currency}</span>
                    <Badge>{config.pay_frequency}</Badge>
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {configSchemes.length} scheme{configSchemes.length !== 1 ? "s" : ""} · {configBrackets.length} bracket{configBrackets.length !== 1 ? "s" : ""}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "var(--border-default)" }}>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Statutory Schemes</h3>
                        <Button variant="secondary" onClick={() => openSchemeModal(config.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      {configSchemes.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No schemes yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Name</th>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Employee %</th>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Employer %</th>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Effective</th>
                            </tr>
                          </thead>
                          <tbody>
                            {configSchemes.map((s) => (
                              <tr key={s.id} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>{s.name}</td>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>{s.employee_rate}%</td>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>{s.employer_rate}%</td>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>{s.effective_date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Tax Brackets</h3>
                        <Button variant="secondary" onClick={() => openBracketModal(config.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                      {configBrackets.length === 0 ? (
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>No tax brackets yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead>
                            <tr>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Range</th>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Rate</th>
                              <th className="text-left py-1" style={{ color: "var(--text-muted)" }}>Effective</th>
                            </tr>
                          </thead>
                          <tbody>
                            {configBrackets.map((b) => (
                              <tr key={b.id} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>
                                  {b.lower_bound} – {b.upper_bound ?? "+"}
                                </td>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>{b.rate}%</td>
                                <td className="py-1" style={{ color: "var(--text-secondary)" }}>{b.effective_date}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal isOpen={currencyModalOpen} onClose={() => setCurrencyModalOpen(false)} title="Add Currency">
        <div className="space-y-4">
          <FormInput
            name="currency"
            label="Currency (ISO code)"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
            placeholder="e.g. USD, LRD, GHS"
            maxLength={3}
          />
          <FormSelect
            name="pay_frequency"
            label="Pay Frequency"
            value={newFrequency}
            onChange={(e) => setNewFrequency(e.target.value)}
            options={[
              { value: "WEEKLY", label: "Weekly" },
              { value: "BIWEEKLY", label: "Bi-weekly" },
              { value: "MONTHLY", label: "Monthly" },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCurrencyModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddCurrency} disabled={savingCurrency}>
              {savingCurrency ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={schemeModalOpen} onClose={() => setSchemeModalOpen(false)} title="Add Statutory Scheme">
        <div className="space-y-4">
          <FormInput name="scheme_name" label="Name" value={schemeName} onChange={(e) => setSchemeName(e.target.value)} placeholder="e.g. NASSCORP" />
          <FormInput name="employee_rate" label="Employee Rate (%)" value={schemeEmployeeRate} onChange={(e) => setSchemeEmployeeRate(e.target.value)} placeholder="e.g. 4" />
          <FormInput name="employer_rate" label="Employer Rate (%)" value={schemeEmployerRate} onChange={(e) => setSchemeEmployerRate(e.target.value)} placeholder="e.g. 6" />
          <FormInput name="scheme_effective_date" label="Effective Date" type="date" value={schemeDate} onChange={(e) => setSchemeDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSchemeModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddScheme} disabled={savingScheme}>
              {savingScheme ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={bracketModalOpen} onClose={() => setBracketModalOpen(false)} title="Add Tax Bracket">
        <div className="space-y-4">
          <FormInput name="lower_bound" label="Lower Bound" value={bracketLower} onChange={(e) => setBracketLower(e.target.value)} placeholder="e.g. 0" />
          <FormInput name="upper_bound" label="Upper Bound (leave blank for unbounded)" value={bracketUpper} onChange={(e) => setBracketUpper(e.target.value)} placeholder="e.g. 1000" />
          <FormInput name="rate" label="Rate (%)" value={bracketRate} onChange={(e) => setBracketRate(e.target.value)} placeholder="e.g. 15" />
          <FormInput name="bracket_effective_date" label="Effective Date" type="date" value={bracketDate} onChange={(e) => setBracketDate(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setBracketModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBracket} disabled={savingBracket}>
              {savingBracket ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}