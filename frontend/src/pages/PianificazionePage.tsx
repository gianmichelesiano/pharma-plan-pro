import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Absence = Tables<"absences">;
type CoverageRule = Tables<"coverage_rules">;
type Shift = Tables<"shifts">;
type SnapshotShift = {
  id: string;
  employee_id: string;
  shift_date: string;
  source: string;
  legacy_code: string | null;
};

type SnapshotIssue = {
  id: string;
  issue_date: string;
  role: Employee["role"] | null;
  severity: "warning" | "critical";
  message: string;
};

type SnapshotSuggestion = {
  id: string;
  issue_date: string;
  suggestion_type: "ADD_SHIFT" | "MOVE_SHIFT" | "SWAP_SHIFT" | "REMOVE_SHIFT";
  title: string;
  description: string;
  score: number;
};

type PlanningSnapshot = {
  run: { id: string; coverage_score: number | null; fairness_score: number | null; status: string } | null;
  draft_shifts: SnapshotShift[];
  issues: SnapshotIssue[];
  suggestions: SnapshotSuggestion[];
} | null;

function toDbWeekday(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const tmp = new Date(d.valueOf());
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const w1 = new Date(tmp.getFullYear(), 0, 4);
  return 1 + Math.round(((tmp.valueOf() - w1.valueOf()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

function getMonthDays(year: number, month: number): string[] {
  const firstDay = new Date(year, month, 1, 12, 0, 0);
  const lastDay = new Date(year, month + 1, 0, 12, 0, 0);

  // extend start back to Monday of first week
  const startDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay();
  const start = new Date(firstDay);
  start.setDate(start.getDate() - (startDow - 1));

  // extend end forward to Sunday of last week
  const endDow = lastDay.getDay() === 0 ? 7 : lastDay.getDay();
  const end = new Date(lastDay);
  end.setDate(end.getDate() + (7 - endDow));

  const out: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    out.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return out;
}

function absenceBadge(absenceType: Absence["type"]): string {
  if (absenceType === "VACATION") return "Ferie";
  if (absenceType === "SICK") return "Malattia";
  if (absenceType === "SCHOOL") return "Scuola";
  if (absenceType === "TRAINING") return "Formazione";
  if (absenceType === "UNAVAILABLE") return "Indisp.";
  return "HR";
}

export function PianificazionePage() {
  const queryClient = useQueryClient();
  const t = useT("piano");
  const common = useT("common");
  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const allDays = useMemo(() => getMonthDays(selectedYear, selectedMonth), [selectedYear, selectedMonth]);
  const monthStart = allDays[0];
  const monthEnd = allDays[allDays.length - 1];

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["absences", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart)
        .eq("status", "approved");
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

  const shiftsQuery = useQuery({
    queryKey: ["shifts", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (error) throw error;
      return data as Shift[];
    },
  });

  const snapshotQuery = useQuery({
    queryKey: ["planning_snapshot", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "snapshot", year: selectedYear, month: selectedMonth + 1 },
      });
      if (error) throw error;
      return (data ?? null) as PlanningSnapshot;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "generate", year: selectedYear, month: selectedMonth + 1 },
      });
      if (error) throw error;
      return data as PlanningSnapshot;
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["planning_snapshot", selectedYear, selectedMonth], snapshot);
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const applySuggestionMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "apply_suggestion", suggestion_id: suggestionId },
      });
      if (error) throw error;
      return data as PlanningSnapshot;
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(["planning_snapshot", selectedYear, selectedMonth], snapshot);
    },
  });

  const commitMutation = useMutation({
    mutationFn: async (runId: string) => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "commit", run_id: runId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["planning_snapshot", selectedYear, selectedMonth] });
    },
  });

  const snapshot = snapshotQuery.data;
  const employees = employeesQuery.data ?? [];
  const absences = absencesQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const shifts = shiftsQuery.data ?? [];

  const shiftMap = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shifts) {
      const key = `${shift.employee_id}-${shift.shift_date}`;
      const arr = map.get(key) ?? [];
      arr.push(shift);
      map.set(key, arr);
    }
    return map;
  }, [shifts]);

  const absenceMap = useMemo(() => {
    const map = new Map<string, Absence[]>();
    for (const a of absences) {
      const arr = map.get(a.employee_id) ?? [];
      arr.push(a);
      map.set(a.employee_id, arr);
    }
    return map;
  }, [absences]);

  const daySummary = useMemo(() => {
    return allDays.map((date) => {
      const jsDay = new Date(`${date}T12:00:00`).getDay();
      if (jsDay === 0) return { date, total: 0, pharmacists: 0, phas: 0, valid: true };
      const weekday = toDbWeekday(jsDay);
      const present = employees.filter((emp) => (shiftMap.get(`${emp.id}-${date}`) ?? []).length > 0);
      const total = present.length;
      const pharmacists = present.filter((emp) => emp.role === "pharmacist").length;
      const phas = present.filter((emp) => emp.role === "pha").length;
      const dayRules = rules.filter((r) => r.weekday === weekday);
      const valid = dayRules.every((rule) => {
        if (rule.role === "pharmacist") return pharmacists >= rule.min_required;
        if (rule.role === "pha") return phas >= rule.min_required;
        return true;
      });
      return { date, total, pharmacists, phas, valid };
    });
  }, [allDays, employees, rules, shiftMap]);

  const monthTotals = useMemo(() => {
    const employeePresenceDays = new Map<string, number>();
    for (const emp of employees) {
      let count = 0;
      for (const date of allDays) {
        const jsDay = new Date(`${date}T12:00:00`).getDay();
        if (jsDay === 0) continue;
        if ((shiftMap.get(`${emp.id}-${date}`) ?? []).length > 0) count += 1;
      }
      employeePresenceDays.set(emp.id, count);
    }
    const workingDaySummary = daySummary.filter((d) => {
      const jsDay = new Date(`${d.date}T12:00:00`).getDay();
      return jsDay !== 0;
    });
    return {
      employeePresenceDays,
      totalAssigned: workingDaySummary.reduce((sum, d) => sum + d.total, 0),
      totalPharmacists: workingDaySummary.reduce((sum, d) => sum + d.pharmacists, 0),
      totalPhas: workingDaySummary.reduce((sum, d) => sum + d.phas, 0),
      validDays: workingDaySummary.filter((d) => d.valid).length,
      workingDays: workingDaySummary.length,
    };
  }, [allDays, daySummary, employees, shiftMap]);

  const isLoading =
    employeesQuery.isLoading || absencesQuery.isLoading || rulesQuery.isLoading || shiftsQuery.isLoading || snapshotQuery.isLoading;
  const isBusy = generateMutation.isPending || applySuggestionMutation.isPending || commitMutation.isPending;

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="toolbar">
          <label className="field">
            <span>{common.month}</span>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {(common.months as string[]).map((label, i) => (
                <option key={label} value={i}>{label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{common.year}</span>
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={() => generateMutation.mutate()} disabled={isBusy || isLoading}>
            {generateMutation.isPending ? t.generating : t.generate}
          </button>
          <button
            className="secondary"
            onClick={() => snapshot?.run?.id && commitMutation.mutate(snapshot.run.id)}
            disabled={isBusy || isLoading || !snapshot?.run?.id}
          >
            {commitMutation.isPending ? t.committing : t.commit}
          </button>
        </div>
        <div className="piano-kpi-line">
          <span>{t.coverageScore}: {snapshot?.run?.coverage_score?.toFixed(1) ?? "—"}</span>
          <span>{t.fairnessScore}: {snapshot?.run?.fairness_score?.toFixed(1) ?? "—"}</span>
          <span>{t.runStatus}: {snapshot?.run?.status ?? "—"}</span>
        </div>
        {snapshotQuery.error ? <p className="schedule-error">{(snapshotQuery.error as Error).message}</p> : null}
        {generateMutation.error ? <p className="schedule-error">{(generateMutation.error as Error).message}</p> : null}
        {applySuggestionMutation.error ? <p className="schedule-error">{(applySuggestionMutation.error as Error).message}</p> : null}
        {commitMutation.error ? <p className="schedule-error">{(commitMutation.error as Error).message}</p> : null}
      </div>

      {isLoading ? <p className="mini-muted">{common.loading}</p> : (
        <div className="grid cards piano-layout">
          <div className="card">
            <div className="piano-table-wrapper">
              <table className="piano-table">
                <thead>
                  <tr>
                    <th className="piano-th-fixed piano-th-kw">KW</th>
                    <th className="piano-th-fixed piano-th-date">Datum</th>
                    <th className="piano-th-fixed piano-th-day">Tag</th>
                    {employees.map((emp) => (
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
                  {allDays.map((date, idx) => {
                    const d = new Date(`${date}T12:00:00`);
                    const jsDay = d.getDay();
                    const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][jsDay];
                    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
                    const summary = daySummary[idx];
                    const prevKw = idx > 0 ? isoWeek(allDays[idx - 1]) : -1;
                    const kw = isoWeek(date);
                    const isSunday = jsDay === 0;

                    return (
                      <tr
                        key={date}
                        className={isSunday ? "piano-row-sunday" : undefined}
                        onClick={() => {}}
                      >
                        <td className="piano-td-fixed piano-td-kw">{kw !== prevKw ? String(kw) : ""}</td>
                        <td className="piano-td-fixed piano-td-date">{dayLabel}</td>
                        <td className="piano-td-fixed piano-td-weekday">{weekdayShort}</td>
                        {employees.map((emp) => {
                          const shifts = shiftMap.get(`${emp.id}-${date}`) ?? [];
                          const absence = (absenceMap.get(emp.id) ?? []).find((a) => date >= a.start_date && date <= a.end_date);
                          return (
                            <td key={emp.id} className={`piano-cell piano-role-${emp.role}`}>
                              <div className="piano-cell-badges">
                                {shifts.map((s) => (
                                  <span key={s.id} className="piano-badge">
                                    ✓
                                  </span>
                                ))}
                                {shifts.length === 0 && absence ? (
                                  <span className={`piano-badge piano-badge-absence piano-badge-absence-${absence.type.toLowerCase()}`}>
                                    {absenceBadge(absence.type)}
                                  </span>
                                ) : null}
                                {shifts.length === 0 && !absence && !isSunday ? <span className="piano-badge piano-badge-empty">—</span> : null}
                              </div>
                            </td>
                          );
                        })}
                        <td className="piano-td-summary">{isSunday ? "" : summary.total}</td>
                        <td className="piano-td-summary">{isSunday ? "" : summary.pharmacists}</td>
                        <td className="piano-td-summary">{isSunday ? "" : summary.phas}</td>
                        <td className={`piano-td-summary ${isSunday ? "" : summary.valid ? "piano-coverage-ok" : "piano-coverage-warn"}`}>
                          {isSunday ? "" : summary.valid ? "✓" : "!"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="piano-row-total">
                    <td className="piano-td-fixed piano-td-kw" colSpan={3}>{t.monthTotalsLabel}</td>
                    {employees.map((emp) => (
                      <td key={emp.id} className="piano-td-summary">
                        {monthTotals.employeePresenceDays.get(emp.id) ?? 0}
                      </td>
                    ))}
                    <td className="piano-td-summary">{monthTotals.totalAssigned}</td>
                    <td className="piano-td-summary">{monthTotals.totalPharmacists}</td>
                    <td className="piano-td-summary">{monthTotals.totalPhas}</td>
                    <td className="piano-td-summary">{monthTotals.validDays}/{monthTotals.workingDays}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="piano-legend">
              <span className="piano-legend-item piano-legend-am">AM</span>
              <span className="piano-legend-item piano-legend-pm">PM</span>
              <span className="piano-legend-item piano-legend-full">FULL</span>
              <span className="piano-legend-item piano-legend-vacation">{t.badgeVacation}</span>
              <span className="piano-legend-item piano-legend-sick">{t.badgeSick}</span>
              <span className="piano-legend-item piano-legend-training">{t.badgeTraining}</span>
              <span className="piano-legend-item piano-legend-empty">{t.badgeEmpty}</span>
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
