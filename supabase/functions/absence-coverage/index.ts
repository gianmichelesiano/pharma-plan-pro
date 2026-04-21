import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function weekdayMon0(iso: string): number {
  const d = new Date(iso + "T00:00:00Z").getUTCDay();
  return (d + 6) % 7;
}

type InitiateAction = { action: "initiate"; absence_id: string; shift_date: string };
type PreviewAction = { action: "preview"; absence_id: string; shift_date: string };
type SendNextAction = { action: "send_next"; request_id: string };
type RespondAction = { action: "respond"; token: string; response: "accept" | "reject" };
type ManualAssignAction = { action: "manual_assign"; request_id: string; employee_id: string };

type Action = InitiateAction | PreviewAction | SendNextAction | RespondAction | ManualAssignAction;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let body: Action;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (body.action === "preview") {
    return await handlePreview(db, body);
  }
  if (body.action === "initiate") {
    return await handleInitiate(db, body, appUrl);
  }
  if (body.action === "send_next") {
    return await handleSendNext(db, body, appUrl);
  }
  if (body.action === "respond") {
    return await handleRespond(db, body, appUrl);
  }
  if (body.action === "manual_assign") {
    return await handleManualAssign(db, body, appUrl);
  }
  return json({ error: "unknown action" }, 400);
});

type Candidate = {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  pattern_type: "standard" | "accessory" | "none";
  shift_count: number;
  available: boolean;
  unavailable_reason?: "already_shifted" | "absent";
};

async function buildCandidates(
  db: ReturnType<typeof createClient>,
  absence_id: string,
  shift_date: string,
): Promise<{ candidates: Candidate[]; role: string; absentEmpId: string } | { error: string; status: number }> {
  const { data: absence, error: absErr } = await db
    .from("absences")
    .select("employee_id, employees!inner(role)")
    .eq("id", absence_id)
    .single();
  if (absErr || !absence) return { error: "absence not found", status: 404 };

  const absentEmpId = absence.employee_id as string;
  const role = (absence.employees as unknown as { role: string }).role as string;
  const weekday = weekdayMon0(shift_date);

  const monthStart = shift_date.slice(0, 7) + "-01";
  const monthEnd = new Date(
    Date.UTC(Number(shift_date.slice(0, 4)), Number(shift_date.slice(5, 7)), 0)
  ).toISOString().slice(0, 10);

  const [shiftCountsRes, patternsRes, allEmpsRes, existingShiftsRes, existingAbsencesRes] = await Promise.all([
    db.from("shifts").select("employee_id").gte("shift_date", monthStart).lte("shift_date", monthEnd),
    db.from("weekly_patterns")
      .select("employee_id, pattern_type")
      .eq("weekday", weekday)
      .eq("active", true),
    db.from("employees")
      .select("id, first_name, last_name, email, role")
      .eq("active", true)
      .eq("role", role),
    db.from("shifts").select("employee_id").eq("shift_date", shift_date),
    db.from("absences").select("employee_id").eq("status", "approved")
      .lte("start_date", shift_date).gte("end_date", shift_date),
  ]);

  const countMap = new Map<string, number>();
  for (const s of shiftCountsRes.data ?? []) {
    countMap.set(s.employee_id, (countMap.get(s.employee_id) ?? 0) + 1);
  }
  const shiftedSet = new Set((existingShiftsRes.data ?? []).map((s) => s.employee_id));
  const absentSet = new Set((existingAbsencesRes.data ?? []).map((a) => a.employee_id));

  // Best pattern_type per employee for this weekday
  const patternMap = new Map<string, "standard" | "accessory">();
  for (const p of patternsRes.data ?? []) {
    const existing = patternMap.get(p.employee_id);
    if (!existing || p.pattern_type === "accessory") {
      patternMap.set(p.employee_id, p.pattern_type as "standard" | "accessory");
    }
  }

  const candidates: Candidate[] = [];
  for (const emp of allEmpsRes.data ?? []) {
    if (emp.id === absentEmpId) continue;
    const patternType = patternMap.get(emp.id) ?? "none";
    const isShifted = shiftedSet.has(emp.id);
    const isAbsent = absentSet.has(emp.id);
    const available = patternType !== "none" && !isShifted && !isAbsent;
    candidates.push({
      employee_id: emp.id,
      first_name: emp.first_name,
      last_name: emp.last_name,
      email: emp.email ?? "",
      pattern_type: patternType,
      shift_count: countMap.get(emp.id) ?? 0,
      available,
      unavailable_reason: isShifted ? "already_shifted" : isAbsent ? "absent" : undefined,
    });
  }

  // Available first (sorted by shifts asc, accessory priority), then unavailable
  candidates.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (!a.available) return 0;
    if (a.shift_count !== b.shift_count) return a.shift_count - b.shift_count;
    const ap = a.pattern_type === "accessory" ? 0 : 1;
    const bp = b.pattern_type === "accessory" ? 0 : 1;
    return ap - bp;
  });

  return { candidates, role, absentEmpId };
}

