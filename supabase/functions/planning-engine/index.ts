import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type SuggestionType = "ADD_SHIFT" | "MOVE_SHIFT" | "SWAP_SHIFT" | "REMOVE_SHIFT";
type Action =
  | { action: "generate"; year: number; month: number }
  | { action: "snapshot"; year: number; month: number; run_id?: string }
  | { action: "apply_suggestion"; suggestion_id: string }
  | { action: "commit"; run_id: string };

type Employee = {
  id: string;
  first_name: string;
  last_name: string;
  display_code: string;
  role: "pharmacist" | "pha" | "apprentice_pha" | "driver" | "auxiliary";
  weekly_hours_pct: number | null;
};

type Pattern = {
  employee_id: string;
  weekday: number;
  active: boolean;
};

type Absence = {
  employee_id: string;
  start_date: string;
  end_date: string;
};

type Rule = {
  weekday: number;
  role: "pharmacist" | "pha" | "apprentice_pha" | "driver" | "auxiliary";
  min_required: number;
  time_window: string;
};

type DraftShift = {
  employee_id: string;
  shift_date: string;
  source: "baseline" | "repair" | "manual" | "suggestion";
  legacy_code: string | null;
};

type PlanningIssue = {
  issue_date: string;
  role: Rule["role"] | null;
  severity: "warning" | "critical";
  code: string;
  message: string;
  details: Record<string, unknown>;
};

