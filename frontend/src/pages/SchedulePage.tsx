import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useCoverageIssues, issuesByDate } from "../lib/coverage";
import { CoverageBadges, hasCritical } from "../components/CoverageBadges";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Shift = Tables<"shifts"> & { employee: Pick<Employee, "first_name" | "last_name" | "display_code" | "role"> | null; source?: string };
type WeeklyPatternNoteRow = Pick<Tables<"weekly_patterns">, "employee_id" | "weekday" | "special_note"> & {
  employee?: { display_code: string | null } | null;
};
type DailyPlanningNoteRow = Pick<Tables<"daily_notes">, "note_date" | "text" | "title">;
const PLANNING_NOTE_TITLE = "planning_note";

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

function weekdayMon0(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
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
  const { confirmState, confirm, cancel } = useConfirm();
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const t = useT("schedule");
  const p = useT("planning");
  const coverageT = useT("coverage");
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
  const clearMonthPlanMutation = useMutation({
    mutationFn: async () => {
      const { error: covErr } = await supabase
        .from("coverage_requests")
        .delete()
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (covErr) throw covErr;

      const { error } = await supabase
        .from("shifts")
        .delete()
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_issues"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
      setActionError(null);
    },
    onError: (e) => setActionError(e.message),
  });
  const generateMonthPlanMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "generate", year: selectedYear, month: selectedMonth + 1 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_issues"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
      setActionError(null);
    },
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
  const absencesQuery = useQuery({
    queryKey: ["absences", calStart, calEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, start_date, end_date, status")
        .lte("start_date", calEnd)
        .gte("end_date", calStart)
        .not("status", "eq", "rejected");
      if (error) throw error;
      return data as Pick<Tables<"absences">, "employee_id" | "start_date" | "end_date" | "status">[];
    },
  });
  const patternNotesQuery = useQuery({
    queryKey: ["schedule-pattern-notes"],
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
  const dailyNotesQuery = useQuery({
    queryKey: ["schedule-daily-notes", calStart, calEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("note_date, text, title")
        .eq("title", PLANNING_NOTE_TITLE)
        .gte("note_date", calStart)
        .lte("note_date", calEnd);
      if (error) throw error;
      return data as DailyPlanningNoteRow[];
    },
  });
  const absenceSet = useMemo(() => {
    const s = new Set<string>();
    for (const row of absencesQuery.data ?? []) {
      const start = new Date(`${row.start_date}T12:00:00`);
      const end = new Date(`${row.end_date}T12:00:00`);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (day >= calStart && day <= calEnd) s.add(`${day}|${row.employee_id}`);
      }
    }
    return s;
  }, [absencesQuery.data, calStart, calEnd]);

  const shiftsByDate = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shiftsQuery.data ?? []) {
      const key = shift.shift_date;
      map.set(key, [...(map.get(key) ?? []), shift]);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const aName = `${a.employee?.first_name ?? ""} ${a.employee?.last_name ?? ""}`;
        const bName = `${b.employee?.first_name ?? ""} ${b.employee?.last_name ?? ""}`;
        return aName.localeCompare(bName, "it", { sensitivity: "base" });
      });
      map.set(k, arr);
    }
    return map;
  }, [shiftsQuery.data]);
  const plannedNotesByWeekday = useMemo(() => {
    const map = new Map<number, string[]>();
    const seenByDay = new Map<number, Set<string>>();
    for (const row of patternNotesQuery.data ?? []) {
      const note = row.special_note?.trim();
      if (!note) continue;
      const code = row.employee?.display_code?.trim() || "—";
      const label = `${code} ${note}`;
      const seen = seenByDay.get(row.weekday) ?? new Set<string>();
      if (seen.has(label)) continue;
      seen.add(label);
      seenByDay.set(row.weekday, seen);
      map.set(row.weekday, [...(map.get(row.weekday) ?? []), label]);
    }
    return map;
  }, [patternNotesQuery.data]);
  const dailyNotesByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of dailyNotesQuery.data ?? []) {
      const text = row.text?.trim();
      if (!text) continue;
      map.set(row.note_date, text);
    }
    return map;
  }, [dailyNotesQuery.data]);

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
    if (!isAdmin) return;
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload) return;
    if (payload.kind === "employee") {
      createMutation.mutate({ employeeId: payload.employeeId, date });
    }
  };

  const handleDeleteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload || payload.kind !== "shift") return;
    deleteMutation.mutate(payload.shiftId);
  };

  const { isAdmin } = useAuth();
  const hasGeneratedPlan = useMemo(
    () =>
      (shiftsQuery.data ?? []).some(
        (s) => s.source === "generated" && s.shift_date >= monthStart && s.shift_date <= monthEnd,
      ),
    [shiftsQuery.data, monthStart, monthEnd],
  );
  const isBusy =
    createMutation.isPending ||
    deleteMutation.isPending ||
    clearMonthPlanMutation.isPending ||
    generateMonthPlanMutation.isPending;

  const activeEmployees = useMemo(
    () => [...(employeesQuery.data ?? [])].sort((a, b) => {
      const aName = `${a.first_name} ${a.last_name}`;
      const bName = `${b.first_name} ${b.last_name}`;
      return aName.localeCompare(bName, "it", { sensitivity: "base" });
    }),
    [employeesQuery.data],
  );
  const roleLabels = c as unknown as Record<string, string>;
  const getRoleLabel = (role: Employee["role"] | undefined) => (role ? (roleLabels[`role_${role}`] ?? role) : "—");

  // suppress unused variable warnings for month range vars used elsewhere
  void monthStart; void monthEnd;

  return (
    <>
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
            {isAdmin && !hasGeneratedPlan && (
              <button
                type="button"
                className="primary"
                disabled={generateMonthPlanMutation.isPending}
                onClick={() => generateMonthPlanMutation.mutate()}
              >
                {generateMonthPlanMutation.isPending ? p.generating : p.generate}
              </button>
            )}
            {isAdmin && hasGeneratedPlan && (
              <button
                type="button"
                className="secondary"
                disabled={clearMonthPlanMutation.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: "Cancella piano",
                    message: "Questa azione cancellerà il piano del mese selezionato e tutti i relativi shift. Vuoi continuare?",
                    confirmLabel: "Cancella piano",
                  });
                  if (ok) clearMonthPlanMutation.mutate();
                }}
              >
                {clearMonthPlanMutation.isPending ? "Cancellazione..." : "Cancella piano"}
              </button>
            )}
          </div>
          <p className="schedule-range">{formatDateCompact(monthStart)} - {formatDateCompact(monthEnd)}</p>
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
                  const noteParts = [
                    ...(plannedNotesByWeekday.get(weekdayMon0(day)) ?? []),
                    dailyNotesByDate.get(day) ?? "",
                  ].filter(Boolean);
                  const notePreview = noteParts.join(" · ");
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
                          (() => {
                            const isAbsent = absenceSet.has(`${shift.shift_date}|${shift.employee_id}`);
                            return (
                          <div
                            key={shift.id}
                            className={[
                              "calendar-person",
                              shift.employee?.role === "pharmacist" ? "pharmacist" : "operator",
                              shift.source === "generated" ? "is-generated" : "",
                              shift.source === "substitute" ? "is-substitute" : "",
                              conflictSet.has(`${shift.shift_date}|${shift.employee_id}`) ? "is-conflict" : "",
                              isAbsent ? "is-absence" : "",
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
                            {isAbsent && (
                              <span
                                className="calendar-person-absence-badge"
                                title={coverageT.absentEmployee}
                                aria-label={coverageT.absentEmployee}
                              />
                            )}
                            <div className="calendar-tooltip">
                              <strong>{shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : "—"}</strong>
                              <span>{t.roleLabel}: {getRoleLabel(shift.employee?.role)}</span>
                              {isAbsent && <span>{coverageT.absentEmployee}</span>}
                            </div>
                            {isAdmin && (
                              <button
                                type="button"
                                className="person-remove"
                                onClick={async () => { const ok = await confirm({ title: "Elimina turno", message: "Sei sicuro di voler eliminare questo turno?", confirmLabel: "Elimina" }); if (ok) deleteMutation.mutate(shift.id); }}
                                disabled={isBusy}
                              >x</button>
                            )}
                          </div>
                            );
                          })()
                        ))}
                        {notePreview ? (
                          <div className="calendar-note-badge" title={notePreview}>
                            <strong>{(t as unknown as Record<string, string>).notesBadge}</strong>
                            <span>{notePreview}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
            <div className="calendar-header calendar-footer">
              {(c.weekdays as string[]).map((wd) => <div key={`f-${wd}`} className="calendar-header-cell">{wd.slice(0, 3)}</div>)}
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
    {confirmState && (
      <ConfirmDialog
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={cancel}
      />
    )}
    </>
  );
}
