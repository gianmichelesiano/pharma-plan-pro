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

function normalizeAppUrl(value: string | undefined): string {
  const fallback = "https://pharma-plan.speats.ch";
  const raw = (value ?? fallback).trim() || fallback;
  return raw.replace(/\/+$/, "");
}

type InitiateAction = { action: "initiate"; absence_id: string; shift_date: string; manual?: boolean };
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
  const appUrl = normalizeAppUrl(Deno.env.get("APP_URL"));

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
  const { absence_id, shift_date, manual = false } = body;

  // Check if request already exists for this absence/day (any status)
  const { data: existing } = await db
    .from("coverage_requests")
    .select("id, status")
    .eq("absence_id", absence_id)
    .eq("shift_date", shift_date)
    .maybeSingle();

  if (existing && (existing.status === "pending" || existing.status === "proposed")) {
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

  let requestId: string;
  if (existing) {
    requestId = existing.id;
    const { error: reqUpdErr } = await db
      .from("coverage_requests")
      .update({ role, status: "pending" })
      .eq("id", requestId);
    if (reqUpdErr) return json({ error: reqUpdErr.message }, 500);

    const { error: delPropErr } = await db
      .from("coverage_proposals")
      .delete()
      .eq("request_id", requestId);
    if (delPropErr) return json({ error: delPropErr.message }, 500);
  } else {
    const { data: request, error: reqErr } = await db
      .from("coverage_requests")
      .insert({ absence_id, shift_date, role, status: "pending" })
      .select("id")
      .single();
    if (reqErr || !request) return json({ error: reqErr?.message ?? "insert failed" }, 500);
    requestId = request.id;
  }

  if (candidates.length === 0) {
    await db
      .from("coverage_requests")
      .update({ status: "exhausted" })
      .eq("id", requestId);
    await notifyAdmin(db, "no_candidates", shift_date, role, appUrl);
    return json({ ok: true, request_id: requestId, exhausted: true });
  }

  // Insert proposals ordered by priority
  const proposals = candidates.map((c, i) => ({
    request_id: requestId,
    employee_id: c.employee_id,
    attempt_order: i + 1,
    token: crypto.randomUUID(),
  }));
  await db.from("coverage_proposals").insert(proposals);

  // Auto mode: send to first candidate. Manual mode: wait for explicit manual assignment.
  if (!manual) {
    await handleSendNextInner(db, requestId, appUrl);
  }

  return json({ ok: true, request_id: requestId, manual });
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

function renderCoverageEmail(params: {
  firstName: string;
  absentName: string;
  absenceReason: string;
  weekday: string;
  dateFormatted: string;
  acceptUrl: string;
  rejectUrl: string;
  expiresAt: string;
}) {
  const {
    firstName,
    absentName,
    absenceReason,
    weekday,
    dateFormatted,
    acceptUrl,
    rejectUrl,
    expiresAt,
  } = params;

  return `
    <div style="margin:0;padding:24px;background:#f4f8f2;font-family:Arial,sans-serif;color:#173f2f">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe8d9;border-radius:22px;overflow:hidden;box-shadow:0 12px 32px rgba(23,63,47,0.08)">
        <div style="padding:28px 32px;background:linear-gradient(135deg,#eaf3e8 0%,#f8fbf7 100%);border-bottom:1px solid #dbe8d9">
          <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#6b7f72;font-weight:700">Richiesta sostituzione</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.15;color:#173f2f">Ciao ${firstName},</h1>
          <p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:#325444">
            Sei disponibile a coprire il turno di <strong>${absentName}</strong>?
          </p>
        </div>

        <div style="padding:28px 32px">
          <div style="display:grid;gap:12px">
            <div style="display:flex;justify-content:space-between;gap:16px;padding:14px 16px;background:#f8fbf7;border:1px solid #e3eee1;border-radius:14px">
              <span style="color:#6b7f72">Giorno</span>
              <strong style="color:#173f2f;text-align:right">${weekday} ${dateFormatted}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;padding:14px 16px;background:#f8fbf7;border:1px solid #e3eee1;border-radius:14px">
              <span style="color:#6b7f72">Motivo assenza</span>
              <strong style="color:#173f2f;text-align:right">${absenceReason}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;gap:16px;padding:14px 16px;background:#f8fbf7;border:1px solid #e3eee1;border-radius:14px">
              <span style="color:#6b7f72">Dipendente assente</span>
              <strong style="color:#173f2f;text-align:right">${absentName}</strong>
            </div>
          </div>

          <div style="margin-top:28px;text-align:center">
            <a href="${acceptUrl}" style="display:inline-block;margin:0 8px 12px 0;padding:14px 26px;border-radius:14px;background:#174e39;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;box-shadow:0 8px 18px rgba(23,78,57,0.18)">Accetto</a>
            <a href="${rejectUrl}" style="display:inline-block;margin:0 0 12px 8px;padding:14px 26px;border-radius:14px;background:#dce8d7;color:#173f2f;text-decoration:none;font-weight:700;font-size:16px;border:1px solid #bfd3bb">Rifiuto</a>
          </div>

          <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#6b7f72;text-align:center">
            Link valido fino a <strong>${new Date(expiresAt).toLocaleString("it-IT")}</strong>
          </p>
        </div>
      </div>
    </div>
  `;
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
  const html = renderCoverageEmail({
    firstName: emp.first_name,
    absentName,
    absenceReason,
    weekday,
    dateFormatted,
    acceptUrl,
    rejectUrl,
    expiresAt,
  });

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
        source: "substitute",
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
    .select("id, shift_date, role, status, timeout_hours, absence_id")
    .eq("id", request_id)
    .single();
  if (!request) return json({ error: "request not found" }, 404);
  if (request.status === "accepted" || request.status === "cancelled") {
    return json({ error: "request not open" }, 409);
  }

  // Cancel any still-open proposals, then activate only the selected one.
  await db.from("coverage_proposals")
    .update({ status: "rejected" })
    .eq("request_id", request_id)
    .in("status", ["pending", "sent"]);

  const { data: existingProposal } = await db
    .from("coverage_proposals")
    .select("id")
    .eq("request_id", request_id)
    .eq("employee_id", employee_id)
    .maybeSingle();

  const proposalId = existingProposal?.id;
  if (!proposalId) {
    const { error: insErr } = await db.from("coverage_proposals").insert({
      request_id,
      employee_id,
      attempt_order: 999,
      token: crypto.randomUUID(),
      status: "pending",
    });
    if (insErr) return json({ error: insErr.message }, 500);
  } else {
    const { error: updErr } = await db
      .from("coverage_proposals")
      .update({ status: "pending", sent_at: null, responded_at: null, expires_at: null })
      .eq("id", proposalId);
    if (updErr) return json({ error: updErr.message }, 500);
  }

  const { data: selectedProposal } = await db
    .from("coverage_proposals")
    .select("id, token")
    .eq("request_id", request_id)
    .eq("employee_id", employee_id)
    .single();
  if (!selectedProposal) return json({ error: "proposal not found" }, 500);

  const expiresAt = new Date(Date.now() + (request.timeout_hours ?? 24) * 60 * 60 * 1000).toISOString();
  await db
    .from("coverage_proposals")
    .update({ status: "sent", sent_at: new Date().toISOString(), expires_at: expiresAt })
    .eq("id", selectedProposal.id);

  await db.from("coverage_requests").update({ status: "proposed" }).eq("id", request_id);

  const [empRes, absenceRes] = await Promise.all([
    db.from("employees").select("first_name, last_name, email").eq("id", employee_id).single(),
    db.from("absences")
      .select("type, employee:employees(first_name, last_name)")
      .eq("id", request.absence_id)
      .single(),
  ]);

  const emp = empRes.data;
  if (emp?.email) {
    const absence = absenceRes.data;
    const absentName = absence?.employee
      ? `${(absence.employee as { first_name: string; last_name: string }).first_name} ${(absence.employee as { first_name: string; last_name: string }).last_name}`
      : "—";
    const absenceReason = ABSENCE_TYPE_IT[absence?.type ?? ""] ?? (absence?.type ?? "—");
    const weekday = WEEKDAYS_IT[weekdayMon0(request.shift_date)];
    const dateFormatted = formatDateIT(request.shift_date);

    const acceptUrl = `${appUrl}/coverage/respond?token=${selectedProposal.token}&response=accept`;
    const rejectUrl = `${appUrl}/coverage/respond?token=${selectedProposal.token}&response=reject`;
    const html = renderCoverageEmail({
      firstName: emp.first_name,
      absentName,
      absenceReason,
      weekday,
      dateFormatted,
      acceptUrl,
      rejectUrl,
      expiresAt,
    });

    await db.functions.invoke("send-email", {
      body: {
        to: emp.email,
        subject: `Sostituzione turno — ${weekday} ${dateFormatted} (${absentName})`,
        html,
      },
    });
  }

  return json({ ok: true, status: "proposed" });
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
