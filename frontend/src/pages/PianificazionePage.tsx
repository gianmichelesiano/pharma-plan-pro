import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Shift = Tables<"shifts">;
type WeeklyPattern = Tables<"weekly_patterns">;
type Absence = Tables<"absences">;
type CoverageRule = Tables<"coverage_rules">;

function toDbWeekday(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function getDaysInMonth(year: number, month: number): string[] {
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
  );
}

function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const tmp = new Date(d.valueOf());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const w1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.valueOf() - w1.valueOf()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

function formatDayLabel(dateStr: string): { kw: number; dayLabel: string; weekdayShort: string; jsDay: number } {
  const d = new Date(`${dateStr}T12:00:00`);
  const jsDay = d.getDay();
  const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][jsDay];
  return { kw: isoWeek(dateStr), dayLabel, weekdayShort, jsDay };
}

type DayStatus =
  | { kind: "present"; shifts: Shift[] }
  | { kind: "absence"; absenceType: string }
  | { kind: "expected"; patterns: WeeklyPattern[] }
  | { kind: "rotating" }
  | { kind: "off" };

function getDayStatus(
  employeeId: string,
  date: string,
  jsDay: number,
  patternMap: Map<string, WeeklyPattern[]>,
  absenceMap: Map<string, Absence[]>,
  shiftMap: Map<string, Shift[]>,
): DayStatus {
  if (jsDay === 0) return { kind: "off" };
  const shifts = shiftMap.get(`${employeeId}-${date}`) ?? [];
  if (shifts.length > 0) return { kind: "present", shifts };
  const absences = absenceMap.get(employeeId) ?? [];
  const absence = absences.find(a => date >= a.start_date && date <= a.end_date);
  if (absence) return { kind: "absence", absenceType: absence.type };
  const dbWeekday = toDbWeekday(jsDay);
  const patterns = (patternMap.get(employeeId) ?? []).filter(p => p.weekday === dbWeekday);
  if (patterns.length === 0) return { kind: "off" };
  if (patterns.every(p => p.slot === "SATURDAY_ROTATING")) return { kind: "rotating" };
  return { kind: "expected", patterns: patterns.filter(p => p.slot !== "SATURDAY_ROTATING") };
}

function getShiftLabel(shifts: Shift[]): string {
  const types = new Set(shifts.map(s => s.shift_type));
  if (types.has("FULL_DAY")) return "G";
  if (types.has("MORNING") && types.has("AFTERNOON")) return "G";
  if (types.has("MORNING")) return "M";
  if (types.has("AFTERNOON")) return "PM";
  return "✓";
}

const ABSENCE_LABELS: Record<string, string> = {
  VACATION: "F", SICK: "Mal", SCHOOL: "Sc",
  TRAINING: "For", UNAVAILABLE: "Ind", HR_MEETING: "HR",
};

function slotToShiftType(slot: string): "MORNING" | "AFTERNOON" | "FULL_DAY" | null {
  if (slot === "MORNING") return "MORNING";
  if (slot === "AFTERNOON") return "AFTERNOON";
  if (slot === "FULL_DAY") return "FULL_DAY";
  return null;
}

