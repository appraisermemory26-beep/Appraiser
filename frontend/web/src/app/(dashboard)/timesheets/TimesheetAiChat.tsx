"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { getLiberiaHolidayMap } from "@/lib/liberiaHolidays";

type Mode = "absent" | "leave";
type Step = "calendar" | "confirm" | "done";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function toIso(year: number, month: number, day: number): string {
  return year + "-" + pad2(month) + "-" + pad2(day);
}

function describeList(label: string, list: string[]): string {
  if (list.length === 0) return label + ": none";
  const days = list.map((d) => d.split("-")[2]).join(", ");
  return label + ": " + days;
}

export function TimesheetAiChat({
  institution,
  year,
  month,
  onGenerated,
  onClose,
}: {
  institution: string;
  year: number;
  month: number;
  onGenerated: () => void;
  onClose: () => void;
}) {
  const monthLabel = MONTH_NAMES[month - 1] + " " + year;
  const holidayMap = getLiberiaHolidayMap(year);

  const [mode, setMode] = useState<Mode>("absent");
  const [absentDates, setAbsentDates] = useState<string[]>([]);
  const [leaveDates, setLeaveDates] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("calendar");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastDay = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const holidayDatesInMonth = Array.from(holidayMap.keys()).filter((d) =>
    d.startsWith(year + "-" + pad2(month))
  );

  function toggleDate(day: number) {
    const iso = toIso(year, month, day);
    if (holidayMap.has(iso)) return;

    if (mode === "absent") {
      setLeaveDates((prev) => prev.filter((d) => d !== iso));
      setAbsentDates((prev) =>
        prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
      );
    } else {
      setAbsentDates((prev) => prev.filter((d) => d !== iso));
      setLeaveDates((prev) =>
        prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso]
      );
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/v1/timesheets/generate-manual-ai/", {
        institution: Number(institution),
        year,
        month,
        absent_dates: absentDates,
        holiday_dates: holidayDatesInMonth,
        leave_dates: leaveDates,
      });
      setStep("done");
      onGenerated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);

  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 8,
        padding: 16,
        margin: "12px 0",
        background: "#F9FAFB",
        maxWidth: 480,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 14 }}>AI Timesheet Assistant</strong>
        <button
          onClick={onClose}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#6B7280" }}
        >
          Close
        </button>
      </div>

      {step === "calendar" && (
        <>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 10, lineHeight: 1.5 }}>
            Let's fill in your {monthLabel} timesheet together. I've already marked this
            month's public holidays in grey - they're filled in automatically. Click any day
            you were absent or on leave below.
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button
              onClick={() => setMode("absent")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: mode === "absent" ? "1px solid #DC2626" : "1px solid #D1D5DB",
                background: mode === "absent" ? "#FEE2E2" : "#fff",
                color: mode === "absent" ? "#991B1B" : "#374151",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: mode === "absent" ? 600 : 400,
              }}
            >
              Mark Absent Days
            </button>
            <button
              onClick={() => setMode("leave")}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: mode === "leave" ? "1px solid #2563EB" : "1px solid #D1D5DB",
                background: mode === "leave" ? "#DBEAFE" : "#fff",
                color: mode === "leave" ? "#1E40AF" : "#374151",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: mode === "leave" ? 600 : 400,
              }}
            >
              Mark Leave Days
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 10 }}>
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
                {w}
              </div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={"blank-" + i} />;
              const iso = toIso(year, month, day);
              const isHoliday = holidayMap.has(iso);
              const isAbsent = absentDates.includes(iso);
              const isLeave = leaveDates.includes(iso);
              const weekday = (firstWeekday + day - 1) % 7;
              const isWeekend = weekday === 0 || weekday === 6;

              let bg = "#fff";
              let color = "#111827";
              let border = "1px solid #E5E7EB";
              if (isHoliday) {
                bg = "#E5E7EB";
                color = "#6B7280";
              } else if (isAbsent) {
                bg = "#DC2626";
                color = "#fff";
                border = "1px solid #DC2626";
              } else if (isLeave) {
                bg = "#2563EB";
                color = "#fff";
                border = "1px solid #2563EB";
              } else if (isWeekend) {
                bg = "#F3F4F6";
              }

              return (
                <button
                  key={iso}
                  onClick={() => toggleDate(day)}
                  disabled={isHoliday}
                  title={isHoliday ? holidayMap.get(iso) : undefined}
                  style={{
                    padding: "6px 0",
                    borderRadius: 6,
                    border,
                    background: bg,
                    color,
                    fontSize: 12,
                    cursor: isHoliday ? "default" : "pointer",
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280", marginBottom: 12 }}>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#E5E7EB", marginRight: 4 }} />Holiday</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#DC2626", marginRight: 4 }} />Absent</span>
            <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#2563EB", marginRight: 4 }} />Leave</span>
          </div>

          {holidayDatesInMonth.length > 0 && (
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 12, lineHeight: 1.6, background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6, padding: "8px 10px" }}>
              <strong>{holidayDatesInMonth.length === 1 ? "Public holiday this month: " : "Public holidays this month: "}</strong>
              {holidayDatesInMonth
                .map((d) => {
                  const day = parseInt(d.split("-")[2], 10);
                  return MONTH_NAMES[month - 1] + " " + day + " - " + holidayMap.get(d);
                })
                .join("; ")}
            </div>
          )}

          <button
            onClick={() => setStep("confirm")}
            style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #2563EB", background: "#2563EB", color: "#fff", fontSize: 13, cursor: "pointer" }}
          >
            Continue
          </button>
        </>
      )}

      {step === "confirm" && (
        <div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 10, lineHeight: 1.6 }}>
            Here's what I'll generate for {monthLabel}: {describeList("Absent", absentDates)} |{" "}
            {describeList("Holidays", holidayDatesInMonth)} | {describeList("Leave", leaveDates)}.
            Every other day will automatically be filled in as a full 8.0-hour workday. Shall I
            generate the draft now?
          </div>
          {error && <div style={{ color: "#DC2626", fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleGenerate}
              disabled={busy}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #2563EB", background: "#2563EB", color: "#fff", fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? "Generating..." : "Generate Draft"}
            </button>
            <button
              onClick={() => setStep("calendar")}
              disabled={busy}
              style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div>
          <div style={{ fontSize: 13, color: "#374151", marginBottom: 10 }}>
            Draft generated. Please review the grid below, then click Accept Draft before sending it.
          </div>
          <button
            onClick={onClose}
            style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid #D1D5DB", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}