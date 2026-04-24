import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type CoverageRule = Tables<"coverage_rules">;

const WEEKDAYS = [0, 1, 2, 3, 4, 5] as const;

type DraftRow = { pharmacist: string; other: string };

export function RulesPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<number, DraftRow>>({});
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
    const map: Record<number, DraftRow> = {};
    for (const wd of WEEKDAYS) {
      const pharm = coverageQuery.data.find(
        (r) => r.weekday === wd && r.role === "pharmacist" && r.time_window === "all_day"
      );
      const other = coverageQuery.data.find(
        (r) => r.weekday === wd && r.role === "pha" && r.time_window === "all_day"
      );
      map[wd] = {
        pharmacist: String(pharm?.min_required ?? 0),
        other: String(other?.min_required ?? 0),
      };
    }
    setDraft(map);
  }, [coverageQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows = WEEKDAYS.flatMap((wd) => {
        const d = draft[wd] ?? { pharmacist: "0", other: "0" };
        return [
          { weekday: wd, role: "pharmacist" as const, time_window: "all_day", min_required: Number(d.pharmacist), note: null },
          { weekday: wd, role: "pha" as const,        time_window: "all_day", min_required: Number(d.other),      note: null },
        ];
      });
      const { error } = await supabase
        .from("coverage_rules")
        .upsert(rows, { onConflict: "weekday,role,time_window" });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["coverage_rules"] });
    },
  });

  const updateCell = (wd: number, field: "pharmacist" | "other", value: string) => {
    setDraft((d) => ({
      ...d,
      [wd]: { ...(d[wd] ?? { pharmacist: "0", other: "0" }), [field]: value },
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
        <div className="table-scroll table-responsive-desktop">
          <table className="table rules-table">
            <thead>
              <tr>
                <th>{t.dayHeader}</th>
                <th>{t.pharmacistsHeader}</th>
                <th>{t.operatorsHeader}</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((wd) => (
                <tr key={wd}>
                  <td>{c.weekdaysShort[wd]}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={draft[wd]?.pharmacist ?? "0"}
                      onChange={(e) => updateCell(wd, "pharmacist", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={draft[wd]?.other ?? "0"}
                      onChange={(e) => updateCell(wd, "other", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-card-list">
          {WEEKDAYS.map((wd) => (
            <article key={wd} className="mobile-card">
              <div className="mobile-card-head">
                <div>
                  <h3 className="mobile-card-title">{c.weekdaysShort[wd]}</h3>
                </div>
              </div>
              <div className="mobile-card-grid">
                <label className="field">
                  <span>{t.pharmacistsHeader}</span>
                  <input
                    type="number"
                    min="0"
                    value={draft[wd]?.pharmacist ?? "0"}
                    onChange={(e) => updateCell(wd, "pharmacist", e.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{t.operatorsHeader}</span>
                  <input
                    type="number"
                    min="0"
                    value={draft[wd]?.other ?? "0"}
                    onChange={(e) => updateCell(wd, "other", e.target.value)}
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
