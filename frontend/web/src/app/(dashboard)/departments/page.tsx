"use client";

import { useState, useEffect, useCallback } from "react";
import { Building2, Users, Layers, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import type { Department, PaginatedResponse } from "@/lib/types";

export default function DepartmentsPage() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    parent: "",
  });

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<Department>>("/api/v1/organisations/departments/");
      setDepartments(res.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/organisations/departments/", {
        name: form.name,
        parent: form.parent ? Number(form.parent) : null,
      });
      toast.success("Department created successfully");
      setModalOpen(false);
      setForm({ name: "", parent: "" });
      fetchDepartments();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create department");
    } finally {
      setSubmitting(false);
    }
  };

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
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Departments</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{departments.length} departments</p>
        </div>
        <Button size="md" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => {
          const parentDept = departments.find((p) => p.id === d.parent);
          return (
            <div
              key={d.id}
              className="rounded-xl border p-6 transition-all"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-hover)"; e.currentTarget.style.borderColor = "var(--accent-muted)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--accent-muted)" }}>
                  <Building2 className="h-5 w-5" style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</h3>
                  {parentDept && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Parent: {parentDept.name}</p>
                  )}
                  {d.head && (
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Head: User #{d.head}</p>
                  )}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <Users className="h-3.5 w-3.5" />
                  Dept #{d.id}
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                  <Layers className="h-3.5 w-3.5" />
                  Created {new Date(d.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Add Department">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormInput
            label="Department Name"
            name="name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <FormSelect
            label="Parent Department"
            name="parent"
            value={form.parent}
            onChange={(e) => setForm({ ...form, parent: e.target.value })}
            placeholder="None (top-level)"
            options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Department"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
