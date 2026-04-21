import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Pattern = Tables<"weekly_patterns">;
type PatternType = "standard" | "accessory";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AvailabilityPage() {
  const queryClient = useQueryClient();
  const t = useT("availability");
  const [patternType, setPatternType] = useState<PatternType>("standard");

  const employeesQuery = useQuery({
    queryKey: ["employees"],
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

  const patternsQuery = useQuery({
    queryKey: ["weekly_patterns", patternType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("*")
        .eq("pattern_type", patternType);
      if (error) throw error;
      return data as Pattern[];
    },
  });

  const standardPatternsQuery = useQuery({
    queryKey: ["weekly_patterns", "standard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("*")
        .eq("pattern_type", "standard");
      if (error) throw error;
      return data as Pattern[];
    },
    enabled: patternType === "accessory",
  });

  const upsertMutation = useMutation({
    mutationFn: async ({
      employee_id,
      weekday,
      active,
    }: {
      employee_id: string;
      weekday: number;
      active: boolean;
    }) => {
      const { error } = await supabase
        .from("weekly_patterns")
        .upsert(
          { employee_id, weekday, active, pattern_type: patternType },
          { onConflict: "employee_id,weekday,pattern_type" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly_patterns", patternType] });
    },
  });

  const employees = employeesQuery.data ?? [];
  const patterns = patternsQuery.data ?? [];

  const map: Record<string, boolean> = {};
  patterns.forEach((p) => {
    map[`${p.employee_id}-${String(p.weekday)}`] = p.active;
  });

  // Standard days shown as locked in accessory tab
  const standardMap: Record<string, boolean> = {};
  (standardPatternsQuery.data ?? []).forEach((p) => {
    standardMap[`${p.employee_id}-${String(p.weekday)}`] = p.active;
  });

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <button
            className={patternType === "standard" ? "primary" : "secondary"}
            onClick={() => setPatternType("standard")}
          >
            {t.tabStandard}
          </button>
          <button
            className={patternType === "accessory" ? "primary" : "secondary"}
            onClick={() => setPatternType("accessory")}
          >
            {t.tabAccessory}
          </button>
        </div>

        {upsertMutation.error ? <p className="error">{t.errorSaving}</p> : null}

        <table className="table availability-table">
          <thead>
            <tr>
              <th>Employee</th>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  {emp.first_name} {emp.last_name}
                </td>
                {WEEKDAYS.map((weekday) => {
                  const key = `${emp.id}-${String(weekday)}`;
                  const isStandard = patternType === "accessory" && !!standardMap[key];
                  return (
                    <td key={weekday}>
                      <input
                        type="checkbox"
                        checked={isStandard || !!map[key]}
                        disabled={isStandard || upsertMutation.isPending}
                        title={isStandard ? "Già in disponibilità standard" : undefined}
                        onChange={(e) =>
                          upsertMutation.mutate({
                            employee_id: emp.id,
                            weekday,
                            active: e.target.checked,
                          })
                        }
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
