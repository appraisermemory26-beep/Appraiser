"use client";

import { getLiberiaHolidayMap } from "@/lib/liberiaHolidays";

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

export function HolidayBanner() {
  const today = new Date();
  const iso = today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());
  const holidayName = getLiberiaHolidayMap(today.getFullYear()).get(iso);

  if (!holidayName) return null;

  return (
    <div
      style={{
        background: "#FEF3C7",
        borderBottom: "1px solid #FDE68A",
        color: "#713F12",
        fontSize: 13,
        padding: "8px 24px",
        textAlign: "center",
      }}
    >
      <strong>Today is a public holiday:</strong> {holidayName}
    </div>
  );
}