async function handlePreview(
  db: ReturnType<typeof createClient>,
  body: PreviewAction,
) {
  const result = await buildCandidates(db, body.absence_id, body.shift_date);
  if ("error" in result) return json({ error: result.error }, result.status);
  return json({ ok: true, candidates: result.candidates });
}

async function handleInitiate(
  db: ReturnType<typeof createClient>,
  body: InitiateAction,
  appUrl: string,
) {
  const { absence_id, shift_date } = body;

  // Check if open request already exists
  const { data: existing } = await db
    .from("coverage_requests")
    .select("id, status")
    .eq("absence_id", absence_id)
    .eq("shift_date", shift_date)
    .in("status", ["pending", "proposed"])
    .maybeSingle();

  if (existing) {
    return json({ ok: true, request_id: existing.id, already_open: true });
  }

  // Verify there is actually a coverage gap on this date
  const { data: issues } = await db.rpc("get_coverage_issues", {
    p_start: shift_date,
    p_end: shift_date,
  });
  const hasGap = (issues ?? []).some(
    (i: { kind: string }) => i.kind === "conflict" || i.kind === "shortage"
  );
  if (!hasGap) return json({ ok: true, no_gap: true });

  const result = await buildCandidates(db, absence_id, shift_date);
  if ("error" in result) return json({ error: result.error }, result.status);
  const { candidates, role } = result;

  // Create coverage_request
  const { data: request, error: reqErr } = await db
    .from("coverage_requests")
    .insert({ absence_id, shift_date, role, status: "pending" })
    .select("id")
    .single();
  if (reqErr || !request) return json({ error: reqErr?.message ?? "insert failed" }, 500);

  if (candidates.length === 0) {
    await db
      .from("coverage_requests")
      .update({ status: "exhausted" })
      .eq("id", request.id);
    await notifyAdmin(db, "no_candidates", shift_date, role, appUrl);
    return json({ ok: true, request_id: request.id, exhausted: true });
  }

  // Insert proposals ordered by priority
  const proposals = candidates.map((c, i) => ({
    request_id: request.id,
    employee_id: c.employee_id,
    attempt_order: i + 1,
    token: crypto.randomUUID(),
  }));
  await db.from("coverage_proposals").insert(proposals);

  // Send to first candidate
  await handleSendNextInner(db, request.id, appUrl);

  return json({ ok: true, request_id: request.id });
}

async function handleSendNext(
  db: ReturnType<typeof createClient>,
  body: SendNextAction,
  appUrl: string,
) {
  await handleSendNextInner(db, body.request_id, appUrl);
  return json({ ok: true });
}

const WEEKDAYS_IT = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const ABSENCE_TYPE_IT: Record<string, string> = {
  VACATION: "Ferie",
  SICK: "Malattia",
  UNAVAILABLE: "Non disponibile",
  SCHOOL: "Scuola",
  TRAINING: "Formazione",
  HR_MEETING: "Riunione HR",
};

