"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Modules", href: "#modules" },
  { label: "Accountability", href: "#accountability" },
  { label: "AI", href: "#ai" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-all duration-200 ease-out"
      style={{
        backgroundColor: scrolled ? "rgba(255, 255, 255, 0.78)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "1px solid transparent",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Appraiser"
            width={32}
            height={32}
            priority
            className="object-contain"
          />
          <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Appraiser
          </span>
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium transition-colors hover:text-[color:var(--text-primary)]"
              style={{ color: "var(--text-secondary)" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="text-sm font-medium transition-colors hover:text-[color:var(--text-primary)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Sign in
          </Link>
          <a
            href="#contact"
            className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-on)",
              boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, var(--shadow)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
          >
            Request a demo
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          aria-label="Open navigation"
          onClick={() => setOpen((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
          style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile sheet */}
      {open && (
        <div
          className="md:hidden"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="mx-auto max-w-6xl px-6 py-4">
            <nav className="flex flex-col">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="border-b py-3 text-sm font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="border-b py-3 text-sm font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                Sign in
              </Link>
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
              >
                Request a demo
              </a>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
