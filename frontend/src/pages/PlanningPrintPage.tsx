import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";
import {
  daysInRange,
  formatDateLabel,
  isWeekend,
  monthBounds,
  weekdayMon0,
  type PlanningDailyNoteRow,
  type PlanningEmployee,
  type PlanningPatternNoteRow,
  type PlanningShiftRow,
} from "../lib/planning";

const PLANNING_NOTE_TITLE = "planning_note";

export function PlanningPrintPage() {
  const [searchParams] = useSearchParams();
  const t = useT("planning");
  const c = useT("common");
  const coverageT = useT("coverage");
  const { lang } = useLanguage();
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);
  const { start, end } = monthBounds(year, month);

  const employeesQuery = useQuery({
    queryKey: ["employees", "active", "print"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("first_name");
      if (error) throw error;
      return data as PlanningEmployee[];
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", start, end, "print"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, employee:employees(id, first_name, last_name, display_code, role)")
        .gte("shift_date", start)
        .lte("shift_date", end);
      if (error) throw error;
      return data as PlanningShiftRow[];
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["planning-absences", start, end, "print"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, start_date, end_date, status")
        .lte("start_date", end)
        .gte("end_date", start)
        .not("status", "eq", "rejected");
      if (error) throw error;
      return data as Pick<Tables<"absences">, "employee_id" | "start_date" | "end_date" | "status">[];
    },
  });

  const patternNotesQuery = useQuery({
    queryKey: ["planning-pattern-notes", "print"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("employee_id, weekday, special_note, pattern_type, employee:employees(display_code)")
        .eq("active", true)
        .not("special_note", "is", null);
      if (error) throw error;
      return data as PlanningPatternNoteRow[];
    },
  });

  const dailyNotesQuery = useQuery({
    queryKey: ["planning-daily-notes", start, end, "print"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, note_date, text, title")
        .eq("title", PLANNING_NOTE_TITLE)
        .gte("note_date", start)
        .lte("note_date", end)
        .order("note_date");
      if (error) throw error;
      return data as PlanningDailyNoteRow[];
    },
  });

  const isLoading =
    employeesQuery.isLoading ||
    shiftsQuery.isLoading ||
    absencesQuery.isLoading ||
    patternNotesQuery.isLoading ||
    dailyNotesQuery.isLoading;

  const employees = useMemo(
    () => [...(employeesQuery.data ?? [])].sort((a, b) => {
      const ap = a.role === "pharmacist" ? 0 : 1;
      const bp = b.role === "pharmacist" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.first_name.localeCompare(b.first_name);
    }),
    [employeesQuery.data],
  );
  const hasBedienerField = useMemo(
    () => (employeesQuery.data ?? []).some((emp) => (emp as any).bediener !== undefined && (emp as any).bediener !== null),
    [employeesQuery.data],
  );
  const days = useMemo(() => daysInRange(start, end), [start, end]);

  const shiftsByDateEmp = useMemo(() => {
    const map = new Map<string, PlanningShiftRow>();
    for (const shift of shiftsQuery.data ?? []) {
      map.set(`${shift.shift_date}|${shift.employee_id}`, shift);
    }
    return map;
  }, [shiftsQuery.data]);

  const absencesByDateEmp = useMemo(() => {
    const set = new Set<string>();
    for (const absence of absencesQuery.data ?? []) {
      const startDate = new Date(`${absence.start_date}T12:00:00`);
      const endDate = new Date(`${absence.end_date}T12:00:00`);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (day >= start && day <= end) set.add(`${day}|${absence.employee_id}`);
      }
    }
    return set;
  }, [absencesQuery.data, start, end]);

  const notesByWeekday = useMemo(() => {
    const map = new Map<number, string[]>();
    const seen = new Set<string>();
    for (const row of patternNotesQuery.data ?? []) {
      const note = row.special_note?.trim();
      if (!note) continue;
      const code = row.employee?.display_code?.trim() || "—";
      const key = `${row.weekday}|${row.employee_id}|${note}`;
      if (seen.has(key)) continue;
      seen.add(key);
      map.set(row.weekday, [...(map.get(row.weekday) ?? []), `${code} ${note}`]);
    }
    return map;
  }, [patternNotesQuery.data]);

  const manualNotesByDate = useMemo(() => {
    const map = new Map<string, PlanningDailyNoteRow>();
    for (const row of dailyNotesQuery.data ?? []) {
      if (!map.has(row.note_date)) map.set(row.note_date, row);
    }
    return map;
  }, [dailyNotesQuery.data]);

  const rows = useMemo(() => {
    return days.map((day) => {
      let total = 0;
      let bedien = 0;
      let pharm = 0;
      for (const emp of employees) {
        const key = `${day}|${emp.id}`;
        if (shiftsByDateEmp.has(key)) {
          total++;
          if (emp.role === "pharmacist") pharm++;
          if (hasBedienerField ? Boolean((emp as any).bediener) : true) bedien++;
        }
      }
      const weekday = weekdayMon0(day);
      return {
        day,
        total,
        bedien,
        pharm,
        plannedNotes: notesByWeekday.get(weekday) ?? [],
        dailyNote: manualNotesByDate.get(day)?.text?.trim() ?? "",
      };
    });
  }, [days, employees, shiftsByDateEmp, hasBedienerField, notesByWeekday, manualNotesByDate]);

  return (
    <section className="planning-print-page">
      <div className="planning-print-toolbar no-print">
        <div>
          <h1>{t.printTitle}</h1>
          <p>{month}/{year}</p>
        </div>
        <div className="planning-print-actions">
          <button type="button" className="secondary" onClick={() => window.close()}>
            {t.closePrint}
          </button>
          <button type="button" onClick={() => window.print()}>
            {t.printAction}
          </button>
        </div>
      </div>

      {isLoading ? <p>{c.loading}</p> : null}

      {!isLoading ? (
        <article className="planning-print-block planning-print-sheet">
          <table className="table planning-print-table">
            <thead>
              <tr>
                <th className="date-cell">Data</th>
                {employees.map((emp) => (
                  <th key={emp.id}>{emp.display_code ?? "—"}</th>
                ))}
                <th className="totals-cell">Total</th>
                <th className="totals-cell">{t.bedienerHeader}</th>
                <th className="totals-cell">PhA&apos;s</th>
                <th className="notes-cell">{t.plannedNotesHeader}</th>
                <th className="notes-cell">{t.dailyNotesHeader}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr
                  key={row.day}
                  data-row-index={rowIndex}
                  className={isWeekend(row.day) ? "weekend-row" : undefined}
                >
                  <td className="date-cell">{formatDateLabel(row.day, lang)}</td>
                  {employees.map((emp) => {
                    const key = `${row.day}|${emp.id}`;
                    const shift = shiftsByDateEmp.get(key);
                    const absent = absencesByDateEmp.has(key);
                    const cls = ["shift-cell"];
                    if (shift?.source === "generated") cls.push("is-generated");
                    if (shift?.source === "substitute") cls.push("is-substitute");
                    if (absent) cls.push("is-absence");
                    return (
                      <td key={emp.id}>
                        <span className="plan-cell-stack">
                          {shift ? <span className={cls.join(" ")}>✓</span> : null}
                          {absent ? <span className="plan-absence-badge" title={coverageT.absentEmployee}>A</span> : null}
                        </span>
                      </td>
                    );
                  })}
                  <td className="totals-cell">{row.total}</td>
                  <td className="totals-cell">{row.bedien}</td>
                  <td className="totals-cell">{row.pharm}</td>
                  <td className="notes-cell print-notes-cell">{row.plannedNotes.join(" · ") || "—"}</td>
                  <td className="notes-cell print-notes-cell">{row.dailyNote || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ) : null}
    </section>
  );
}
