import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Shift = Tables<"shifts"> & { employee: Pick<Employee, "first_name" | "last_name" | "display_code" | "role"> | null };
type ShiftType = Tables<"shifts">["shift_type"];

const SLOT_TIME_LABELS: Record<ShiftType, string> = {
  MORNING: "08:00-12:15",
  AFTERNOON: "13:30-18:30",
  FULL_DAY: "08:00-15:00",
};

const SLOT_LABEL: Record<ShiftType, string> = { MORNING: "AM", AFTERNOON: "PM", FULL_DAY: "FULL" };

function formatDateCompact(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
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
  const t = useT("schedule");
  const c = useT("common");

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

  const shiftsQuery = useQuery({
    queryKey: ["shifts", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, employee:employees(first_name, last_name, display_code, role)")
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (error) throw error;
      return data as Shift[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ employeeId, date, shiftType }: { employeeId: string; date: string; shiftType: ShiftType }) => {
      const { error } = await supabase.from("shifts").insert({ employee_id: employeeId, shift_date: date, shift_type: shiftType });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); setActionError(null); },
    onError: (e) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); setActionError(null); },
    onError: (e) => setActionError(e.message),
  });

  const calendarWeeks = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    const firstDate = new Date(`${days[0]}T12:00:00`);
    const leadingEmpties = (firstDate.getDay() + 6) % 7;
    const cells = [...Array.from({ length: leadingEmpties }, () => null), ...days];
    const weeks: Array<Array<string | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [selectedMonth, selectedYear]);

  const shiftsByDaySlot = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shiftsQuery.data ?? []) {
      const key = `${shift.shift_date}-${shift.shift_type}`;
      map.set(key, [...(map.get(key) ?? []), shift]);
    }
    return map;
  }, [shiftsQuery.data]);

  const handleDrop = (e: React.DragEvent, date: string, shiftType: ShiftType) => {
    e.preventDefault();
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload) return;
    if (payload.kind === "employee") {
      createMutation.mutate({ employeeId: payload.employeeId, date, shiftType });
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
    () => [...(employeesQuery.data ?? [])].sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [employeesQuery.data],
  );

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards schedule-layout">
        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{c.month}</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {(c.months as string[]).map((label, i) => <option key={label} value={i}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{c.year}</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, offset) => today.getFullYear() - 2 + offset).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <p className="mini-muted">{t.noPlanAvailable}</p>
        </div>

        <div className="card schedule-main-card">
          {actionError ? <p className="schedule-error">{actionError}</p> : null}
          <div className="calendar-board">
            <div className="calendar-header">
              {(c.weekdays as string[]).map((wd) => <div key={wd} className="calendar-header-cell">{wd.slice(0, 3)}</div>)}
            </div>
            <div className="calendar-grid">
              {calendarWeeks.flatMap((week, wi) =>
                week.map((day, di) => {
                  if (!day) return <div key={`e-${wi}-${di}`} className="calendar-cell empty" />;
                  const dayDate = new Date(`${day}T12:00:00`);
                  const dayOfWeek = dayDate.getDay();
                  const slotTypes: ShiftType[] = dayOfWeek === 0 ? [] : dayOfWeek === 6 ? ["FULL_DAY"] : ["MORNING", "AFTERNOON", "FULL_DAY"];
                  return (
                    <div key={day} className="calendar-cell">
                      <div className="calendar-cell-head">
                        <strong>{formatDateCompact(day)}</strong>
                      </div>
                      <div className="calendar-cell-body slot-stack">
                        {slotTypes.length === 0 ? <span className="mini-muted">{t.closed}</span> : null}
                        {slotTypes.map((shiftType) => {
                          const shifts = shiftsByDaySlot.get(`${day}-${shiftType}`) ?? [];
                          return (
                            <div
                              key={shiftType}
                              className="calendar-slot"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, day, shiftType)}
                            >
                              <div className="calendar-slot-head">
                                <span>{SLOT_TIME_LABELS[shiftType]}</span>
                              </div>
                              <div className="calendar-people">
                                {shifts.map((shift) => (
                                  <div
                                    key={shift.id}
                                    className={["calendar-person", shift.employee?.role === "pharmacist" ? "pharmacist" : "operator"].join(" ")}
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
                                      <span>{SLOT_LABEL[shiftType]}</span>
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
                        })}
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
                className="employee-chip"
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
