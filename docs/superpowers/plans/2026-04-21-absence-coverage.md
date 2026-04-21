# Absence Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semi-automatic substitution flow — when an absence is added to a committed plan, admin triggers a substitution search; the system emails candidates in order of fairness until one accepts, then creates the shift automatically.

**Architecture:** New DB tables (`coverage_requests`, `coverage_proposals`) track the state machine. A new Edge Function `absence-coverage` handles initiate/send_next/respond actions. Frontend adds a public respond page (no auth), an admin requests dashboard, and extends AbsencesPage + AvailabilityPage.

**Tech Stack:** Supabase (PostgreSQL migrations, Edge Functions Deno/TS), React + TypeScript + Tanstack Query, nodemailer via existing `send-email` function.

---

## File Map

| File | Status | Purpose |
|---|---|---|
| `supabase/migrations/20260421000001_coverage_tables.sql` | Create | coverage_requests + coverage_proposals tables + RLS |
| `supabase/migrations/20260421000002_weekly_patterns_accessory.sql` | Create | Add pattern_type to weekly_patterns, update unique constraint |
| `supabase/functions/absence-coverage/index.ts` | Create | Edge Function: initiate / send_next / respond |
| `frontend/src/lib/coverage-requests.ts` | Create | API helpers + types for coverage_requests/proposals |
| `frontend/src/pages/CoverageRequestsPage.tsx` | Create | Admin dashboard for open requests |
| `frontend/src/pages/CoverageRespondPage.tsx` | Create | Public accept/reject page (no auth) |
| `frontend/src/pages/AbsencesPage.tsx` | Modify | Add conflict badges + "Cerca sostituto" button |
| `frontend/src/pages/AvailabilityPage.tsx` | Modify | Add Standard / Accessory tab switcher |
| `frontend/src/routes/router.tsx` | Modify | Add /coverage-requests (admin) + /coverage/respond (public) |
| `frontend/src/components/AppShell.tsx` | Modify | Add coverage-requests to nav |
| `frontend/src/i18n/translations.ts` | Modify | Add coverage keys for it/en/de/fr |

---

## Task 1: DB Migration — coverage tables

**Files:**
- Create: `supabase/migrations/20260421000001_coverage_tables.sql`

- [ ] **Step 1: Write migration**

```sql
-- coverage_requests: one per (absence, shift_date) pair
create table coverage_requests (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references absences(id) on delete cascade,
  shift_date date not null,
  role employee_role not null,
  status text not null default 'pending'
    check (status in ('pending','proposed','accepted','exhausted','cancelled')),
  timeout_hours smallint not null default 24,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coverage_requests_absence_idx on coverage_requests(absence_id);
create index coverage_requests_status_idx on coverage_requests(status, shift_date);

create trigger coverage_requests_set_updated_at
  before update on coverage_requests
  for each row execute function set_updated_at();

-- coverage_proposals: one row per candidate per request, ordered
create table coverage_proposals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references coverage_requests(id) on delete cascade,
  employee_id uuid not null references employees(id),
  attempt_order smallint not null,
  status text not null default 'pending'
    check (status in ('pending','sent','accepted','rejected','expired')),
  token text not null unique,
  sent_at timestamptz,
  responded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index coverage_proposals_request_idx on coverage_proposals(request_id, attempt_order);
create index coverage_proposals_token_idx on coverage_proposals(token);

-- RLS: service_role bypasses; authenticated admins can read/write
alter table coverage_requests enable row level security;
alter table coverage_proposals enable row level security;

create policy "admins manage coverage_requests"
  on coverage_requests for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

create policy "admins manage coverage_proposals"
  on coverage_proposals for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
```

- [ ] **Step 2: Apply migration**

```bash
cd /Users/gianmichele/Development/Personal/pharma-plan-pro
npx supabase db push
```

