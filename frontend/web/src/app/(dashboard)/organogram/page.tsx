"use client";

import { useState, useEffect } from "react";
import { Network, Loader2, FileWarning, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

const ALLOWED_ROLES = ["ADMIN", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER"];

export default function OrganogramPage() {
  const { user, organisation } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Organisation is already loaded via auth context
    setLoading(false);
  }, [organisation]);

  const role = user?.role || "";

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <FileWarning className="h-12 w-12 mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const organogramUrl = organisation?.organogram_file || null;

  const isImage = organogramUrl
    ? /\.(png|jpe?g|gif|webp|svg)$/i.test(organogramUrl)
    : false;

  const isPdf = organogramUrl
    ? /\.pdf$/i.test(organogramUrl)
    : false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Organogram
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {organisation?.name || "Organisation"} structure
          </p>
        </div>
        {organogramUrl && (
          <a href={organogramUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="md">
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
          </a>
        )}
      </div>

      {/* Content */}
      {!organogramUrl ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <Network className="h-16 w-16 mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            No Organogram Uploaded
          </p>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            The organisation has not uploaded an organogram yet. An admin can upload one from Settings.
          </p>
        </div>
      ) : isImage ? (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="p-4">
            <img
              src={organogramUrl}
              alt="Organisation Organogram"
              className="w-full h-auto rounded-xl"
              style={{ maxHeight: "80vh", objectFit: "contain" }}
            />
          </div>
        </div>
      ) : isPdf ? (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <iframe
            src={organogramUrl}
            className="w-full rounded-xl"
            style={{ height: "80vh", border: "none" }}
            title="Organisation Organogram"
          />
        </div>
      ) : (
        <div className="rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
            The organogram file format is not previewable in the browser.
          </p>
          <a href={organogramUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" size="md">
              <ExternalLink className="h-4 w-4" />
              Download Organogram
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}
