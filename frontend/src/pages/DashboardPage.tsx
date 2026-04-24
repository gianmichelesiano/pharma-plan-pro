import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import { useMemo } from "react";
import type { Tables } from "../lib/database.types";
import { issuesByDate, useCoverageIssues } from "../lib/coverage";

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const weekday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    days: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    }),
  };
}

function formatDayLabel(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(-2)}`;
}

type ShiftRow = {
  id: string;
  shift_date: string;
  employee_id: string;
  source?: string | null;
  employee: { first_name: string; last_name: string; display_code: string; role: string } | null;
};
type WeeklyPatternNoteRow = Pick<Tables<"weekly_patterns">, "employee_id" | "weekday" | "special_note"> & {
  employee?: { display_code: string | null } | null;
};
type DailyPlanningNoteRow = Pick<Tables<"daily_notes">, "note_date" | "text" | "title">;
const PLANNING_NOTE_TITLE = "planning_note";

function weekdayMon0(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}

function hasCritical(issues: Array<{ severity?: string }> = []): boolean {
  return issues.some((issue) => issue.severity === "critical");
}

export function DashboardPage() {
  const t = useT("dashboard");
  const c = useT("common");
  const coverageT = useT("coverage");
  const { start: monthStart, end: monthEnd } = getMonthRange();
  const { start: weekStart, end: weekEnd, days } = getWeekRange();
  const today = new Date().toISOString().slice(0, 10);

  const employeesQuery = useQuery({
    queryKey: ["dashboard-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["dashboard-absences", monthStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("absences")
        .select("id", { count: "exact", head: true })
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["dashboard-shifts", weekStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const weekShiftsQuery = useQuery({
    queryKey: ["dashboard-week-shifts", weekStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, employee_id, shift_date, source, employee:employees(first_name, last_name, display_code, role)")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("shift_date");
      if (error) throw error;
      return data as unknown as ShiftRow[];
    },
  });
  const weekAbsencesQuery = useQuery({
    queryKey: ["dashboard-week-absences", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, start_date, end_date, status")
        .lte("start_date", weekEnd)
        .gte("end_date", weekStart)
        .not("status", "eq", "rejected");
      if (error) throw error;
      return data as Pick<Tables<"absences">, "employee_id" | "start_date" | "end_date" | "status">[];
    },
  });
  const patternNotesQuery = useQuery({
    queryKey: ["dashboard-pattern-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("employee_id, weekday, special_note, employee:employees(display_code)")
        .eq("active", true)
        .not("special_note", "is", null);
      if (error) throw error;
      return data as WeeklyPatternNoteRow[];
    },
  });
  const dailyNoteQuery = useQuery({
    queryKey: ["dashboard-daily-note", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("note_date, text, title")
        .eq("title", PLANNING_NOTE_TITLE)
        .gte("note_date", weekStart)
        .lte("note_date", weekEnd);
      if (error) throw error;
      return data as DailyPlanningNoteRow[];
    },
  });

  const dayLabels = (c as unknown as Record<string, string[]>).weekdaysShort ?? ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
  const issuesQuery = useCoverageIssues(weekStart, weekEnd);
  const issuesMap = useMemo(() => issuesByDate(issuesQuery.data ?? []), [issuesQuery.data]);

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const day of days) map.set(day, []);
    for (const s of weekShiftsQuery.data ?? []) {
      map.get(s.shift_date)?.push(s);
    }
    return map;
  }, [weekShiftsQuery.data, days]);
  const absenceSet = useMemo(() => {
    const set = new Set<string>();
    for (const row of weekAbsencesQuery.data ?? []) {
      const start = new Date(`${row.start_date}T12:00:00`);
      const end = new Date(`${row.end_date}T12:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (day >= weekStart && day <= weekEnd) set.add(`${day}|${row.employee_id}`);
      }
    }
    return set;
  }, [weekAbsencesQuery.data, weekStart, weekEnd]);
  const plannedNotesToday = useMemo(() => {
    const weekday = weekdayMon0(today);
    const items: string[] = [];
    const seen = new Set<string>();
    for (const row of patternNotesQuery.data ?? []) {
      const note = row.special_note?.trim();
      if (!note || row.weekday !== weekday) continue;
      const code = row.employee?.display_code?.trim() || "—";
      const key = `${code}|${note}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(`${code} ${note}`);
    }
    return items;
  }, [patternNotesQuery.data, today]);
  const plannedNotesByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const day of days) {
      const weekday = weekdayMon0(day);
      const items: string[] = [];
      const seen = new Set<string>();
      for (const row of patternNotesQuery.data ?? []) {
        const note = row.special_note?.trim();
        if (!note || row.weekday !== weekday) continue;
        const code = row.employee?.display_code?.trim() || "—";
        const label = `${code} ${note}`;
        if (seen.has(label)) continue;
        seen.add(label);
        items.push(label);
      }
      map.set(day, items);
    }
    return map;
  }, [days, patternNotesQuery.data]);
  const dailyNotesByDay = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of dailyNoteQuery.data ?? []) {
      const text = row.text?.trim();
      if (!text) continue;
      map.set(row.note_date, text);
    }
    return map;
  }, [dailyNoteQuery.data]);
  const dailyNoteToday = dailyNotesByDay.get(today) ?? "";

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards">
        <article className="card">
          <p className="eyebrow">{t.minCoverageTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {employeesQuery.isLoading ? "—" : employeesQuery.data}
          </h2>
          <p>{t.minCoverageText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{t.periodTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {absencesQuery.isLoading ? "—" : absencesQuery.data}
          </h2>
          <p>{t.periodText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{t.emergenciesTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {shiftsQuery.isLoading ? "—" : shiftsQuery.data}
          </h2>
          <p>{t.emergenciesText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{(t as unknown as Record<string, string>).notesTodayTitle}</p>
          <div className="dashboard-notes-list">
            {plannedNotesToday.length > 0 ? (
              <div className="calendar-note-badge dashboard-note-badge">
                <strong>{(t as unknown as Record<string, string>).plannedNotesLabel}</strong>
                <span>{plannedNotesToday.join(" · ")}</span>
              </div>
            ) : null}
            {dailyNoteToday ? (
              <div className="calendar-note-badge dashboard-note-badge">
                <strong>{(t as unknown as Record<string, string>).dailyNotesLabel}</strong>
                <span>{dailyNoteToday}</span>
              </div>
            ) : null}
            {plannedNotesToday.length === 0 && !dailyNoteToday ? (
              <p className="dashboard-notes-empty">{(t as unknown as Record<string, string>).noNotesToday}</p>
            ) : null}
          </div>
        </article>
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem" }}>{(t as unknown as Record<string, string>).weekTitle}</h3>
        {weekShiftsQuery.isLoading ? (
          <p>{(t as unknown as Record<string, string>).loading}</p>
        ) : (
          <div className="table-scroll mobile-table-scroll">
            <div className="dashboard-week-grid">
            {days.map((day, i) => {
              const isToday = day === today;
              const dayShifts = shiftsByDay.get(day) ?? [];
              const notePreview = [
                ...(plannedNotesByDay.get(day) ?? []),
                dailyNotesByDay.get(day) ?? "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <div
                  key={day}
                  className={hasCritical(issuesMap.get(day) ?? []) ? "day-has-critical dashboard-week-day" : "dashboard-week-day"}
                  style={{
                    background: isToday ? "#f0fdf4" : "#fafaf9",
                    border: isToday ? "2px solid #22c55e" : "1px solid #e5e7eb",
                    borderRadius: "10px",
                    padding: "0.75rem 0.5rem",
                    minWidth: "100px",
                  }}
                >
                  <div style={{ textAlign: "center", fontWeight: 600, fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.25rem" }}>
                    {dayLabels[i]}
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 700, fontSize: "0.85rem", color: "#173f2f", marginBottom: "0.75rem" }}>
                    {formatDayLabel(day)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                    {dayShifts.length === 0 ? (
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af", textAlign: "center" }}>—</span>
                    ) : (
                      [...dayShifts]
                        .sort((a, b) => {
                          const aName = `${a.employee?.first_name ?? ""} ${a.employee?.last_name ?? ""}`;
                          const bName = `${b.employee?.first_name ?? ""} ${b.employee?.last_name ?? ""}`;
                          return aName.localeCompare(bName, "it", { sensitivity: "base" });
                        })
                        .map((s) => {
                          const isAbsent = absenceSet.has(`${s.shift_date}|${s.employee_id}`);
                          const fullName = s.employee ? `${s.employee.first_name} ${s.employee.last_name}` : "?";
                          return (
                            <div
                              key={s.id}
                              className={[
                                "calendar-person",
                                s.employee?.role === "pharmacist" ? "pharmacist" : "operator",
                                s.source === "substitute" ? "is-substitute" : "",
                                isAbsent ? "is-absence" : "",
                              ].filter(Boolean).join(" ")}
                              style={{ cursor: "default" }}
                            >
                              <span>{s.employee?.display_code ?? "—"}</span>
                              {isAbsent ? (
                                <span
                                  className="calendar-person-absence-badge"
                                  title={coverageT.absentEmployee}
                                  aria-label={coverageT.absentEmployee}
                                />
                              ) : null}
                              <div className="calendar-tooltip">
                                <strong>{fullName}</strong>
                                {isAbsent ? <span>{coverageT.absentEmployee}</span> : null}
                              </div>
                            </div>
                          );
                        })
                    )}
                    {notePreview ? (
                      <div className="calendar-note-badge dashboard-note-badge" title={notePreview}>
                        <strong>{(t as unknown as Record<string, string>).noteBadge}</strong>
                        <span>{notePreview}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