function formatDateIT(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function handleSendNextInner(
  db: ReturnType<typeof createClient>,
  request_id: string,
  appUrl: string,
) {
  const { data: request } = await db
    .from("coverage_requests")
    .select("id, shift_date, role, timeout_hours, absence_id")
    .eq("id", request_id)
    .single();
  if (!request) return;

  // Find next pending proposal
  const { data: proposal } = await db
    .from("coverage_proposals")
    .select("id, employee_id, token")
    .eq("request_id", request_id)
    .eq("status", "pending")
    .order("attempt_order")
    .limit(1)
    .maybeSingle();

  if (!proposal) {
    await db.from("coverage_requests").update({ status: "exhausted" }).eq("id", request_id);
    await notifyAdmin(db, "exhausted", request.shift_date, request.role, appUrl);
    return;
  }

  const expiresAt = new Date(Date.now() + (request.timeout_hours ?? 24) * 60 * 60 * 1000).toISOString();

  await db
    .from("coverage_proposals")
    .update({ status: "sent", sent_at: new Date().toISOString(), expires_at: expiresAt })
    .eq("id", proposal.id);

  await db.from("coverage_requests").update({ status: "proposed" }).eq("id", request_id);

  // Load employee email + absence details in parallel
  const [empRes, absenceRes] = await Promise.all([
    db.from("employees").select("first_name, last_name, email").eq("id", proposal.employee_id).single(),
    db.from("absences")
      .select("type, employee:employees(first_name, last_name)")
      .eq("id", request.absence_id)
      .single(),
  ]);

  const emp = empRes.data;
  if (!emp?.email) return;

  const absence = absenceRes.data;
  const absentName = absence?.employee
    ? `${(absence.employee as { first_name: string; last_name: string }).first_name} ${(absence.employee as { first_name: string; last_name: string }).last_name}`
    : "—";
  const absenceReason = ABSENCE_TYPE_IT[absence?.type ?? ""] ?? (absence?.type ?? "—");
  const weekday = WEEKDAYS_IT[weekdayMon0(request.shift_date)];
  const dateFormatted = formatDateIT(request.shift_date);

  const acceptUrl = `${appUrl}/coverage/respond?token=${proposal.token}&response=accept`;
  const rejectUrl = `${appUrl}/coverage/respond?token=${proposal.token}&response=reject`;

  const html = `
    <p>Ciao ${emp.first_name},</p>
    <p>Sei disponibile a coprire il turno di <strong>${absentName}</strong>?</p>
    <table style="border-collapse:collapse;margin:1rem 0;font-size:0.95rem">
      <tr><td style="padding:4px 12px 4px 0;color:#666">Giorno</td><td><strong>${weekday} ${dateFormatted}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Motivo assenza</td><td><strong>${absenceReason}</strong></td></tr>
      <tr><td style="padding:4px 12px 4px 0;color:#666">Dipendente assente</td><td><strong>${absentName}</strong></td></tr>
    </table>
    <p>
      <a href="${acceptUrl}" style="background:#22c55e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px">✓ Accetto</a>
      <a href="${rejectUrl}" style="background:#ef4444;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">✗ Rifiuto</a>
    </p>
    <p><small>Link valido fino a: ${new Date(expiresAt).toLocaleString("it-IT")}</small></p>
  `;

  await db.functions.invoke("send-email", {
    body: {
      to: emp.email,
      subject: `Sostituzione turno — ${weekday} ${dateFormatted} (${absentName})`,
      html,
    },
  });
}

async function handleRespond(
  db: ReturnType<typeof createClient>,
  body: RespondAction,
  appUrl: string,
) {
  const { token, response } = body;

  const { data: proposal } = await db
    .from("coverage_proposals")
    .select("id, request_id, employee_id, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!proposal) return json({ error: "token_not_found" }, 404);
  if (proposal.status === "accepted" || proposal.status === "rejected") {
    return json({ error: "already_responded" }, 409);
  }
  if (proposal.expires_at && new Date(proposal.expires_at) < new Date()) {
    return json({ error: "token_expired" }, 410);
  }
  if (proposal.status !== "sent") {
    return json({ error: "token_not_active" }, 409);
  }

  const now = new Date().toISOString();

  if (response === "accept") {
    const { data: updated } = await db
      .from("coverage_proposals")
      .update({ status: "accepted", responded_at: now })
      .eq("id", proposal.id)
      .eq("status", "sent")
      .select("id")
      .maybeSingle();
    if (!updated) return json({ error: "already_responded" }, 409);

    const { data: request } = await db
      .from("coverage_requests")
      .select("shift_date")
      .eq("id", proposal.request_id)
      .single();

    await db.from("coverage_requests").update({ status: "accepted" }).eq("id", proposal.request_id);

    if (request) {
      await db.from("shifts").insert({
        employee_id: proposal.employee_id,
        shift_date: request.shift_date,
        source: "manual",
      });
    }

    const { data: acceptedEmp } = await db
      .from("employees")
      .select("first_name, last_name")
      .eq("id", proposal.employee_id)
      .single();
    const empName = acceptedEmp ? `${acceptedEmp.first_name} ${acceptedEmp.last_name}` : proposal.employee_id;
    await notifyAdmin(db, "accepted", request?.shift_date ?? "", empName, appUrl);
    return json({ ok: true, result: "accepted" });
  }

  // reject
  const { data: updatedReject } = await db
    .from("coverage_proposals")
    .update({ status: "rejected", responded_at: now })
    .eq("id", proposal.id)
    .eq("status", "sent")
    .select("id")
    .maybeSingle();
  if (!updatedReject) return json({ error: "already_responded" }, 409);

  await handleSendNextInner(db, proposal.request_id, appUrl);
  return json({ ok: true, result: "rejected" });
}

async function handleManualAssign(
  db: ReturnType<typeof createClient>,
  body: ManualAssignAction,
  appUrl: string,
) {
  const { request_id, employee_id } = body;

  const { data: request } = await db
    .from("coverage_requests")
    .select("id, shift_date, role")
    .eq("id", request_id)
    .single();
  if (!request) return json({ error: "request not found" }, 404);

  // Insert shift (ignore if already exists)
  await db.from("shifts").upsert(
    { employee_id, shift_date: request.shift_date, source: "manual" },
    { onConflict: "employee_id,shift_date", ignoreDuplicates: true }
  );

  // Mark request accepted
  await db.from("coverage_requests").update({ status: "accepted" }).eq("id", request_id);

  // Cancel any pending/sent proposals
  await db.from("coverage_proposals")
    .update({ status: "rejected" })
    .eq("request_id", request_id)
    .in("status", ["pending", "sent"]);

  const { data: emp } = await db.from("employees").select("first_name, last_name").eq("id", employee_id).single();
  const empName = emp ? `${emp.first_name} ${emp.last_name}` : employee_id;
  await notifyAdmin(db, "accepted", request.shift_date, empName, appUrl);

  return json({ ok: true });
}

async function notifyAdmin(
  db: ReturnType<typeof createClient>,
  event: string,
  shiftDate: string,
  detail: string,
  _appUrl: string,
) {
  const adminEmail = Deno.env.get("ADMIN_EMAIL");
  if (!adminEmail) return;

  const subjects: Record<string, string> = {
    no_candidates: `Nessun sostituto trovato per il ${shiftDate}`,
    exhausted: `Tutti i candidati hanno rifiutato per il ${shiftDate}`,
    accepted: `Turno ${shiftDate} coperto da ${detail}`,
  };

  await db.functions.invoke("send-email", {
    body: {
      to: adminEmail,
      subject: subjects[event] ?? `Coverage update ${shiftDate}`,
      text: `Evento: ${event} — data: ${shiftDate} — dettaglio: ${detail}`,
    },
  });
}
