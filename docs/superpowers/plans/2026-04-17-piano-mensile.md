# Piano Mensile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/piano` page that renders a monthly employee grid (rows=days, columns=employees), auto-generates shifts from weekly_patterns + absences, allows cell-level toggle, and shows coverage-rule compliance per day.

**Architecture:** Single `PianificazionePage.tsx` component using 5 react-query queries (employees, weekly_patterns, shifts, absences, coverage_rules). All cell state is derived in `useMemo` from those datasets. Three mutations: bulk-generate, clear-month, and per-cell toggle. CSS appended to existing `app.css`.

**Tech Stack:** React 18 + TypeScript, @tanstack/react-query v5, Supabase JS client, custom CSS design system in `frontend/src/styles/app.css`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/i18n/translations.ts` | Modify | Add `piano` nav key (all 4 langs) + `piano` namespace (all 4 langs) |
| `frontend/src/components/AppShell.tsx` | Modify | Add `{ to: "/piano", key: "piano" as const }` to `navRoutes` |
| `frontend/src/routes/router.tsx` | Modify | Add `/piano` route |
| `frontend/src/pages/PianificazionePage.tsx` | Create | Full page component |
| `frontend/src/styles/app.css` | Modify | Append piano-* CSS classes |

---

## Task 1: i18n, routing, nav

**Files:**
- Modify: `frontend/src/i18n/translations.ts`
- Modify: `frontend/src/components/AppShell.tsx`
- Modify: `frontend/src/routes/router.tsx`
- Create: `frontend/src/pages/PianificazionePage.tsx` (skeleton only)

- [ ] **Step 1: Add `piano` nav key to all 4 language nav objects in translations.ts**

  Open `frontend/src/i18n/translations.ts`. In each of the 4 language `nav` objects, add `piano` **after** `training:` (and before `signOut:`).

  Italian nav (line ~52):
  ```typescript
      training: "Formazione",
      piano: "Piano mensile",
      signOut: "Esci",
  ```

  German nav (line ~240):
  ```typescript
      training: "Schulungen",
      piano: "Monatsplan",
      signOut: "Abmelden",
  ```

  French nav (line ~428):
  ```typescript
      training: "Formation",
      piano: "Plan mensuel",
      signOut: "Se déconnecter",
  ```

  English nav (line ~616):
  ```typescript
      training: "Training",
      piano: "Monthly Plan",
      signOut: "Sign out",
  ```

- [ ] **Step 2: Add `piano` namespace to all 4 languages in translations.ts**

  In each language object, add the `piano` namespace **after** the `training` namespace block (before the closing `}`).

  Italian (after `training: { ... },`):
  ```typescript
      piano: {
        title: "Piano mensile",
        description: "Griglia mensile con turni generati da disponibilità, assenze e regole di copertura.",
        generate: "Genera turni",
        generating: "Generazione...",
        clear: "Cancella mese",
        confirmClear: "Cancellare tutti i turni di questo mese?",
      },
  ```

  German (after `training: { ... },` in `de`):
  ```typescript
      piano: {
        title: "Monatsplan",
        description: "Monatsgitter mit Schichten aus Verfügbarkeit, Abwesenheiten und Deckungsregeln.",
        generate: "Schichten generieren",
        generating: "Generiere...",
        clear: "Monat löschen",
        confirmClear: "Alle Schichten dieses Monats löschen?",
      },
  ```

  French (after `training: { ... },` in `fr`):
  ```typescript
      piano: {
        title: "Plan mensuel",
        description: "Grille mensuelle avec les quarts issus de la disponibilité, des absences et des règles de couverture.",
        generate: "Générer les quarts",
        generating: "Génération...",
        clear: "Effacer le mois",
        confirmClear: "Supprimer tous les quarts de ce mois?",
      },
  ```

  English (after `training: { ... },` in `en`):
  ```typescript
      piano: {
        title: "Monthly Plan",
        description: "Monthly grid with shifts generated from availability, absences and coverage rules.",
        generate: "Generate shifts",
        generating: "Generating...",
        clear: "Clear month",
        confirmClear: "Delete all shifts for this month?",
      },
  ```

- [ ] **Step 3: Add nav entry to AppShell**

  Open `frontend/src/components/AppShell.tsx`. In `navRoutes`, add after `{ to: "/training", key: "training" as const }`:
  ```typescript
    { to: "/piano", key: "piano" as const },
  ```

- [ ] **Step 4: Add route to router.tsx**

  Open `frontend/src/routes/router.tsx`. Add import:
  ```typescript
  import { PianificazionePage } from "../pages/PianificazionePage";
  ```

  In the `children` array, add after the training route:
  ```typescript
        { path: "piano", element: <PianificazionePage /> },
  ```

- [ ] **Step 5: Create skeleton PianificazionePage.tsx**

  Create `frontend/src/pages/PianificazionePage.tsx`:
  ```typescript
  import { useT } from "../i18n/useT";
  import { PageHeader } from "../components/PageHeader";

  export function PianificazionePage() {
    const t = useT("piano");
    return (
      <section className="page">
        <PageHeader title={t.title} description={t.description} />
        <p className="mini-muted">In costruzione…</p>
      </section>
    );
  }
  ```

- [ ] **Step 6: Verify TypeScript compiles**

  Run from `frontend/`:
  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro/frontend
  npx tsc --noEmit
  ```
  Expected: no errors. If you see `Type '"piano"' is not assignable`, verify `piano` was added to ALL 4 language nav objects — the `Namespace` type is inferred from `translations.it`, so only the Italian object matters for types, but all 4 must have the key for runtime correctness.

