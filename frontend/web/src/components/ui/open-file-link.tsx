"use client";

import { ExternalLink } from "lucide-react";
import clsx from "clsx";
import { fileNameFromPath, mediaUrl } from "@/lib/api";

type OpenFileLinkVariant = "inline" | "pill" | "icon";

interface OpenFileLinkProps {
  file: string | null | undefined;
  label?: string;
  className?: string;
  variant?: OpenFileLinkVariant;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export function OpenFileLink({
  file,
  label,
  className,
  variant = "inline",
  onClick,
}: OpenFileLinkProps) {
  const url = mediaUrl(file);
  if (!url) return null;

  const text = label ?? fileNameFromPath(file);

  if (variant === "icon") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open in new tab"
        aria-label="Open in new tab"
        onClick={onClick}
        className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer",
          className,
        )}
        style={{ color: "var(--info)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "rgba(88, 166, 255, 0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
        }}
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    );
  }

  if (variant === "pill") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className={clsx(
          "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors cursor-pointer",
          className,
        )}
        style={{ color: "var(--accent)", backgroundColor: "var(--accent-muted)" }}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {text}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      title={text}
      className={clsx(
        "inline-flex min-w-0 items-center gap-1 font-medium underline-offset-2 hover:underline cursor-pointer truncate",
        className,
      )}
      style={{ color: "var(--info)" }}
    >
      <ExternalLink className="h-3 w-3 shrink-0" />
      <span className="truncate">{text}</span>
    </a>
  );
}
