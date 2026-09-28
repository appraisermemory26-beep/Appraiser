"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Users, Shield, UserCog, User, Loader2, CheckCircle2 } from "lucide-react";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { api, mediaUrl, formatFullName, userInitials } from "@/lib/api";
import type { User as UserType, Department, EmploymentStatus, PaginatedResponse } from "@/lib/types";

const roleVariant: Record<string, "danger" | "purple" | "info" | "warning" | "success" | "neutral"> = {
  ADMIN: "danger",
  EXECUTIVE: "danger",
  BOARD_MEMBER: "danger",
  MANAGER: "purple",
  DEPT_HEAD: "purple",
  STAFF: "info",
};

const statusDotColor: Record<string, string> = {
  ACTIVE: "var(--accent)",
  PROBATION: "var(--info)",
  PROMOTED: "var(--accent)",
  DEMOTED: "var(--warning)",
  SUSPENDED: "var(--danger)",
  RESIGNED: "var(--warning)",
  TERMINATED: "var(--danger)",
  CONTRACT_ENDED: "var(--text-muted)",
};

const statusBadgeVariant: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  ACTIVE: "success",
  PROBATION: "info",
  PROMOTED: "success",
  DEMOTED: "warning",
  SUSPENDED: "danger",
  RESIGNED: "warning",
  TERMINATED: "danger",
  CONTRACT_ENDED: "neutral",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  PROBATION: "Probation",
  PROMOTED: "Promoted",
  DEMOTED: "Demoted",
  SUSPENDED: "Suspended",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
  CONTRACT_ENDED: "Contract Ended",
};

const avatarColors = ["#f85149", "#4ade80", "#58a6ff", "#bc8cff", "#d29922", "#f0b429", "#8b949e"];

const PRIVILEGED_ROLES = ["ADMIN", "MANAGER", "DEPT_HEAD"];

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PROBATION", label: "Probation" },
  { value: "PROMOTED", label: "Promoted" },
  { value: "DEMOTED", label: "Demoted" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "CONTRACT_ENDED", label: "Contract Ended" },
];

const STATUS_CHANGE_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "PROBATION", label: "Probation" },
  { value: "PROMOTED", label: "Promoted" },
  { value: "DEMOTED", label: "Demoted" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "RESIGNED", label: "Resigned" },
  { value: "TERMINATED", label: "Terminated" },
  { value: "CONTRACT_ENDED", label: "Contract Ended" },
];

// Statuses that revoke access and group the member under "Former Members".
const FORMER_STATUSES: EmploymentStatus[] = ["RESIGNED", "TERMINATED", "CONTRACT_ENDED"];