Expected: migration applied without errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260421000001_coverage_tables.sql
git commit -m "feat: add coverage_requests and coverage_proposals tables"
```

---

## Task 2: DB Migration — weekly_patterns accessory type

**Files:**
- Create: `supabase/migrations/20260421000002_weekly_patterns_accessory.sql`

> Note: current unique constraint is `(employee_id, weekday)`. Adding `pattern_type` means one employee can have both a standard AND an accessory pattern for the same weekday — so we drop the old constraint and add a new one that includes `pattern_type`.

- [ ] **Step 1: Write migration**

```sql
-- Drop old unique constraint (name may vary; check with \d weekly_patterns)
alter table weekly_patterns
  drop constraint if exists weekly_patterns_employee_id_weekday_key;

-- Add pattern_type column
alter table weekly_patterns
  add column pattern_type text not null default 'standard'
  check (pattern_type in ('standard', 'accessory'));

-- New unique constraint includes pattern_type
alter table weekly_patterns
  add constraint weekly_patterns_employee_weekday_type_key
  unique (employee_id, weekday, pattern_type);
```

- [ ] **Step 2: Apply migration**

```bash
npx supabase db push
```

Expected: no errors. Existing rows get `pattern_type = 'standard'`.

- [ ] **Step 3: Regenerate DB types**

```bash
npx supabase gen types typescript --linked > frontend/src/lib/database.types.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260421000002_weekly_patterns_accessory.sql frontend/src/lib/database.types.ts
git commit -m "feat: add pattern_type to weekly_patterns for accessory availability"
```

---

## Task 3: Edge Function `absence-coverage`

**Files:**
- Create: `supabase/functions/absence-coverage/index.ts`

This function uses the **service role key** (passed via env `SUPABASE_SERVICE_ROLE_KEY`) so it bypasses RLS. It calls `send-email` via `supabase.functions.invoke`.

- [ ] **Step 1: Write the function**

```typescript
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
    .eq("active", true);

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
    // Notify admin
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
    // All exhausted
    await db.from("coverage_requests").update({ status: "exhausted" }).eq("id", request_id);
    await notifyAdmin(db, "exhausted", request.shift_date, request.role, appUrl);
    return;
  }

  const expiresAt = new Date(Date.now() + request.timeout_hours * 60 * 60 * 1000).toISOString();

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
    await db
      .from("coverage_proposals")
      .update({ status: "accepted", responded_at: now })
      .eq("id", proposal.id);

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

    await notifyAdmin(db, "accepted", request?.shift_date ?? "", proposal.employee_id, appUrl);
    return json({ ok: true, result: "accepted" });
  }

  // reject
  await db
    .from("coverage_proposals")
    .update({ status: "rejected", responded_at: now })
    .eq("id", proposal.id);

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
```

- [ ] **Step 2: Deploy the function**

```bash
npx supabase functions deploy absence-coverage
```

- [ ] **Step 3: Set required env vars in Supabase secrets**

```bash
npx supabase secrets set APP_URL=https://your-app-url.vercel.app
npx supabase secrets set ADMIN_EMAIL=gianmichele.siano@ngft.com
```

> `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase into edge functions — no need to set manually.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/absence-coverage/index.ts
git commit -m "feat: absence-coverage edge function (initiate/send_next/respond)"
```

---

## Task 4: Frontend API helpers

**Files:**
- Create: `frontend/src/lib/coverage-requests.ts`

- [ ] **Step 1: Write helpers**

```typescript
import { supabase } from "./supabase";

export type CoverageRequest = {
  id: string;
  absence_id: string;
  shift_date: string;
  role: string;
  status: "pending" | "proposed" | "accepted" | "exhausted" | "cancelled";
  timeout_hours: number;
  created_at: string;
  updated_at: string;
  absence: {
    employee: { first_name: string; last_name: string } | null;
  } | null;
  proposals: CoverageProposal[];
};

export type CoverageProposal = {
  id: string;
  request_id: string;
  employee_id: string;
  attempt_order: number;
  status: "pending" | "sent" | "accepted" | "rejected" | "expired";
  expires_at: string | null;
  employee: { first_name: string; last_name: string } | null;
};

export async function fetchCoverageRequests(): Promise<CoverageRequest[]> {
  const { data, error } = await supabase
    .from("coverage_requests")
    .select(`
      *,
      absence:absences(employee:employees(first_name, last_name)),
      proposals:coverage_proposals(*, employee:employees(first_name, last_name))
    `)
    .not("status", "in", '("accepted","cancelled")')
    .order("shift_date");
  if (error) throw error;
  return data as unknown as CoverageRequest[];
}

