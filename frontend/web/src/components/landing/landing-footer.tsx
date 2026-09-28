"use client";

import Image from "next/image";
import Link from "next/link";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Modules", href: "#modules" },
      { label: "Accountability", href: "#accountability" },
      { label: "AI", href: "#ai" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Security", href: "#security" },
      { label: "Roles", href: "#roles" },
      { label: "Contact", href: "#contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Register organisation", href: "/signup" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer
      className="border-t pt-16 pb-10"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-primary)" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Appraiser" width={32} height={32} className="object-contain" />
              <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Appraiser
              </span>
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
              Focus · Productivity · Performance
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              An institution-grade performance platform built for permanent records, accountability,
              and AI-assisted decision support.
            </p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p
                className="mb-4 text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: "var(--text-muted)" }}
              >
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => {
                  const isInternal = l.href.startsWith("/");
                  const cls =
                    "text-sm transition-colors hover:text-[color:var(--text-primary)]";
                  return (
                    <li key={l.href}>
                      {isInternal ? (
                        <Link href={l.href} className={cls} style={{ color: "var(--text-secondary)" }}>
                          {l.label}
                        </Link>
                      ) : (
                        <a href={l.href} className={cls} style={{ color: "var(--text-secondary)" }}>
                          {l.label}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-12 flex flex-col items-start justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center"
          style={{ borderColor: "var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            © {new Date().getFullYear()} Credminds · Appraiser is a Credminds product.
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Made with restraint. Designed for institutions.
          </p>
        </div>
      </div>
    </footer>
  );
}
