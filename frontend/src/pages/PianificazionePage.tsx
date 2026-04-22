import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { CoverageBadges, hasCritical } from "../components/CoverageBadges";
import { useT } from "../i18n/useT";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { supabase } from "../lib/supabase";
import { useCoverageIssues, issuesByDate } from "../lib/coverage";
import type { Tables } from "../lib/database.types";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useConfirm } from "../hooks/useConfirm";

type Employee = Tables<"employees">;

type ShiftRow = Tables<"shifts"> & { employee?: Pick<Employee, "id" | "first_name" | "last_name" | "display_code" | "role"> };
type WeeklyPatternNoteRow = Pick<Tables<"weekly_patterns">, "employee_id" | "weekday" | "special_note" | "pattern_type"> & {
  employee?: Pick<Employee, "display_code"> | null;
};
type DailyPlanningNoteRow = Pick<Tables<"daily_notes">, "id" | "note_date" | "text" | "title">;
const PLANNING_NOTE_TITLE = "planning_note";

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

function formatDateLabel(dateStr: string, lang: string): string {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, mo - 1, da));
  const locale = { it: "it-IT", en: "en-GB", de: "de-DE", fr: "fr-FR" }[lang] ?? "en-GB";
  const label = new Intl.DateTimeFormat(locale, {
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
  const c = useT("common");
  const coverageT = useT("coverage");
  const { isAdmin } = useAuth();
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const { confirmState, confirm, cancel } = useConfirm();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [draftDailyNotes, setDraftDailyNotes] = useState<Record<string, string>>({});
  const [openNoteDate, setOpenNoteDate] = useState<string | null>(null);
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
  const absencesQuery = useQuery({
    queryKey: ["planning-absences", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("employee_id, start_date, end_date, status")
        .lte("start_date", end)
        .gte("end_date", start)
        .not("status", "eq", "rejected");
      if (error) throw error;
      return data as Pick<Tables<"absences">, "employee_id" | "start_date" | "end_date" | "status">[];
    },
  });
  const patternNotesQuery = useQuery({
    queryKey: ["planning-pattern-notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("employee_id, weekday, special_note, pattern_type, employee:employees(display_code)")
        .eq("active", true)
        .not("special_note", "is", null);
      if (error) throw error;
      return data as WeeklyPatternNoteRow[];
    },
  });
  const dailyNotesQuery = useQuery({
    queryKey: ["planning-daily-notes", start, end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_notes")
        .select("id, note_date, text, title")
        .eq("title", PLANNING_NOTE_TITLE)
        .gte("note_date", start)
        .lte("note_date", end)
        .order("note_date");
      if (error) throw error;
      return data as DailyPlanningNoteRow[];
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
  const clearMonthPlan = useMutation({
    mutationFn: async () => {
      const { error: covErr } = await supabase
        .from("coverage_requests")
        .delete()
        .gte("shift_date", start)
        .lte("shift_date", end);
      if (covErr) throw covErr;

      const { error } = await supabase
        .from("shifts")
        .delete()
        .gte("shift_date", start)
        .lte("shift_date", end);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts", start, end] });
      queryClient.invalidateQueries({ queryKey: ["coverage_issues", start, end] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
      queryClient.invalidateQueries({ queryKey: ["coverage_requests_all"] });
    },
  });
  const saveDailyNote = useMutation({
    mutationFn: async ({ date, text }: { date: string; text: string }) => {
      const trimmed = text.trim();
      const existing = (dailyNotesQuery.data ?? []).find((row) => row.note_date === date);

      if (!trimmed) {
        if (!existing) return;
        const { error } = await supabase.from("daily_notes").delete().eq("id", existing.id);
        if (error) throw error;
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from("daily_notes")
          .update({ text: trimmed })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from("daily_notes").insert({
        note_date: date,
        title: PLANNING_NOTE_TITLE,
        text: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning-daily-notes", start, end] });
    },
  });

  const days = useMemo(() => daysInRange(start, end), [start, end]);
  const employees = useMemo(
    () => [...(employeesQuery.data ?? [])].sort((a, b) => {
      const ap = a.role === "pharmacist" ? 0 : 1;
      const bp = b.role === "pharmacist" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.first_name.localeCompare(b.first_name);
    }),
    [employeesQuery.data],
  );
  const hasBedienerField = useMemo(
    () => (employeesQuery.data ?? []).some((emp) => (emp as any).bediener !== undefined && (emp as any).bediener !== null),
    [employeesQuery.data],
  );
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
  const hasGeneratedPlan = useMemo(
    () => (shiftsQuery.data ?? []).some((s) => s.source === "generated"),
    [shiftsQuery.data],
  );
  const absencesByDateEmp = useMemo(() => {
    const s = new Set<string>();
    for (const a of absencesQuery.data ?? []) {
      const startDate = new Date(`${a.start_date}T12:00:00`);
      const endDate = new Date(`${a.end_date}T12:00:00`);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (day >= start && day <= end) s.add(`${day}|${a.employee_id}`);
      }
    }
    return s;
  }, [absencesQuery.data, start, end]);
  const notesByWeekday = useMemo(() => {
    const map = new Map<number, string[]>();
    const seen = new Set<string>();
    for (const row of patternNotesQuery.data ?? []) {
      const note = row.special_note?.trim();
      if (!note) continue;
      const code = row.employee?.display_code?.trim() || "—";
      const key = `${row.weekday}|${row.employee_id}|${note}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = map.get(row.weekday) ?? [];
      existing.push(`${code} ${note}`);
      map.set(row.weekday, existing);
    }
    return map;
  }, [patternNotesQuery.data]);
  const manualNotesByDate = useMemo(() => {
    const map = new Map<string, DailyPlanningNoteRow>();
    for (const row of dailyNotesQuery.data ?? []) {
      if (!map.has(row.note_date)) map.set(row.note_date, row);
    }
    return map;
  }, [dailyNotesQuery.data]);

  return (
    <>
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
          {isAdmin && !hasGeneratedPlan && (
            <button
              className="primary"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? t.generating : t.generate}
            </button>
          )}
          {isAdmin && hasGeneratedPlan && (
            <button
              className="secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: "Cancella piano",
                  message: "Questa azione cancellerà il piano del mese selezionato e tutti i relativi shift. Vuoi continuare?",
                  confirmLabel: "Cancella piano",
                });
                if (!ok) return;
                clearMonthPlan.mutate();
              }}
              disabled={clearMonthPlan.isPending}
            >
              {clearMonthPlan.isPending ? "Cancellazione..." : "Cancella piano"}
            </button>
          )}
          {isAdmin && generate.error ? <span className="error">{String(generate.error)}</span> : null}
          {isAdmin && clearMonthPlan.error ? <span className="error">{String(clearMonthPlan.error)}</span> : null}
        </div>

        <div className="plan-grid-wrap">
          <table className="table plan-grid">
            <thead>
              <tr>
                <th className="date-cell">Data</th>
                {employees.map((emp) => (
                  <th key={emp.id}>{emp.display_code ?? "—"}</th>
                ))}
                <th className="totals-cell">Total</th>
                <th className="totals-cell">{t.bedienerHeader}</th>
                <th className="totals-cell">PhA&apos;s</th>
                <th className="notes-cell">{t.plannedNotesHeader}</th>
                <th className="notes-cell">{t.dailyNotesHeader}</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => {
                const dayIssues = issuesMap.get(day) ?? [];
                const critical = hasCritical(dayIssues);
                const weekend = isWeekend(day);
                const weekday = weekdayMon0(day);
                const dayNotes = notesByWeekday.get(weekday) ?? [];
                const manualNote = manualNotesByDate.get(day)?.text ?? "";
                const hasManualNote = Boolean(manualNote.trim());

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
                    }
                    if (hasBedienerField ? Boolean((emp as any).bediener) : true) {
                      bedien++;
                    }
                  }
                }

                return (
                  <tr key={day} className={weekend ? "weekend-row" : undefined}>
                    <td className={`date-cell${critical ? " day-has-critical" : ""}`}>
                      {formatDateLabel(day, lang)}
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
                      const absent = absencesByDateEmp.has(key);
                      if (!s && !absent) return <td key={emp.id}></td>;
                      const cls = ["shift-cell"];
                      if (s?.source === "generated") cls.push("is-generated");
                      if (s?.source === "substitute") cls.push("is-substitute");
                      if (conflict) cls.push("is-conflict");
                      if (absent) cls.push("is-absence");
                      return (
                        <td key={emp.id}>
                          <span className="plan-cell-stack">
                            {s ? <span className={cls.join(" ")}>✓</span> : null}
                            {absent ? <span className="plan-absence-badge" title={coverageT.absentEmployee}>A</span> : null}
                          </span>
                        </td>
                      );
                    })}
                    <td className="totals-cell">{total}</td>
                    <td className="totals-cell">{bedien}</td>
                    <td className="totals-cell">{pharm}</td>
                    <td className="notes-cell">
                      {dayNotes.length > 0 ? <div className="planning-note-preview-inline">{dayNotes.join(" · ")}</div> : null}
                    </td>
                    <td className="notes-cell">
                      {manualNote ? <div className="planning-note-preview-inline">{manualNote}</div> : null}
                      <button
                        type="button"
                        className={`secondary planning-note-trigger${hasManualNote ? " has-content" : ""}`}
                        onClick={() => {
                          setDraftDailyNotes((prev) => ({
                            ...prev,
                            [day]: prev[day] ?? manualNote,
                          }));
                          setOpenNoteDate(day);
                        }}
                        title={t.dailyNotesHeader}
                      >
                        {hasManualNote ? t.dailyNotesHeader : "+"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th className="date-cell">Data</th>
                {employees.map((emp) => (
                  <th key={`f-${emp.id}`}>{emp.display_code ?? "—"}</th>
                ))}
                <th className="totals-cell">Total</th>
                <th className="totals-cell">{t.bedienerHeader}</th>
                <th className="totals-cell">PhA&apos;s</th>
                <th className="notes-cell">{t.plannedNotesHeader}</th>
                <th className="notes-cell">{t.dailyNotesHeader}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
    {confirmState && (
      <ConfirmDialog
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        onConfirm={confirmState.onConfirm}
        onCancel={cancel}
      />
    )}
    {openNoteDate && (() => {
      const weekday = weekdayMon0(openNoteDate);
      const autoNotes = notesByWeekday.get(weekday) ?? [];
      const savedManualNote = manualNotesByDate.get(openNoteDate)?.text ?? "";
      const noteValue = draftDailyNotes[openNoteDate] ?? savedManualNote;
      return (
        <div className="planning-note-modal-backdrop" onClick={() => setOpenNoteDate(null)}>
          <div className="planning-note-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{formatDateLabel(openNoteDate, lang)}</h3>
            {autoNotes.length > 0 ? (
              <div className="planning-note-auto-block">
                <strong>{t.plannedNotesHeader}</strong>
                <p>{autoNotes.join(" · ")}</p>
              </div>
            ) : null}
            <textarea
              className="planning-note-input"
              rows={4}
              value={noteValue}
              placeholder={t.notePlaceholder}
              disabled={saveDailyNote.isPending}
              onChange={(e) =>
                setDraftDailyNotes((prev) => ({
                  ...prev,
                  [openNoteDate]: e.target.value,
                }))
              }
            />
            <div className="planning-note-actions">
              <button type="button" className="secondary" onClick={() => setOpenNoteDate(null)} disabled={saveDailyNote.isPending}>
                {c.cancel}
              </button>
              <button
                type="button"
                className="primary planning-note-save"
                disabled={saveDailyNote.isPending}
                onClick={() => {
                  saveDailyNote.mutate(
                    { date: openNoteDate, text: noteValue },
                    { onSuccess: () => setOpenNoteDate(null) },
                  );
                }}
              >
                {saveDailyNote.isPending ? c.saving ?? c.save : c.save}
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
}

function weekdayMon0(iso: string): number {
  const d = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return (d + 6) % 7;
}
