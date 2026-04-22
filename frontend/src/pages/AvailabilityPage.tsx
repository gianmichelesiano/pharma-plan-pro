import { useMemo, useState } from "react";
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
  const c = useT("common");
  const [patternType, setPatternType] = useState<PatternType>("standard");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});

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
      special_note,
    }: {
      employee_id: string;
      weekday: number;
      active: boolean;
      special_note?: string | null;
    }) => {
      const { error } = await supabase
        .from("weekly_patterns")
        .upsert(
          {
            employee_id,
            weekday,
            active,
            pattern_type: patternType,
            special_note: special_note ?? null,
          },
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

  const patternMap = useMemo(() => {
    const m = new Map<string, Pattern>();
    patterns.forEach((p) => {
      m.set(`${p.employee_id}-${String(p.weekday)}`, p);
    });
    return m;
  }, [patterns]);

  // Standard days shown as locked in accessory tab
  const standardMap: Record<string, boolean> = {};
  (standardPatternsQuery.data ?? []).forEach((p) => {
    standardMap[`${p.employee_id}-${String(p.weekday)}`] = p.active;
  });

  const saveNote = (employeeId: string, weekday: number, note: string) => {
    upsertMutation.mutate({
      employee_id: employeeId,
      weekday,
      active: true,
      special_note: note.trim() ? note.trim() : null,
    });
  };

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
                  const pattern = patternMap.get(key);
                  const available = isStandard || !!pattern?.active;
                  const noteValue = draftNotes[key] ?? pattern?.special_note ?? "";
                  const noteOpen = !!openNotes[key];
                  const savedNote = pattern?.special_note ?? "";
                  const hasSavedNote = Boolean(savedNote.trim());
                  return (
                    <td key={weekday}>
                      <div className="availability-cell">
                        <div className="availability-inline-row">
                          <label className="availability-active">
                            <input
                              type="checkbox"
                              checked={available}
                              disabled={isStandard || upsertMutation.isPending}
                              title={isStandard ? "Già in disponibilità standard" : undefined}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                if (!checked) {
                                  setDraftNotes((prev) => ({ ...prev, [key]: "" }));
                                  setOpenNotes((prev) => ({ ...prev, [key]: false }));
                                }
                                upsertMutation.mutate({
                                  employee_id: emp.id,
                                  weekday,
                                  active: checked,
                                  special_note: checked ? (noteValue.trim() || null) : null,
                                });
                              }}
                            />
                          </label>
                          {available && !isStandard && (
                            <div className="availability-special availability-special-inline">
                              {!hasSavedNote && !noteOpen && (
                                <button
                                  type="button"
                                  className="secondary availability-note-btn"
                                  disabled={upsertMutation.isPending}
                                  onClick={() => {
                                    setDraftNotes((prev) => ({
                                      ...prev,
                                      [key]: prev[key] ?? pattern?.special_note ?? "",
                                    }));
                                    setOpenNotes((prev) => ({ ...prev, [key]: true }));
                                  }}
                                >
                                  {t.noteButton}
                                </button>
                              )}
                              {!noteOpen && hasSavedNote && (
                                <div className="availability-note-inline-actions">
                                  <button
                                    type="button"
                                    className="secondary availability-note-inline-btn"
                                    disabled={upsertMutation.isPending}
                                    onClick={() => {
                                      setDraftNotes((prev) => ({
                                        ...prev,
                                        [key]: savedNote,
                                      }));
                                      setOpenNotes((prev) => ({ ...prev, [key]: true }));
                                    }}
                                  >
                                    {c.modify}
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary availability-note-inline-btn danger"
                                    disabled={upsertMutation.isPending}
                                    onClick={() => {
                                      setDraftNotes((prev) => ({ ...prev, [key]: "" }));
                                      upsertMutation.mutate({
                                        employee_id: emp.id,
                                        weekday,
                                        active: true,
                                        special_note: null,
                                      });
                                    }}
                                  >
                                    {c.delete}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        {available && !isStandard && (
                          <div className="availability-special">
                            {noteOpen && (
                              <div className="availability-note-pop">
                                <textarea
                                  className="availability-note-text"
                                  rows={3}
                                  value={noteValue}
                                  placeholder={t.notePlaceholder}
                                  disabled={upsertMutation.isPending}
                                  onChange={(e) =>
                                    setDraftNotes((prev) => ({
                                      ...prev,
                                      [key]: e.target.value,
                                    }))
                                  }
                                />
                                <div className="availability-note-actions">
                                  <button
                                    type="button"
                                    className="primary availability-note-save"
                                    disabled={upsertMutation.isPending}
                                    onClick={() => {
                                      saveNote(emp.id, weekday, noteValue);
                                      setOpenNotes((prev) => ({ ...prev, [key]: false }));
                                    }}
                                  >
                                    {c.save}
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary availability-note-cancel"
                                    disabled={upsertMutation.isPending}
                                    onClick={() => {
                                      setDraftNotes((prev) => ({
                                        ...prev,
                                        [key]: pattern?.special_note ?? "",
                                      }));
                                      setOpenNotes((prev) => ({ ...prev, [key]: false }));
                                    }}
                                  >
                                    {c.cancel}
                                  </button>
                                </div>
                              </div>
                            )}
                            {!noteOpen && hasSavedNote && (
                              <div className="availability-note-preview-wrap">
                                <div className="availability-note-preview">{savedNote}</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
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
