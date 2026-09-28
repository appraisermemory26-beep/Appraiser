"use client";

import clsx from "clsx";

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  className?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  className,
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div
      className={clsx("overflow-x-auto rounded-xl", className)}
      style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)", backgroundColor: "color-mix(in srgb, var(--bg-primary) 50%, transparent)" }}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx("px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest", col.className)}
                style={{ color: "var(--text-secondary)" }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              className={clsx(
                "transition-colors",
                onRowClick && "cursor-pointer",
                i === data.length - 1 ? "" : ""
              )}
              style={{
                borderBottom: i < data.length - 1 ? "1px solid color-mix(in srgb, var(--border) 50%, transparent)" : "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {columns.map((col) => (
                <td key={col.key} className={clsx("px-4 py-3", col.className)} style={{ color: "var(--text-primary)" }}>
                  {col.render ? col.render(row) : (row[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
