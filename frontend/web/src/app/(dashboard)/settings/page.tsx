"use client";

import { useState, useEffect, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useSidebar } from "@/lib/sidebar-context";
import { api, mediaUrl, formatFullName, userInitials } from "@/lib/api";
import type { User, Organisation } from "@/lib/types";
import clsx from "clsx";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const tabs = ["Profile", "Organization", "Notifications", "Appearance"];

export default function SettingsPage() {
  const toast = useToast();
  const { user, organisation, refreshOrganisation } = useAuth();
  const { preference, setPreference } = useTheme();
  const { collapsed, setCollapsed } = useSidebar();
  const [activeTab, setActiveTab] = useState("Profile");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [savingOrg, setSavingOrg] = useState(false);

  const [profileForm, setProfileForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    phone: "",
    job_title: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const me = await api.get<User>("/api/v1/accounts/users/me/");
        setProfile(me);
        setProfileForm({
          first_name: me.first_name,
          middle_name: me.middle_name || "",
          last_name: me.last_name,
          email: me.email,
          phone: me.phone || "",
          job_title: me.job_title || "",
        });
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  useEffect(() => {
    if (organisation) {
      setOrgName(organisation.name);
    }
  }, [organisation]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await api.patch<User>(`/api/v1/accounts/users/${profile.id}/`, {
        first_name: profileForm.first_name,
        middle_name: profileForm.middle_name,
        last_name: profileForm.last_name,
        email: profileForm.email,
        phone: profileForm.phone,
        job_title: profileForm.job_title,
      });
      setProfile(updated);
      toast.success("Profile updated successfully");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarPick = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG, JPG, etc.)");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image too large. Max 5 MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const updated = await api.patchFormData<User>(
        `/api/v1/accounts/users/${profile.id}/`,
        form,
      );
      setProfile(updated);
      toast.success("Profile picture updated");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to upload profile picture");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/v1/auth/password/change/", {
        old_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success("Password updated successfully");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const initials = userInitials(profile);
  const avatarSrc = mediaUrl(profile?.avatar);
  const displayName = formatFullName(profile);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Settings</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Manage your account and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer"
            style={
              activeTab === t
                ? { backgroundColor: "var(--accent-muted)", color: "var(--accent)" }
                : { color: "var(--text-secondary)" }
            }
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "Profile" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Personal Info */}
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <h3 className="text-sm font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Personal Information</h3>
            <div className="mb-6 flex items-center gap-4">
              <div className="relative">
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="h-16 w-16 rounded-full object-cover"
                    style={{ border: "1px solid var(--border)" }}
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold"
                    style={{ backgroundColor: "var(--accent-muted)", color: "var(--accent)" }}
                  >
                    {initials}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAvatarPick}
                  disabled={uploadingAvatar}
                  title="Upload profile picture"
                  aria-label="Upload profile picture"
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "var(--border)", color: "var(--text-secondary)" }}
                  onMouseEnter={(e) => { if (!uploadingAvatar) { e.currentTarget.style.backgroundColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent-on)"; } }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  {uploadingAvatar ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{displayName}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{profile?.role}</p>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSaveProfile}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>First Name</label>
                  <input
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                    className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Middle Name</label>
                  <input
                    value={profileForm.middle_name}
                    onChange={(e) => setProfileForm({ ...profileForm, middle_name: e.target.value })}
                    placeholder="Optional"
                    className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Last Name</label>
                  <input
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                    className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Email</label>
                <input
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Job Title</label>
                <input
                  value={profileForm.job_title}
                  onChange={(e) => setProfileForm({ ...profileForm, job_title: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              <Button size="md" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </div>

          {/* Change Password */}
          <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
            <h3 className="text-sm font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Change Password</h3>
            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Current Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={passwordForm.current_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>New Password</label>
                <input
                  type="password"
                  placeholder="Enter new password"
                  value={passwordForm.new_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>
              <Button size="md" type="submit" disabled={saving}>
                {saving ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "Organization" && (
        <div className="rounded-xl border p-6 max-w-xl" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <h3 className="text-sm font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Organization Settings</h3>
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (!organisation) {
              toast.error("Could not load organization");
              return;
            }
            setSavingOrg(true);
            try {
              const updated = await api.patch<Organisation>(
                `/api/v1/organisations/organisations/${organisation.id}/`,
                { name: orgName }
              );
              setOrgName(updated.name);
              await refreshOrganisation();
              toast.success("Organization updated successfully");
            } catch (err: unknown) {
              toast.error((err as Error).message || "Failed to update organization");
            } finally {
              setSavingOrg(false);
            }
          }}>
            <div>
              <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Organization Name</label>
              <input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="Your organization"
                className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-colors"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)", color: "var(--text-primary)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>
            <Button size="md" type="submit" disabled={savingOrg}>
              {savingOrg ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </div>
      )}

      {activeTab === "Notifications" && (
        <div className="rounded-xl border p-6 max-w-xl" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <h3 className="text-sm font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Notification Preferences</h3>
          <div className="space-y-3">
            {[
              { label: "Task assignments", desc: "Get notified when a task is assigned to you" },
              { label: "Task updates", desc: "Get notified when tasks you follow are updated" },
              { label: "Project milestones", desc: "Get notified on project progress updates" },
              { label: "Policy updates", desc: "Get notified when policies are published or updated" },
              { label: "Team changes", desc: "Get notified when team members join or leave" },
            ].map((item, i) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border px-5 py-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-input)" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{item.label}</p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input type="checkbox" defaultChecked={i < 3} className="peer sr-only" />
                  <div
                    className="h-5 w-9 rounded-full after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:transition-all peer-checked:after:translate-x-full"
                    style={{
                      backgroundColor: "var(--border)",
                    }}
                  >
                    <style>{`
                      .peer:checked ~ div { background-color: var(--accent-muted) !important; }
                      .peer:checked ~ div::after { background-color: var(--accent) !important; }
                      div::after { background-color: var(--text-secondary); }
                    `}</style>
                  </div>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "Appearance" && (
        <div className="rounded-xl border p-6 max-w-xl" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <h3 className="text-sm font-semibold mb-6" style={{ color: "var(--text-primary)" }}>Appearance</h3>
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Theme</label>
              <div className="flex gap-3">
                {(["dark", "light", "system"] as const).map((t) => {
                  const label = t.charAt(0).toUpperCase() + t.slice(1);
                  const isActive = preference === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setPreference(t)}
                      className="rounded-lg border px-6 py-3 text-sm font-medium transition-all cursor-pointer"
                      style={
                        isActive
                          ? { borderColor: "var(--accent)", backgroundColor: "var(--accent-muted)", color: "var(--accent)" }
                          : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>Sidebar</label>
              <div className="flex gap-3">
                {([false, true] as const).map((isCollapsed) => {
                  const label = isCollapsed ? "Collapsed" : "Expanded";
                  const isActive = collapsed === isCollapsed;
                  return (
                    <button
                      key={label}
                      onClick={() => setCollapsed(isCollapsed)}
                      className="rounded-lg border px-6 py-3 text-sm font-medium transition-all cursor-pointer"
                      style={
                        isActive
                          ? { borderColor: "var(--accent)", backgroundColor: "var(--accent-muted)", color: "var(--accent)" }
                          : { borderColor: "var(--border)", color: "var(--text-secondary)" }
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