- [ ] **Step 7: Commit**

  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro
  git add frontend/src/i18n/translations.ts frontend/src/components/AppShell.tsx frontend/src/routes/router.tsx frontend/src/pages/PianificazionePage.tsx
  git commit -m "feat: add PianificazionePage routing, nav and i18n skeleton"
  ```

---

## Task 2: Grid data + rendering + CSS

**Files:**
- Modify: `frontend/src/pages/PianificazionePage.tsx` (full implementation)
- Modify: `frontend/src/styles/app.css` (append piano-* classes)

This task replaces the skeleton with the full grid. No mutations yet — the grid is read-only at this point.

- [ ] **Step 1: Replace PianificazionePage.tsx with the full component**

  Write `frontend/src/pages/PianificazionePage.tsx` with the following complete content:

  ```typescript
  import { useMemo, useState } from "react";
  import { useQuery } from "@tanstack/react-query";
  import { PageHeader } from "../components/PageHeader";
  import { useT } from "../i18n/useT";
  import { supabase } from "../lib/supabase";
  import type { Tables } from "../lib/database.types";

  type Employee = Tables<"employees">;
  type Shift = Tables<"shifts">;
  type WeeklyPattern = Tables<"weekly_patterns">;
  type Absence = Tables<"absences">;
  type CoverageRule = Tables<"coverage_rules">;
  type ShiftType = Tables<"shifts">["shift_type"];

  // DB weekday: 0=Mon, JS getDay(): 0=Sun
  function toDbWeekday(jsDay: number): number {
    return (jsDay + 6) % 7;
  }

  function getDaysInMonth(year: number, month: number): string[] {
    const count = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: count }, (_, i) =>
      `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`
    );
  }

  function isoWeek(dateStr: string): number {
    const d = new Date(`${dateStr}T12:00:00`);
    const tmp = new Date(d.valueOf());
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const w1 = new Date(tmp.getFullYear(), 0, 4);
    return 1 + Math.round(((tmp.valueOf() - w1.valueOf()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  }

  function formatDayLabel(dateStr: string): { kw: number; dayLabel: string; weekdayShort: string; jsDay: number } {
    const d = new Date(`${dateStr}T12:00:00`);
    const jsDay = d.getDay();
    const dayLabel = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
    const weekdayShort = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][jsDay];
    return { kw: isoWeek(dateStr), dayLabel, weekdayShort, jsDay };
  }

  type DayStatus =
    | { kind: "present"; shifts: Shift[] }
    | { kind: "absence"; absenceType: string }
    | { kind: "expected"; patterns: WeeklyPattern[] }
    | { kind: "rotating" }
    | { kind: "off" };

  function getDayStatus(
    employeeId: string,
    date: string,
    jsDay: number,
    patternMap: Map<string, WeeklyPattern[]>,
    absenceMap: Map<string, Absence[]>,
    shiftMap: Map<string, Shift[]>,
  ): DayStatus {
    if (jsDay === 0) return { kind: "off" };

    const shifts = shiftMap.get(`${employeeId}-${date}`) ?? [];
    if (shifts.length > 0) return { kind: "present", shifts };

    const absences = absenceMap.get(employeeId) ?? [];
    const absence = absences.find(a => date >= a.start_date && date <= a.end_date);
    if (absence) return { kind: "absence", absenceType: absence.type };

    const dbWeekday = toDbWeekday(jsDay);
    const patterns = (patternMap.get(employeeId) ?? []).filter(p => p.weekday === dbWeekday);
    if (patterns.length === 0) return { kind: "off" };
    if (patterns.every(p => p.slot === "SATURDAY_ROTATING")) return { kind: "rotating" };
    return { kind: "expected", patterns: patterns.filter(p => p.slot !== "SATURDAY_ROTATING") };
  }

  function getShiftLabel(shifts: Shift[]): string {
    const types = new Set(shifts.map(s => s.shift_type));
    if (types.has("FULL_DAY")) return "G";
    if (types.has("MORNING") && types.has("AFTERNOON")) return "G";
    if (types.has("MORNING")) return "M";
    if (types.has("AFTERNOON")) return "PM";
    return "✓";
  }

  const ABSENCE_LABELS: Record<string, string> = {
    VACATION: "F", SICK: "Mal", SCHOOL: "Sc",
    TRAINING: "For", UNAVAILABLE: "Ind", HR_MEETING: "HR",
  };

  export function slotToShiftType(slot: string): ShiftType | null {
    if (slot === "MORNING") return "MORNING";
    if (slot === "AFTERNOON") return "AFTERNOON";
    if (slot === "FULL_DAY") return "FULL_DAY";
    return null;
  }

  export function PianificazionePage() {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const t = useT("piano");
    const common = useT("common");

    const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);

    const employeesQuery = useQuery({
      queryKey: ["employees"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("employees").select("*").eq("active", true).order("last_name");
        if (error) throw error;
        return data as Employee[];
      },
    });

    const patternsQuery = useQuery({
      queryKey: ["weekly_patterns"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("weekly_patterns").select("*").eq("active", true);
        if (error) throw error;
        return data as WeeklyPattern[];
      },
    });

    const shiftsQuery = useQuery({
      queryKey: ["shifts", monthStart],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("shifts").select("*")
          .gte("shift_date", monthStart).lte("shift_date", monthEnd);
        if (error) throw error;
        return data as Shift[];
      },
    });

    const absencesQuery = useQuery({
      queryKey: ["absences", monthStart],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("absences").select("*")
          .lte("start_date", monthEnd).gte("end_date", monthStart);
        if (error) throw error;
        return data as Absence[];
      },
    });

    const rulesQuery = useQuery({
      queryKey: ["coverage_rules"],
      queryFn: async () => {
        const { data, error } = await supabase.from("coverage_rules").select("*");
        if (error) throw error;
        return data as CoverageRule[];
      },
    });

    const patternMap = useMemo(() => {
      const map = new Map<string, WeeklyPattern[]>();
      for (const p of patternsQuery.data ?? []) {
        const arr = map.get(p.employee_id) ?? [];
        arr.push(p);
        map.set(p.employee_id, arr);
      }
      return map;
    }, [patternsQuery.data]);

    const absenceMap = useMemo(() => {
      const map = new Map<string, Absence[]>();
      for (const a of absencesQuery.data ?? []) {
        const arr = map.get(a.employee_id) ?? [];
        arr.push(a);
        map.set(a.employee_id, arr);
      }
      return map;
    }, [absencesQuery.data]);

    const shiftMap = useMemo(() => {
      const map = new Map<string, Shift[]>();
      for (const s of shiftsQuery.data ?? []) {
        const key = `${s.employee_id}-${s.shift_date}`;
        const arr = map.get(key) ?? [];
        arr.push(s);
        map.set(key, arr);
      }
      return map;
    }, [shiftsQuery.data]);

    const days = useMemo(
      () => getDaysInMonth(selectedYear, selectedMonth),
      [selectedYear, selectedMonth],
    );

    const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

    const coverageSummary = useMemo(() => {
      const rules = rulesQuery.data ?? [];
      return days.map(date => {
        const jsDay = new Date(`${date}T12:00:00`).getDay();
        if (jsDay === 0) return { date, total: 0, farmacisti: 0, phas: 0, valid: true };
        const dbWeekday = toDbWeekday(jsDay);
        const presentEmps = employees.filter(emp => (shiftMap.get(`${emp.id}-${date}`) ?? []).length > 0);
        const total = presentEmps.length;
        const farmacisti = presentEmps.filter(e => e.role === "pharmacist").length;
        const phas = presentEmps.filter(e => e.role === "pha").length;
        const dayRules = rules.filter(r => r.weekday === dbWeekday);
        const valid = dayRules.every(rule => {
          if (rule.role === "pharmacist") return farmacisti >= rule.min_required;
          if (rule.role === "pha") {
            if (rule.time_window === "evening") {
              const eveningPhas = employees.filter(emp => {
                const shifts = shiftMap.get(`${emp.id}-${date}`) ?? [];
                return shifts.some(s => s.shift_type === "AFTERNOON") && emp.role === "pha";
              }).length;
              return eveningPhas >= rule.min_required;
            }
            return phas >= rule.min_required;
          }
          return true;
        });
        return { date, total, farmacisti, phas, valid };
      });
    }, [days, employees, shiftMap, rulesQuery.data]);

    const isLoading =
      employeesQuery.isLoading || patternsQuery.isLoading ||
      shiftsQuery.isLoading || absencesQuery.isLoading;

    return (
      <section className="page">
        <PageHeader title={t.title} description={t.description} />

        <div className="card" style={{ marginBottom: "1rem" }}>
          <div className="toolbar">
            <label className="field">
              <span>{common.month}</span>
              <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                {(common.months as string[]).map((label, i) => (
                  <option key={label} value={i}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{common.year}</span>
              <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {isLoading ? (
          <p className="mini-muted">{common.loading}</p>
        ) : (
          <div className="card">
            <div className="piano-table-wrapper">
              <table className="piano-table">
                <thead>
                  <tr>
                    <th className="piano-th-fixed piano-th-kw">KW</th>
                    <th className="piano-th-fixed piano-th-date">Datum</th>
                    <th className="piano-th-fixed piano-th-day">Tag</th>
                    {employees.map(emp => (
                      <th
                        key={emp.id}
                        className={`piano-th-emp piano-role-${emp.role}`}
                        title={`${emp.first_name} ${emp.last_name}`}
                      >
                        {emp.display_code}
                      </th>
                    ))}
                    <th className="piano-th-summary">Tot</th>
                    <th className="piano-th-summary">Ph</th>
                    <th className="piano-th-summary">PHA</th>
                    <th className="piano-th-summary">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((date, idx) => {
                    const { kw, dayLabel, weekdayShort, jsDay } = formatDayLabel(date);
                    const isSunday = jsDay === 0;
                    const summary = coverageSummary[idx];
                    const prevKw = idx > 0 ? isoWeek(days[idx - 1]) : -1;
                    return (
                      <tr key={date} className={isSunday ? "piano-row-sunday" : undefined}>
                        <td className="piano-td-fixed piano-td-kw">
                          {kw !== prevKw ? String(kw) : ""}
                        </td>
                        <td className="piano-td-fixed piano-td-date">{dayLabel}</td>
                        <td className="piano-td-fixed piano-td-weekday">{weekdayShort}</td>
                        {employees.map(emp => {
                          if (isSunday) {
                            return <td key={emp.id} className="piano-cell piano-cell-sunday" />;
                          }
                          const status = getDayStatus(
                            emp.id, date, jsDay, patternMap, absenceMap, shiftMap,
                          );
                          return (
                            <td
                              key={emp.id}
                              className={`piano-cell piano-cell-${status.kind}${status.kind === "absence" ? `-${status.absenceType}` : ""}`}
                              title={status.kind === "absence" ? (ABSENCE_LABELS[status.absenceType] ?? status.absenceType) : undefined}
                            >
                              {status.kind === "present" ? getShiftLabel(status.shifts) : null}
                              {status.kind === "absence" ? (ABSENCE_LABELS[status.absenceType] ?? "—") : null}
                              {status.kind === "expected" ? "·" : null}
                              {status.kind === "rotating" ? "R" : null}
                            </td>
                          );
                        })}
                        <td className="piano-td-summary">{isSunday ? "" : summary.total}</td>
                        <td className="piano-td-summary">{isSunday ? "" : summary.farmacisti}</td>
                        <td className="piano-td-summary">{isSunday ? "" : summary.phas}</td>
                        <td className={`piano-td-summary ${isSunday ? "" : summary.valid ? "piano-coverage-ok" : "piano-coverage-warn"}`}>
                          {isSunday ? "" : summary.valid ? "✓" : "!"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="piano-legend">
              <span className="piano-legend-item piano-legend-present">G/M/PM = turno</span>
              <span className="piano-legend-item piano-legend-vacation">F = ferie</span>
              <span className="piano-legend-item piano-legend-sick">Mal = malattia</span>
              <span className="piano-legend-item piano-legend-school">Sc = scuola</span>
              <span className="piano-legend-item piano-legend-training">For = formazione</span>
              <span className="piano-legend-item piano-legend-expected">· = previsto</span>
              <span className="piano-legend-item piano-legend-rotating">R = sabato rotante</span>
            </div>
          </div>
        )}
      </section>
    );
  }
  ```

- [ ] **Step 2: Append piano-* CSS classes to app.css**

  Append the following block to the END of `frontend/src/styles/app.css`:

  ```css
  /* ── Piano mensile ─────────────────────────────────────────── */
  .piano-table-wrapper {
    overflow-x: auto;
    max-height: 72vh;
    overflow-y: auto;
  }

  .piano-table {
    border-collapse: collapse;
    font-size: 0.76rem;
    white-space: nowrap;
  }

  .piano-table th,
  .piano-table td {
    border: 1px solid #d8e6d8;
    padding: 2px 5px;
    text-align: center;
    vertical-align: middle;
  }

  .piano-th-fixed,
  .piano-td-fixed {
    position: sticky;
    background: #f8faf8;
    z-index: 2;
    text-align: left;
  }

  .piano-th-kw, .piano-td-kw { left: 0; min-width: 2.2rem; }
  .piano-th-date, .piano-td-date { left: 2.2rem; min-width: 3.4rem; }
  .piano-th-day, .piano-td-weekday { left: 5.6rem; min-width: 2rem; }

  thead .piano-th-fixed { z-index: 3; }

  .piano-td-kw { font-weight: 600; color: #496053; }
  .piano-td-weekday { color: #6f816f; }

  .piano-th-emp {
    font-weight: 600;
    min-width: 2.4rem;
    font-size: 0.72rem;
  }

  .piano-th-emp.piano-role-pharmacist { background: #e0ede0; color: #173f2f; }
  .piano-th-emp.piano-role-pha { background: #eaf4ea; color: #2a5a3a; }
  .piano-th-emp.piano-role-apprentice_pha,
  .piano-th-emp.piano-role-driver,
  .piano-th-emp.piano-role-auxiliary { background: #f4f8f4; color: #496053; }

  .piano-th-summary,
  .piano-td-summary {
    background: #f0f8f0;
    font-weight: 600;
    min-width: 2rem;
    font-size: 0.72rem;
  }

  .piano-cell { min-width: 2.4rem; height: 1.5rem; font-size: 0.7rem; font-weight: 600; }

  .piano-cell-present { background: #c8e8c8; color: #173f2f; }
  .piano-cell-absence-VACATION { background: #b8d4f0; color: #1a3a6a; }
  .piano-cell-absence-SICK { background: #f0b8b8; color: #6a1a1a; }
  .piano-cell-absence-SCHOOL { background: #f8ebb8; color: #5a4a10; }
  .piano-cell-absence-TRAINING { background: #f0d8b8; color: #6a3a10; }
  .piano-cell-absence-UNAVAILABLE { background: #e0d0e8; color: #3a2050; }
  .piano-cell-absence-HR_MEETING { background: #e8e8e8; color: #404040; }
  .piano-cell-expected { background: transparent; color: #b0c8b0; font-weight: 400; }
  .piano-cell-rotating { background: #e8d8f4; color: #4a2080; }
  .piano-cell-off { background: #f4f4f4; }
  .piano-cell-sunday, .piano-row-sunday td { background: #f0f0f0; color: #c0c0c0; }

  .piano-coverage-ok { color: #2d6a2d; }
  .piano-coverage-warn { background: #fde8a8; color: #7a4a00; font-weight: 700; }

  .piano-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    margin-top: 0.75rem;
    padding-top: 0.6rem;
    border-top: 1px solid #e0e8e0;
    font-size: 0.76rem;
    color: #496053;
  }

  .piano-legend-item { display: flex; align-items: center; gap: 0.3rem; }

  .piano-legend-present::before,
  .piano-legend-vacation::before,
  .piano-legend-sick::before,
  .piano-legend-school::before,
  .piano-legend-training::before,
  .piano-legend-rotating::before {
    content: "";
    display: inline-block;
    width: 0.9rem;
    height: 0.7rem;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.15);
  }

  .piano-legend-present::before { background: #c8e8c8; }
  .piano-legend-vacation::before { background: #b8d4f0; }
  .piano-legend-sick::before { background: #f0b8b8; }
  .piano-legend-school::before { background: #f8ebb8; }
  .piano-legend-training::before { background: #f0d8b8; }
  .piano-legend-expected::before { content: "·"; font-size: 1.2rem; line-height: 1; color: #b0c8b0; }
  .piano-legend-rotating::before { background: #e8d8f4; }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro/frontend
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 4: Verify the page loads in dev server**

  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro/frontend
  npm run dev
  ```
  Open browser at `http://localhost:5173`. Navigate to "Piano mensile" in the sidebar. Expected: grid renders with days as rows, employee codes as column headers. Cells show colored state (absences colored, expected as `·`, shifts as M/PM/G). Summary columns show counts. Coverage column shows ✓ or !.

  If no data appears, it's likely because no shifts/absences/patterns are seeded — that's fine. The grid should still render the day rows with the correct structure.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro
  git add frontend/src/pages/PianificazionePage.tsx frontend/src/styles/app.css
  git commit -m "feat: PianificazionePage grid with multi-source cell state and coverage summary"
  ```

---

## Task 3: Generate, clear, and toggle mutations

**Files:**
- Modify: `frontend/src/pages/PianificazionePage.tsx` (add mutations + wire toolbar buttons + cell click)

This task adds the three write operations on top of the read-only grid from Task 2.

- [ ] **Step 1: Add mutation imports and hook to PianificazionePage.tsx**

  Change the import line at the top from:
  ```typescript
  import { useMemo, useState } from "react";
  import { useQuery } from "@tanstack/react-query";
  ```
  To:
  ```typescript
  import { useMemo, useState } from "react";
  import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
  ```

  Add `const queryClient = useQueryClient();` as the first line inside `PianificazionePage()` body (before `const today = ...`).

- [ ] **Step 2: Add generateMutation**

  After the `const isLoading = ...` line, add:

  ```typescript
  const generateMutation = useMutation({
    mutationFn: async () => {
      const toInsert: { employee_id: string; shift_date: string; shift_type: ShiftType }[] = [];
      for (const emp of employees) {
        for (const date of days) {
          const jsDay = new Date(`${date}T12:00:00`).getDay();
          if (jsDay === 0) continue;
          const dbWeekday = toDbWeekday(jsDay);
          const patterns = (patternMap.get(emp.id) ?? [])
            .filter(p => p.weekday === dbWeekday && p.slot !== "SATURDAY_ROTATING");
          if (patterns.length === 0) continue;
          const hasAbsence = (absenceMap.get(emp.id) ?? [])
            .some(a => date >= a.start_date && date <= a.end_date);
          if (hasAbsence) continue;
          for (const pat of patterns) {
            const shiftType = slotToShiftType(pat.slot);
            if (shiftType) toInsert.push({ employee_id: emp.id, shift_date: date, shift_type: shiftType });
          }
        }
      }
      if (toInsert.length === 0) return;
      const { error } = await supabase
        .from("shifts")
        .upsert(toInsert, { onConflict: "employee_id,shift_date,shift_type", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });
  ```

- [ ] **Step 3: Add clearMutation**

  After `generateMutation`, add:

  ```typescript
  const clearMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("shifts")
        .delete()
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });
  ```

- [ ] **Step 4: Add toggleMutation**

  After `clearMutation`, add:

  ```typescript
  const toggleMutation = useMutation({
    mutationFn: async ({
      employeeId,
      date,
      status,
    }: {
      employeeId: string;
      date: string;
      status: DayStatus;
    }) => {
      if (status.kind === "present") {
        for (const shift of status.shifts) {
          const { error } = await supabase.from("shifts").delete().eq("id", shift.id);
          if (error) throw error;
        }
      } else if (status.kind === "expected") {
        const toInsert = status.patterns
          .map(p => slotToShiftType(p.slot))
          .filter((st): st is ShiftType => st !== null)
          .map(shiftType => ({ employee_id: employeeId, shift_date: date, shift_type: shiftType }));
        if (toInsert.length > 0) {
          const { error } = await supabase
            .from("shifts")
            .upsert(toInsert, { onConflict: "employee_id,shift_date,shift_type", ignoreDuplicates: true });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const isBusy = generateMutation.isPending || clearMutation.isPending || toggleMutation.isPending;
  ```

- [ ] **Step 5: Wire toolbar buttons**

  Replace the toolbar `<div className="card" ...>` block with the following (adds the two action buttons and error display):

  ```tsx
  <div className="card" style={{ marginBottom: "1rem" }}>
    <div className="toolbar">
      <label className="field">
        <span>{common.month}</span>
        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
          {(common.months as string[]).map((label, i) => (
            <option key={label} value={i}>{label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{common.year}</span>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
          {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <button
        className="primary"
        onClick={() => generateMutation.mutate()}
        disabled={isBusy || isLoading}
      >
        {generateMutation.isPending ? t.generating : t.generate}
      </button>
      <button
        className="secondary"
        onClick={() => {
          if (window.confirm(t.confirmClear)) clearMutation.mutate();
        }}
        disabled={isBusy || isLoading}
      >
        {t.clear}
      </button>
    </div>
    {generateMutation.isError && (
      <p className="schedule-error">{(generateMutation.error as Error).message}</p>
    )}
    {clearMutation.isError && (
      <p className="schedule-error">{(clearMutation.error as Error).message}</p>
    )}
  </div>
  ```

- [ ] **Step 6: Wire cell click (toggle)**

  In the table body, find the inner `<td key={emp.id} ...>` for non-Sunday cells and replace it with a version that includes `onClick` and cursor style:

  ```tsx
  {employees.map(emp => {
    if (isSunday) {
      return <td key={emp.id} className="piano-cell piano-cell-sunday" />;
    }
    const status = getDayStatus(
      emp.id, date, jsDay, patternMap, absenceMap, shiftMap,
    );
    const isClickable = !isBusy && (status.kind === "present" || status.kind === "expected");
    return (
      <td
        key={emp.id}
        className={`piano-cell piano-cell-${status.kind}${status.kind === "absence" ? `-${status.absenceType}` : ""}`}
        onClick={isClickable ? () => toggleMutation.mutate({ employeeId: emp.id, date, status }) : undefined}
        style={isClickable ? { cursor: "pointer" } : undefined}
        title={status.kind === "absence" ? (ABSENCE_LABELS[status.absenceType] ?? status.absenceType) : undefined}
      >
        {status.kind === "present" ? getShiftLabel(status.shifts) : null}
        {status.kind === "absence" ? (ABSENCE_LABELS[status.absenceType] ?? "—") : null}
        {status.kind === "expected" ? "·" : null}
        {status.kind === "rotating" ? "R" : null}
      </td>
    );
  })}
  ```

- [ ] **Step 7: Verify TypeScript compiles**

  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro/frontend
  npx tsc --noEmit
  ```
  Expected: no errors.

- [ ] **Step 8: Manual test in browser**

  ```bash
  npm run dev
  ```

  Test sequence:
  1. Navigate to `/piano`. Grid loads.
  2. Click **"Genera turni"**. Button shows "Generazione..." while pending. After success, cells that previously showed `·` (expected) should turn green with label M/PM/G.
  3. Click a green cell (present). It should become `·` (expected) — the shift was deleted.
  4. Click `·` cell again. It should turn green again — shift re-created.
  5. Click **"Cancella mese"** → confirm dialog appears → confirm → all green cells should clear back to `·`.
  6. Summary columns (Tot/Ph/PHA) update to reflect present employee counts.
  7. Coverage column shows ✓ when enough staff, ! when below min_required.

- [ ] **Step 9: Commit**

  ```bash
  cd /Users/gianmichele/Development/Personal/pharma-plan-pro
  git add frontend/src/pages/PianificazionePage.tsx
  git commit -m "feat: PianificazionePage generate/clear/toggle mutations with coverage validation"
  ```

---

## Self-Review

**Spec coverage check:**
- ✅ Monthly grid rows=days, columns=employees
- ✅ Auto-generate from weekly_patterns (skips SATURDAY_ROTATING, skips absences)
- ✅ Saves to `shifts` table via upsert
- ✅ Cell toggle (click expected → create; click present → delete)
- ✅ Overlay absences with color coding (VACATION/SICK/SCHOOL/TRAINING/UNAVAILABLE/HR_MEETING)
- ✅ Summary columns: Total, Farmacisti, PHA
- ✅ Coverage rule validation per day (✓/!)
- ✅ Clear month button with confirmation

**Placeholder scan:** None found. All steps contain complete code.

**Type consistency:**
- `DayStatus` defined in Task 2, referenced identically in Task 3
- `slotToShiftType` exported in Task 2, used in Task 3 within same file (no cross-file issue)
- `ShiftType` = `Tables<"shifts">["shift_type"]` = `"FULL_DAY" | "MORNING" | "AFTERNOON"` — consistent throughout
- `toDbWeekday` defined once, used in both coverage and cell state — identical signature
