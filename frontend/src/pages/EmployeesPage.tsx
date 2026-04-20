import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables, TablesInsert } from "../lib/database.types";

type Employee = Tables<"employees">;

type EmployeeForm = {
  first_name: string;
  last_name: string;
  display_code: string;
  email: string;
  phone: string;
  role: Employee["role"];
  weekly_hours_pct: string;
  active: boolean;
};

const initialForm: EmployeeForm = {
  first_name: "",
  last_name: "",
  display_code: "",
  email: "",
  phone: "",
  role: "pha",
  weekly_hours_pct: "100",
  active: true,
};

const ROLES: Employee["role"][] = ["pharmacist", "pha", "apprentice_pha", "driver", "auxiliary"];

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EmployeeForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const t = useT("employees");
  const c = useT("common");

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const resetForm = () => { setForm(initialForm); setEditingId(null); };

  const createMutation = useMutation({
    mutationFn: async (payload: TablesInsert<"employees">) => {
      const { error } = await supabase.from("employees").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Employee> }) => {
      const { error } = await supabase.from("employees").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); resetForm(); },
  });

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      display_code: form.display_code.trim() || (form.first_name.slice(0, 2).toUpperCase() + form.last_name.slice(0, 2).toUpperCase()),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      role: form.role,
      weekly_hours_pct: Number(form.weekly_hours_pct),
      active: form.active,
      employment_status: "active" as const,
    };
    if (editingId === null) { createMutation.mutate(payload); return; }
    updateMutation.mutate({ id: editingId, payload });
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      first_name: emp.first_name,
      last_name: emp.last_name,
      display_code: emp.display_code,
      email: (emp as any).email ?? "",
      phone: (emp as any).phone ?? "",
      role: emp.role,
      weekly_hours_pct: String(emp.weekly_hours_pct ?? 100),
      active: emp.active,
    });
  };

  const filteredEmployees = useMemo(() => {
    const items = [...(data ?? [])].sort((a, b) => a.first_name.localeCompare(b.first_name));
    return filter === "active" ? items.filter((e) => e.active) : items;
  }, [data, filter]);

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards two-columns">
        <div className="card">
          <h3>{editingId === null ? t.newEmployee : t.editEmployee}</h3>
          <form className="form-grid" onSubmit={submitForm}>
            <label className="field">
              <span>{t.firstName}</span>
              <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.lastName}</span>
              <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.displayCode}</span>
              <input value={form.display_code} onChange={(e) => setForm((f) => ({ ...f, display_code: e.target.value }))} placeholder="Es. MA-BI" />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label className="field">
              <span>Telefono</span>
              <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
            <label className="field">
              <span>{c.role}</span>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))}>
                {ROLES.map((r) => <option key={r} value={r}>{(c as unknown as Record<string, string>)[`role_${r}`] ?? r}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t.weeklyHoursPct}</span>
              <input type="number" min="0" max="100" value={form.weekly_hours_pct} onChange={(e) => setForm((f) => ({ ...f, weekly_hours_pct: e.target.value }))} required />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <span>{t.activeLabel}</span>
            </label>
            <div className="toolbar">
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId === null ? (createMutation.isPending ? t.creating : t.create) : (updateMutation.isPending ? t.saving : c.save)}
              </button>
              {editingId !== null ? <button type="button" className="secondary" onClick={resetForm}>{c.cancel}</button> : null}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{t.filterLabel}</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value as "active" | "all")}>
                <option value="active">{c.filterActive}</option>
                <option value="all">{c.filterAll}</option>
              </select>
            </label>
          </div>
          {isLoading ? <p>{t.loadingEmployees}</p> : null}
          {error ? <p>{t.errorLoading}</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>{t.nameHeader}</th>
                <th>Email</th>
                <th>Tel</th>
                <th>{t.roleHeader}</th>
                <th>%</th>
                <th>{t.statusHeader}</th>
                <th>{t.actionsHeader}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.first_name} {emp.last_name} <small style={{ color: "#6f816f" }}>({emp.display_code})</small></td>
                  <td>{(emp as any).email ?? "—"}</td>
                  <td>{(emp as any).phone ?? "—"}</td>
                  <td>{(c as unknown as Record<string, string>)[`role_${emp.role}`] ?? emp.role}</td>
                  <td>{emp.weekly_hours_pct ?? "—"}</td>
                  <td><span className={emp.active ? "status-badge active" : "status-badge inactive"}>{emp.active ? c.active : c.inactive}</span></td>
                  <td><div className="table-actions"><button type="button" className="secondary" onClick={() => startEdit(emp)}>{c.modify}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
