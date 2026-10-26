// Liberia's public holidays, computed for any given year.
// A fixed-date holiday that falls on a Sunday is also observed the next Monday,
// matching normal Liberian practice. Edit this list if an official date changes.

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

function iso(year: number, month: number, day: number): string {
  return year + "-" + pad2(month) + "-" + pad2(day);
}

// Day-of-month for the Nth occurrence of a weekday in a month.
// weekday: 0 = Sunday ... 6 = Saturday
function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  return 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
}

export function getLiberiaHolidayMap(year: number): Map<string, string> {
  const holidays: { date: string; name: string }[] = [];

  function addFixed(month: number, day: number, name: string) {
    const d = new Date(year, month - 1, day);
    holidays.push({ date: iso(year, month, day), name });
    if (d.getDay() === 0) {
      const monday = new Date(year, month - 1, day + 1);
      holidays.push({
        date: iso(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()),
        name: name + " (observed)",
      });
    }
  }

  addFixed(1, 1, "New Year's Day");
  addFixed(2, 11, "Armed Forces Day");
  addFixed(5, 14, "National Unification Day");
  addFixed(7, 26, "Independence Day");
  addFixed(8, 24, "Flag Day");
  addFixed(11, 29, "National Memorial Day (Tubman's Birthday)");
  addFixed(12, 25, "Christmas Day");

  holidays.push({ date: iso(year, 3, nthWeekdayOfMonth(year, 3, 3, 2)), name: "Decoration Day" });
  holidays.push({ date: iso(year, 4, nthWeekdayOfMonth(year, 4, 5, 2)), name: "Fast and Prayer Day" });
  holidays.push({ date: iso(year, 11, nthWeekdayOfMonth(year, 11, 4, 1)), name: "Thanksgiving Day" });

  const map = new Map<string, string>();
  for (const h of holidays) map.set(h.date, h.name);
  return map;
}