import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../../components/PageHeader";
import { useT } from "../../i18n/translations";
import { listShiftsForMonth } from "./api";
import { monthGrid, isInMonth } from "./calendar";
import { ShiftEditorModal } from "./ShiftEditorModal";

export function ShiftsPage() {
  const t = useT("shifts");
  const common = useT("common");
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month0, setMonth0] = useState(now.getUTCMonth());
  const [openDate, setOpenDate] = useState<string | null>(null);

  const shifts = useQuery({
    queryKey: ["shifts", year, month0],
    queryFn: () => listShiftsForMonth(year, month0),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, typeof shifts.data>();
    for (const s of shifts.data ?? []) {
      const arr = map.get(s.shift_date) ?? [];
      arr.push(s);
      map.set(s.shift_date, arr);
    }
    return map;
  }, [shifts.data]);

  const weeks = monthGrid(year, month0);

  function prevMonth() {
    if (month0 === 0) { setYear(year - 1); setMonth0(11); } else { setMonth0(month0 - 1); }
  }
  function nextMonth() {
    if (month0 === 11) { setYear(year + 1); setMonth0(0); } else { setMonth0(month0 + 1); }
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div>
        <button onClick={prevMonth}>‹</button>
        <strong>{common.months[month0]} {year}</strong>
        <button onClick={nextMonth}>›</button>
      </div>

      <div className="calendar-grid">
        {common.weekdaysShort.map((w) => <div key={w} className="calendar-head">{w}</div>)}
        {weeks.flat().map((iso) => {
          const dayShifts = byDate.get(iso) ?? [];
          const inMonth = isInMonth(iso, year, month0);
          return (
            <button
              key={iso}
              className={`calendar-cell ${inMonth ? "" : "is-outside"}`}
              onClick={() => setOpenDate(iso)}
            >
              <div className="calendar-day-num">{Number(iso.slice(8, 10))}</div>
              <ul>
                {dayShifts.map((s) => (
                  <li key={s.id}>{s.employees?.display_code}{s.shift_type !== "FULL_DAY" ? ` (${s.shift_type[0]})` : ""}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {openDate && (
        <ShiftEditorModal
          date={openDate}
          existing={byDate.get(openDate) ?? []}
          onClose={() => setOpenDate(null)}
        />
      )}
    </>
  );
}
