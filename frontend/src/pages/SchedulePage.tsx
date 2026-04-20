import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import { useCoverageIssues, issuesByDate } from "../lib/coverage";
import { CoverageBadges, hasCritical } from "../components/CoverageBadges";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Shift = Tables<"shifts"> & { employee: Pick<Employee, "first_name" | "last_name" | "display_code" | "role"> | null; source?: string };

function formatDateCompact(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
}

function isoWeek(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00`);
  const jan4 = new Date(d.getFullYear(), 0, 4, 12, 0, 0);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const diff = d.getTime() - startOfWeek1.getTime();
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

type DragPayload =
  | { kind: "employee"; employeeId: string }
  | { kind: "shift"; shiftId: string };

function serializeDrag(p: DragPayload) { return JSON.stringify(p); }
function parseDrag(raw: string | null): DragPayload | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function SchedulePage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const t = useT("schedule");
  const c = useT("common");

  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);

  // extended range covering full ISO weeks at month boundaries
  const calStart = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth, 1, 12, 0, 0);
    d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    return d.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);
  const calEnd = useMemo(() => {
    const d = new Date(selectedYear, selectedMonth + 1, 0, 12, 0, 0);
    d.setDate(d.getDate() + (6 - (d.getDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  }, [selectedYear, selectedMonth]);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", calStart, calEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("id, employee_id, shift_date, source, employee:employees(first_name, last_name, display_code, role)")
        .gte("shift_date", calStart)
        .lte("shift_date", calEnd);
      if (error) throw error;
      return data as Shift[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ employeeId, date }: { employeeId: string; date: string }) => {
      const { error } = await supabase
        .from("shifts")
        .upsert(
          { employee_id: employeeId, shift_date: date, source: "manual" },
          { onConflict: "employee_id,shift_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); queryClient.invalidateQueries({ queryKey: ["coverage_issues"] }); setActionError(null); },
    onError: (e) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); queryClient.invalidateQueries({ queryKey: ["coverage_issues"] }); setActionError(null); },
    onError: (e) => setActionError(e.message),
  });

  const calendarWeeks = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1, 12, 0, 0);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0, 12, 0, 0);

    const startDow = (firstDay.getDay() + 6) % 7; // Mon=0
    const start = new Date(firstDay);
    start.setDate(start.getDate() - startDow);

    const endDow = (lastDay.getDay() + 6) % 7;
    const end = new Date(lastDay);
    end.setDate(end.getDate() + (6 - endDow));

    const cells: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      cells.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }

    const weeks: Array<Array<string>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [selectedMonth, selectedYear]);

  const issuesQuery = useCoverageIssues(calStart, calEnd);
  const issuesMap = useMemo(() => issuesByDate(issuesQuery.data ?? []), [issuesQuery.data]);
  const conflictSet = useMemo(
    () =>
      new Set(
        (issuesQuery.data ?? [])
          .filter((i) => i.kind === "conflict" && i.employee_id)
          .map((i) => `${i.issue_date}|${i.employee_id}`),
      ),
    [issuesQuery.data],
  );

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shiftsQuery.data ?? []) {
      const key = shift.shift_date;
      map.set(key, [...(map.get(key) ?? []), shift]);
    }
    return map;
  }, [shiftsQuery.data]);

  const weekList = useMemo(() => {
    const seen = new Set<number>();
    const weeks: { kw: number; start: string; end: string }[] = [];
    for (const week of calendarWeeks) {
      const days = week.filter(Boolean) as string[];
      if (!days.length) continue;
      const kw = isoWeek(days[0]);
      if (!seen.has(kw)) {
        seen.add(kw);
        weeks.push({ kw, start: days[0], end: days[days.length - 1] });
      }
    }
    return weeks;
  }, [calendarWeeks]);

  const displayedWeeks = useMemo(() => {
    if (selectedWeek === null) return calendarWeeks;
    return calendarWeeks.filter((week) => {
      const days = week.filter(Boolean) as string[];
      return days.length > 0 && isoWeek(days[0]) === selectedWeek;
    });
  }, [calendarWeeks, selectedWeek]);

  const handleDrop = (e: React.DragEvent, date: string) => {
    e.preventDefault();
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload) return;
    if (payload.kind === "employee") {
      createMutation.mutate({ employeeId: payload.employeeId, date });
    }
  };

  const handleDeleteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload || payload.kind !== "shift") return;
    deleteMutation.mutate(payload.shiftId);
  };

  const isBusy = createMutation.isPending || deleteMutation.isPending;

  const activeEmployees = useMemo(
    () => [...(employeesQuery.data ?? [])].sort((a, b) => a.first_name.localeCompare(b.first_name)),
    [employeesQuery.data],
  );
  const roleLabels = c as unknown as Record<string, string>;
  const getRoleLabel = (role: Employee["role"] | undefined) => (role ? (roleLabels[`role_${role}`] ?? role) : "—");

  // suppress unused variable warnings for month range vars used elsewhere
  void monthStart; void monthEnd;

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards schedule-layout">
        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{c.month}</span>
              <select value={selectedMonth} onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedWeek(null); }}>
                {(c.months as string[]).map((label, i) => <option key={label} value={i}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{c.year}</span>
              <select value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedWeek(null); }}>
                {Array.from({ length: 5 }, (_, offset) => today.getFullYear() - 2 + offset).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <div className="schedule-week-list">
            <button
              className={["schedule-week-item", selectedWeek === null ? "active" : ""].join(" ").trim()}
              onClick={() => setSelectedWeek(null)}
            >
              {t.allMonth}
            </button>
            {weekList.map(({ kw, start, end }) => (
              <button
                key={kw}
                className={["schedule-week-item", selectedWeek === kw ? "active" : ""].join(" ").trim()}
                onClick={() => setSelectedWeek(kw)}
              >
                <span className="schedule-week-kw">KW {kw}</span>
                <span className="schedule-week-range">{formatDateCompact(start)} – {formatDateCompact(end)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card schedule-main-card">
          {actionError ? <p className="schedule-error">{actionError}</p> : null}
          <div className="calendar-board">
            <div className="calendar-header">
              {(c.weekdays as string[]).map((wd) => <div key={wd} className="calendar-header-cell">{wd.slice(0, 3)}</div>)}
            </div>
            <div className="calendar-grid">
              {displayedWeeks.flatMap((week, wi) =>
                week.map((day, di) => {
                  if (!day) return <div key={`e-${wi}-${di}`} className="calendar-cell empty" />;
                  const dayDate = new Date(`${day}T12:00:00`);
                  const isOutOfMonth = dayDate.getMonth() !== selectedMonth;
                  const dayShifts = shiftsByDate.get(day) ?? [];
                  return (
                    <div key={day} className={`calendar-cell${isOutOfMonth ? " out-of-month" : ""}${hasCritical(issuesMap.get(day) ?? []) ? " day-has-critical" : ""}`}>
                      <div className="calendar-cell-head">
                        <strong>{formatDateCompact(day)}</strong>
                        <CoverageBadges issues={issuesMap.get(day) ?? []} />
                      </div>
                      <div
                        className="calendar-cell-body"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, day)}
                      >
                        {dayShifts.map((shift) => (
                          <div
                            key={shift.id}
                            className={[
                              "calendar-person",
                              "shift-cell",
                              shift.employee?.role === "pharmacist" ? "pharmacist" : "operator",
                              shift.source === "generated" ? "is-generated" : "",
                              conflictSet.has(`${shift.shift_date}|${shift.employee_id}`) ? "is-conflict" : "",
                            ].filter(Boolean).join(" ")}
                            draggable
                            onDragStart={(e) => {
                              const p = serializeDrag({ kind: "shift", shiftId: shift.id });
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("application/pharma-plan", p);
                              e.dataTransfer.setData("text/plain", p);
                            }}
                          >
                            <span>{shift.employee?.display_code ?? "—"}</span>
                            <div className="calendar-tooltip">
                              <strong>{shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : "—"}</strong>
                              <span>{t.roleLabel}: {getRoleLabel(shift.employee?.role)}</span>
                            </div>
                            <button
                              type="button"
                              className="person-remove"
                              onClick={() => deleteMutation.mutate(shift.id)}
                              disabled={isBusy}
                            >x</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>{t.activeEmployees}</h3>
          <p className="page-description">{t.dragHint}</p>
          {employeesQuery.isLoading ? <p>{t.loadingEmployees}</p> : null}
          <div
            className="employee-pool sidebar-pool"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDeleteDrop}
          >
            {activeEmployees.map((emp) => (
              <div
                key={emp.id}
                className={`employee-chip role-${emp.role}`}
                draggable
                onDragStart={(e) => {
                  const p = serializeDrag({ kind: "employee", employeeId: emp.id });
                  e.dataTransfer.effectAllowed = "copyMove";
                  e.dataTransfer.setData("application/pharma-plan", p);
                  e.dataTransfer.setData("text/plain", p);
                }}
              >
                {emp.display_code}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
