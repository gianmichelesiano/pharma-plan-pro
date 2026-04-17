import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/PageHeader";
import { useT } from "../../i18n/translations";
import { listEmployees } from "../employees/api";
import { createAbsence, deleteAbsence, listAbsences } from "./api";

const TYPES = ["VACATION", "UNAVAILABLE", "SICK", "SCHOOL", "TRAINING", "HR_MEETING"] as const;

export function AbsencesPage() {
  const t = useT("absences");
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const absences = useQuery({ queryKey: ["absences"], queryFn: listAbsences });
  const employees = useQuery({ queryKey: ["employees-all"], queryFn: () => listEmployees(false) });

  const create = useMutation({
    mutationFn: createAbsence,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["absences"] }); setShowForm(false); },
  });

  const del = useMutation({
    mutationFn: deleteAbsence,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["absences"] }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    create.mutate({
      employee_id: String(fd.get("employee_id")),
      start_date: String(fd.get("start_date")),
      end_date: String(fd.get("end_date")),
      type: String(fd.get("type")) as never,
      status: "approved",
      note: String(fd.get("note")) || null,
    });
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <button onClick={() => setShowForm(true)}>{t.newAbsence}</button>

      {absences.isLoading && <p>{t.loading}</p>}
      <table>
        <thead>
          <tr><th>Employee</th><th>From</th><th>To</th><th>Type</th><th>Note</th><th></th></tr>
        </thead>
        <tbody>
          {absences.data?.map((a) => (
            <tr key={a.id}>
              <td>{a.employees?.display_code} {a.employees?.first_name} {a.employees?.last_name}</td>
              <td>{a.start_date}</td>
              <td>{a.end_date}</td>
              <td>{a.type}</td>
              <td>{a.note ?? ""}</td>
              <td><button onClick={() => del.mutate(a.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <dialog open>
          <form onSubmit={onSubmit}>
            <h3>{t.newAbsence}</h3>
            <label>Employee
              <select name="employee_id" required>
                <option value="">—</option>
                {employees.data?.map((e) => (
                  <option key={e.id} value={e.id}>{e.display_code} — {e.first_name} {e.last_name}</option>
                ))}
              </select>
            </label>
            <label>From <input type="date" name="start_date" required /></label>
            <label>To <input type="date" name="end_date" required /></label>
            <label>Type
              <select name="type" required>
                {TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
            <label>Note <input name="note" /></label>
            <button type="submit" disabled={create.isPending}>{create.isPending ? t.saving : t.save}</button>
            <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </form>
        </dialog>
      )}
    </>
  );
}
