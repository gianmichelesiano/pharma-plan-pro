import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenerateAction = { action: "generate"; year: number; month: number };

function monthBounds(year: number, month: number): { start: string; end: string } {
  const s = new Date(Date.UTC(year, month - 1, 1));
  const e = new Date(Date.UTC(year, month, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(s), end: iso(e) };
}

function eachDay(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d.getTime() <= e.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function weekdayMon0(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getUTCDay();
  return (d + 6) % 7;
}

async function generate(
  supabase: ReturnType<typeof createClient>,
  year: number,
  month: number,
) {
  const { start, end } = monthBounds(year, month);
  const [empRes, patRes, absRes] = await Promise.all([
    supabase.from("employees").select("id, active").eq("active", true),
    supabase.from("weekly_patterns").select("employee_id, weekday, active").eq("active", true).eq("pattern_type", "standard"),
    supabase
      .from("absences")
      .select("employee_id, start_date, end_date, status")
      .eq("status", "approved")
      .lte("start_date", end)
      .gte("end_date", start),
  ]);
  if (empRes.error) throw empRes.error;
  if (patRes.error) throw patRes.error;
  if (absRes.error) throw absRes.error;

  const worksOn = new Map<string, Set<number>>();
  for (const p of patRes.data ?? []) {
    const set = worksOn.get(p.employee_id as string) ?? new Set<number>();
    set.add(p.weekday as number);
    worksOn.set(p.employee_id as string, set);
  }

  const absentOn = new Map<string, Set<string>>();
  for (const a of absRes.data ?? []) {
    const empId = a.employee_id as string;
    const from = new Date((a.start_date as string) + "T00:00:00Z");
    const to = new Date((a.end_date as string) + "T00:00:00Z");
    const clampFrom = from < new Date(start + "T00:00:00Z") ? new Date(start + "T00:00:00Z") : from;
    const clampTo = to > new Date(end + "T00:00:00Z") ? new Date(end + "T00:00:00Z") : to;
    const set = absentOn.get(empId) ?? new Set<string>();
    for (let d = new Date(clampFrom); d.getTime() <= clampTo.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
      set.add(d.toISOString().slice(0, 10));
    }
    absentOn.set(empId, set);
  }

  const rows: { employee_id: string; shift_date: string; source: string }[] = [];
  for (const date of eachDay(start, end)) {
    const wd = weekdayMon0(date);
    if (wd === 6) continue;
    for (const emp of empRes.data ?? []) {
      const empId = emp.id as string;
      if (!worksOn.get(empId)?.has(wd)) continue;
      if (absentOn.get(empId)?.has(date)) continue;
      rows.push({ employee_id: empId, shift_date: date, source: "generated" });
    }
  }

  const del = await supabase
    .from("shifts")
    .delete()
    .eq("source", "generated")
    .gte("shift_date", start)
    .lte("shift_date", end);
  if (del.error) throw del.error;

  if (rows.length > 0) {
    const ins = await supabase.from("shifts").upsert(rows, {
      onConflict: "employee_id,shift_date",
      ignoreDuplicates: true,
    });
    if (ins.error) throw ins.error;
  }

  return { generated: rows.length, start, end };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) {
      return new Response(JSON.stringify({ error: "missing env" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }
    const supabase = createClient(url, key);
    const body = (await req.json()) as GenerateAction;
    if (body.action !== "generate") {
      return new Response(JSON.stringify({ error: "unknown action" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }
    const result = await generate(supabase, body.year, body.month);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err && typeof err === "object" ? JSON.stringify(err) : String(err));
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
