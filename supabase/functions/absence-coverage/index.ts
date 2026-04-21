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
type SendNextAction = { action: "send_next"; request_id: string };
type RespondAction = { action: "respond"; token: string; response: "accept" | "reject" };

type Action = InitiateAction | SendNextAction | RespondAction;

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

  if (body.action === "initiate") {
    return await handleInitiate(db, body, appUrl);
  }
  if (body.action === "send_next") {
    return await handleSendNext(db, body, appUrl);
  }
  if (body.action === "respond") {
    return await handleRespond(db, body, appUrl);
  }
  return json({ error: "unknown action" }, 400);
});

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

  // Load absence to get absent employee's role
  const { data: absence, error: absErr } = await db
    .from("absences")
    .select("employee_id, employees!inner(role)")
    .eq("id", absence_id)
    .single();
  if (absErr || !absence) return json({ error: "absence not found" }, 404);

  const absentEmpId = absence.employee_id as string;
  const role = (absence.employees as unknown as { role: string }).role as string;
  const weekday = weekdayMon0(shift_date);

  // Count shifts per employee in the month (for fairness ordering)
  const monthStart = shift_date.slice(0, 7) + "-01";
  const monthEnd = new Date(
    Date.UTC(Number(shift_date.slice(0, 4)), Number(shift_date.slice(5, 7)), 0)
  ).toISOString().slice(0, 10);

  const { data: shiftCounts } = await db
    .from("shifts")
    .select("employee_id")
    .gte("shift_date", monthStart)
    .lte("shift_date", monthEnd);

  const countMap = new Map<string, number>();
  for (const s of shiftCounts ?? []) {
    countMap.set(s.employee_id, (countMap.get(s.employee_id) ?? 0) + 1);
  }

  // Find employees with same role, active, available on weekday, no shift/absence on shift_date
  const { data: patterns } = await db
    .from("weekly_patterns")
    .select("employee_id, pattern_type, employees!inner(id, role, active, email)")
    .eq("weekday", weekday)
    .eq("active", true)
    .eq("employees.active", true);

  // Employees already shifted on shift_date
  const { data: existingShifts } = await db
    .from("shifts")
    .select("employee_id")
    .eq("shift_date", shift_date);
  const shiftedSet = new Set((existingShifts ?? []).map((s) => s.employee_id));

  // Employees with approved absence on shift_date
  const { data: existingAbsences } = await db
    .from("absences")
    .select("employee_id")
    .eq("status", "approved")
    .lte("start_date", shift_date)
    .gte("end_date", shift_date);
  const absentSet = new Set((existingAbsences ?? []).map((a) => a.employee_id));

  type Candidate = { employee_id: string; email: string; pattern_type: string; shift_count: number };
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  for (const p of patterns ?? []) {
    const emp = p.employees as unknown as { id: string; role: string; active: boolean; email: string | null };
    if (
      emp.role !== role ||
      !emp.active ||
      emp.id === absentEmpId ||
      shiftedSet.has(emp.id) ||
      absentSet.has(emp.id) ||
      seen.has(emp.id)
    ) continue;
    seen.add(emp.id);
    candidates.push({
      employee_id: emp.id,
      email: emp.email ?? "",
      pattern_type: p.pattern_type as string,
      shift_count: countMap.get(emp.id) ?? 0,
    });
  }

  // Sort: fewest shifts first; accessory patterns break ties (they come first)
  candidates.sort((a, b) => {
    if (a.shift_count !== b.shift_count) return a.shift_count - b.shift_count;
    const ap = a.pattern_type === "accessory" ? 0 : 1;
    const bp = b.pattern_type === "accessory" ? 0 : 1;
    return ap - bp;
  });

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

  // Load employee email
  const { data: emp } = await db
    .from("employees")
    .select("first_name, last_name, email")
    .eq("id", proposal.employee_id)
    .single();

  if (!emp?.email) return;

  const acceptUrl = `${appUrl}/coverage/respond?token=${proposal.token}&response=accept`;
  const rejectUrl = `${appUrl}/coverage/respond?token=${proposal.token}&response=reject`;

  const html = `
    <p>Ciao ${emp.first_name},</p>
    <p>Sei disponibile a coprire il turno del <strong>${request.shift_date}</strong>?</p>
    <p>
      <a href="${acceptUrl}" style="background:#22c55e;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-right:12px">✓ Accetto</a>
      <a href="${rejectUrl}" style="background:#ef4444;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">✗ Rifiuto</a>
    </p>
    <p><small>Link valido fino a: ${new Date(expiresAt).toLocaleString("it-IT")}</small></p>
  `;

  await db.functions.invoke("send-email", {
    body: {
      to: emp.email,
      subject: `Richiesta sostituzione turno ${request.shift_date}`,
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
