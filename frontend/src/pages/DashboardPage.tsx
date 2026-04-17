import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/translations";

export function DashboardPage() {
  const t = useT("dashboard");

  const counts = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const [emp, abs, sh] = await Promise.all([
        supabase.from("plan_employees").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("plan_absences").select("id", { count: "exact", head: true }),
        supabase.from("plan_shifts").select("id", { count: "exact", head: true }),
      ]);
      return {
        employees: emp.count ?? 0,
        absences: abs.count ?? 0,
        shifts: sh.count ?? 0,
      };
    },
  });

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="card-grid">
        <div className="card"><h3>Active employees</h3><p>{counts.data?.employees ?? "-"}</p></div>
        <div className="card"><h3>Absences</h3><p>{counts.data?.absences ?? "-"}</p></div>
        <div className="card"><h3>Shifts planned</h3><p>{counts.data?.shifts ?? "-"}</p></div>
      </div>
    </>
  );
}
