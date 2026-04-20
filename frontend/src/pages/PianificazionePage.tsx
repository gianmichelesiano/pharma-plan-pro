import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { CoverageBadges, hasCritical } from "../components/CoverageBadges";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import { useCoverageIssues, issuesByDate } from "../lib/coverage";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;

type ShiftRow = Tables<"shifts"> & { employee?: Pick<Employee, "id" | "first_name" | "last_name" | "display_code" | "role"> };

function monthBounds(year: number, month: number): { start: string; end: string } {
  const s = new Date(Date.UTC(year, month - 1, 1));
  const e = new Date(Date.UTC(year, month, 0));
  return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10) };
}

function daysInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function PianificazionePage() {
  const t = useT("planning");
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const { start, end } = monthBounds(year, month);

  const employeesQuery = useQuery({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("active", true)
        .order("first_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, employee:employees(id, first_name, last_name, display_code, role)")
        .gte("shift_date", start)
        .lte("shift_date", end);
      if (error) throw error;
      return data as ShiftRow[];
    },
  });

  const issuesQuery = useCoverageIssues(start, end);

  const generate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("planning-engine", {
        body: { action: "generate", year, month },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", start, end] });
      queryClient.invalidateQueries({ queryKey: ["coverage_issues", start, end] });
    },
  });

  const days = useMemo(() => daysInRange(start, end), [start, end]);
  const issuesMap = useMemo(() => issuesByDate(issuesQuery.data ?? []), [issuesQuery.data]);

  const shiftsByDateEmp = useMemo(() => {
    const m = new Map<string, ShiftRow>();
    for (const s of shiftsQuery.data ?? []) {
      m.set(`${s.shift_date}|${s.employee_id}`, s);
    }
    return m;
  }, [shiftsQuery.data]);

  const conflictsByDateEmp = useMemo(() => {
    const s = new Set<string>();
    for (const i of issuesQuery.data ?? []) {
      if (i.kind === "conflict" && i.employee_id) s.add(`${i.issue_date}|${i.employee_id}`);
    }
    return s;
  }, [issuesQuery.data]);

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <label>
            {t.year}
            <input
              type="number"
              value={year}
              min={2025}
              max={2030}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label>
            {t.month}
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
          >
            {generate.isPending ? t.generating : t.generate}
          </button>
          {generate.error ? <span className="error">{String(generate.error)}</span> : null}
        </div>

        <div className="plan-grid-wrap">
          <table className="table plan-grid">
            <thead>
              <tr>
                <th>{t.employee}</th>
                {days.map((d) => {
                  const dayIssues = issuesMap.get(d) ?? [];
                  const critical = hasCritical(dayIssues);
                  return (
                    <th key={d} className={critical ? "day-has-critical" : ""}>
                      <div>{d.slice(8)}</div>
                      <CoverageBadges issues={dayIssues} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(employeesQuery.data ?? []).map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.first_name} {emp.last_name}</td>
                  {days.map((d) => {
                    const key = `${d}|${emp.id}`;
                    const s = shiftsByDateEmp.get(key);
                    const conflict = conflictsByDateEmp.has(key);
                    if (!s) return <td key={d}></td>;
                    const cls = ["shift-cell"];
                    if (s.source === "generated") cls.push("is-generated");
                    if (conflict) cls.push("is-conflict");
                    return (
                      <td key={d}>
                        <span className={cls.join(" ")}>{emp.display_code}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
