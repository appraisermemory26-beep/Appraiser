"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { FormSelect } from "@/components/ui/form-select";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { Button } from "@/components/ui/button";
import { TimesheetAiChat } from "./TimesheetAiChat";
import { getLiberiaHolidayMap } from "@/lib/liberiaHolidays";
import type {
  Timesheet,
  TimesheetDay,
  Institution,
  Organisation,
  PaginatedResponse,
} from "@/lib/types";

/* ---------------------------------------------------------------------- */
/*  Exact CSS from the approved design preview (Strict-Mode-ON).          */
/*  Written as literal styles so the look never depends on this app's     */
/*  Tailwind color theme.                                                 */
/* ---------------------------------------------------------------------- */

const STRIP_CSS = `
.ts-wrap { font-family: -apple-system, system-ui, "Segoe UI", Arial, sans-serif; color: #111827; }
.ts-badge { display: inline-block; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 999px; margin-left: 8px; vertical-align: middle; }
.ts-badge.good { background: #DCFCE7; color: #15803D; }
.ts-badge.bad { background: #FEE2E2; color: #B91C1C; }
.ts-infogrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.ts-infobox { background: #fff; border: 1px solid #E5E7EB; border-radius: 10px; padding: 14px 16px; }
.ts-infobox .ts-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9CA3AF; letter-spacing: .04em; }
.ts-infobox .ts-value { font-size: 14px; font-weight: 600; margin-top: 3px; }
.ts-strip-scroll { overflow-x: auto; border: 1px solid #E5E7EB; border-radius: 12px; background: #fff; margin-bottom: 20px; }
table.ts-strip { border-collapse: collapse; font-size: 11px; white-space: nowrap; width: 100%; }
table.ts-strip th, table.ts-strip td { border: 1px solid #E5E7EB; padding: 6px 8px; text-align: center; }
th.ts-rowlabel, td.ts-rowlabel { position: sticky; left: 0; background: #F3F4F6; text-align: left; font-weight: 600; z-index: 2; min-width: 150px; }
td.ts-rowlabel { white-space: normal; max-width: 260px; }
th.ts-dc, th.ts-dow { background: #F9FAFB; color: #374151; }
th.ts-dow { font-size: 10px; font-weight: 500; color: #6B7280; }
.ts-wknd { background: #D1D5DB !important; color: #4B5563; }
.ts-wknd.ts-padwknd { background: #E8E9EB !important; color: #B5B9BF; }
.ts-divider { border-left: 1px solid #9CA3AF !important; }
.ts-wd-present { background: #FFFFFF !important; color: #111827; font-weight: 700; }
.ts-wd-absent  { background: #FACC15 !important; color: #713F12; font-weight: 700; }
.ts-wd-pad     { background: #F4F4F3 !important; color: #C7C9CC; }
.ts-total-row-cell { background: #4B5563 !important; color: #F9FAFB; font-weight: 700; }
.ts-total-row-sum  { background: #374151 !important; color: #FFFFFF; font-weight: 700; }
.ts-pctcell-green   { background: #16A34A !important; color: #FFFFFF; font-weight: 700; }
.ts-pctcell-red     { background: #DC2626 !important; color: #FFFFFF; font-weight: 700; }
.ts-pctcell-neutral { background: #F3F4F6 !important; color: #6B7280; font-weight: 600; }
.ts-pcthead { background: #16A34A !important; color: #FFFFFF; }
.ts-section-row td { background: #F3F4F6; font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; color: #6B7280; text-align: left; }
.ts-spacer td { border: none !important; height: 4px; background: transparent; }
.ts-legend { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12px; color: #6B7280; margin-bottom: 20px; }
.ts-legend span { display: inline-flex; align-items: center; gap: 6px; }
.ts-swatch { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
table.ts-weekly { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; margin-bottom: 20px; font-size: 13px; }
table.ts-weekly th, table.ts-weekly td { border-bottom: 1px solid #E5E7EB; padding: 10px 16px; text-align: right; }
table.ts-weekly th:first-child, table.ts-weekly td:first-child { text-align: left; }
table.ts-weekly th { background: #F9FAFB; color: #6B7280; font-weight: 600; font-size: 12px; }
table.ts-weekly td.ts-wk-green { background: #16A34A; color: #fff; font-weight: 700; }
table.ts-weekly td.ts-wk-red { background: #DC2626; color: #fff; font-weight: 700; }
table.ts-weekly tr.ts-monthtotal td { font-weight: 700; background: #F9FAFB; }
.ts-bottomgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.ts-bottombox { background: #fff; border: 1px solid #E5E7EB; border-radius: 10px; padding: 16px; }
.ts-bottombox .ts-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9CA3AF; letter-spacing: .04em; }
.ts-bottombox .ts-value { font-size: 14px; font-weight: 600; margin-top: 4px; }
.ts-note { font-size: 12px; color: #065F46; background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 10px 14px; margin-top: 16px; margin-bottom: 20px; }
.ts-pattern-alert { display: flex; gap: 12px; align-items: flex-start; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; color: #fff; }
.ts-pattern-alert.ts-ok { background: #16A34A; }
.ts-pattern-alert.ts-bad { background: #DC2626; }
.ts-pattern-alert .ts-icon { font-size: 20px; line-height: 1; }
.ts-pattern-alert .ts-title { font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .03em; margin-bottom: 4px; }
.ts-pattern-alert .ts-body { font-size: 13px; line-height: 1.5; }
.ts-mode-banner { display: flex; align-items: center; justify-content: space-between; background: #111827; color: #fff; border-radius: 12px; padding: 12px 20px; margin-bottom: 20px; font-size: 12.5px; flex-wrap: wrap; gap: 8px; }
.ts-mode-banner .ts-modelabel { font-weight: 700; letter-spacing: .03em; }
.ts-mode-banner .ts-on { color: #4ADE80; }
.ts-mode-banner .ts-off { color: #FBBF24; }
.ts-mode-banner .ts-sub2 { color: #9CA3AF; }
h2.ts-sec { font-size: 15px; font-weight: 700; margin: 28px 0 12px; }
.ts-panel { background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; padding: 20px 24px; margin-bottom: 20px; }
.ts-scoregrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 16px; }
.ts-scorebox { border-radius: 10px; padding: 14px 16px; text-align: center; color: #fff; }
.ts-scorebox.ts-green { background: #16A34A; }
.ts-scorebox.ts-red { background: #DC2626; }
.ts-scorebox.ts-gray { background: #9CA3AF; }
.ts-scorebox .ts-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .03em; opacity: .85; }
.ts-scorebox .ts-big { font-size: 26px; font-weight: 800; margin-top: 4px; }
table.ts-tasks { width: 100%; border-collapse: collapse; font-size: 12.5px; }
table.ts-tasks th, table.ts-tasks td { border-bottom: 1px solid #E5E7EB; padding: 9px 10px; text-align: left; }
table.ts-tasks th { color: #6B7280; font-weight: 600; background: #F9FAFB; }
.ts-pill { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
.ts-pill.ts-done { background: #DCFCE7; color: #15803D; }
.ts-pill.ts-late { background: #FEF3C7; color: #92400E; }
.ts-pill.ts-excluded { background: #F3F4F6; color: #6B7280; }
.ts-flag { border-radius: 10px; padding: 12px 16px; font-size: 12.5px; line-height: 1.5; margin-top: 14px; display: flex; gap: 10px; }
.ts-flag.ts-good { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }
.ts-flag.ts-warn { background: #FFF7ED; border: 1px solid #FED7AA; color: #9A3412; }
.ts-flag.ts-info { background: #EFF6FF; border: 1px solid #BFDBFE; color: #1E40AF; }
.ts-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.ts-dropdown { position: relative; display: inline-block; }
.ts-dropbtn { padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; background: #fff; color: #111827; border: 1px solid #E5E7EB; display: inline-flex; align-items: center; gap: 6px; }
.ts-dropbtn:hover { background: #F9FAFB; }
.ts-dropmenu { position: absolute; top: calc(100% + 4px); left: 0; background: #fff; border: 1px solid #E5E7EB; border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 20; min-width: 140px; max-height: 260px; overflow-y: auto; padding: 4px; }
.ts-dropitem { padding: 7px 12px; border-radius: 6px; font-size: 13px; cursor: pointer; color: #374151; }
.ts-dropitem:hover { background: #F3F4F6; }
.ts-dropitem.ts-active { background: #111827; color: #fff; }
.ts-modetoggle { display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700; border: 1px solid transparent; }
.ts-modetoggle.ts-strict { background: #111827; color: #fff; }
.ts-modetoggle.ts-alt { background: #FEF3C7; color: #92400E; }
.ts-modetoggle.ts-clickable { cursor: pointer; }
.ts-modetoggle.ts-readonly { cursor: default; opacity: 0.9; }
.ts-manual-note { font-size: 12px; color: #92400E; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; }
.ts-optional-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
.ts-optional-field label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #9CA3AF; letter-spacing: .04em; display: block; margin-bottom: 4px; }
.ts-optional-field input { width: 100%; padding: 8px 10px; border-radius: 8px; border: 1px solid #E5E7EB; font-size: 14px; }
`;

