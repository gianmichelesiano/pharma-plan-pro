# Absence Coverage — Design Spec
_Date: 2026-04-21_

## Problem

After a monthly plan is committed, absences can be added (sickness, training, etc.). These create two types of coverage gaps:
- **Conflict** — employee has a shift and an approved absence on the same date
- **Shortage** — minimum role coverage (coverage_rules) no longer satisfied

The system currently detects but does not resolve these gaps.

## Goal

Semi-automatic substitution flow: admin triggers the process, system finds and contacts candidates automatically, substitute accepts/rejects via email link, admin handles escalation if all candidates are exhausted.

## Approach

Manual trigger (Approach 2): admin explicitly initiates the substitution search after adding an absence. No background automation for now; admin monitors open requests and can manually advance the queue if a proposal expires.

---

## Data Model

### New table: `coverage_requests`

Tracks one substitution request per (absence, shift_date) pair.

```sql
create table coverage_requests (
  id uuid primary key default gen_random_uuid(),
  absence_id uuid not null references absences(id) on delete cascade,
  shift_date date not null,
  role employee_role not null,
  status text not null default 'pending'
    check (status in ('pending','proposed','accepted','rejected','exhausted','cancelled')),
  timeout_hours smallint not null default 24,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coverage_requests_absence_idx on coverage_requests(absence_id);
create index coverage_requests_status_idx on coverage_requests(status, shift_date);
```

### New table: `coverage_proposals`

One row per candidate per request. Ordered by `attempt_order`.

```sql
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
  expires_at timestamptz
);

create index coverage_proposals_request_idx on coverage_proposals(request_id, attempt_order);
create index coverage_proposals_token_idx on coverage_proposals(token);
```

### Modified table: `weekly_patterns`

Add `pattern_type` to distinguish standard availability from accessory (emergency) availability.

```sql
alter table weekly_patterns
  add column pattern_type text not null default 'standard'
  check (pattern_type in ('standard', 'accessory'));
```

Accessory patterns = same structure as standard, but used only for coverage substitution candidate search. Displayed in a separate tab in the existing AvailabilityPage UI.

---

## Edge Function: `absence-coverage`

Single function, three actions dispatched via `action` field in request body.

### `action: "initiate"`

Triggered by admin clicking "Cerca sostituto" in AbsencesPage.

Input: `{ absence_id, shift_date }`

Steps:
1. Verify gap still open via `get_coverage_issues` for that date/role
2. Load eligible candidates: same role as absent employee, active, available on shift_date (checks weekly_patterns — accessory patterns take priority in ordering, but both types are eligible)
3. Order candidates by ascending shift count in current month (fairness)
4. Create `coverage_request` (status = `pending`)
5. Create `coverage_proposals` for all candidates, ordered by priority
6. Call `send_next` internally to dispatch first email

### `action: "send_next"`

Sends email to the next pending candidate.

Input: `{ request_id }`

Steps:
1. Find first proposal with `status = 'pending'` for this request (lowest `attempt_order`)
2. Generate token (UUID v4), compute `expires_at = now() + timeout_hours`
3. Update proposal → `status = 'sent'`, `sent_at`, `expires_at`, `token`
4. Update request → `status = 'proposed'`
5. Send email with two action links:
   - `<APP_URL>/coverage/respond?token=<token>&response=accept`
   - `<APP_URL>/coverage/respond?token=<token>&response=reject`

### `action: "respond"`

Called by the public `/coverage/respond` page (no auth required).

Input: `{ token, response }` where response is `'accept'` or `'reject'`

Steps:
1. Look up proposal by token
2. Validate: exists, `status = 'sent'`, `expires_at > now()`
3. If `accept`:
   - Set proposal → `status = 'accepted'`, `responded_at = now()`
   - Set request → `status = 'accepted'`
   - Insert shift for `employee_id` on `shift_date` with `source = 'manual'`
   - Send confirmation email to admin
4. If `reject`:
   - Set proposal → `status = 'rejected'`, `responded_at = now()`
   - Call `send_next` for next pending proposal
   - If no pending proposals remain: set request → `status = 'exhausted'`, send escalation email to admin
5. If token expired: return error `token_expired`
6. If already responded: return error `already_responded`

---

## Admin Settings

`timeout_hours` is stored per `coverage_request` at creation time. Default = 24h. Future: add a global setting in a config table to override the default.

---

## UI Components

### AbsencesPage (modified)

- Each absence row with an active conflict shows a red badge
- Admin-only button **"Cerca sostituto"** per conflict row
  - If request already exists and is open: button label = **"Vedi richiesta"** → navigates to CoverageRequestsPage filtered by that absence
  - On click: calls `absence-coverage` with `action: "initiate"`

### CoverageRequestsPage (new) — `/coverage-requests`

Admin-only page. Shows all open coverage requests.

Table columns: Date | Role | Absent employee | Status | Current candidate | Expires | Actions

Status chips:
- `proposed` — yellow
- `accepted` — green
- `exhausted` — red
- `cancelled` — grey

Actions per row:
- **"Reinvia al prossimo"** — visible when `status = 'proposed'` and `expires_at` is past → calls `send_next`
- **"Annulla"** — sets request to `cancelled`
- **"Gestisci manuale"** — visible when `status = 'exhausted'` → opens AbsencesPage or SchedulePage for manual resolution

### AvailabilityPage (modified)

Add tab switcher at the top:

```
[ Disponibilità Standard ]  [ Disponibilità Accessoria ]
```

Both tabs use identical UI. The active tab filters `weekly_patterns` by `pattern_type`. Saves with the appropriate `pattern_type`. No other changes to existing availability logic.

### CoverageRespondPage (new, public) — `/coverage/respond`

No authentication required. Reads `?token=xxx&response=accept|reject` from URL on mount, calls `absence-coverage` with `action: "respond"`, then shows one of:
- Success: "Turno confermato, grazie." (accept)
- Success: "Risposta registrata." (reject)
- Error: "Link scaduto." (token_expired)
- Error: "Hai già risposto." (already_responded)

Route must be excluded from ProtectedRoute wrapper.

---

## Candidate Selection Logic

```
eligible = employees where:
  - active = true
  - role = absent_employee.role
  - has weekly_pattern (standard OR accessory) covering shift_date weekday
  - no existing shift on shift_date
  - no approved absence on shift_date

order by:
  - shift_count_in_month ASC  (fairness)
  - pattern_type = 'accessory' first when tie  (accessory priority)
```

---

## Error Cases

| Case | Handling |
|---|---|
| Gap already resolved when admin clicks initiate | Show message "Copertura già sufficiente", no request created |
| Duplicate initiate on same absence+date | Return existing open request, don't create new one |
| Token expired | `expires_at < now()` → return `token_expired`, proposal stays `sent` until admin calls `send_next` |
| No candidates at all | Skip proposal creation, set request → `exhausted` immediately, email admin |

---

## Out of Scope (this iteration)

- Automatic timeout (cron) — admin manually advances expired proposals
- Push/in-app notifications
- Multi-shift absences (one request per shift_date, admin initiates each separately)
- Candidate opt-out ("never contact me for substitutions")
