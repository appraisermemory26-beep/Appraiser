import { FileText, Image, ExternalLink } from "lucide-react";
import { mediaUrl, fileNameFromPath } from "@/lib/api";
import type { TaskOutput } from "@/lib/types";

function fmtDateTime(d: string): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileInfo(url: string) {
  const filename = fileNameFromPath(url);
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf") return { filename, ext: "PDF", color: "var(--danger)", Icon: FileText };
  if (["doc", "docx"].includes(ext)) return { filename, ext: ext.toUpperCase(), color: "var(--info)", Icon: FileText };
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { filename, ext: ext.toUpperCase(), color: "var(--accent)", Icon: Image };
  return { filename, ext: ext.toUpperCase(), color: "var(--text-secondary)", Icon: FileText };
}

export default function TaskOutputCard({ output }: { output: TaskOutput }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border)" }}
    >
      {/* Header: submitter + timestamp */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ backgroundColor: "var(--bg-hover)" }}
      >
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {output.submitted_by_name || `User #${output.submitted_by}`}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {fmtDateTime(output.created_at)}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* File attachment */}
        {output.file && (() => {
          const fileUrl = mediaUrl(output.file);
          const { filename, ext, color, Icon } = getFileInfo(output.file);
          if (!fileUrl) return null;
          return (
            <div
              className="flex items-center gap-3 rounded-lg px-3 py-2.5"
              style={{ backgroundColor: "var(--bg-hover)" }}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "var(--bg-primary)" }}
              >
                <Icon className="h-4 w-4" style={{ color }} />
              </div>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-0 text-sm font-medium truncate underline-offset-2 hover:underline cursor-pointer"
                style={{ color: "var(--text-primary)" }}
                title="Open file"
              >
                {filename}
              </a>
              <span
                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                {ext}
              </span>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
                style={{ color: "var(--info)" }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </div>
          );
        })()}

        {/* Text content */}
        {output.text_content && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--text-muted)" }}>
              Text Note
            </p>
            <div
              className="rounded-lg px-4 py-3 text-sm whitespace-pre-wrap"
              style={{
                backgroundColor: "var(--bg-hover)",
                borderLeft: "3px solid var(--accent)",
                color: "var(--text-primary)",
              }}
            >
              {output.text_content}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
