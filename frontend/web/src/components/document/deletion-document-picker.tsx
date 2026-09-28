"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Search, X } from "lucide-react";
import clsx from "clsx";
import type { DeletionDocumentType } from "@/lib/deletion-types";
import {
  fetchDeletionDocumentOptions,
  type DeletionDocumentOption,
} from "@/lib/deletion-document-options";

interface DeletionDocumentPickerProps {
  documentType: DeletionDocumentType;
  value: string;
  onChange: (documentId: string) => void;
  required?: boolean;
  error?: string;
}

export function DeletionDocumentPicker({
  documentType,
  value,
  onChange,
  required,
  error,
}: DeletionDocumentPickerProps) {
  const [options, setOptions] = useState<DeletionDocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((opt) => String(opt.id) === value);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const next = await fetchDeletionDocumentOptions(documentType);
      setOptions(next);
    } catch (err: unknown) {
      setOptions([]);
      setFetchError((err as Error).message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [documentType]);

  useEffect(() => {
    setQuery("");
    setOpen(false);
    loadOptions();
  }, [documentType, loadOptions]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter(
    (opt) => !query.trim() || opt.searchText.includes(query.trim().toLowerCase()) || opt.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const displayError = error || fetchError;

  return (
    <div ref={containerRef}>
      <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        Document
        {required && <span className="ml-1" style={{ color: "var(--danger)" }}>*</span>}
      </label>

      {selected && !open ? (
        <div
          className="flex min-h-11 items-center gap-2 rounded-lg border px-3.5 py-2"
          style={{ backgroundColor: "var(--bg-input)", borderColor: displayError ? "var(--danger)" : "var(--border)" }}
        >
          <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
            {selected.label}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={loading ? "Loading documents..." : "Search documents..."}
            disabled={loading}
            className="h-11 w-full rounded-lg border pl-10 pr-10 text-sm outline-none transition-colors"
            style={{
              backgroundColor: "var(--bg-input)",
              borderColor: displayError ? "var(--danger)" : "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" style={{ color: "var(--text-muted)" }} />
          ) : (
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          )}
        </div>
      )}

      {open && !loading && (
        <div
          className="mt-1 max-h-52 overflow-y-auto rounded-lg border shadow-lg"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-sm text-center" style={{ color: "var(--text-muted)" }}>
              {options.length === 0 ? "No documents available" : "No matches found"}
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  onChange(String(opt.id));
                  setQuery("");
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                  String(opt.id) === value && "font-medium",
                )}
                style={{
                  color: "var(--text-primary)",
                  backgroundColor: String(opt.id) === value ? "var(--bg-hover)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = String(opt.id) === value ? "var(--bg-hover)" : "transparent";
                }}
              >
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}

      {displayError && (
        <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{displayError}</p>
      )}
    </div>
  );
}
