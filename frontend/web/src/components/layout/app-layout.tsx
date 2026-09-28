"use client";

import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { useSidebar } from "@/lib/sidebar-context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebar();

  return (
    <div className="flex h-screen overflow-hidden theme-surface-gradient" style={{ backgroundColor: "var(--bg-primary)" }}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