/* ---------------------------------------------------------------------- */
/*  Calendar / attendance helpers                                         */
/* ---------------------------------------------------------------------- */

type DayType =
  | "WORK"
  | "WEEKEND"
  | "HOLIDAY"
  | "LEAVE_ANNUAL"
  | "LEAVE_UPA"
  | "SICK_LEAVE"
  | "LEAVE_OTHER"
  | "ABSENT";

/** color is the FIXED visual bucket for this category's row (per the approved design). */
const OTHER_TIME_ROWS: { key: DayType; label: string; color: "present" | "absent" }[] = [
  { key: "LEAVE_ANNUAL", label: "Leave (Annual)", color: "absent" },
  { key: "LEAVE_UPA", label: "Leave (UPA)", color: "present" },
  { key: "SICK_LEAVE", label: "Sick Leave", color: "absent" },
  { key: "HOLIDAY", label: "Holiday", color: "present" },
  { key: "LEAVE_OTHER", label: "Other Leave", color: "absent" },
];

const DOW_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}
function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
function dayNum(iso: string): number {
  return toDate(iso).getDate();
}
function isWeekend(iso: string): boolean {
  const dow = toDate(iso).getDay();
  return dow === 0 || dow === 6;
}

interface GridCell {
  date: string;
  inMonth: boolean;
  weekend: boolean;
  day?: TimesheetDay;
}

function buildGrid(periodStart: string, periodEnd: string, days: TimesheetDay[]): GridCell[][] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const start = toDate(periodStart);
  const end = toDate(periodEnd);
  const startDow = start.getDay();
  const sinceSat = (startDow + 1) % 7;
  let cursor = addDays(start, -sinceSat);
  const endIso = fmtISO(end);

  const weeks: GridCell[][] = [];
  while (true) {
    const week: GridCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(cursor, i);
      const iso = fmtISO(d);
      const inMonth = d >= start && d <= end;
      week.push({ date: iso, inMonth, weekend: isWeekend(iso), day: byDate.get(iso) });
    }
    weeks.push(week);
    if (week[6].date >= endIso) break;
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function isExpectedWorkday(cell: GridCell): boolean {
  return cell.inMonth && !cell.weekend;
}

/** Looks for a value under any of several possible field names/paths — real APIs name things differently. */
function pick(obj: unknown, paths: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  for (const path of paths) {
    let cur: unknown = obj;
    for (const key of path.split(".")) {
      if (cur && typeof cur === "object" && key in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[key];
      } else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim() !== "") return cur;
  }
  return null;
}

function monthLabelFromPeriod(start: string | undefined): string {
  if (!start) return "—";
  const d = toDate(start);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en", { month: "long", year: "numeric" });
}

interface MonthStats {
  presentTotal: number;
  absentTotal: number;
  expectedTotal: number;
  categoryTotals: Record<string, number>;
  presentPct: number;
  weekly: { label: string; present: number; expected: number; pct: number | null }[];
  pattern: { weekday: string; rate: number }[];
}

