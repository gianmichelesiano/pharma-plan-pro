import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";
import { useAuth } from "../contexts/AuthContext";
import { useCoverageIssues } from "../lib/coverage";
import { fetchCoverageRequests, initiateRequest } from "../lib/coverage-requests";

type Employee = Tables<"employees">;
type Absence = Tables<"absences"> & { employee: Pick<Employee, "first_name" | "last_name"> | null };
type AbsenceType = Tables<"absences">["type"];
type AbsenceStatus = Tables<"absences">["status"];

const ABSENCE_TYPES: AbsenceType[] = ["VACATION", "UNAVAILABLE", "SICK", "SCHOOL", "TRAINING", "HR_MEETING"];
const ABSENCE_STATUSES: AbsenceStatus[] = ["requested", "approved", "rejected"];

function formatDateCompact(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
}

function intersectsRange(startDate: string, endDate: string, rangeStart: Date, rangeEnd: Date) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  return start <= rangeEnd && end >= rangeStart;
}

export function AbsencesPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState({ employee_id: "", start_date: "", end_date: "", type: "VACATION" as AbsenceType, status: "approved" as AbsenceStatus });
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const t = useT("absences");
  const c = useT("common");

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, first_name, last_name, role").order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["absences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*, employee:employees(first_name, last_name)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Absence[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("absences").insert({
        employee_id: form.employee_id,
        start_date: form.start_date,
        end_date: form.end_date,
        type: form.type,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setForm({ employee_id: "", start_date: "", end_date: "", type: "VACATION", status: "approved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["absences"] }),
  });

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const coverageQuery = useQuery({
    queryKey: ["coverage_requests_open"],
    queryFn: fetchCoverageRequests,
    enabled: isAdmin,
  });

  const openRequestMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of coverageQuery.data ?? []) {
      if (r.absence_id) m.set(r.absence_id, r.id);
    }
    return m;
  }, [coverageQuery.data]);

  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const monthEndDate = new Date(selectedYear, selectedMonth + 1, 0);
  const monthEnd = monthEndDate.toISOString().slice(0, 10);
  const issuesQuery = useCoverageIssues(monthStart, monthEnd);

  const conflictPairs = useMemo(() => {
    const s = new Set<string>();
    for (const i of issuesQuery.data ?? []) {
      if (i.kind === "conflict" && i.employee_id) {
        s.add(`${i.employee_id}|${i.issue_date}`);
      }
    }
    return s;
  }, [issuesQuery.data]);

  function absenceHasConflict(row: Absence): boolean {
    const s = new Date(row.start_date + "T00:00:00Z");
    const e = new Date(row.end_date + "T00:00:00Z");
    for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
      if (conflictPairs.has(`${row.employee_id}|${d.toISOString().slice(0, 10)}`)) return true;
    }
    return false;
  }

  const initiateMutation = useMutation({
    mutationFn: async ({ absence_id, shift_date }: { absence_id: string; shift_date: string }) => {
      return initiateRequest(absence_id, shift_date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
    },
  });

  const filteredAbsences = useMemo(() => {
    const rows = absencesQuery.data ?? [];
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    return rows.filter((row) => intersectsRange(row.start_date, row.end_date, start, end));
  }, [absencesQuery.data, selectedMonth, selectedYear]);

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards two-columns">
        <div className="card">
          <h3>{t.newAbsence}</h3>
          <form className="form-grid" onSubmit={(e: FormEvent) => { e.preventDefault(); createMutation.mutate(); }}>
            <label className="field">
              <span>{c.employee}</span>
              <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} required>
                <option value="">{t.selectPlaceholder}</option>
                {(employeesQuery.data ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.from}</span>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.to}</span>
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.reason}</span>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceType }))}>
                {ABSENCE_TYPES.map((type) => (
                  <option key={type} value={type}>{(c as unknown as Record<string, string>)[`absence_type_${type}`] ?? type}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.status}</span>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AbsenceStatus }))}>
                {ABSENCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{(c as unknown as Record<string, string>)[`absence_status_${s}`] ?? s}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? t.adding : t.addAbsence}</button>
          </form>
          {createMutation.error ? <p>{t.errorSaving}</p> : null}
        </div>

        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{c.month}</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {c.months.map((label, i) => <option key={label} value={i}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{c.year}</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, offset) => today.getFullYear() - 2 + offset).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          {absencesQuery.isLoading ? <p>{t.loadingAbsences}</p> : null}
          {!absencesQuery.isLoading && filteredAbsences.length === 0 ? <p>{t.noAbsences}</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>{t.employeeHeader}</th>
                <th>{t.periodHeader}</th>
                <th>{t.reasonHeader}</th>
                <th>{t.statusHeader}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAbsences.map((row) => (
                <tr key={row.id}>
                  <td>{row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : "—"}</td>
                  <td>{formatDateCompact(row.start_date)} → {formatDateCompact(row.end_date)}</td>
                  <td>{(c as unknown as Record<string, string>)[`absence_type_${row.type}`] ?? row.type}</td>
                  <td>{(c as unknown as Record<string, string>)[`absence_status_${row.status}`] ?? row.status}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      {isAdmin && absenceHasConflict(row) && (() => {
                        const openId = openRequestMap.get(row.id);
                        if (openId) {
                          return (
                            <button
                              key="view"
                              type="button"
                              className="secondary"
                              onClick={() => navigate("/coverage-requests")}
                            >
                              {t.viewRequest}
                            </button>
                          );
                        }
                        const days: string[] = [];
                        const s = new Date(row.start_date + "T00:00:00Z");
                        const e = new Date(row.end_date + "T00:00:00Z");
                        for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
                          days.push(d.toISOString().slice(0, 10));
                        }
                        return days.map((day) => (
                          <button
                            key={day}
                            type="button"
                            className="primary"
                            disabled={initiateMutation.isPending}
                            onClick={() => initiateMutation.mutate({ absence_id: row.id, shift_date: day })}
                          >
                            {t.initiate} {day.slice(5)}
                          </button>
                        ));
                      })()}
                      <button type="button" className="secondary" onClick={() => deleteMutation.mutate(row.id)}>{c.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
