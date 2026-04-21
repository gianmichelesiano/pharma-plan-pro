import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import { useMemo } from "react";

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


function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function formatDayLabel(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(-2)}`;
}

type ShiftRow = {
  id: string;
  shift_date: string;
  employee: { first_name: string; last_name: string; role: string } | null;
};

export function DashboardPage() {
  const t = useT("dashboard");
  const c = useT("common");
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
        .select("id, shift_date, employee:employees(first_name, last_name, role)")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("shift_date");
      if (error) throw error;
      return data as unknown as ShiftRow[];
    },
  });

  const dayLabels = (c as unknown as Record<string, string[]>).weekdaysShort ?? ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];

  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const day of days) map.set(day, []);
    for (const s of weekShiftsQuery.data ?? []) {
      map.get(s.shift_date)?.push(s);
    }
    return map;
  }, [weekShiftsQuery.data, days]);

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
      </div>

      <div className="card" style={{ marginTop: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem" }}>{(t as unknown as Record<string, string>).weekTitle}</h3>
        {weekShiftsQuery.isLoading ? (
          <p>{(t as unknown as Record<string, string>).loading}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.75rem", overflowX: "auto" }}>
            {days.map((day, i) => {
              const isToday = day === today;
              const dayShifts = shiftsByDay.get(day) ?? [];
              return (
                <div
                  key={day}
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
                          const role = s.employee?.role === "pharmacist" ? "pharmacist" : "operator";
                          const fullName = s.employee ? `${s.employee.first_name} ${s.employee.last_name}` : "?";
                          return (
                            <div
                              key={s.id}
                              className={`employee-chip role-${role}`}
                              style={{ justifyContent: "center", cursor: "default" }}
                            >
                              {s.employee ? initials(s.employee.first_name, s.employee.last_name) : "?"}
                              <div className="calendar-tooltip">
                                <strong>{fullName}</strong>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