type PlanningSuggestion = {
  issue_date: string;
  suggestion_type: SuggestionType;
  title: string;
  description: string;
  action_payload: Record<string, unknown>;
  score: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function toDbWeekday(jsDay: number): number {
  return (jsDay + 6) % 7;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1, 12, 0, 0);
  const end = new Date(year, month, 0, 12, 0, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function monthDays(year: number, month: number): string[] {
  const { start, end } = monthBounds(year, month);
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const stop = new Date(`${end}T12:00:00`);
  while (cur <= stop) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + ((v - mean) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function uniqueShifts(shifts: DraftShift[]): DraftShift[] {
  const seen = new Set<string>();
  const out: DraftShift[] = [];
  for (const shift of shifts) {
    const key = `${shift.employee_id}-${shift.shift_date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(shift);
  }
  return out;
}

async function loadInputs(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number,
) {
  const { start, end } = monthBounds(year, month);
  const [employeesRes, patternsRes, absencesRes, rulesRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, first_name, last_name, display_code, role, weekly_hours_pct")
      .eq("active", true)
      .order("last_name"),
    supabase
      .from("weekly_patterns")
      .select("employee_id, weekday, active")
      .eq("active", true),
    supabase
      .from("absences")
      .select("employee_id, start_date, end_date")
      .lte("start_date", end)
      .gte("end_date", start)
      .eq("status", "approved"),
    supabase.from("coverage_rules").select("weekday, role, min_required, time_window"),
  ]);
  if (employeesRes.error) throw employeesRes.error;
  if (patternsRes.error) throw patternsRes.error;
  if (absencesRes.error) throw absencesRes.error;
  if (rulesRes.error) throw rulesRes.error;
  return {
    employees: (employeesRes.data ?? []) as Employee[],
    patterns: (patternsRes.data ?? []) as Pattern[],
    absences: (absencesRes.data ?? []) as Absence[],
    rules: (rulesRes.data ?? []) as Rule[],
  };
}

function buildBaseDraft(
  employees: Employee[],
  patterns: Pattern[],
  absences: Absence[],
  _rules: Rule[],
  year: number,
  month: number,
): DraftShift[] {
  const days = monthDays(year, month);
  const patternMap = new Map<string, Pattern[]>();
  const absenceMap = new Map<string, Absence[]>();
  const out: DraftShift[] = [];

  for (const p of patterns) {
    const row = patternMap.get(p.employee_id) ?? [];
    row.push(p);
    patternMap.set(p.employee_id, row);
  }
  for (const a of absences) {
    const row = absenceMap.get(a.employee_id) ?? [];
    row.push(a);
    absenceMap.set(a.employee_id, row);
  }

  const isAbsent = (employeeId: string, date: string) =>
    (absenceMap.get(employeeId) ?? []).some((a) => date >= a.start_date && date <= a.end_date);

  for (const date of days) {
    const jsDay = new Date(`${date}T12:00:00`).getDay();
    if (jsDay === 0) continue;
    const weekday = toDbWeekday(jsDay);
    for (const emp of employees) {
      if (isAbsent(emp.id, date)) continue;
      const empatterns = patternMap.get(emp.id) ?? [];
      const worksToday = empatterns.some((p) => p.weekday === weekday && p.active);
      if (!worksToday) continue;
      out.push({
        employee_id: emp.id,
        shift_date: date,
        source: "baseline",
        legacy_code: "1",
      });
    }
  }

  return uniqueShifts(out);
}

function evaluateDraft(
  draft: DraftShift[],
  employees: Employee[],
  _patterns: Pattern[],
  absences: Absence[],
  rules: Rule[],
  year: number,
  month: number,
): { issues: PlanningIssue[]; suggestions: PlanningSuggestion[]; coverageScore: number; fairnessScore: number } {
  const days = monthDays(year, month);
  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  const absenceMap = new Map<string, Absence[]>();
  for (const a of absences) {
    const row = absenceMap.get(a.employee_id) ?? [];
    row.push(a);
    absenceMap.set(a.employee_id, row);
  }

  const issueList: PlanningIssue[] = [];
  const suggestionList: PlanningSuggestion[] = [];
  const byDate = new Map<string, DraftShift[]>();
  const assignedByEmployee = new Map<string, number>();
  let checkedRules = 0;
  let passedRules = 0;

  for (const shift of draft) {
    const arr = byDate.get(shift.shift_date) ?? [];
    arr.push(shift);
    byDate.set(shift.shift_date, arr);
    assignedByEmployee.set(shift.employee_id, (assignedByEmployee.get(shift.employee_id) ?? 0) + 1);
  }

  const workingDays = days.filter((date) => {
    const jsDay = new Date(`${date}T12:00:00`).getDay();
    return jsDay !== 0;
  }).length;
  const targetByEmployee = new Map<string, number>();
  for (const emp of employees) {
    const pct = Number(emp.weekly_hours_pct ?? 100) / 100;
    targetByEmployee.set(emp.id, Math.max(1, Math.round(workingDays * pct)));
  }

  const isAbsent = (employeeId: string, date: string) =>
    (absenceMap.get(employeeId) ?? []).some((a) => date >= a.start_date && date <= a.end_date);

  for (const date of days) {
    const jsDay = new Date(`${date}T12:00:00`).getDay();
    if (jsDay === 0) continue;
    const weekday = toDbWeekday(jsDay);
    const dayShifts = byDate.get(date) ?? [];

    for (const rule of rules.filter((r) => r.weekday === weekday)) {
      checkedRules += 1;
      const assigned = dayShifts.filter((s) => {
        const emp = employeeMap.get(s.employee_id);
        return emp?.role === rule.role;
      }).length;

      if (assigned >= rule.min_required) {
        passedRules += 1;
        continue;
      }

      issueList.push({
        issue_date: date,
        role: rule.role,
        severity: "critical",
        code: "COVERAGE_SHORTAGE",
        message: `Need ${rule.min_required} ${rule.role}(s), have ${assigned}`,
        details: { required: rule.min_required, assigned },
      });

      const present = new Set(dayShifts.map((s) => s.employee_id));
      const shortage = rule.min_required - assigned;
      const candidates = employees
        .filter((e) => e.role === rule.role)
        .filter((e) => !isAbsent(e.id, date))
        .filter((e) => !present.has(e.id))
        .sort((a, b) => (assignedByEmployee.get(a.id) ?? 0) - (assignedByEmployee.get(b.id) ?? 0));

      for (let i = 0; i < Math.min(shortage, candidates.length); i += 1) {
        const candidate = candidates[i];
        const assignedCount = assignedByEmployee.get(candidate.id) ?? 0;
        const target = targetByEmployee.get(candidate.id) ?? 1;
        const overload = Math.max(0, assignedCount - target);
        const score = Math.max(10, 100 - overload * 8);
        suggestionList.push({
          issue_date: date,
          suggestion_type: "ADD_SHIFT",
          title: `Add ${candidate.display_code} (${rule.role})`,
          description: `Cover ${date} for role ${rule.role}`,
          action_payload: {
            employee_id: candidate.id,
            shift_date: date,
            role: rule.role,
          },
          score,
        });
      }

      if (candidates.length === 0) {
        issueList.push({
          issue_date: date,
          role: rule.role,
          severity: "warning",
          code: "NO_ELIGIBLE_CANDIDATE",
          message: `No eligible ${rule.role} candidates available`,
          details: {},
        });
      }
    }
  }

  const coverageScore = checkedRules > 0 ? (passedRules / checkedRules) * 100 : 100;
  const normalizedLoads = employees.map((e) => {
    const assigned = assignedByEmployee.get(e.id) ?? 0;
    const target = targetByEmployee.get(e.id) ?? 1;
    return assigned / Math.max(1, target);
  });
  const fairnessScore = Math.max(0, 100 - stddev(normalizedLoads) * 100);
  return { issues: issueList, suggestions: suggestionList.sort((a, b) => b.score - a.score), coverageScore, fairnessScore };
}

async function getRunSnapshot(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number,
  runId?: string,
) {
  let runQuery = supabase
    .from("planning_runs")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .order("created_at", { ascending: false })
    .limit(1);
  if (runId) runQuery = supabase.from("planning_runs").select("*").eq("id", runId).limit(1);
  const runRes = await runQuery;
  if (runRes.error) throw runRes.error;
  const run = runRes.data?.[0];
  if (!run) return null;

  const [draftRes, issuesRes, suggestionsRes] = await Promise.all([
    supabase
      .from("planning_draft_shifts")
      .select("id, employee_id, shift_date, source, legacy_code, employee:employees(first_name, last_name, display_code, role)")
      .eq("run_id", run.id),
    supabase
      .from("planning_issues")
      .select("*")
      .eq("run_id", run.id)
      .order("issue_date", { ascending: true }),
    supabase
      .from("planning_suggestions")
      .select("*")
      .eq("run_id", run.id)
      .eq("status", "pending")
      .order("score", { ascending: false }),
  ]);
  if (draftRes.error) throw draftRes.error;
  if (issuesRes.error) throw issuesRes.error;
  if (suggestionsRes.error) throw suggestionsRes.error;
  return {
    run,
    draft_shifts: draftRes.data ?? [],
    issues: issuesRes.data ?? [],
    suggestions: suggestionsRes.data ?? [],
  };
}

async function recomputeAndPersist(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  year: number,
  month: number,
) {
  const [{ data: currentDraft, error: draftError }, inputs] = await Promise.all([
    supabase
      .from("planning_draft_shifts")
      .select("employee_id, shift_date, source, legacy_code")
      .eq("run_id", runId),
    loadInputs(supabase, year, month),
  ]);
  if (draftError) throw draftError;

  const evalResult = evaluateDraft(
    (currentDraft ?? []) as DraftShift[],
    inputs.employees,
    inputs.patterns,
    inputs.absences,
    inputs.rules,
    year,
    month,
  );

  const [{ error: clearIssueError }, { error: clearSuggestionError }] = await Promise.all([
    supabase.from("planning_issues").delete().eq("run_id", runId),
    supabase.from("planning_suggestions").delete().eq("run_id", runId).eq("status", "pending"),
  ]);
  if (clearIssueError) throw clearIssueError;
  if (clearSuggestionError) throw clearSuggestionError;

  if (evalResult.issues.length > 0) {
    const { error } = await supabase.from("planning_issues").insert(
      evalResult.issues.map((i) => ({ ...i, run_id: runId })),
    );
    if (error) throw error;
  }
  if (evalResult.suggestions.length > 0) {
    const { error } = await supabase.from("planning_suggestions").insert(
      evalResult.suggestions.map((s) => ({ ...s, run_id: runId })),
    );
    if (error) throw error;
  }
  const { error: runError } = await supabase
    .from("planning_runs")
    .update({
      fairness_score: evalResult.fairnessScore,
      coverage_score: evalResult.coverageScore,
      metadata: {
        issues_count: evalResult.issues.length,
        suggestions_count: evalResult.suggestions.length,
      },
    })
    .eq("id", runId);
  if (runError) throw runError;
}

async function syncRunToShifts(
  supabase: ReturnType<typeof createClient>,
  runId: string,
  year: number,
  month: number,
) {
  const { start, end } = monthBounds(year, month);
  const { data: draft, error: draftError } = await supabase
    .from("planning_draft_shifts")
    .select("employee_id, shift_date")
    .eq("run_id", runId);
  if (draftError) throw draftError;

  const { error: delError } = await supabase
    .from("shifts")
    .delete()
    .gte("shift_date", start)
    .lte("shift_date", end);
  if (delError) throw delError;

  if ((draft ?? []).length > 0) {
    const { error: insError } = await supabase
      .from("shifts")
      .insert((draft ?? []).map((s: { employee_id: string; shift_date: string }) => ({
        employee_id: s.employee_id,
        shift_date: s.shift_date,
      })));
    if (insError) throw insError;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Action;
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    const supabase = createClient(url, serviceRole, { auth: { persistSession: false } });

    if (body.action === "generate") {
      const inputs = await loadInputs(supabase, body.year, body.month);
      const draft = buildBaseDraft(inputs.employees, inputs.patterns, inputs.absences, inputs.rules, body.year, body.month);
      const result = evaluateDraft(
        draft,
        inputs.employees,
        inputs.patterns,
        inputs.absences,
        inputs.rules,
        body.year,
        body.month,
      );

      const { data: run, error: runError } = await supabase
        .from("planning_runs")
        .insert({
          year: body.year,
          month: body.month,
          status: "draft",
          fairness_score: result.fairnessScore,
          coverage_score: result.coverageScore,
          metadata: {
            draft_shifts: draft.length,
            issues_count: result.issues.length,
            suggestions_count: result.suggestions.length,
          },
        })
        .select("*")
        .single();
      if (runError) throw runError;

      if (draft.length > 0) {
        const { error } = await supabase.from("planning_draft_shifts").insert(
          draft.map((s) => ({ ...s, run_id: run.id })),
        );
        if (error) throw error;
      }
      if (result.issues.length > 0) {
        const { error } = await supabase.from("planning_issues").insert(
          result.issues.map((i) => ({ ...i, run_id: run.id })),
        );
        if (error) throw error;
      }
      if (result.suggestions.length > 0) {
        const { error } = await supabase.from("planning_suggestions").insert(
          result.suggestions.map((s) => ({ ...s, run_id: run.id })),
        );
        if (error) throw error;
      }

      await syncRunToShifts(supabase, run.id, body.year, body.month);

      const snapshot = await getRunSnapshot(supabase, body.year, body.month, run.id);
      return new Response(JSON.stringify(snapshot), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "snapshot") {
      const snapshot = await getRunSnapshot(supabase, body.year, body.month, body.run_id);
      return new Response(JSON.stringify(snapshot), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "apply_suggestion") {
      const { data: suggestion, error: suggestionError } = await supabase
        .from("planning_suggestions")
        .select("id, run_id, suggestion_type, action_payload, status")
        .eq("id", body.suggestion_id)
        .single();
      if (suggestionError) throw suggestionError;
      if (suggestion.status !== "pending") {
        return new Response(JSON.stringify({ error: "Suggestion is not pending" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        });
      }

      if (suggestion.suggestion_type === "ADD_SHIFT") {
        const payload = suggestion.action_payload as Record<string, unknown>;
        const employeeId = String(payload.employee_id ?? "");
        const shiftDate = String(payload.shift_date ?? "");
        if (!employeeId || !shiftDate) {
          throw new Error("Invalid ADD_SHIFT payload");
        }
        const { error } = await supabase
          .from("planning_draft_shifts")
          .upsert({
            run_id: suggestion.run_id,
            employee_id: employeeId,
            shift_date: shiftDate,
            source: "suggestion",
            legacy_code: "1",
          }, { onConflict: "run_id,employee_id,shift_date", ignoreDuplicates: true });
        if (error) throw error;
      }

      const { error: markError } = await supabase
        .from("planning_suggestions")
        .update({ status: "applied", applied_at: new Date().toISOString() })
        .eq("id", suggestion.id);
      if (markError) throw markError;

      const { data: runData, error: runReadError } = await supabase
        .from("planning_runs")
        .select("id, year, month")
        .eq("id", suggestion.run_id)
        .single();
      if (runReadError) throw runReadError;

      await recomputeAndPersist(supabase, runData.id, runData.year, runData.month);
      await syncRunToShifts(supabase, runData.id, runData.year, runData.month);
      const snapshot = await getRunSnapshot(supabase, runData.year, runData.month, runData.id);
      return new Response(JSON.stringify(snapshot), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "commit") {
      const { data: run, error: runError } = await supabase
        .from("planning_runs")
        .select("id, year, month")
        .eq("id", body.run_id)
        .single();
      if (runError) throw runError;
      const { start, end } = monthBounds(run.year, run.month);

      const { data: draft, error: draftError } = await supabase
        .from("planning_draft_shifts")
        .select("employee_id, shift_date")
        .eq("run_id", run.id);
      if (draftError) throw draftError;

      const { error: delError } = await supabase
        .from("shifts")
        .delete()
        .gte("shift_date", start)
        .lte("shift_date", end);
      if (delError) throw delError;

      if ((draft ?? []).length > 0) {
        const { error: insError } = await supabase
          .from("shifts")
          .insert((draft ?? []).map((s: { employee_id: string; shift_date: string }) => ({
            employee_id: s.employee_id,
            shift_date: s.shift_date,
          })));
        if (insError) throw insError;
      }

      const { error: statusError } = await supabase
        .from("planning_runs")
        .update({ status: "committed" })
        .eq("id", run.id);
      if (statusError) throw statusError;

      return new Response(JSON.stringify({ ok: true, run_id: run.id, inserted: (draft ?? []).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
