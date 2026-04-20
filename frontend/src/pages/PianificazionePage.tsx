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

function formatDateLabel(dateStr: string): string {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, da));
  const label = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isWeekend(dateStr: string): boolean {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
  return dow === 0 || dow === 6;
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
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
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
                <th className="date-cell">Data</th>
                {employees.map((emp) => (
                  <th key={emp.id}>{emp.display_code ?? emp.first_name}</th>
                ))}
                <th className="totals-cell">Total</th>
                <th className="totals-cell">Bedien</th>
                <th className="totals-cell">PhA&apos;s</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dayIssues = issuesMap.get(day) ?? [];
                const critical = hasCritical(dayIssues);
                const weekend = isWeekend(day);

                // compute totals for this day
                let total = 0;
                let bedien = 0;
                let pharm = 0;
                for (const emp of employees) {
                  const key = `${day}|${emp.id}`;
                  if (shiftsByDateEmp.has(key)) {
                    total++;
                    if (emp.role === "pharmacist") {
                      pharm++;
                    } else {
                      bedien++;
                    }
                  }
                }

                return (
                  <tr key={day} className={weekend ? "weekend-row" : undefined}>
                    <td className={`date-cell${critical ? " day-has-critical" : ""}`}>
                      {formatDateLabel(day)}
                      {dayIssues.length > 0 && (
                        <span style={{ marginLeft: "0.5rem" }}>
                          <CoverageBadges issues={dayIssues} />
                        </span>
                      )}
                    </td>
                    {employees.map((emp) => {
                      const key = `${day}|${emp.id}`;
                      const s = shiftsByDateEmp.get(key);
                      const conflict = conflictsByDateEmp.has(key);
                      if (!s) return <td key={emp.id}></td>;
                      const cls = ["shift-cell"];
                      if (s.source === "generated") cls.push("is-generated");
                      if (conflict) cls.push("is-conflict");
                      return (
                        <td key={emp.id}>
                          <span className={cls.join(" ")}>✓</span>
                        </td>
                      );
                    })}
                    <td className="totals-cell">{total}</td>
                    <td className="totals-cell">{bedien}</td>
                    <td className="totals-cell">{pharm}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
