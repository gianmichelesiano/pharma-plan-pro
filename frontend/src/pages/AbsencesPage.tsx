import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";
import { useAuth } from "../contexts/AuthContext";
import { initiateRequest, previewCandidates, manualAssign, type CandidatePreview } from "../lib/coverage-requests";
import { CandidatePreviewModal } from "../components/CandidatePreviewModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

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

  type PreviewModal = { absence_id: string; shift_date: string; candidates: CandidatePreview[] } | null;
  const [previewModal, setPreviewModal] = useState<PreviewModal>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const { confirmState, confirm, cancel } = useConfirm();

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
      queryClient.invalidateQueries({ queryKey: ["coverage_issues"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
      setForm({ employee_id: "", start_date: "", end_date: "", type: "VACATION", status: "approved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const absence = absencesQuery.data?.find((a) => a.id === id);

      // Cancel any coverage requests for this absence (cascades to proposals)
      if (absence) {
        const { data: reqs } = await supabase
          .from("coverage_requests")
          .select("id, shift_date")
          .eq("absence_id", id)
          .not("status", "eq", "cancelled");
        if (reqs?.length) {
          // Find accepted proposals to remove substitute shifts
          const reqIds = reqs.map((r) => r.id);
          const { data: accepted } = await supabase
            .from("coverage_proposals")
            .select("employee_id, request_id")
            .in("request_id", reqIds)
            .eq("status", "accepted");
          if (accepted?.length) {
            for (const p of accepted) {
              const req = reqs.find((r) => r.id === p.request_id);
              if (req) {
                await supabase
                  .from("shifts")
                  .delete()
                  .eq("employee_id", p.employee_id)
                  .eq("shift_date", req.shift_date);
              }
            }
          }
          await supabase
            .from("coverage_requests")
            .update({ status: "cancelled" })
            .in("id", reqIds);
        }
      }

      const { error } = await supabase.from("absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_issues"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
    },
  });

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const coverageAllQuery = useQuery({
    queryKey: ["coverage_requests_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coverage_requests")
        .select(`
          id, absence_id, status, shift_date,
          proposals:coverage_proposals(status, employee:employees(first_name, last_name))
        `)
        .not("status", "eq", "cancelled");
      if (error) throw error;
      return data as {
        id: string;
        absence_id: string;
        status: string;
        shift_date: string;
        proposals: { status: string; employee: { first_name: string; last_name: string } | null }[];
      }[];
    },
    enabled: isAdmin,
  });

  const selectedMonthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const selectedMonthEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);

  const shiftsInMonthQuery = useQuery({
    queryKey: ["absences-shifts", selectedMonthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("employee_id, shift_date")
        .gte("shift_date", selectedMonthStart)
        .lte("shift_date", selectedMonthEnd);
      if (error) throw error;
      return data as { employee_id: string; shift_date: string }[];
    },
    enabled: isAdmin,
  });

  const shiftDays = useMemo(() => {
    const s = new Set<string>();
    for (const sh of shiftsInMonthQuery.data ?? []) {
      s.add(`${sh.employee_id}|${sh.shift_date}`);
    }
    return s;
  }, [shiftsInMonthQuery.data]);

  // key: `${absence_id}|${shift_date}`
  const openRequestMap = useMemo(() => {
    const m = new Map<string, { id: string; status: string; substitute: string | null }>();
    for (const r of coverageAllQuery.data ?? []) {
      if (!r.absence_id) continue;
      const accepted = r.proposals?.find((p) => p.status === "accepted");
      const substitute = accepted?.employee
        ? `${accepted.employee.first_name} ${accepted.employee.last_name}`
        : null;
      m.set(`${r.absence_id}|${r.shift_date}`, { id: r.id, status: r.status, substitute });
    }
    return m;
  }, [coverageAllQuery.data]);


  const initiateMutation = useMutation({
    mutationFn: async ({ absence_id, shift_date }: { absence_id: string; shift_date: string }) => {
      return initiateRequest(absence_id, shift_date);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
    },
  });

  const filteredAbsences = useMemo(() => {
    const rows = absencesQuery.data ?? [];
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    return rows.filter((row) => intersectsRange(row.start_date, row.end_date, start, end));
  }, [absencesQuery.data, selectedMonth, selectedYear]);

  return (
    <>
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
                      {isAdmin && (() => {
                        const days: string[] = [];
                        const s = new Date(row.start_date + "T00:00:00Z");
                        const e = new Date(row.end_date + "T00:00:00Z");
                        for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
                          const day = d.toISOString().slice(0, 10);
                          const req = openRequestMap.get(`${row.id}|${day}`);
                          if (req || shiftDays.has(`${row.employee_id}|${day}`)) {
                            days.push(day);
                          }
                        }
                        return days.map((day) => {
                          const req = openRequestMap.get(`${row.id}|${day}`);
                          if (req?.status === "accepted") {
                            return (
                              <span key={day} style={{ display: "inline-flex", alignItems: "center", padding: "0.25rem 0.75rem", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 500, background: "#e6f2ec", color: "#2d7a4f", border: "1px solid #2d7a4f" }}>
                                {t.substituteFound}{req.substitute ? `: ${req.substitute} (${day.slice(5)})` : ` (${day.slice(5)})`}
                              </span>
                            );
                          }
                          if (req) {
                            return (
                              <button
                                key={day}
                                type="button"
                                className="secondary"
                                onClick={() => navigate("/coverage-requests")}
                              >
                                {t.viewRequest} {day.slice(5)}
                              </button>
                            );
                          }
                          return (
                            <button
                              key={day}
                              type="button"
                              className="primary"
                              disabled={previewLoading}
                              onClick={async () => {
                                setPreviewLoading(true);
                                try {
                                  const candidates = await previewCandidates(row.id, day);
                                  setPreviewModal({ absence_id: row.id, shift_date: day, candidates });
                                } finally {
                                  setPreviewLoading(false);
                                }
                              }}
                            >
                              {t.initiate} {day.slice(5)}
                            </button>
                          );
                        });
                      })()}
                      <button type="button" className="secondary" onClick={async () => { const ok = await confirm({ title: "Elimina assenza", message: "Sei sicuro? Verranno rimossi anche eventuali sostituti associati.", confirmLabel: "Elimina" }); if (ok) deleteMutation.mutate(row.id); }}>{c.delete}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
    {previewModal && (
      <CandidatePreviewModal
        shiftDate={previewModal.shift_date}
        candidates={previewModal.candidates}
        isPending={initiateMutation.isPending}
        confirmLabel={t.confirmInitiate}
        cancelLabel={c.cancel ?? "Annulla"}
        subtitleText={t.previewSubtitle}
        noCandidatesText={t.noCandidates}
        onClose={() => setPreviewModal(null)}
        onConfirm={() =>
          initiateMutation.mutate(
            { absence_id: previewModal.absence_id, shift_date: previewModal.shift_date },
            { onSuccess: () => setPreviewModal(null) }
          )
        }
        onAssign={async (employee_id) => {
          const res = await initiateRequest(previewModal.absence_id, previewModal.shift_date);
          await manualAssign(res.request_id, employee_id);
          queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
          queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
        }}
      />
    )}
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
