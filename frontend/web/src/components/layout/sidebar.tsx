"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import { sidebarNavigation } from "@/lib/constants";
import { useAuth } from "@/lib/auth-context";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  return (
    <>
    <aside
      className={clsx(
        "relative flex h-screen shrink-0 flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
      style={{ backgroundColor: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
    >
      {/* Collapse/Expand toggle - floats on the edge */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[26px] z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-colors cursor-pointer"
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          color: "var(--text-secondary)",
        }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      {/* Logo */}
      <div className={clsx("flex h-16 items-center gap-3", collapsed ? "justify-center px-2" : "px-4")} style={{ borderBottom: "1px solid var(--border)" }}>
        <Image
          src="/logo.png"
          alt="Appraiser"
          width={collapsed ? 32 : 36}
          height={collapsed ? 32 : 36}
          priority
          className="shrink-0 object-contain"
        />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-sm font-bold tracking-tight leading-none" style={{ color: "var(--text-primary)" }}>
              Appraiser
            </p>
            <p className="mt-0.5 text-[9px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Institutional Memory
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {sidebarNavigation.map((group) => {
          const visibleItems = group.items.filter(
            (item) => !item.roles || item.roles.includes(user?.role || "")
          );
          if (visibleItems.length === 0) return null;
          return (
          <div key={group.title} className="mb-5">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                {group.title}
              </p>
            )}
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                    collapsed && "justify-center px-0"
                  )}
                  style={{
                    backgroundColor: isActive ? "var(--accent-muted)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="px-2 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          className={clsx(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer",
            collapsed && "justify-center px-0"
          )}
          style={{ color: "var(--text-secondary)" }}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>

    {/* Logout Confirmation Modal */}
    {showLogoutConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "var(--overlay)" }}>
        <div className="w-full max-w-sm rounded-xl p-6 shadow-2xl" style={{ backgroundColor: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
          <h3 className="mb-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Confirm Logout</h3>
          <p className="mb-6 text-sm" style={{ color: "var(--text-secondary)" }}>
            Are you sure you want to logout?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowLogoutConfirm(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
              style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowLogoutConfirm(false); logout(); }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors cursor-pointer"
              style={{ backgroundColor: "var(--danger)" }}
            >
              Yes, Logout
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
