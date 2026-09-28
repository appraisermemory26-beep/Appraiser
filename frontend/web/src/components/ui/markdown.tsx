"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  children: string;
  className?: string;
}

/**
 * Renders an AI-generated markdown payload using the project palette.
 * Used for chat answers, JD drafts, coaching tips, and project summaries.
 */
export function Markdown({ children, className }: Props) {
  return (
    <div
      className={className}
      style={{ color: "var(--text-primary)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => (
            <h1
              {...p}
              className="text-xl font-bold mt-4 mb-2"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          h2: (p) => (
            <h2
              {...p}
              className="text-lg font-bold mt-4 mb-2"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          h3: (p) => (
            <h3
              {...p}
              className="text-base font-bold mt-3 mb-1.5"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          h4: (p) => (
            <h4
              {...p}
              className="text-sm font-semibold mt-3 mb-1.5"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          p: (p) => (
            <p
              {...p}
              className="text-sm leading-relaxed my-2"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          ul: (p) => (
            <ul
              {...p}
              className="list-disc pl-5 my-2 space-y-1 text-sm"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          ol: (p) => (
            <ol
              {...p}
              className="list-decimal pl-5 my-2 space-y-1 text-sm"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          li: (p) => <li {...p} className="leading-relaxed" />,
          strong: (p) => (
            <strong
              {...p}
              className="font-semibold"
              style={{ color: "var(--text-primary)" }}
            />
          ),
          em: (p) => <em {...p} className="italic" />,
          a: (p) => (
            <a
              {...p}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
              style={{ color: "var(--accent)" }}
            />
          ),
          blockquote: (p) => (
            <blockquote
              {...p}
              className="border-l-4 pl-3 my-3 italic text-sm"
              style={{
                borderColor: "var(--border)",
                color: "var(--text-secondary)",
              }}
            />
          ),
          code: ({ children, ...rest }) => {
            const inline = !String(children).includes("\n");
            return inline ? (
              <code
                {...rest}
                className="rounded px-1 py-0.5 text-[12px] font-mono"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: "var(--text-primary)",
                }}
              >
                {children}
              </code>
            ) : (
              <code
                {...rest}
                className="block rounded-lg p-3 my-2 text-[12px] font-mono overflow-x-auto"
                style={{
                  backgroundColor: "var(--bg-hover)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                {children}
              </code>
            );
          },
          pre: (p) => <pre {...p} className="my-2" />,
          hr: () => (
            <hr
              className="my-4"
              style={{ borderColor: "var(--border)" }}
            />
          ),
          table: (p) => (
            <div className="overflow-x-auto my-3">
              <table
                {...p}
                className="text-sm border-collapse w-full"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
          ),
          th: (p) => (
            <th
              {...p}
              className="border px-3 py-2 text-left font-semibold"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-hover)",
              }}
            />
          ),
          td: (p) => (
            <td
              {...p}
              className="border px-3 py-2"
              style={{ borderColor: "var(--border)" }}
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
