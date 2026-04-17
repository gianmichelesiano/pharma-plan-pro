import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const weekday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export function DashboardPage() {
  const t = useT("dashboard");
  const { start: monthStart, end: monthEnd } = getMonthRange();
  const { start: weekStart, end: weekEnd } = getWeekRange();

  const employeesQuery = useQuery({
    queryKey: ["dashboard-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["dashboard-absences", monthStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("absences")
        .select("id", { count: "exact", head: true })
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["dashboard-shifts", weekStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards">
        <article className="card">
          <p className="eyebrow">{t.minCoverageTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {employeesQuery.isLoading ? "—" : employeesQuery.data}
          </h2>
          <p>{t.minCoverageText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{t.periodTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {absencesQuery.isLoading ? "—" : absencesQuery.data}
          </h2>
          <p>{t.periodText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{t.emergenciesTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {shiftsQuery.isLoading ? "—" : shiftsQuery.data}
          </h2>
          <p>{t.emergenciesText}</p>
        </article>
      </div>
    </section>
  );
}
