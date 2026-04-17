import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Pattern = Tables<"weekly_patterns">;

const SLOTS = ["AM", "PM", "FULL"] as const;
const SLOT_TIMES: Record<string, string> = { AM: "08:00-12:15", PM: "13:30-18:30", FULL: "08:00-15:00" };

export function AvailabilityPage() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const t = useT("availability");
  const c = useT("common");

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  useEffect(() => {
    if (selectedEmployeeId === null && employeesQuery.data?.length) {
      setSelectedEmployeeId(employeesQuery.data[0].id);
    }
  }, [employeesQuery.data, selectedEmployeeId]);

  const patternsQuery = useQuery({
    queryKey: ["weekly_patterns", selectedEmployeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("*")
        .eq("employee_id", selectedEmployeeId!);
      if (error) throw error;
      return data as Pattern[];
    },
    enabled: selectedEmployeeId !== null,
  });

  useEffect(() => {
    if (!patternsQuery.data) return;
    const map: Record<string, boolean> = {};
    for (let weekday = 0; weekday < 6; weekday++) {
      for (const slot of SLOTS) {
        map[`${weekday}-${slot}`] = false;
      }
    }
    for (const p of patternsQuery.data) {
      map[`${p.weekday}-${p.slot}`] = p.active;
    }
    setDraft(map);
  }, [patternsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployeeId) throw new Error("No employee selected");
      const { error: delError } = await supabase
        .from("weekly_patterns")
        .delete()
        .eq("employee_id", selectedEmployeeId);
      if (delError) throw delError;
      const rows = Object.entries(draft)
        .filter(([, active]) => active)
        .map(([key]) => {
          const [weekday, slot] = key.split("-");
          return { employee_id: selectedEmployeeId, weekday: Number(weekday), slot, active: true };
        });
      if (rows.length > 0) {
        const { error: insError } = await supabase.from("weekly_patterns").insert(rows);
        if (insError) throw insError;
      }
      queryClient.invalidateQueries({ queryKey: ["weekly_patterns", selectedEmployeeId] });
    },
  });

  const toggleSlot = (weekday: number, slot: string) => {
    setDraft((d) => ({ ...d, [`${weekday}-${slot}`]: !d[`${weekday}-${slot}`] }));
  };

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <label className="field">
            <span>{c.employee}</span>
            <select
              value={selectedEmployeeId ?? ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={employeesQuery.isLoading}
            >
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || patternsQuery.isLoading}>
            {saveMutation.isPending ? t.saving : t.saveAvailability}
          </button>
        </div>

        {saveMutation.isSuccess ? <p>{t.savedSuccess}</p> : null}
        {saveMutation.error ? <p>{t.errorSaving}</p> : null}

        <table className="table availability-table">
          <thead>
            <tr>
              <th>{t.dayHeader}</th>
              {SLOTS.map((s) => <th key={s}>{s} <small style={{ color: "#6f816f", fontWeight: 400 }}>{SLOT_TIMES[s]}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, weekday) => (
              <tr key={weekday}>
                <td>{c.weekdays[weekday]}</td>
                {SLOTS.map((slot) => (
                  <td key={slot}>
                    <label className="availability-toggle">
                      <input
                        type="checkbox"
                        checked={draft[`${weekday}-${slot}`] ?? false}
                        onChange={() => toggleSlot(weekday, slot)}
                      />
                      <span>{draft[`${weekday}-${slot}`] ? c.active : c.inactive}</span>
                    </label>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
