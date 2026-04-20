import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type CoverageRule = Tables<"coverage_rules">;

const SLOT_DEFS = [
  { weekday: 0, label: "Mon" },
  { weekday: 1, label: "Tue" },
  { weekday: 2, label: "Wed" },
  { weekday: 3, label: "Thu" },
  { weekday: 4, label: "Fri" },
  { weekday: 5, label: "Sat" },
];

type DraftRow = { pharmacist: string; operator: string };

export function RulesPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const t = useT("rules");
  const c = useT("common");

  const coverageQuery = useQuery({
    queryKey: ["coverage_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coverage_rules").select("*");
      if (error) throw error;
      return data as CoverageRule[];
    },
  });

  useEffect(() => {
    if (!coverageQuery.data) return;
    const map: Record<string, DraftRow> = {};
    for (const def of SLOT_DEFS) {
      const key = String(def.weekday);
      const pharmRow = coverageQuery.data.find(
        (r) => r.weekday === def.weekday && r.role === "pharmacist"
      );
      const opRow = coverageQuery.data.find(
        (r) => r.weekday === def.weekday && r.role !== "pharmacist"
      );
      map[key] = {
        pharmacist: String(pharmRow?.min_required ?? 1),
        operator: String(opRow?.min_required ?? 3),
      };
    }
    setDraft(map);
  }, [coverageQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows: Omit<CoverageRule, "id">[] = [];
      for (const def of SLOT_DEFS) {
        const key = String(def.weekday);
        const d = draft[key] ?? { pharmacist: "1", operator: "3" };
        rows.push({
          weekday: def.weekday,
          role: "pharmacist",
          min_required: Number(d.pharmacist),
          time_window: "",
          note: null,
        });
        rows.push({
          weekday: def.weekday,
          role: "pha",
          min_required: Number(d.operator),
          time_window: "",
          note: null,
        });
      }
      const { error } = await supabase
        .from("coverage_rules")
        .upsert(rows, { onConflict: "weekday,role" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["coverage_rules"] });
    },
  });

  const updateCell = (key: string, field: "pharmacist" | "operator", value: string) => {
    setDraft((d) => ({
      ...d,
      [key]: { ...(d[key] ?? { pharmacist: "1", operator: "3" }), [field]: value },
    }));
  };

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || coverageQuery.isLoading}
          >
            {saveMutation.isPending ? t.savingRules : t.saveRules}
          </button>
        </div>
        {coverageQuery.isLoading ? <p>{t.loadingRules}</p> : null}
        {saveMutation.isSuccess ? <p>{t.savedSuccess}</p> : null}
        {saveMutation.error ? <p>{t.errorSaving}</p> : null}
        <table className="table rules-table">
          <thead>
            <tr>
              <th>{t.dayHeader}</th>
              <th>{t.pharmacistsHeader}</th>
              <th>{t.operatorsHeader}</th>
            </tr>
          </thead>
          <tbody>
            {SLOT_DEFS.map((def) => {
              const key = String(def.weekday);
              return (
                <tr key={key}>
                  <td>{c.weekdaysShort[def.weekday]}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={draft[key]?.pharmacist ?? "1"}
                      onChange={(e) => updateCell(key, "pharmacist", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={draft[key]?.operator ?? "3"}
                      onChange={(e) => updateCell(key, "operator", e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
