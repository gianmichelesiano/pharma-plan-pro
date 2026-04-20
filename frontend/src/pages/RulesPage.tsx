import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Database, Tables } from "../lib/database.types";

type CoverageRule = Tables<"coverage_rules">;
type EmployeeRole = Database["public"]["Enums"]["employee_role"];

type RuleDraft = {
  id?: string;
  weekday: number;
  role: string;
  time_window: string;
  min_required: number;
  note: string | null;
  _deleted?: boolean;
  _dirty?: boolean;
};

const ROLES = ["pharmacist", "pha", "apprentice_pha", "driver", "auxiliary"] as const;

function newDraft(): RuleDraft {
  return {
    weekday: 0,
    role: "pharmacist",
    time_window: "all_day",
    min_required: 1,
    note: null,
    _dirty: true,
  };
}

function rowKey(draft: RuleDraft, index: number): string {
  return draft.id ?? `new-${index}`;
}

export function RulesPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<RuleDraft[]>([]);
  const t = useT("rules");
  const c = useT("common");

  const coverageQuery = useQuery({
    queryKey: ["coverage_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coverage_rules")
        .select("*")
        .order("weekday")
        .order("role");
      if (error) throw error;
      return data as CoverageRule[];
    },
  });

  useEffect(() => {
    if (!coverageQuery.data) return;
    setDrafts(
      coverageQuery.data.map((row) => ({
        id: row.id,
        weekday: row.weekday,
        role: row.role,
        time_window: row.time_window,
        min_required: row.min_required,
        note: row.note ?? null,
        _dirty: false,
        _deleted: false,
      }))
    );
  }, [coverageQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Deletes
      const toDelete = drafts.filter((d) => d._deleted && d.id);
      for (const d of toDelete) {
        const { error } = await supabase
          .from("coverage_rules")
          .delete()
          .eq("id", d.id!);
        if (error) throw error;
      }

      // Updates
      const toUpdate = drafts.filter((d) => !d._deleted && d._dirty && d.id);
      for (const d of toUpdate) {
        const { error } = await supabase
          .from("coverage_rules")
          .update({
            weekday: d.weekday,
            role: d.role as EmployeeRole,
            time_window: d.time_window,
            min_required: d.min_required,
            note: d.note,
          })
          .eq("id", d.id!);
        if (error) throw error;
      }

      // Inserts
      const toInsert = drafts.filter((d) => !d._deleted && !d.id);
      if (toInsert.length > 0) {
        const { error } = await supabase.from("coverage_rules").insert(
          toInsert.map((d) => ({
            weekday: d.weekday,
            role: d.role as EmployeeRole,
            time_window: d.time_window,
            min_required: d.min_required,
            note: d.note,
          }))
        );
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["coverage_rules"] });
    },
  });

  function updateDraft(index: number, patch: Partial<RuleDraft>) {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch, _dirty: true };
      return next;
    });
  }

  function deleteRow(index: number) {
    setDrafts((prev) => {
      const row = prev[index];
      if (row.id) {
        const next = [...prev];
        next[index] = { ...row, _deleted: true };
        return next;
      }
      // No id: just drop it
      return prev.filter((_, i) => i !== index);
    });
  }

  function addRow() {
    setDrafts((prev) => [...prev, newDraft()]);
  }

  const visible = drafts.filter((d) => !d._deleted);

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
          <button type="button" onClick={addRow} disabled={saveMutation.isPending}>
            Add rule
          </button>
        </div>
        {coverageQuery.isLoading ? <p>{t.loadingRules}</p> : null}
        {saveMutation.isSuccess ? <p>{t.savedSuccess}</p> : null}
        {saveMutation.error ? <p>{t.errorSaving}</p> : null}
        <table className="table rules-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Role</th>
              <th>Time window</th>
              <th>Min required</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((draft) => {
              // Map visible index back to drafts index
              const draftIdx = drafts.indexOf(draft);
              return (
                <tr key={rowKey(draft, draftIdx)}>
                  <td>
                    <select
                      value={draft.weekday}
                      onChange={(e) =>
                        updateDraft(draftIdx, { weekday: Number(e.target.value) })
                      }
                    >
                      {c.weekdaysShort.map((label, i) => (
                        <option key={i} value={i}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={draft.role}
                      onChange={(e) => updateDraft(draftIdx, { role: e.target.value })}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={draft.time_window}
                      onChange={(e) =>
                        updateDraft(draftIdx, { time_window: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      value={draft.min_required}
                      onChange={(e) =>
                        updateDraft(draftIdx, { min_required: Number(e.target.value) })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={draft.note ?? ""}
                      onChange={(e) =>
                        updateDraft(draftIdx, {
                          note: e.target.value || null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => deleteRow(draftIdx)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && !coverageQuery.isLoading ? (
          <p style={{ padding: "1rem" }}>No rules. Click "Add rule" to create one.</p>
        ) : null}
      </div>
    </section>
  );
}