function computeStats(weeks: GridCell[][]): MonthStats {
  let presentTotal = 0;
  let absentTotal = 0;
  let expectedTotal = 0;
  const categoryTotals: Record<string, number> = {};
  OTHER_TIME_ROWS.forEach((r) => (categoryTotals[r.key] = 0));

  const weekly: MonthStats["weekly"] = [];
  const weekdayAbsence: Record<number, { occ: number; abs: number }> = {};

  weeks.forEach((week, wi) => {
    let weekPresent = 0;
    let weekExpected = 0;
    week.forEach((cell) => {
      if (!isExpectedWorkday(cell)) return;
      weekExpected += 8;
      expectedTotal += 8;
      const dow = toDate(cell.date).getDay();
      weekdayAbsence[dow] = weekdayAbsence[dow] || { occ: 0, abs: 0 };
      weekdayAbsence[dow].occ += 1;

      const dt = (cell.day?.day_type as DayType) || "WORK";
      if (dt === "ABSENT") {
        absentTotal += 8;
        weekdayAbsence[dow].abs += 1;
      } else if (OTHER_TIME_ROWS.some((r) => r.key === dt)) {
        categoryTotals[dt] += 8;
      } else {
        presentTotal += 8;
        weekPresent += 8;
      }
    });
    const first = week.find((c) => c.inMonth) ?? week[2];
    const last = [...week].reverse().find((c) => c.inMonth) ?? week[4];
    weekly.push({
      label: first && last ? `Week ${wi + 1} (${first.date.slice(5)} – ${last.date.slice(5)})` : `Week ${wi + 1}`,
      present: weekPresent,
      expected: weekExpected,
      pct: weekExpected > 0 ? Math.round((weekPresent / weekExpected) * 100) : null,
    });
  });

  const presentPct = expectedTotal > 0 ? Math.round((presentTotal / expectedTotal) * 100) : 0;

  const pattern = Object.entries(weekdayAbsence)
    .filter(([, v]) => v.occ >= 2 && v.abs === v.occ)
    .map(([dow, v]) => ({ weekday: DOW_ABBR[Number(dow)], rate: Math.round((v.abs / v.occ) * 100) }));

  return { presentTotal, absentTotal, expectedTotal, categoryTotals, presentPct, weekly, pattern };
}

/* ---------------------------------------------------------------------- */
/*  Productivity & Performance (Strict-mode add-on, tied to Tasks module) */
/* ---------------------------------------------------------------------- */

interface TaskRecord {
  id?: string;
  name?: string;
  title?: string;
  assigned_date?: string;
  due_date?: string;
  delivered_date?: string;
  delivered_on_time?: boolean;
  supported?: boolean;
  status?: string;
}

interface PerformanceResult {
  productivityScore: number;
  taskScore: number | null;
  performance: number | null;
  scorableTasks: TaskRecord[];
  excludedTasks: TaskRecord[];
  notGradable: boolean;
  flagReason: string | null;
  recommend1on1: boolean;
}

function computePerformance(presentPct: number, tasks: TaskRecord[]): PerformanceResult {
  const productivityScore = presentPct;

  if (tasks.length === 0) {
    return {
      productivityScore,
      taskScore: null,
      performance: productivityScore,
      scorableTasks: [],
      excludedTasks: [],
      notGradable: true,
      flagReason: "No task was assigned this month yet - this is expected while the Tasks module has no history, and is flagged to the supervisor, not the employee.",
      recommend1on1: false,
    };
  }

  const scorableTasks = tasks.filter((t) => t.supported !== false);
  const excludedTasks = tasks.filter((t) => t.supported === false);

  if (scorableTasks.length === 0) {
    return {
      productivityScore,
      taskScore: null,
      performance: productivityScore,
      scorableTasks,
      excludedTasks,
      notGradable: true,
      flagReason:
        "Every assigned task was missing required support (transport, materials, internet, electricity, etc.) - excluded from scoring and flagged to the organization/supervisor, not the employee.",
      recommend1on1: false,
    };
  }

  const onTimeCount = scorableTasks.filter((t) => t.delivered_on_time !== false).length;
  const taskScore = Math.round((onTimeCount / scorableTasks.length) * 100);
  const performance = Math.round((taskScore + productivityScore) / 2);
  const recommend1on1 = performance < 90 && excludedTasks.length === 0;

  return {
    productivityScore,
    taskScore,
    performance,
    scorableTasks,
    excludedTasks,
    notGradable: false,
    flagReason:
      excludedTasks.length > 0
        ? `${excludedTasks.length} task(s) this month lacked required support — excluded from scoring and flagged to the organization/supervisor.`
        : null,
    recommend1on1,
  };
}

/* ---------------------------------------------------------------------- */
/*  Component                                                             */
/* ---------------------------------------------------------------------- */

const COMMENT_PRESETS = [
  "Regular at work and dedicated",
  "Irregular at work and not focused",
  "Consistent improvement this period",
  "Needs closer supervision going forward",
  "Custom comment…",
];

const APPROVER_ROLES = ["MANAGER", "DEPT_HEAD", "EXECUTIVE", "BOARD_MEMBER", "ADMIN"];