export async function initiateRequest(absence_id: string, shift_date: string) {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "initiate", absence_id, shift_date },
  });
  if (error) throw error;
  return data as { ok: boolean; request_id: string; already_open?: boolean; exhausted?: boolean };
}

export async function sendNext(request_id: string) {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "send_next", request_id },
  });
  if (error) throw error;
  return data;
}

export async function respondToProposal(token: string, response: "accept" | "reject") {
  const { data, error } = await supabase.functions.invoke("absence-coverage", {
    body: { action: "respond", token, response },
  });
  if (error) throw error;
  return data as { ok: boolean; result: "accepted" | "rejected"; error?: string };
}

export async function cancelRequest(request_id: string) {
  const { error } = await supabase
    .from("coverage_requests")
    .update({ status: "cancelled" })
    .eq("id", request_id);
  if (error) throw error;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/coverage-requests.ts
git commit -m "feat: coverage-requests API helpers"
```

---

## Task 5: i18n keys

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

- [ ] **Step 1: Add coverage keys to all four languages**

Add inside each language object (`it`, `en`, `de`, `fr`) a new `coverage` section. Find the `nav` sections and add `coverageRequests` key too.

For `it`:
```typescript
// inside translations.it — add nav key
nav: {
  // ...existing keys...
  coverageRequests: "Copertura",
},
// add coverage section
coverage: {
  title: "Richieste di sostituzione",
  description: "Gestisci le sostituzioni per assenze dell'ultimo momento.",
  shiftDate: "Data turno",
  absentEmployee: "Assente",
  status: "Stato",
  currentCandidate: "Candidato attuale",
  expires: "Scade",
  actions: "Azioni",
  resend: "Reinvia al prossimo",
  cancel: "Annulla",
  manualFix: "Gestisci manuale",
  noRequests: "Nessuna richiesta aperta.",
  initiate: "Cerca sostituto",
  viewRequest: "Vedi richiesta",
  status_pending: "In attesa",
  status_proposed: "Proposta inviata",
  status_accepted: "Accettata",
  status_exhausted: "Esaurita",
  status_cancelled: "Annullata",
  respondAccepted: "Turno confermato, grazie!",
  respondRejected: "Risposta registrata.",
  respondExpired: "Link scaduto.",
  respondAlreadyUsed: "Hai già risposto.",
  respondError: "Errore nel processare la risposta.",
},
availability: {
  // ...existing keys...
  tabStandard: "Disponibilità Standard",
  tabAccessory: "Disponibilità Accessoria",
},
```

For `en`:
```typescript
nav: { coverageRequests: "Coverage" },
coverage: {
  title: "Substitution Requests",
  description: "Manage substitutions for last-minute absences.",
  shiftDate: "Shift Date",
  absentEmployee: "Absent",
  status: "Status",
  currentCandidate: "Current Candidate",
  expires: "Expires",
  actions: "Actions",
  resend: "Try Next Candidate",
  cancel: "Cancel",
  manualFix: "Handle Manually",
  noRequests: "No open requests.",
  initiate: "Find Substitute",
  viewRequest: "View Request",
  status_pending: "Pending",
  status_proposed: "Proposal Sent",
  status_accepted: "Accepted",
  status_exhausted: "Exhausted",
  status_cancelled: "Cancelled",
  respondAccepted: "Shift confirmed, thank you!",
  respondRejected: "Response recorded.",
  respondExpired: "Link expired.",
  respondAlreadyUsed: "You have already responded.",
  respondError: "Error processing response.",
},
availability: { tabStandard: "Standard Availability", tabAccessory: "Accessory Availability" },
```

For `de`:
```typescript
nav: { coverageRequests: "Vertretungen" },
coverage: {
  title: "Vertretungsanfragen",
  description: "Vertretungen bei kurzfristigen Abwesenheiten verwalten.",
  shiftDate: "Schichtdatum",
  absentEmployee: "Abwesend",
  status: "Status",
  currentCandidate: "Aktueller Kandidat",
  expires: "Läuft ab",
  actions: "Aktionen",
  resend: "Nächsten Kandidaten kontaktieren",
  cancel: "Abbrechen",
  manualFix: "Manuell verwalten",
  noRequests: "Keine offenen Anfragen.",
  initiate: "Ersatz suchen",
  viewRequest: "Anfrage anzeigen",
  status_pending: "Ausstehend",
  status_proposed: "Vorschlag gesendet",
  status_accepted: "Akzeptiert",
  status_exhausted: "Erschöpft",
  status_cancelled: "Abgebrochen",
  respondAccepted: "Schicht bestätigt, danke!",
  respondRejected: "Antwort registriert.",
  respondExpired: "Link abgelaufen.",
  respondAlreadyUsed: "Du hast bereits geantwortet.",
  respondError: "Fehler bei der Verarbeitung.",
},
availability: { tabStandard: "Standardverfügbarkeit", tabAccessory: "Zusätzliche Verfügbarkeit" },
```

For `fr`:
```typescript
nav: { coverageRequests: "Remplacements" },
coverage: {
  title: "Demandes de remplacement",
  description: "Gérer les remplacements pour les absences de dernière minute.",
  shiftDate: "Date de service",
  absentEmployee: "Absent(e)",
  status: "Statut",
  currentCandidate: "Candidat actuel",
  expires: "Expire",
  actions: "Actions",
  resend: "Contacter le suivant",
  cancel: "Annuler",
  manualFix: "Gérer manuellement",
  noRequests: "Aucune demande ouverte.",
  initiate: "Chercher remplaçant",
  viewRequest: "Voir la demande",
  status_pending: "En attente",
  status_proposed: "Proposition envoyée",
  status_accepted: "Acceptée",
  status_exhausted: "Épuisée",
  status_cancelled: "Annulée",
  respondAccepted: "Service confirmé, merci !",
  respondRejected: "Réponse enregistrée.",
  respondExpired: "Lien expiré.",
  respondAlreadyUsed: "Vous avez déjà répondu.",
  respondError: "Erreur lors du traitement.",
},
availability: { tabStandard: "Disponibilité Standard", tabAccessory: "Disponibilité Accessoire" },
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/i18n/translations.ts
git commit -m "feat: i18n keys for coverage and availability tabs"
```

---

## Task 6: AvailabilityPage — accessory tab

**Files:**
- Modify: `frontend/src/pages/AvailabilityPage.tsx`

- [ ] **Step 1: Add tab state and filter patterns by pattern_type**

Replace the content of `AvailabilityPage.tsx` with:

```typescript
import { useState } from "react";
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
  const [patternType, setPatternType] = useState<PatternType>("standard");

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

  const upsertMutation = useMutation({
    mutationFn: async ({
      employee_id,
      weekday,
      active,
    }: {
      employee_id: string;
      weekday: number;
      active: boolean;
    }) => {
      const { error } = await supabase
        .from("weekly_patterns")
        .upsert(
          { employee_id, weekday, active, pattern_type: patternType },
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

  const map: Record<string, boolean> = {};
  patterns.forEach((p) => {
    map[`${p.employee_id}-${String(p.weekday)}`] = p.active;
  });

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
                  return (
                    <td key={weekday}>
                      <input
                        type="checkbox"
                        checked={!!map[key]}
                        disabled={upsertMutation.isPending}
                        onChange={(e) =>
                          upsertMutation.mutate({
                            employee_id: emp.id,
                            weekday,
                            active: e.target.checked,
                          })
                        }
                      />
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AvailabilityPage.tsx
git commit -m "feat: availability page accessory tab"
```

---

## Task 7: AbsencesPage — conflict badge + initiate button

**Files:**
- Modify: `frontend/src/pages/AbsencesPage.tsx`

- [ ] **Step 1: Add coverage query and button to the absences table**

Add these imports and logic to `AbsencesPage.tsx`:

After existing imports, add:
```typescript
import { useMutation as useMut2, useQuery as useQ2, useQueryClient } from "@tanstack/react-query";
import { initiateRequest, fetchCoverageRequests } from "../lib/coverage-requests";
import { useCoverageIssues } from "../lib/coverage";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
```

Inside `AbsencesPage` function, add after existing state:
```typescript
const { isAdmin } = useAuth();
const navigate = useNavigate();
const now2 = new Date();
const coverageQuery = useQ2({
  queryKey: ["coverage_requests_open"],
  queryFn: fetchCoverageRequests,
  enabled: isAdmin,
});

// Map absence_id -> open request id
const openRequestMap = useMemo(() => {
  const m = new Map<string, string>();
  for (const r of coverageQuery.data ?? []) {
    if (r.absence_id) m.set(r.absence_id, r.id);
  }
  return m;
}, [coverageQuery.data]);

// Coverage issues for current month view
const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
const monthEndDate = new Date(selectedYear, selectedMonth + 1, 0);
const monthEnd = monthEndDate.toISOString().slice(0, 10);
const issuesQuery = useCoverageIssues(monthStart, monthEnd);

// Set of "employee_id|date" conflict pairs
const conflictPairs = useMemo(() => {
  const s = new Set<string>();
  for (const i of issuesQuery.data ?? []) {
    if (i.kind === "conflict" && i.employee_id) {
      s.add(i.employee_id);
    }
  }
  return s;
}, [issuesQuery.data]);

const initiateMutation = useMut2({
  mutationFn: async ({ absence_id, shift_date }: { absence_id: string; shift_date: string }) => {
    return initiateRequest(absence_id, shift_date);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] });
  },
});
```

In the table row for each absence, replace the delete button cell with:
```tsx
<td>
  <div style={{ display: "flex", gap: "0.5rem" }}>
    {isAdmin && conflictPairs.has(row.employee_id) && (() => {
      const openId = openRequestMap.get(row.id);
      if (openId) {
        return (
          <button
            type="button"
            className="secondary"
            onClick={() => navigate("/coverage-requests")}
          >
            {t.viewRequest ?? "Vedi richiesta"}
          </button>
        );
      }
      // Generate one "seek substitute" button per day in absence range
      const days: string[] = [];
      const s = new Date(row.start_date + "T00:00:00Z");
      const e = new Date(row.end_date + "T00:00:00Z");
      for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
        days.push(d.toISOString().slice(0, 10));
      }
      return days.map((day) => (
        <button
          key={day}
          type="button"
          className="primary"
          disabled={initiateMutation.isPending}
          onClick={() => initiateMutation.mutate({ absence_id: row.id, shift_date: day })}
        >
          {t.initiate ?? "Cerca sostituto"} {day.slice(5)}
        </button>
      ));
    })()}
    <button type="button" className="secondary" onClick={() => deleteMutation.mutate(row.id)}>{c.delete}</button>
  </div>
</td>
```

Also add the `t` translations keys to `useT("absences")` — add to the absences section in translations:
```typescript
absences: {
  // ...existing...
  initiate: "Cerca sostituto",
  viewRequest: "Vedi richiesta",
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/AbsencesPage.tsx frontend/src/i18n/translations.ts
git commit -m "feat: absence page conflict badge and seek-substitute button"
```

---

## Task 8: CoverageRequestsPage

**Files:**
- Create: `frontend/src/pages/CoverageRequestsPage.tsx`

- [ ] **Step 1: Write the page**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import {
  fetchCoverageRequests,
  sendNext,
  cancelRequest,
  type CoverageRequest,
} from "../lib/coverage-requests";

const STATUS_COLORS: Record<string, string> = {
  pending: "#94a3b8",
  proposed: "#f59e0b",
  accepted: "#22c55e",
  exhausted: "#ef4444",
  cancelled: "#94a3b8",
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(-2)}`;
}

function isExpired(request: CoverageRequest): boolean {
  const sent = request.proposals.find((p) => p.status === "sent");
  if (!sent?.expires_at) return false;
  return new Date(sent.expires_at) < new Date();
}

function currentCandidate(request: CoverageRequest): string {
  const sent = request.proposals.find((p) => p.status === "sent");
  if (!sent?.employee) return "—";
  return `${sent.employee.first_name} ${sent.employee.last_name}`;
}

function expiresLabel(request: CoverageRequest): string {
  const sent = request.proposals.find((p) => p.status === "sent");
  if (!sent?.expires_at) return "—";
  const diff = new Date(sent.expires_at).getTime() - Date.now();
  if (diff <= 0) return "Scaduto";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export function CoverageRequestsPage() {
  const t = useT("coverage");
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ["coverage_requests_open"],
    queryFn: fetchCoverageRequests,
    refetchInterval: 60_000,
  });

  const sendNextMutation = useMutation({
    mutationFn: (request_id: string) => sendNext(request_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (request_id: string) => cancelRequest(request_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coverage_requests_open"] }),
  });

  const requests = requestsQuery.data ?? [];

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        {requestsQuery.isLoading ? <p>Caricamento...</p> : null}
        {!requestsQuery.isLoading && requests.length === 0 ? (
          <p>{t.noRequests}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t.shiftDate}</th>
                <th>{t.absentEmployee}</th>
                <th>{t.status}</th>
                <th>{t.currentCandidate}</th>
                <th>{t.expires}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{formatDate(r.shift_date)}</td>
                  <td>
                    {r.absence?.employee
                      ? `${r.absence.employee.first_name} ${r.absence.employee.last_name}`
                      : "—"}
                  </td>
                  <td>
                    <span
                      style={{
                        background: STATUS_COLORS[r.status] ?? "#94a3b8",
                        color: "#fff",
                        borderRadius: "4px",
                        padding: "2px 8px",
                        fontSize: "0.8rem",
                      }}
                    >
                      {(t as unknown as Record<string, string>)[`status_${r.status}`] ?? r.status}
                    </span>
                  </td>
                  <td>{currentCandidate(r)}</td>
                  <td>{expiresLabel(r)}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {r.status === "proposed" && isExpired(r) && (
                        <button
                          className="primary"
                          disabled={sendNextMutation.isPending}
                          onClick={() => sendNextMutation.mutate(r.id)}
                        >
                          {t.resend}
                        </button>
                      )}
                      {r.status === "exhausted" && (
                        <span style={{ color: "#ef4444", fontSize: "0.85rem" }}>{t.manualFix}</span>
                      )}
                      {(r.status === "pending" || r.status === "proposed") && (
                        <button
                          className="secondary"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(r.id)}
                        >
                          {t.cancel}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CoverageRequestsPage.tsx
git commit -m "feat: coverage requests admin page"
```

---

## Task 9: CoverageRespondPage (public, no auth)

**Files:**
- Create: `frontend/src/pages/CoverageRespondPage.tsx`

- [ ] **Step 1: Write the page**

```typescript
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { respondToProposal } from "../lib/coverage-requests";
import { useT } from "../i18n/useT";

type State = "loading" | "accepted" | "rejected" | "expired" | "already_responded" | "error";

export function CoverageRespondPage() {
  const [searchParams] = useSearchParams();
  const t = useT("coverage");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    const response = searchParams.get("response") as "accept" | "reject" | null;

    if (!token || (response !== "accept" && response !== "reject")) {
      setState("error");
      return;
    }

    respondToProposal(token, response)
      .then((data) => {
        if (data.error === "token_expired") setState("expired");
        else if (data.error === "already_responded") setState("already_responded");
        else if (data.result === "accepted") setState("accepted");
        else setState("rejected");
      })
      .catch(() => setState("error"));
  }, []);

  const messages: Record<State, string> = {
    loading: "...",
    accepted: t.respondAccepted,
    rejected: t.respondRejected,
    expired: t.respondExpired,
    already_responded: t.respondAlreadyUsed,
    error: t.respondError,
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
        fontSize: "1.25rem",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <p>{messages[state]}</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CoverageRespondPage.tsx
git commit -m "feat: public coverage respond page"
```

---

## Task 10: Router + Nav wiring

**Files:**
- Modify: `frontend/src/routes/router.tsx`
- Modify: `frontend/src/components/AppShell.tsx`

- [ ] **Step 1: Add routes to router.tsx**

Add imports:
```typescript
import { CoverageRequestsPage } from "../pages/CoverageRequestsPage";
import { CoverageRespondPage } from "../pages/CoverageRespondPage";
```

Add `/coverage/respond` as a top-level public route (before the protected wrapper):
```typescript
{ path: "/coverage/respond", element: <CoverageRespondPage /> },
```

Add `/coverage-requests` inside `AdminRoute` children:
```typescript
{ path: "coverage-requests", element: <CoverageRequestsPage /> },
```

Final router structure:
```typescript
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/pending", element: <PendingApprovalPage /> },
  { path: "/coverage/respond", element: <CoverageRespondPage /> },
  {
    path: "/",
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "schedule", element: <SchedulePage /> },
      { path: "piano", element: <PianificazionePage /> },
      {
        element: <AdminRoute />,
        children: [
          { path: "employees", element: <EmployeesPage /> },
          { path: "availability", element: <AvailabilityPage /> },
          { path: "absences", element: <AbsencesPage /> },
          { path: "rules", element: <RulesPage /> },
          { path: "training", element: <TrainingPage /> },
          { path: "email-test", element: <EmailTestPage /> },
          { path: "coverage-requests", element: <CoverageRequestsPage /> },
        ],
      },
      { path: "admin/users", element: <AdminRoute><AdminUsersPage /></AdminRoute> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
```

- [ ] **Step 2: Add nav entry in AppShell.tsx**

In `navRoutes` array add:
```typescript
{ to: "/coverage-requests", key: "coverageRequests", adminOnly: true },
```

Update `NavKey` type:
```typescript
type NavKey = "dashboard" | "rules" | "employees" | "availability" | "absences" | "training" | "schedule" | "piano" | "users" | "coverageRequests";
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd frontend && npm run build
```

Expected: build completes with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/router.tsx frontend/src/components/AppShell.tsx
git commit -m "feat: wire coverage-requests and coverage-respond routes"
```

---

## Task 11: Planning engine — exclude accessory patterns

**Files:**
- Modify: `supabase/functions/planning-engine/index.ts`

The planning engine queries `weekly_patterns` without filtering by `pattern_type`. After the migration, it must only use `standard` patterns to generate shifts.

- [ ] **Step 1: Add pattern_type filter**

Find this line in `planning-engine/index.ts`:
```typescript
supabase.from("weekly_patterns").select("employee_id, weekday, active").eq("active", true),
```

Change to:
```typescript
supabase.from("weekly_patterns").select("employee_id, weekday, active").eq("active", true).eq("pattern_type", "standard"),
```

- [ ] **Step 2: Deploy updated planning engine**

```bash
npx supabase functions deploy planning-engine
```

- [ ] **Step 3: Commit**

```bash
git add supabase/functions/planning-engine/index.ts
git commit -m "fix: planning engine only uses standard weekly patterns"
```

---

## Self-Review

**Spec coverage:**
- ✅ `coverage_requests` + `coverage_proposals` tables (Task 1)
- ✅ `weekly_patterns.pattern_type` migration (Task 2)
- ✅ Edge Function initiate/send_next/respond (Task 3)
- ✅ Candidate ordering: fewest shifts + accessory priority (Task 3)
- ✅ Timeout configurable per request with default 24h (Task 3)
- ✅ Cascade to next on reject, exhausted → admin email (Task 3)
- ✅ Token-based accept/reject via email link (Task 3)
- ✅ Conflict detected → shift created on accept (Task 3)
- ✅ AvailabilityPage Standard/Accessory tabs (Task 6)
- ✅ AbsencesPage conflict badge + initiate button (Task 7)
- ✅ CoverageRequestsPage with resend/cancel (Task 8)
- ✅ Public CoverageRespondPage no auth (Task 9)
- ✅ Router + nav wiring (Task 10)
- ✅ Planning engine excludes accessory patterns (Task 11)
- ✅ `APP_URL` + `ADMIN_EMAIL` env vars documented (Task 3)

**No candidates edge case:** handled in `handleInitiate` — request goes straight to `exhausted` and admin is emailed.

**Duplicate initiate:** handled — returns existing open request id.

**`already_responded` / `token_expired`:** both handled in `handleRespond`.
