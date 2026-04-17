import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../../components/PageHeader";
import { useT } from "../../i18n/translations";
import { createEmployee, listEmployees, toggleEmployeeActive, updateEmployee, type Employee } from "./api";

const ROLES = ["pharmacist", "pha", "apprentice_pha", "driver", "auxiliary"] as const;

export function EmployeesPage() {
  const t = useT("employees");
  const [onlyActive, setOnlyActive] = useState(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const qc = useQueryClient();

  const employees = useQuery({
    queryKey: ["employees", onlyActive],
    queryFn: () => listEmployees(onlyActive),
  });

  const save = useMutation({
    mutationFn: async (form: Partial<Employee> & { id?: string }) => {
      if (form.id) return updateEmployee(form.id, form);
      return createEmployee(form as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditing(null);
    },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleEmployeeActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    save.mutate({
      id: editing?.id,
      display_code: String(fd.get("display_code")),
      first_name: String(fd.get("first_name")),
      last_name: String(fd.get("last_name")),
      email: String(fd.get("email")) || null,
      role: String(fd.get("role")) as Employee["role"],
      weekly_hours_pct: fd.get("weekly_hours_pct") ? Number(fd.get("weekly_hours_pct")) : null,
      active: fd.get("active") === "on",
    });
  }

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <label>
        <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
        {t.filterLabel}
      </label>

      <button onClick={() => setEditing({} as Employee)}>{t.newEmployee}</button>

      {employees.isLoading && <p>{t.loadingEmployees}</p>}
      {employees.error && <p>{t.errorLoading}</p>}

      <table>
        <thead>
          <tr>
            <th>Code</th><th>{t.nameHeader}</th><th>{t.roleHeader}</th><th>%</th><th>{t.statusHeader}</th><th>{t.actionsHeader}</th>
          </tr>
        </thead>
        <tbody>
          {employees.data?.map((emp) => (
            <tr key={emp.id}>
              <td>{emp.display_code}</td>
              <td>{emp.first_name} {emp.last_name}</td>
              <td>{emp.role}</td>
              <td>{emp.weekly_hours_pct ?? "-"}</td>
              <td>{emp.active ? "✓" : "—"}</td>
              <td>
                <button onClick={() => setEditing(emp)}>Edit</button>
                <button onClick={() => toggle.mutate({ id: emp.id, active: !emp.active })}>
                  {emp.active ? "Deactivate" : "Activate"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <dialog open>
          <form onSubmit={onSubmit}>
            <h3>{editing.id ? t.editEmployee : t.newEmployee}</h3>
            <label>Code<input name="display_code" defaultValue={editing.display_code ?? ""} required /></label>
            <label>{t.firstName}<input name="first_name" defaultValue={editing.first_name ?? ""} required /></label>
            <label>{t.lastName}<input name="last_name" defaultValue={editing.last_name ?? ""} required /></label>
            <label>Email<input name="email" type="email" defaultValue={editing.email ?? ""} /></label>
            <label>{t.roleHeader}
              <select name="role" defaultValue={editing.role ?? "pharmacist"}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>% <input name="weekly_hours_pct" type="number" step="0.01" defaultValue={editing.weekly_hours_pct ?? ""} /></label>
            <label><input type="checkbox" name="active" defaultChecked={editing.active ?? true} /> {t.activeLabel}</label>
            <button type="submit" disabled={save.isPending}>{save.isPending ? t.saving : t.create}</button>
            <button type="button" onClick={() => setEditing(null)}>Cancel</button>
          </form>
        </dialog>
      )}
    </>
  );
}