export default function TeamPage() {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<UserType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Detail / status-change modal
  const [selectedMember, setSelectedMember] = useState<UserType | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<EmploymentStatus>("ACTIVE");
  const [statusReason, setStatusReason] = useState("");
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [successorId, setSuccessorId] = useState<string>("");
  const [successorSubmitting, setSuccessorSubmitting] = useState(false);

  const [setupUrl, setSetupUrl] = useState<string | null>(null);
  const [setupLinkCopied, setSetupLinkCopied] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    role: "STAFF",
    department: "",
  });

  const canChangeStatus = currentUser && PRIVILEGED_ROLES.includes(currentUser.role);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await api.get<PaginatedResponse<UserType>>("/api/v1/accounts/users/");
      setMembers(res.results);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    async function fetchDepts() {
      try {
        const res = await api.get<PaginatedResponse<Department>>("/api/v1/organisations/departments/");
        setDepartments(res.results);
      } catch {
        // silently fail
      }
    }
    fetchDepts();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post<{ setup_url?: string }>("/api/v1/accounts/users/", {
        first_name: form.first_name,
        middle_name: form.middle_name,
        last_name: form.last_name,
        email: form.email,
        role: form.role,
        department: form.department ? Number(form.department) : null,
      });
      if (res?.setup_url) {
        setSetupUrl(res.setup_url);
        setSetupLinkCopied(false);
      } else {
        toast.success("Member invited successfully");
        setModalOpen(false);
      }
      setForm({ first_name: "", middle_name: "", last_name: "", email: "", role: "STAFF", department: "" });
      fetchMembers();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to invite member");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopySetupLink = async () => {
    if (!setupUrl) return;
    try {
      await navigator.clipboard.writeText(setupUrl);
      setSetupLinkCopied(true);
      toast.success("Setup link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleCloseInviteModal = () => {
    setModalOpen(false);
    setSetupUrl(null);
    setSetupLinkCopied(false);
  };

  const handleStatusChange = async () => {
    if (!selectedMember || !statusReason.trim()) return;
    setStatusSubmitting(true);
    try {
      const inactiveStatuses: EmploymentStatus[] = ["RESIGNED", "TERMINATED", "CONTRACT_ENDED"];
      const payload: {
        employment_status: EmploymentStatus;
        reason: string;
        succeeded_by?: number | null;
      } = {
        employment_status: newStatus,
        reason: statusReason,
      };
      if (inactiveStatuses.includes(newStatus)) {
        payload.succeeded_by = successorId ? Number(successorId) : null;
      }
      await api.post(`/api/v1/accounts/users/${selectedMember.id}/change-status/`, payload);
      toast.success(`Status updated to ${statusLabel[newStatus]}`);
      setDetailModalOpen(false);
      setSelectedMember(null);
      setStatusReason("");
      setSuccessorId("");
      fetchMembers();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update status");
    } finally {
      setStatusSubmitting(false);
    }
  };

  const openDetailModal = (member: UserType) => {
    setSelectedMember(member);
    setNewStatus(member.employment_status);
    setStatusReason("");
    setSuccessorId(member.succeeded_by ? String(member.succeeded_by) : "");
    setDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setDetailModalOpen(false);
    setSelectedMember(null);
    setStatusReason("");
    setSuccessorId("");
  };

  const handleSuccessorSave = async () => {
    if (!selectedMember) return;
    setSuccessorSubmitting(true);
    try {
      const updated = await api.patch<UserType>(
        `/api/v1/accounts/users/${selectedMember.id}/`,
        { succeeded_by: successorId ? Number(successorId) : null },
      );
      toast.success("Successor updated");
      setSelectedMember(updated);
      fetchMembers();
    } catch (err) {
      toast.error((err as Error).message || "Failed to update successor");
    } finally {
      setSuccessorSubmitting(false);
    }
  };

  const deptMap = Object.fromEntries(departments.map((d) => [d.id, d.name]));

  // Filtered members
  const filteredMembers = useMemo(() => {
    if (statusFilter === "ALL") return members;
    return members.filter((m) => m.employment_status === statusFilter);
  }, [members, statusFilter]);

  // Separate active from inactive for historical view
  const activeMembers = useMemo(() => filteredMembers.filter((m) => !FORMER_STATUSES.includes(m.employment_status)), [filteredMembers]);
  const inactiveMembers = useMemo(() => filteredMembers.filter((m) => FORMER_STATUSES.includes(m.employment_status)), [filteredMembers]);

  const adminCount = members.filter((m) => m.role === "ADMIN" || m.role === "EXECUTIVE" || m.role === "BOARD_MEMBER").length;
  const managerCount = members.filter((m) => m.role === "MANAGER" || m.role === "DEPT_HEAD").length;
  const staffCount = members.filter((m) => m.role === "STAFF").length;

  const stats = [
    { label: "Admins", value: adminCount, icon: Shield, labelColor: "var(--danger)" },
    { label: "Managers", value: managerCount, icon: UserCog, labelColor: "var(--purple)" },
    { label: "Staff", value: staffCount, icon: User, labelColor: "var(--info)" },
    { label: "Total Members", value: members.length, icon: Users, labelColor: "var(--accent)" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const renderMemberCard = (m: UserType, idx: number, dimmed: boolean) => {
    const color = avatarColors[idx % avatarColors.length];
    const initials = userInitials(m);
    const avatar = mediaUrl(m.avatar);
    const fullName = formatFullName(m);
    return (
      <div
        key={m.id}
        className="rounded-xl border p-6 text-center transition-all cursor-pointer"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg-card)",
          opacity: dimmed ? 0.55 : 1,
        }}
        onClick={() => openDetailModal(m)}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-hover)";
          e.currentTarget.style.borderColor = "var(--accent-muted)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "var(--bg-card)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
      >
        <div className="relative mx-auto w-fit">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt={fullName}
              className="h-16 w-16 rounded-full object-cover"
              style={{ border: "1px solid var(--border)" }}
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
              style={{ backgroundColor: color + "20", color }}
            >
              {initials}
            </div>
          )}
          <span
            className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2"
            style={{
              borderColor: "var(--bg-card)",
              backgroundColor: statusDotColor[m.employment_status] || "var(--text-muted)",
            }}
          />
        </div>
        <h3 className="mt-4 font-semibold" style={{ color: "var(--text-primary)" }}>
          {fullName}
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{m.email}</p>
        {m.job_title && (
          <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{m.job_title}</p>
        )}
        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
          <Badge variant={roleVariant[m.role] || "neutral"}>{m.role}</Badge>
          <Badge variant={statusBadgeVariant[m.employment_status] || "neutral"}>
            {statusLabel[m.employment_status] || m.employment_status}
          </Badge>
        </div>
        <p className="mt-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
          {deptMap[m.department ?? 0] || "No Department"}
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Team</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{members.length} members</p>
        </div>
        <div className="flex items-center gap-3">
          <FormSelect
            label=""
            name="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_FILTER_OPTIONS}
          />
          <Button size="md" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatsCard key={s.label} label={s.label} value={s.value} icon={s.icon} labelColor={s.labelColor} />
        ))}
      </div>

      {/* Active Members */}
      {activeMembers.length > 0 && (
        <div className="space-y-3">
          {statusFilter === "ALL" && (
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Active Members ({activeMembers.length})
            </h3>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeMembers.map((m, idx) => renderMemberCard(m, idx, false))}
          </div>
        </div>
      )}

      {/* Inactive / Historical Members */}
      {inactiveMembers.length > 0 && (
        <div className="space-y-3">
          {statusFilter === "ALL" && (
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Former Members ({inactiveMembers.length})
            </h3>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inactiveMembers.map((m, idx) => renderMemberCard(m, idx, statusFilter === "ALL"))}
          </div>
        </div>
      )}

      {filteredMembers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12" style={{ color: "var(--text-muted)" }} />
          <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>No team members found for this filter.</p>
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal isOpen={modalOpen} onClose={handleCloseInviteModal} title="Invite Member">
        {setupUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl p-4" style={{ backgroundColor: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}>
              <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--accent)" }} />
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Account created successfully!
              </p>
            </div>
            <div>
              <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
                Share this secure setup link with the user so they can set their password:
              </p>
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 rounded-lg px-3 py-2.5 text-xs break-all select-all"
                  style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                >
                  {setupUrl}
                </div>
                <Button
                  variant={setupLinkCopied ? "secondary" : "primary"}
                  size="sm"
                  onClick={handleCopySetupLink}
                >
                  {setupLinkCopied ? "Copied" : "Copy Link"}
                </Button>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={handleCloseInviteModal}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <FormInput
                label="First Name"
                name="first_name"
                required
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              />
              <FormInput
                label="Middle Name"
                name="middle_name"
                placeholder="Optional"
                value={form.middle_name}
                onChange={(e) => setForm({ ...form, middle_name: e.target.value })}
              />
              <FormInput
                label="Last Name"
                name="last_name"
                required
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
            <FormInput
              label="Email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <FormSelect
              label="Role"
              name="role"
              required
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              options={[
                { value: "STAFF", label: "Staff" },
                { value: "MANAGER", label: "Manager" },
                { value: "DEPT_HEAD", label: "Department Head" },
                { value: "EXECUTIVE", label: "Executive" },
                { value: "BOARD_MEMBER", label: "Board Member" },
                { value: "ADMIN", label: "Admin" },
              ]}
            />
            <FormSelect
              label="Department"
              name="department"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="Select department..."
              options={departments.map((d) => ({ value: String(d.id), label: d.name }))}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" type="button" onClick={handleCloseInviteModal}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Inviting..." : "Invite Member"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Member Detail / Status Change Modal */}
      <Modal isOpen={detailModalOpen} onClose={closeDetailModal} title="Member Details">
        {selectedMember && (
          <div className="space-y-5">
            {/* Member Info */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Name</span>
                  <p style={{ color: "var(--text-primary)" }}>{formatFullName(selectedMember)}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Email</span>
                  <p style={{ color: "var(--text-primary)" }}>{selectedMember.email}</p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Role</span>
                  <div className="mt-0.5">
                    <Badge variant={roleVariant[selectedMember.role] || "neutral"}>{selectedMember.role}</Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Department</span>
                  <p style={{ color: "var(--text-primary)" }}>
                    {deptMap[selectedMember.department ?? 0] || "No Department"}
                  </p>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Employment Status</span>
                  <div className="mt-0.5">
                    <Badge variant={statusBadgeVariant[selectedMember.employment_status] || "neutral"}>
                      {statusLabel[selectedMember.employment_status] || selectedMember.employment_status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Job Title</span>
                  <p style={{ color: "var(--text-primary)" }}>{selectedMember.job_title || "Not set"}</p>
                </div>
              </div>
            </div>

            {/* Successor (privileged roles only) */}
            {canChangeStatus && (
              <div style={{ borderTop: "1px solid var(--border)" }} className="pt-5">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Successor
                </h3>
                <p className="mb-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  Assign the colleague taking over this person&apos;s responsibilities while they are inactive.
                  When changing status to terminated, resigned, or contract ended, the successor selected here
                  is saved automatically and can inherit their tasks.
                </p>
                {selectedMember.succeeded_by_name && (
                  <div className="mb-3 rounded-lg p-3" style={{ backgroundColor: "var(--accent-muted)" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                      Currently succeeded by
                    </p>
                    <p className="mt-0.5 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {selectedMember.succeeded_by_name}
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  <FormSelect
                    label="Successor"
                    name="successor"
                    value={successorId}
                    onChange={(e) => setSuccessorId(e.target.value)}
                    placeholder="No successor assigned"
                    options={members
                      .filter((m) =>
                        m.id !== selectedMember.id &&
                        m.employment_status === "ACTIVE",
                      )
                      .map((m) => ({
                        value: String(m.id),
                        label: `${formatFullName(m)}${m.job_title ? ` · ${m.job_title}` : ""}`,
                      }))}
                  />
                  <div className="flex justify-end pt-1">
                    <Button
                      size="md"
                      disabled={successorSubmitting}
                      onClick={handleSuccessorSave}
                    >
                      {successorSubmitting ? "Saving..." : "Save Successor"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Change Employment Status (privileged roles only) */}
            {canChangeStatus && (
              <>
                <div style={{ borderTop: "1px solid var(--border)" }} className="pt-5">
                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    Change Employment Status
                  </h3>
                  <div className="space-y-3">
                    <FormSelect
                      label="New Status"
                      name="newStatus"
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as EmploymentStatus)}
                      options={STATUS_CHANGE_OPTIONS}
                    />
                    <FormTextarea
                      label="Reason"
                      name="statusReason"
                      required
                      placeholder="Provide a reason for this status change..."
                      value={statusReason}
                      onChange={(e) => setStatusReason(e.target.value)}
                      rows={3}
                    />
                    <div className="flex justify-end pt-1">
                      <Button
                        size="md"
                        disabled={!statusReason.trim() || statusSubmitting}
                        onClick={handleStatusChange}
                      >
                        {statusSubmitting ? "Updating..." : "Update Status"}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