export default function TimesheetsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const now = new Date();

  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [loading, setLoading] = useState(true);

  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1); // 1-12
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [togglingMode, setTogglingMode] = useState(false);

  const [showGenerate, setShowGenerate] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);
  const [genInstitution, setGenInstitution] = useState("");
  useEffect(() => {
    if (!genInstitution && institutions.length > 0) {
      setGenInstitution(String(institutions[0].id));
    }
  }, [institutions, genInstitution]);
  const [generating, setGenerating] = useState(false);

  const [editDay, setEditDay] = useState<TimesheetDay | null>(null);
  const [editDayType, setEditDayType] = useState<string>("WORK");
  const [editDayHours, setEditDayHours] = useState<string>("8");
  const [savingDay, setSavingDay] = useState(false);

  const [showApprove, setShowApprove] = useState(false);
  const [approveComment, setApproveComment] = useState(COMMENT_PRESETS[0]);
  const [approveCustom, setApproveCustom] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [approving, setApproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepting, setAccepting] = useState(false);


  useEffect(() => {
    load();
  }, []);

  // Deep link from a Task ("Approve timesheet: ...") - jump straight to
  // the exact timesheet it points at, by switching the month/year filter
  // to match its period ("selected" is derived from periodYear/periodMonth).
  useEffect(() => {
    if (typeof window === "undefined" || timesheets.length === 0) return;
    const approveId = new URLSearchParams(window.location.search).get("approve");
    if (!approveId) return;
    const match = timesheets.find((t) => String(t.id) === approveId);
    if (match) {
      const d = toDate(match.period_start);
      setPeriodYear(d.getFullYear());
      setPeriodMonth(d.getMonth() + 1);
      setShowApprove(true);
    }
  }, [timesheets]);

  async function load() {
    setLoading(true);
    try {
      const [tsRes, instRes, orgRes] = await Promise.all([
        api.get<PaginatedResponse<Timesheet>>("/api/v1/timesheets/"),
        api.get<PaginatedResponse<Institution>>("/api/v1/organisations/institutions/"),
        api.get<Organisation>("/api/v1/organisations/my-org/"),
      ]);
      setTimesheets(tsRes.results);
      setInstitutions(instRes.results);
      setOrganisation(orgRes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load timesheets.");
    } finally {
      setLoading(false);
    }
  }

  const isStrict = organisation?.attendance_enforced ?? true;
  const isAdmin = user?.role === "ADMIN";

  const selected = useMemo(() => {
    return (
      timesheets.find((t) => {
        const d = toDate(t.period_start);
        return d.getFullYear() === periodYear && d.getMonth() + 1 === periodMonth;
      }) ?? null
    );
  }, [timesheets, periodYear, periodMonth]);

  const grid = useMemo(() => {
    if (!selected) return [];
    return buildGrid(selected.period_start, selected.period_end, selected.days);
  }, [selected]);

  const stats = useMemo(() => computeStats(grid), [grid]);

  const tasks: TaskRecord[] = useMemo(() => {
    const raw = (selected as unknown as { tasks?: TaskRecord[] } | null)?.tasks;
    return Array.isArray(raw) ? raw : [];
  }, [selected]);

  const performance = useMemo(() => computePerformance(stats.presentPct, tasks), [stats.presentPct, tasks]);

  const canAccept =
    selected?.status === "DRAFT" &&
    selected?.user === user?.id &&
    !!selected?.requires_acceptance &&
    !selected?.accepted_at;
  const canSubmit =
    (selected?.status === "DRAFT" || selected?.status === "REVISE_REQUESTED") &&
    selected?.user === user?.id &&
    (!selected?.requires_acceptance || !!selected?.accepted_at);
  const canApprove =
    selected?.status === "SUBMITTED" &&
    !!user?.id &&
    selected?.user !== user?.id &&
    (selected?.current_approver === user.id || user?.role === "ADMIN");

  async function handleToggleMode() {
    if (!organisation || !isAdmin || togglingMode) return;
    setTogglingMode(true);
    try {
      const updated = await api.patch<Organisation>(`/api/v1/organisations/${organisation.id}/`, {
        attendance_enforced: !organisation.attendance_enforced,
      });
      setOrganisation(updated);
      toast.success(
        updated.attendance_enforced
          ? "Switched to Strict Mode (automated attendance)."
          : "Switched to Alternative Mode (manual timesheets)."
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change mode.");
    } finally {
      setTogglingMode(false);
    }
  }

  async function handleGenerate() {
    if (!genInstitution) return;
    setGenerating(true);
    try {
      const endpoint = isStrict
        ? "/api/v1/timesheets/generate/"
        : "/api/v1/timesheets/generate-manual/";
      await api.post<Timesheet>(endpoint, {
        institution: Number(genInstitution),
        year: periodYear,
        month: periodMonth,
      });
      toast.success("Timesheet generated.");
      setShowGenerate(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate timesheet.");
    } finally {
      setGenerating(false);
    }
  }

  function openDayModal(day: TimesheetDay) {
    setEditDay(day);
    setEditDayType(day.day_type);
    setEditDayHours(String(day.hours ?? (day.day_type === "WORK" ? "8" : "0")));
  }

  function onDayTypeChange(newType: string) {
    setEditDayType(newType);
    // sensible default hours when switching type, still editable
    setEditDayHours(newType === "WORK" ? "8" : "0");
  }

  async function handleSaveDay() {
    if (!editDay || !selected) return;
    setSavingDay(true);
    try {
      await api.patch(`/api/v1/timesheets/${selected.id}/days/${editDay.id}/`, {
        day_type: editDayType,
        hours: Number(editDayHours) || 0,
      });
      toast.success("Day updated.");
      setEditDay(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update day.");
    } finally {
      setSavingDay(false);
    }
  }

  async function handleInlineDayEdit(day: TimesheetDay, dayType: string, hours: number) {
    if (!selected) return;
    try {
      await api.patch("/api/v1/timesheets/" + selected.id + "/days/" + day.id + "/", { day_type: dayType, hours });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update day.");
    }
  }

  async function handleAccept() {
    if (!selected) return;
    setAccepting(true);
    try {
      await api.post("/api/v1/timesheets/" + selected.id + "/accept/", {});
      toast.success("Draft accepted - ready to submit.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept timesheet.");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.post(`/api/v1/timesheets/${selected.id}/submit/`, {});
      toast.success("Timesheet submitted for approval.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit timesheet.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!selected) return;
    setApproving(true);
    try {
      const comment = approveComment === COMMENT_PRESETS[COMMENT_PRESETS.length - 1] ? approveCustom : approveComment;
      await api.post(`/api/v1/timesheets/${selected.id}/approve/`, { action: "APPROVE", comment });
      toast.success("Timesheet approved.");
      setShowApprove(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve timesheet.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReviewAction(action: "REVISE" | "REJECT") {
    if (!selected) return;
    if (!actionComment.trim()) {
      toast.error("Please provide a reason/comment.");
      return;
    }
    setApproving(true);
    try {
      await api.post(`/api/v1/timesheets/${selected.id}/approve/`, { action, comment: actionComment });
      toast.success(action === "REVISE" ? "Sent back for revision." : "Timesheet rejected.");
      setShowApprove(false);
      setActionComment("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update timesheet.");
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="ts-wrap" style={{ padding: 32, fontSize: 14, color: "#6B7280" }}>
        <style>{STRIP_CSS}</style>
        Loading timesheets…
      </div>
    );
  }

  const yearOptions: number[] = [];
  for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 1; y++) yearOptions.push(y);

  function isPeriodLocked(year: number, month: number): boolean {
    const unlockDate = new Date(year, month - 1, 20);
    return new Date() < unlockDate;
  }
  const periodLocked = isPeriodLocked(periodYear, periodMonth);


  return (
    <div className="ts-wrap" style={{ padding: 32 }}>
      <style>{STRIP_CSS}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Timesheets</h1>
        {!isStrict && !periodLocked && (
          <Button variant="primary" size="md" onClick={() => setShowGenerate(true)}>
            Generate Timesheet
          </Button>
        )}
      </div>

      <div className="ts-toolbar">
        <div className="ts-dropdown">
          <button
            className="ts-dropbtn"
            onClick={() => {
              setMonthMenuOpen((v) => !v);
              setYearMenuOpen(false);
            }}
          >
            {MONTH_NAMES[periodMonth - 1]} ▾
          </button>
          {monthMenuOpen && (
            <div className="ts-dropmenu">
              {MONTH_NAMES.map((name, idx) => (
                <div
                  key={name}
                  className={`ts-dropitem ${idx + 1 === periodMonth ? "ts-active" : ""}`}
                  onClick={() => {
                    setPeriodMonth(idx + 1);
                    setMonthMenuOpen(false);
                  }}
                >
                  {name}{isPeriodLocked(periodYear, idx + 1) ? " (locked)" : ""}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ts-dropdown">
          <button
            className="ts-dropbtn"
            onClick={() => {
              setYearMenuOpen((v) => !v);
              setMonthMenuOpen(false);
            }}
          >
            {periodYear} ▾
          </button>
          {yearMenuOpen && (
            <div className="ts-dropmenu">
              {yearOptions.map((y) => (
                <div
                  key={y}
                  className={`ts-dropitem ${y === periodYear ? "ts-active" : ""}`}
                  onClick={() => {
                    setPeriodYear(y);
                    setYearMenuOpen(false);
                  }}
                >
                  {y}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`ts-modetoggle ${isStrict ? "ts-strict" : "ts-alt"} ${isAdmin ? "ts-clickable" : "ts-readonly"}`}
          onClick={isAdmin ? handleToggleMode : undefined}
          title={isAdmin ? "Click to switch mode (organisation-wide)" : "Set by your organisation's Admin"}
        >
          {togglingMode ? "Updating…" : isStrict ? "🔒 Strict Mode" : "📝 Alternative Mode"}
        </div>
      </div>

      {!isStrict && (
        <div className="ts-manual-note">
          Alternative Mode is on for your organisation — timesheets are filled in manually instead of being
          pulled from automated attendance clocking. Click a day in the grid below to set its hours, then submit
          it to your supervisor for approval.
        </div>
      )}

      {!selected ? (
        <div style={{ fontSize: 14, color: "#6B7280" }}>
          {isStrict ? (
            <>No timesheet for {MONTH_NAMES[periodMonth - 1]} {periodYear} yet. This is generated automatically by the system.</>
          ) : periodLocked ? (
            <>{MONTH_NAMES[periodMonth - 1]} {periodYear} is locked. It unlocks on the 20th of that month.</>
          ) : (
            <>
              No timesheet for {MONTH_NAMES[periodMonth - 1]} {periodYear} yet.{" "}
              <button
                onClick={() => setShowGenerate(true)}
                style={{ color: "#111827", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}
              >
                Generate one to get started.
              </button>
            </>
          )}
        </div>
      ) : (
        <TimesheetView
          selected={selected}
          grid={grid}
          stats={stats}
          performance={performance}
          isStrict={isStrict}
          canAccept={!!canAccept}
          canSubmit={!!canSubmit}
          canApprove={!!canApprove}
          accepting={accepting}
          submitting={submitting}
          onAccept={handleAccept}
          onSubmit={handleSubmit}
          onApproveClick={() => setShowApprove(true)}
          onDayClick={openDayModal}
          onCellEdit={handleInlineDayEdit}
        />
      )}

      <Modal isOpen={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Timesheet">
        <div className="space-y-4">
          <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>
            For {MONTH_NAMES[periodMonth - 1]} {periodYear} — {isStrict ? "Strict Mode (automated from attendance)" : "Alternative Mode (manual entry)"}
          </p>
          <FormSelect
            name="institution"
            label="Institution"
            value={genInstitution}
            onChange={(e) => setGenInstitution(e.target.value)}
            options={institutions.map((i) => ({ value: String(i.id), label: i.name }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            {!isStrict && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => { setShowGenerate(false); setShowAiChat(true); }}
                disabled={!genInstitution}
              >
                Generate with AI
              </Button>
            )}
            <Button variant="secondary" size="md" onClick={() => setShowGenerate(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleGenerate} disabled={generating || !genInstitution}>
              {generating ? "Generating..." : "Generate"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showAiChat} onClose={() => setShowAiChat(false)} title="AI Timesheet Assistant">
        {genInstitution && (
          <TimesheetAiChat
            institution={genInstitution}
            year={periodYear}
            month={periodMonth}
            onGenerated={() => { setShowAiChat(false); load(); }}
            onClose={() => setShowAiChat(false)}
          />
        )}
      </Modal>

      <Modal isOpen={!!editDay} onClose={() => setEditDay(null)} title={editDay ? `Edit ${editDay.date}` : ""}>
        <div className="space-y-4">
          <FormSelect
            name="day_type"
            label="Day Type"
            value={editDayType}
            onChange={(e) => onDayTypeChange(e.target.value)}
            options={[
              { value: "WORK", label: "Present (Work)" },
              { value: "ABSENT", label: "Absent" },
              { value: "LEAVE_ANNUAL", label: "Leave (Annual)" },
              { value: "LEAVE_UPA", label: "Leave (UPA)" },
              { value: "SICK_LEAVE", label: "Sick Leave" },
              { value: "HOLIDAY", label: "Holiday" },
              { value: "LEAVE_OTHER", label: "Other Leave" },
            ]}
          />
          <FormInput
            name="hours"
            label="Hours"
            type="number"
            value={editDayHours}
            onChange={(e) => setEditDayHours(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="md" onClick={() => setEditDay(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSaveDay} disabled={savingDay}>
              {savingDay ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showApprove} onClose={() => setShowApprove(false)} title="Approve Timesheet">
        <div className="space-y-4">
          <FormSelect
            name="comment_preset"
            label="Comment"
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            options={COMMENT_PRESETS.map((c) => ({ value: c, label: c }))}
          />
          {approveComment === COMMENT_PRESETS[COMMENT_PRESETS.length - 1] && (
            <FormInput
              name="custom_comment"
              label="Custom comment"
              value={approveCustom}
              onChange={(e) => setApproveCustom(e.target.value)}
            />
          )}

          <div className="pt-2" style={{ borderTop: "1px solid #E5E7EB" }}>
            <FormTextarea
              name="action_comment"
              label="Reason (required to request revision or reject)"
              rows={3}
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
            />
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" size="md" onClick={() => handleReviewAction("REVISE")} disabled={approving}>
                Request Revision
              </Button>
              <Button variant="danger" size="md" onClick={() => handleReviewAction("REJECT")} disabled={approving}>
                Reject
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="md" onClick={() => setShowApprove(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleApprove} disabled={approving}>
              {approving ? "Approving…" : "Approve"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Timesheet view — matches Strict-Mode-ON.dc.html exactly             */
/* ---------------------------------------------------------------------- */

function cellClass(cell: GridCell, i: number, kind: "present" | "absent", matchKey: string | null): string {
  const divider = i === 1 ? " ts-divider" : "";
  if (cell.weekend) {
    const pad = !cell.inMonth ? " ts-padwknd" : "";
    return `ts-wknd${pad}${divider}`;
  }
  if (!cell.inMonth) return `ts-wd-pad${divider}`;
  // The row's color is FIXED per the approved design — every weekday cell in a
  // present-colored row is white, every weekday cell in an absent-colored row is
  // yellow, all the way across, regardless of whether that particular day matches.
  return (kind === "present" ? "ts-wd-present" : "ts-wd-absent") + divider;
}

function cellMatches(dt: string, matchKey: string | null): boolean {
  // matchKey === null marks the one generic "Present" row: any ordinary work day counts.
  // Every other row (Absent, or a specific Other Time category) matches only its own exact type.
  if (matchKey === null) return dt !== "ABSENT" && !OTHER_TIME_ROWS.some((r) => r.key === dt);
  return dt === matchKey;
}

function cellText(cell: GridCell, kind: "present" | "absent", matchKey: string | null): string {
  if (cell.weekend) return cell.inMonth ? (kind === "absent" ? "0.0" : "—") : "—";
  if (!cell.inMonth) return "—";
  const dt = cell.day?.day_type ?? "WORK";
  return cellMatches(dt, matchKey) ? Number(cell.day?.hours ?? 0).toFixed(1) : "0.0";
}

function AttendanceRow({
  label,
  grid,
  rowColor,
  matchKey,
  setDayType,
  editable,
  onDayClick,
  onCellEdit,
  total,
  pct,
  neutralPct,
}: {
  label: string;
  grid: GridCell[][];
  rowColor: "present" | "absent";
  matchKey: string | null;
  setDayType: string;
  editable: boolean;
  onDayClick: (day: TimesheetDay) => void;
  onCellEdit: (day: TimesheetDay, dayType: string, hours: number) => void;
  total: number;
  pct: number;
  neutralPct?: boolean;
}) {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  return (
    <tr>
      <td className="ts-rowlabel">{label}</td>
      {grid.flatMap((week) =>
        week.map((cell, i) => {
          const clickable = isExpectedWorkday(cell) && !!cell.day;
          const isEditing = editable && editingDate === cell.date;

          if (isEditing) {
            return (
              <td key={cell.date} className={cellClass(cell, i, rowColor, matchKey)}>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  autoFocus
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onBlur={() => {
                    const hours = parseFloat(editingValue);
                    if (cell.day && !isNaN(hours)) onCellEdit(cell.day, setDayType, hours);
                    setEditingDate(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditingDate(null);
                  }}
                  style={{ width: 48, textAlign: "center" }}
                />
              </td>
            );
          }

          return (
            <td
              key={cell.date}
              onClick={
                !clickable
                  ? undefined
                  : editable
                  ? () => {
                      setEditingValue(String(cell.day?.hours ?? 0));
                      setEditingDate(cell.date);
                    }
                  : () => onDayClick(cell.day as TimesheetDay)
              }
              className={cellClass(cell, i, rowColor, matchKey)}
              style={clickable ? { cursor: "pointer" } : undefined}
            >
              {cellText(cell, rowColor, matchKey)}
            </td>
          );
        })
      )}
      <td className={rowColor === "present" ? "ts-wd-present" : "ts-wd-absent"}>{total.toFixed(2)}</td>
      <td className={neutralPct ? "ts-pctcell-neutral" : pct >= 90 ? "ts-pctcell-green" : "ts-pctcell-red"}>{pct}%</td>
    </tr>
  );
}

function TimesheetView({
  selected,
  grid,
  stats,
  performance,
  isStrict,
  canAccept,
  canSubmit,
  canApprove,
  accepting,
  submitting,
  onAccept,
  onSubmit,
  onApproveClick,
  onDayClick,
  onCellEdit,
}: {
  selected: Timesheet;
  grid: GridCell[][];
  stats: MonthStats;
  performance: PerformanceResult;
  isStrict: boolean;
  canAccept: boolean;
  canSubmit: boolean;
  canApprove: boolean;
  accepting: boolean;
  submitting: boolean;
  onAccept: () => void;
  onSubmit: () => void;
  onApproveClick: () => void;
  onDayClick: (day: TimesheetDay) => void;
  onCellEdit: (day: TimesheetDay, dayType: string, hours: number) => void;
}) {
  const grandTotal = stats.expectedTotal;
  const totalCols = grid.length * 7 + 3;
  const monthLabel = monthLabelFromPeriod(selected.period_start);
  const periodDateForHolidays = toDate(selected.period_start);
  const gridHolidayMap = getLiberiaHolidayMap(periodDateForHolidays.getFullYear());
  const gridMonthPrefix =
    periodDateForHolidays.getFullYear() +
    "-" +
    (periodDateForHolidays.getMonth() + 1 < 10
      ? "0" + (periodDateForHolidays.getMonth() + 1)
      : String(periodDateForHolidays.getMonth() + 1));
  const gridHolidayDatesThisMonth = Array.from(gridHolidayMap.keys()).filter((d) => d.startsWith(gridMonthPrefix));

  const employeeName =
    pick(selected, ["user_name", "employee_name", "user.full_name", "user.name"]) ?? "—";
  const institutionName =
    pick(selected, ["institution_name", "institution.name"]) ?? "—";
  const employeeTitle =
    pick(selected, ["position", "employee_title", "department_name"]) ?? "—";
  const approvedByName =
    pick(selected, ["approved_by_name", "approved_by.full_name", "approved_by.name"]);
  const approvalComment = pick(selected, ["approval_comment", "comment"]);

  const perfColor = performance.performance === null ? "gray" : performance.performance >= 90 ? "green" : "red";
  const taskColor = performance.taskScore === null ? "gray" : performance.taskScore >= 90 ? "green" : "red";
  const prodColor = performance.productivityScore >= 90 ? "green" : "red";

  return (
    <div>
      <div className="ts-mode-banner">
        <div className="ts-modelabel">
          STRICT ATTENDANCE &amp; TIMESHEET:{" "}
          {isStrict ? <span className="ts-on">ON</span> : <span className="ts-off">OFF — Alternative Mode</span>}
        </div>
        <div className="ts-sub2">Set by Executive Director / Board / Senior Management</div>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>
        Timesheet — {employeeName}
        <span className={`ts-badge ${stats.presentPct >= 90 ? "good" : "bad"}`}>
          {stats.presentPct >= 90 ? "GOOD ATTENDANCE" : "IRREGULAR ATTENDANCE"}
        </span>
      </h1>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>
        {institutionName} &nbsp;·&nbsp; {employeeTitle} &nbsp;·&nbsp; {monthLabel}{" "}
        &nbsp;·&nbsp; Source: {isStrict ? "Daily Attendance Clock (automated)" : "Entered manually by employee"}
      </p>

      <div className={`ts-pattern-alert ${stats.pattern.length > 0 ? "ts-bad" : "ts-ok"}`}>
        <div className="ts-icon">{stats.pattern.length > 0 ? "⚠" : "✓"}</div>
        <div>
          <div className="ts-title">
            {stats.pattern.length > 0 ? "Pattern Detected — Recurring Irregular Attendance" : "No Irregular Pattern Detected"}
          </div>
          <div className="ts-body">
            {stats.pattern.length > 0
              ? `Absent on every ${stats.pattern.map((p) => p.weekday).join(", ")} this month — a repeating weekly pattern, not a one-off.`
              : "Present attendance stayed at or above 90% every week, with no weekday showing a repeated pattern of being missed. Nothing to flag."}
          </div>
        </div>
      </div>

      <div className="ts-infogrid">
        <div className="ts-infobox">
          <div className="ts-label">Employee</div>
          <div className="ts-value">{employeeName}</div>
        </div>
        <div className="ts-infobox">
          <div className="ts-label">Institution</div>
          <div className="ts-value">{institutionName}</div>
        </div>
        <div className="ts-infobox">
          <div className="ts-label">Job Title</div>
          <div className="ts-value">{employeeTitle}</div>
        </div>
        <div className="ts-infobox">
          <div className="ts-label">Month</div>
          <div className="ts-value">{monthLabel}</div>
        </div>
      </div>

      <div className="ts-strip-scroll">
        <table className="ts-strip">
          <thead>
            <tr>
              <th className="ts-rowlabel">{institutionName}</th>
              {grid.flatMap((week) =>
                week.map((cell, i) => (
                  <th key={cell.date} className={cell.weekend ? `ts-wknd${!cell.inMonth ? " ts-padwknd" : ""}${i === 1 ? " ts-divider" : ""}` : `ts-dc${i === 1 ? " ts-divider" : ""}`}>
                    {dayNum(cell.date)}
                  </th>
                ))
              )}
              <th>Total</th>
              <th className="ts-pcthead">%</th>
            </tr>
            <tr>
              <th className="ts-rowlabel"></th>
              {grid.flatMap((week) =>
                week.map((cell, i) => (
                  <th key={cell.date} className={cell.weekend ? `ts-wknd${!cell.inMonth ? " ts-padwknd" : ""}${i === 1 ? " ts-divider" : ""}` : `ts-dow${i === 1 ? " ts-divider" : ""}`}>
                    {DOW_ABBR[toDate(cell.date).getDay()]}
                  </th>
                ))
              )}
              <th></th>
              <th className="ts-pcthead"></th>
            </tr>
          </thead>
          <tbody>
            <tr className="ts-section-row">
              <td colSpan={totalCols}>
                Working Hours Per Day (1 man-hour = 1hr and 8 man-hour = 8.0hr per day)
                {isStrict ? " — from clock in / clock out" : " — entered manually"}
              </td>
            </tr>

            

            <AttendanceRow
              label="Present (8.0hrs)"
              grid={grid}
              rowColor="present"
              matchKey={null}
              setDayType="WORK"
              editable={!isStrict}
              onDayClick={onDayClick}
              onCellEdit={onCellEdit}
              total={stats.presentTotal}
              pct={stats.presentPct}
            />
            <AttendanceRow
              label="Absent (0.0hrs)"
              grid={grid}
              rowColor="absent"
              matchKey="ABSENT"
              setDayType="ABSENT"
              editable={!isStrict}
              onDayClick={onDayClick}
              onCellEdit={onCellEdit}
              total={stats.absentTotal}
              pct={grandTotal > 0 ? Math.round((stats.absentTotal / grandTotal) * 100) : 0}
              neutralPct
            />

            <tr className="ts-spacer">
              <td colSpan={totalCols}></td>
            </tr>
            <tr className="ts-section-row">
              <td colSpan={totalCols}>Other Time</td>
            </tr>

            {OTHER_TIME_ROWS.map((row) => (
              <AttendanceRow
                key={row.key}
                label={row.label}
                grid={grid}
                rowColor={row.color}
                matchKey={row.key}
                setDayType={row.key}
                editable={!isStrict}
                onDayClick={onDayClick}
                onCellEdit={onCellEdit}
                total={stats.categoryTotals[row.key]}
                pct={grandTotal > 0 ? Math.round((stats.categoryTotals[row.key] / grandTotal) * 100) : 0}
                neutralPct
              />
            ))}

            <tr className="ts-spacer">
              <td colSpan={totalCols}></td>
            </tr>

            <tr>
              <td className="ts-rowlabel ts-total-row-sum">TOTAL</td>
              {grid.flatMap((week) =>
                week.map((cell, i) => (
                  <td key={cell.date} className={`ts-total-row-cell${i === 1 ? " ts-divider" : ""}`}>
                    {isExpectedWorkday(cell) ? "8.0" : "—"}
                  </td>
                ))
              )}
              <td className="ts-total-row-sum">{grandTotal.toFixed(2)}</td>
              <td className="ts-pctcell-green">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="ts-legend">
        <span>
          <span className="ts-swatch" style={{ background: "#FFFFFF", border: "1px solid #E5E7EB" }}></span>Present (8.0)
        </span>
        <span>
          <span className="ts-swatch" style={{ background: "#FACC15" }}></span>Absent (0.0)
        </span>
        <span>
          <span className="ts-swatch" style={{ background: "#D1D5DB" }}></span>Sat + Sun — grey wall
        </span>
        <span>
          <span className="ts-swatch" style={{ background: "#16A34A" }}></span>≥ 90% attendance — green
        </span>
        <span>
          <span className="ts-swatch" style={{ background: "#DC2626" }}></span>&lt; 90% attendance — red
        </span>
      </div>

      {gridHolidayDatesThisMonth.length > 0 && (
        <div style={{ fontSize: 12, color: "#374151", marginBottom: 16, lineHeight: 1.6, background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 6, padding: "8px 10px" }}>
          <strong>{gridHolidayDatesThisMonth.length === 1 ? "Public holiday this month: " : "Public holidays this month: "}</strong>
          {gridHolidayDatesThisMonth
            .map((d) => {
              const day = parseInt(d.split("-")[2], 10);
              return MONTH_NAMES[periodDateForHolidays.getMonth()] + " " + day + " - " + gridHolidayMap.get(d);
            })
            .join("; ")}
        </div>
      )}

      {!isStrict && (
        <div style={{ fontSize: 12, lineHeight: 1.6, margin: "8px 0 16px", color: "#374151" }}>
          <strong>How to fill this grid:</strong> click any box below and type the actual hours for that day.{" "}
          8.0 in the Present row means a full day worked. 0.0 in the Absent row means no hours that day.{" "}
          Every box starts at 0.0 until you fill it in. When done, click Accept Draft, then Submit for approval.
        </div>
      )}

      <table className="ts-weekly">
        <thead>
          <tr>
            <th>Week</th>
            <th>Present Hours</th>
            <th>Expected Hours</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
          {stats.weekly.map((w) => (
            <tr key={w.label}>
              <td>{w.label}</td>
              <td>{w.present.toFixed(2)}</td>
              <td>{w.expected.toFixed(2)}</td>
              <td className={w.pct === null ? "" : w.pct >= 90 ? "ts-wk-green" : "ts-wk-red"}>
                {w.pct === null ? "n/a" : `${w.pct}%`}
              </td>
            </tr>
          ))}
          <tr className="ts-monthtotal">
            <td>Month Total — {monthLabel}</td>
            <td>{stats.presentTotal.toFixed(2)}</td>
            <td>{stats.expectedTotal.toFixed(2)}</td>
            <td className={stats.presentPct >= 90 ? "ts-wk-green" : "ts-wk-red"}>{stats.presentPct}%</td>
          </tr>
        </tbody>
      </table>

      <div className="ts-bottomgrid">
        <div className="ts-bottombox">
          <div className="ts-label">Submitted by</div>
          <div className="ts-value">{employeeName}</div>
        </div>
        <div className="ts-bottombox">
          <div className="ts-label">Approved by</div>
          <div className="ts-value">{approvedByName ?? "Pending approval"}</div>
          {approvalComment && <div style={{ fontSize: 12, fontStyle: "italic", color: "#6B7280", marginTop: 4 }}>{approvalComment}</div>}
        </div>
      </div>

      <div className="ts-note">
        {isStrict
          ? stats.presentPct >= 90
            ? "Attendance this month is strong — nothing here was typed in; Present/Absent, the daily totals, the weekly breakdown, and the month score are all derived automatically from the clock-in/clock-out log."
            : "Attendance this month is below target, and the pattern above was detected automatically from the clock-in/clock-out log — nothing here was typed in."
          : "This timesheet was filled in manually. Click any weekday cell above to set its hours and type, then submit it to your supervisor for sign-off."}
      </div>

      {isStrict && (
        <>
          <h2 className="ts-sec">Productivity &amp; Performance Calculator — {monthLabel}</h2>
          <div className="ts-panel">
            <div className="ts-scoregrid">
              <div className={`ts-scorebox ts-${prodColor}`}>
                <div className="ts-label">Productivity (Attendance)</div>
                <div className="ts-big">{performance.productivityScore}%</div>
              </div>
              <div className={`ts-scorebox ts-${taskColor}`}>
                <div className="ts-label">Task Score</div>
                <div className="ts-big">{performance.taskScore === null ? "—" : `${performance.taskScore}%`}</div>
              </div>
              <div className={`ts-scorebox ts-${perfColor}`}>
                <div className="ts-label">Performance</div>
                <div className="ts-big">{performance.performance === null ? "—" : `${performance.performance}%`}</div>
              </div>
            </div>

            {performance.scorableTasks.length + performance.excludedTasks.length > 0 && (
              <table className="ts-tasks">
                <thead>
                  <tr>
                    <th>Task (from Appraiser Tasks module)</th>
                    <th>Support Provided</th>
                    <th>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {[...performance.scorableTasks, ...performance.excludedTasks].map((t, i) => (
                    <tr key={t.id ?? i}>
                      <td>{t.title ?? t.name ?? `Task ${i + 1}`}</td>
                      <td>{t.supported === false ? "No" : "Yes"}</td>
                      <td>
                        {t.supported === false ? (
                          <span className="ts-pill ts-excluded">Excluded</span>
                        ) : (
                          <span className={`ts-pill ${t.delivered_on_time === false ? "ts-late" : "ts-done"}`}>
                            {t.delivered_on_time === false ? "Late" : "On time"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {performance.flagReason && <div className="ts-flag ts-warn">⚠&nbsp; {performance.flagReason}</div>}
            {performance.recommend1on1 && (
              <div className="ts-flag ts-info">
                ℹ&nbsp; Support was provided and attendance was tracked, but performance is below target — the system
                recommends a supervisor 1:1 conversation with this employee.
              </div>
            )}
            {!performance.notGradable && !performance.flagReason && !performance.recommend1on1 && (
              <div className="ts-flag ts-good">
                ✓&nbsp; Every task this month was delivered on time with full support, and attendance stayed on target.
                Nothing for the supervisor to review or flag.
              </div>
            )}
          </div>
        </>
      )}

      {canAccept && (
        <div className="ts-flag ts-info" style={{ marginTop: 20 }}>
          This draft was filled in manually - review the grid above, then accept it before submitting.
        </div>
      )}
      {selected.source === "MANUAL" && selected.status === "DRAFT" && selected.accepted_at && (
        <div className="ts-flag ts-good" style={{ marginTop: 20 }}>
          Accepted by you - ready to submit for approval.
        </div>
      )}

      {selected.status === "SUBMITTED" && selected.current_approver_name && (
        <div className="ts-flag" style={{ marginTop: 20 }}>
          Awaiting approval from: {selected.current_approver_name}
        </div>
      )}

      {selected.status === "REVISE_REQUESTED" && (
        <div className="ts-flag" style={{ marginTop: 20, background: "#FEF3C7", color: "#92400E" }}>
          Revision requested{selected.last_action_by_name ? ` by ${selected.last_action_by_name}` : ""}
          {selected.last_action_comment ? `: ${selected.last_action_comment}` : ""}. Edit the days below and resubmit.
        </div>
      )}

      {selected.status === "REJECTED" && (
        <div className="ts-flag" style={{ marginTop: 20, background: "#FEE2E2", color: "#991B1B" }}>
          Rejected{selected.last_action_by_name ? ` by ${selected.last_action_by_name}` : ""}
          {selected.last_action_comment ? `: ${selected.last_action_comment}` : ""}.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
        {canAccept && (
          <Button variant="secondary" size="md" onClick={onAccept} disabled={accepting}>
            {accepting ? "Accepting..." : "Accept Draft"}
          </Button>
        )}
        {canSubmit && (
          <Button variant="primary" size="md" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit for Approval"}
          </Button>
        )}
        {canApprove && (
          <Button variant="primary" size="md" onClick={onApproveClick}>
            Approve
          </Button>
        )}
      </div>
    </div>
  );
}
