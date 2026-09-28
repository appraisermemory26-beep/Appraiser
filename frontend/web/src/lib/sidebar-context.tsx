"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("appraiser_sidebar");
    if (stored === "collapsed") setCollapsedState(true);
  }, []);

  function toggle() {
    setCollapsedState((prev) => {
      const next = !prev;
      localStorage.setItem("appraiser_sidebar", next ? "collapsed" : "expanded");
      return next;
    });
  }

  function setCollapsed(v: boolean) {
    setCollapsedState(v);
    localStorage.setItem("appraiser_sidebar", v ? "collapsed" : "expanded");
  }

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
