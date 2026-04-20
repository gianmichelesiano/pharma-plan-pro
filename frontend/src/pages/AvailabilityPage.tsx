import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Pattern = Tables<"weekly_patterns">;

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function AvailabilityPage() {
  const queryClient = useQueryClient();
  const t = useT("availability");

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
    queryKey: ["weekly_patterns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("*");
      if (error) throw error;
      return data as Pattern[];
    },
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
          { employee_id, weekday, active },
          { onConflict: "employee_id,weekday" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly_patterns"] });
    },
  });

  const employees = employeesQuery.data ?? [];
  const patterns = patternsQuery.data ?? [];

  // Build map: "employeeId-weekday" -> active
  const map: Record<string, boolean> = {};
  patterns.forEach((p) => {
    map[`${p.employee_id}-${String(p.weekday)}`] = p.active;
  });

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
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
                  return (
                    <td key={weekday}>
                      <input
                        type="checkbox"
                        checked={!!map[key]}
                        disabled={upsertMutation.isPending}
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
