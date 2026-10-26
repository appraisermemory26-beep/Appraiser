"use client";

import { useState, useEffect, useCallback } from "react";
import { Landmark, Plus, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Institution, PaginatedResponse } from "@/lib/types";

const ALLOWED_ROLES = ["EXECUTIVE", "BOARD_MEMBER", "ADMIN"];

export default function InstitutionsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const allowed = !!user?.role && ALLOWED_ROLES.includes(user.role);

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse<Institution>>("/api/v1/organisations/institutions/");
      setInstitutions(res.results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load institutions");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setName("");
    setCountry("");
    setCurrency("");
    setModalOpen(true);
  }

  function openEdit(inst: Institution) {
    setEditing(inst);
    setName(inst.name);
    setCountry(inst.country);
    setCurrency(inst.default_currency);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !currency.trim()) {
      toast.error("Name and currency are required");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/v1/organisations/institutions/${editing.id}/`, {
          name, country, default_currency: currency.toUpperCase(),
        });
        toast.success("Institution updated");
      } else {
        await api.post("/api/v1/organisations/institutions/", {
          name, country, default_currency: currency.toUpperCase(),
        });
        toast.success("Institution added");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save institution");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--text-muted)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Institutions</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Clients/institutions your employees do work for. Each carries its own default currency for payroll.
          </p>
        </div>
        {allowed && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add Institution
          </Button>
        )}
      </div>

      {institutions.length === 0 ? (
        <div
          className="rounded-lg border p-8 text-center text-sm"
          style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
        >
          No institutions yet. Add one to start generating Timesheets against it.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-default)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-muted)" }}>
                <th className="text-left px-4 py-2" style={{ color: "var(--text-muted)" }}>Name</th>
                <th className="text-left px-4 py-2" style={{ color: "var(--text-muted)" }}>Country</th>
                <th className="text-left px-4 py-2" style={{ color: "var(--text-muted)" }}>Currency</th>
                <th className="text-left px-4 py-2" style={{ color: "var(--text-muted)" }}>Status</th>
                {allowed && <th className="px-4 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {institutions.map((inst) => (
                <tr key={inst.id} className="border-t" style={{ borderColor: "var(--border-default)" }}>
                  <td className="px-4 py-2" style={{ color: "var(--text-primary)" }}>
                    <Landmark className="h-4 w-4 inline mr-2" style={{ color: "var(--text-muted)" }} />
                    {inst.name}
                  </td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{inst.country || "—"}</td>
                  <td className="px-4 py-2" style={{ color: "var(--text-secondary)" }}>{inst.default_currency}</td>
                  <td className="px-4 py-2">
                    <Badge variant={inst.is_active ? "success" : "neutral"}>
                      {inst.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  {allowed && (
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => openEdit(inst)} style={{ color: "var(--text-muted)" }}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Institution" : "Add Institution"}>
        <div className="space-y-4">
          <FormInput name="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nutri-Liberia Inc." />
          <FormInput name="country" label="Country" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Liberia" />
          <FormInput
            name="default_currency"
            label="Default Currency (ISO code)"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            placeholder="e.g. USD, LRD, GHS"
            maxLength={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}