export function PianificazionePage() {
  const today = new Date();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const t = useT("piano");
  const common = useT("common");

  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const patternsQuery = useQuery({
    queryKey: ["weekly_patterns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("weekly_patterns").select("*").eq("active", true);
      if (error) throw error;
      return data as WeeklyPattern[];
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.from("shifts").select("*").gte("shift_date", monthStart).lte("shift_date", monthEnd);
      if (error) throw error;
      return data as Shift[];
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["absences", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.from("absences").select("*").lte("start_date", monthEnd).gte("end_date", monthStart);
      if (error) throw error;
      return data as Absence[];
    },
  });

  const rulesQuery = useQuery({
    queryKey: ["coverage_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coverage_rules").select("*");
      if (error) throw error;
      return data as CoverageRule[];
    },
  });

  const patternMap = useMemo(() => {
    const map = new Map<string, WeeklyPattern[]>();
    for (const p of patternsQuery.data ?? []) {
      const arr = map.get(p.employee_id) ?? [];
      arr.push(p);
      map.set(p.employee_id, arr);
    }
    return map;
  }, [patternsQuery.data]);

  const absenceMap = useMemo(() => {
    const map = new Map<string, Absence[]>();
    for (const a of absencesQuery.data ?? []) {
      const arr = map.get(a.employee_id) ?? [];
      arr.push(a);
      map.set(a.employee_id, arr);
    }
    return map;
  }, [absencesQuery.data]);

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const s of shiftsQuery.data ?? []) {
      const key = `${s.employee_id}-${s.shift_date}`;
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [shiftsQuery.data]);

  const days = useMemo(() => getDaysInMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const coverageSummary = useMemo(() => {
    const rules = rulesQuery.data ?? [];
    return days.map(date => {
      const jsDay = new Date(`${date}T12:00:00`).getDay();
      if (jsDay === 0) return { date, total: 0, farmacisti: 0, phas: 0, valid: true };
      const dbWeekday = toDbWeekday(jsDay);
      const presentEmps = employees.filter(emp => (shiftMap.get(`${emp.id}-${date}`) ?? []).length > 0);
      const total = presentEmps.length;
      const farmacisti = presentEmps.filter(e => e.role === "pharmacist").length;
      const phas = presentEmps.filter(e => e.role === "pha").length;
      const dayRules = rules.filter(r => r.weekday === dbWeekday);
      const valid = dayRules.every(rule => {
        if (rule.role === "pharmacist") return farmacisti >= rule.min_required;
        if (rule.role === "pha") {
          if (rule.time_window === "evening") {
            const eveningPhas = employees.filter(emp => {
              const shifts = shiftMap.get(`${emp.id}-${date}`) ?? [];
              return shifts.some(s => s.shift_type === "AFTERNOON") && emp.role === "pha";
            }).length;
            return eveningPhas >= rule.min_required;
          }
          return phas >= rule.min_required;
        }
        return true;
      });
      return { date, total, farmacisti, phas, valid };
    });
  }, [days, employees, shiftMap, rulesQuery.data]);

  const isLoading = employeesQuery.isLoading || patternsQuery.isLoading || shiftsQuery.isLoading || absencesQuery.isLoading || rulesQuery.isLoading;

  const generateMutation = useMutation({
    mutationFn: async () => {
      const toInsert: { employee_id: string; shift_date: string; shift_type: "MORNING" | "AFTERNOON" | "FULL_DAY" }[] = [];
      for (const emp of employees) {
        for (const date of days) {
          const jsDay = new Date(`${date}T12:00:00`).getDay();
          if (jsDay === 0) continue;
          const dbWeekday = toDbWeekday(jsDay);
          const patterns = (patternMap.get(emp.id) ?? [])
            .filter(p => p.weekday === dbWeekday && p.slot !== "SATURDAY_ROTATING");
          if (patterns.length === 0) continue;
          const hasAbsence = (absenceMap.get(emp.id) ?? [])
            .some(a => date >= a.start_date && date <= a.end_date);
          if (hasAbsence) continue;
          for (const pat of patterns) {
            const shiftType = slotToShiftType(pat.slot);
            if (shiftType) toInsert.push({ employee_id: emp.id, shift_date: date, shift_type: shiftType });
          }
        }
      }
      if (toInsert.length === 0) return;
      const { error } = await supabase
        .from("shifts")
        .upsert(toInsert, { onConflict: "employee_id,shift_date,shift_type", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({
      employeeId,
      date,
      status,
    }: {
      employeeId: string;
      date: string;
      status: DayStatus;
    }) => {
      if (status.kind === "present") {
        for (const shift of status.shifts) {
          const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
          if (error) throw error;
        }
      } else if (status.kind === "expected") {
        const toInsert = status.patterns
          .map(p => slotToShiftType(p.slot))
          .filter((st): st is "MORNING" | "AFTERNOON" | "FULL_DAY" => st !== null)
          .map(shiftType => ({ employee_id: employeeId, shift_date: date, shift_type: shiftType }));
        if (toInsert.length > 0) {
          const { error } = await supabase
            .from("shifts")
            .upsert(toInsert, { onConflict: "employee_id,shift_date,shift_type", ignoreDuplicates: true });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const isBusy = generateMutation.isPending || clearMutation.isPending || toggleMutation.isPending;

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="toolbar">
          <label className="field">
            <span>{common.month}</span>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
              {(common.months as string[]).map((label, i) => (
                <option key={label} value={i}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{common.year}</span>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            onClick={() => generateMutation.mutate()}
            disabled={isBusy || isLoading}
          >
            {generateMutation.isPending ? t.generating : t.generate}
          </button>
          <button
            className="secondary"
            onClick={() => {
              if (window.confirm(t.confirmClear)) clearMutation.mutate();
            }}
            disabled={isBusy || isLoading}
          >
            {t.clear}
          </button>
        </div>
        {generateMutation.isError && (
          <p className="schedule-error">{(generateMutation.error as Error).message}</p>
        )}
        {clearMutation.isError && (
          <p className="schedule-error">{(clearMutation.error as Error).message}</p>
        )}
        {toggleMutation.isError && (
          <p className="schedule-error">{(toggleMutation.error as Error).message}</p>
        )}
      </div>
      {isLoading ? (
        <p className="mini-muted">{common.loading}</p>
      ) : (
        <div className="card">
          <div className="piano-table-wrapper">
            <table className="piano-table">
              <thead>
                <tr>
                  <th className="piano-th-fixed piano-th-kw">KW</th>
                  <th className="piano-th-fixed piano-th-date">Datum</th>
                  <th className="piano-th-fixed piano-th-day">Tag</th>
                  {employees.map(emp => (
                    <th key={emp.id} className={`piano-th-emp piano-role-${emp.role}`} title={`${emp.first_name} ${emp.last_name}`}>
                      {emp.display_code}
                    </th>
                  ))}
                  <th className="piano-th-summary">Tot</th>
                  <th className="piano-th-summary">Ph</th>
                  <th className="piano-th-summary">PHA</th>
                  <th className="piano-th-summary">✓</th>
                </tr>
              </thead>
              <tbody>
                {days.map((date, idx) => {
                  const { kw, dayLabel, weekdayShort, jsDay } = formatDayLabel(date);
                  const isSunday = jsDay === 0;
                  const summary = coverageSummary[idx];
                  const prevKw = idx > 0 ? isoWeek(days[idx - 1]) : -1;
                  return (
                    <tr key={date} className={isSunday ? "piano-row-sunday" : undefined}>
                      <td className="piano-td-fixed piano-td-kw">{kw !== prevKw ? String(kw) : ""}</td>
                      <td className="piano-td-fixed piano-td-date">{dayLabel}</td>
                      <td className="piano-td-fixed piano-td-weekday">{weekdayShort}</td>
                      {employees.map(emp => {
                        if (isSunday) return <td key={emp.id} className="piano-cell piano-cell-sunday" />;
                        const status = getDayStatus(emp.id, date, jsDay, patternMap, absenceMap, shiftMap);
                        const isClickable = !isBusy && (status.kind === "present" || status.kind === "expected");
                        return (
                          <td
                            key={emp.id}
                            className={`piano-cell piano-cell-${status.kind}${status.kind === "absence" ? `-${status.absenceType}` : ""}`}
                            onClick={isClickable ? () => toggleMutation.mutate({ employeeId: emp.id, date, status }) : undefined}
                            style={isClickable ? { cursor: "pointer" } : undefined}
                            title={status.kind === "absence" ? (ABSENCE_LABELS[status.absenceType] ?? status.absenceType) : undefined}
                          >
                            {status.kind === "present" ? getShiftLabel(status.shifts) : null}
                            {status.kind === "absence" ? (ABSENCE_LABELS[status.absenceType] ?? "—") : null}
                            {status.kind === "expected" ? "·" : null}
                            {status.kind === "rotating" ? "R" : null}
                          </td>
                        );
                      })}
                      <td className="piano-td-summary">{isSunday ? "" : summary.total}</td>
                      <td className="piano-td-summary">{isSunday ? "" : summary.farmacisti}</td>
                      <td className="piano-td-summary">{isSunday ? "" : summary.phas}</td>
                      <td className={`piano-td-summary ${isSunday ? "" : summary.valid ? "piano-coverage-ok" : "piano-coverage-warn"}`}>
                        {isSunday ? "" : summary.valid ? "✓" : "!"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="piano-legend">
            <span className="piano-legend-item piano-legend-present">G/M/PM = turno</span>
            <span className="piano-legend-item piano-legend-vacation">F = ferie</span>
            <span className="piano-legend-item piano-legend-sick">Mal = malattia</span>
            <span className="piano-legend-item piano-legend-school">Sc = scuola</span>
            <span className="piano-legend-item piano-legend-training">For = formazione</span>
            <span className="piano-legend-item piano-legend-expected">· = previsto</span>
            <span className="piano-legend-item piano-legend-rotating">R = sabato rotante</span>
          </div>
        </div>
      )}
    </section>
  );
}
