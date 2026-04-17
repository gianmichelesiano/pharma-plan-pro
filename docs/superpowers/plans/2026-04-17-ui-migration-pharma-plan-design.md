# UI Migration: pharma-plan Design → pharma-plan-pro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace pharma-plan-pro's Tailwind/Material Design UI with pharma-plan's custom CSS design system, while keeping Supabase auth and data layer intact.

**Architecture:** pharma-plan's `app.css` (568-line custom design: dark green #173f2f, glassmorphism, calendar) becomes the sole style layer. Pages are ported from pharma-plan and adapted to use Supabase queries instead of REST. Auth is preserved via AuthContext + ProtectedRoute.

**Tech Stack:** React 18, React Router 6, React Query 5, Supabase JS SDK, custom CSS (no Tailwind on app pages)

---

## Data Mapping Reference

Before coding, understand these schema differences:

| pharma-plan (REST) | pharma-plan-pro (Supabase) |
|---|---|
| `employees.weekly_hours: number` | `employees.weekly_hours_pct: number \| null` |
| `employees.role: "pharmacist" \| "operator"` | `employees.role: "pharmacist" \| "pha" \| "apprentice_pha" \| "driver" \| "auxiliary"` |
| `time-off.reason: "vacation" \| "sick_leave"` | `absences.type: "VACATION" \| "SICK" \| "UNAVAILABLE" \| "SCHOOL" \| "TRAINING" \| "HR_MEETING"` |
| `time-off.status: "approved" \| "pending"` | `absences.status: "requested" \| "approved" \| "rejected"` |
| `availability.slot_name: "AM"\|"PM"\|"FULL"` | `weekly_patterns.slot: string` (use "AM", "PM", "FULL") |
| `rules/coverage: {pharmacist_min, operator_min} per slot` | `coverage_rules: one row per (weekday, slot, role)` |
| `shifts.slot_name: "AM"\|"PM"\|"FULL"` | `shifts.shift_type: "MORNING"\|"AFTERNOON"\|"FULL_DAY"` |
| Schedule generation via POST /schedules/generate | No generation — manual drag-drop only |

Slot time labels (hardcoded in UI):
- AM / MORNING → 08:00–12:15
- PM / AFTERNOON → 13:30–18:30
- FULL / FULL_DAY → 08:00–15:00

---

## File Map

### Delete
- `frontend/src/styles/tailwind.css` — replaced by app.css
- `frontend/tailwind.config.ts` — no longer needed
- `frontend/postcss.config.cjs` — remove tailwindcss plugin (keep autoprefixer)
- `frontend/src/features/` — all feature modules replaced by pages
- `frontend/src/pages/LoginPage.tsx` — rewritten
- `frontend/src/pages/RegisterPage.tsx` — rewritten

### Copy from pharma-plan (then adapt)
- `frontend/src/styles/app.css` ← pharma-plan's app.css (replaces current)
- `frontend/src/i18n/translations.ts` ← pharma-plan's translations + additions
- `frontend/src/components/AppShell.tsx` ← pharma-plan's AppShell + auth signout
- `frontend/src/components/PageHeader.tsx` ← pharma-plan's PageHeader

### Create/Replace in pharma-plan-pro
- `frontend/src/pages/LoginPage.tsx` — CSS-class-based (no Tailwind)
- `frontend/src/pages/RegisterPage.tsx` — CSS-class-based (no Tailwind)
- `frontend/src/pages/DashboardPage.tsx` — Supabase counts
- `frontend/src/pages/EmployeesPage.tsx` — Supabase CRUD
- `frontend/src/pages/AvailabilityPage.tsx` — weekly_patterns CRUD
- `frontend/src/pages/AbsencesPage.tsx` — absences CRUD with join
- `frontend/src/pages/RulesPage.tsx` — coverage_rules CRUD
- `frontend/src/pages/SchedulePage.tsx` — shifts calendar, manual only
- `frontend/src/routes/router.tsx` — all 6 routes + auth guards
- `frontend/src/main.tsx` — import only app.css

### Keep unchanged
- `frontend/src/lib/supabase.ts`
- `frontend/src/lib/database.types.ts`
- `frontend/src/contexts/AuthContext.tsx`
- `frontend/src/contexts/LanguageContext.tsx`
- `frontend/src/components/ProtectedRoute.tsx`

---

## Task 1: Remove Tailwind, install pharma-plan CSS

**Files:**
- Delete: `frontend/tailwind.config.ts`
- Modify: `frontend/postcss.config.cjs`
- Replace: `frontend/src/styles/app.css`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Check current postcss config**

```bash
cat /Users/gianmichele/Development/Personal/pharma-plan-pro/frontend/postcss.config.cjs
```

- [ ] **Step 2: Remove tailwindcss from postcss**

Replace `frontend/postcss.config.cjs` content:
```js
export default {
  plugins: {
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Delete tailwind config**

```bash
rm frontend/tailwind.config.ts
rm frontend/src/styles/tailwind.css
```

- [ ] **Step 4: Replace app.css with pharma-plan's**

Copy exact content of `/Users/gianmichele/Development/Personal/pharma-plan/frontend/src/styles/app.css` to `frontend/src/styles/app.css`.

Add these extra rules at the bottom (needed for auth pages):

```css
/* Auth page */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top left, rgba(153, 197, 163, 0.35), transparent 32%),
    linear-gradient(180deg, #f4f1e8 0%, #eef3eb 100%);
  padding: 2rem;
}

.auth-card {
  width: 100%;
  max-width: 380px;
  padding: 2rem;
  border-radius: 1.25rem;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(23, 63, 47, 0.1);
  box-shadow: 0 16px 40px rgba(23, 63, 47, 0.1);
}

.auth-brand {
  text-align: center;
  margin-bottom: 1.5rem;
}

.auth-brand h1 {
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
  color: #173f2f;
}

.auth-brand p {
  font-size: 0.85rem;
  color: #4f665c;
  margin: 0;
}

.auth-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.auth-tab {
  flex: 1;
  padding: 0.6rem;
  border-radius: 0.75rem;
  background: transparent;
  color: #4f665c;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.auth-tab.active {
  background: #173f2f;
  color: #fffdf8;
}

.auth-error {
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  background: #fff0e3;
  color: #8a3d16;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 1rem;
}

.lang-switcher {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  color: #355445;
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.85rem;
  cursor: pointer;
  border: 1px solid rgba(23, 63, 47, 0.12);
  width: 100%;
}

.user-info {
  font-size: 0.78rem;
  color: #4f665c;
  padding: 0.4rem 0.75rem;
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 5: Update main.tsx to import only app.css**

Edit `frontend/src/main.tsx`:
```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { router } from "./routes/router";
import "./styles/app.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 6: Remove tailwindcss package**

```bash
cd frontend && npm uninstall tailwindcss @tailwindcss/forms
```

- [ ] **Step 7: Verify build compiles**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build succeeds (may have TS errors from old features/ files — those get replaced in later tasks).

- [ ] **Step 8: Commit**

```bash
cd frontend && git add -A && git commit -m "style: replace Tailwind with pharma-plan custom CSS"
```

---

## Task 2: Update translations

**Files:**
- Replace: `frontend/src/i18n/translations.ts`

pharma-plan's translations.ts is the base. We need to add/extend for Supabase-specific labels.

- [ ] **Step 1: Copy pharma-plan translations as base**

Copy exact content of `/Users/gianmichele/Development/Personal/pharma-plan/frontend/src/i18n/translations.ts` to `frontend/src/i18n/translations.ts`.

- [ ] **Step 2: Add Supabase-specific keys to each language**

In the `it` block, update these sections:

```typescript
// In common (add after existing keys):
employment_status_active: "Attivo",
employment_status_planned: "In programma",
employment_status_terminated: "Terminato",
role_pharmacist: "Farmacista",
role_pha: "PHA",
role_apprentice_pha: "Apprendista PHA",
role_driver: "Autista",
role_auxiliary: "Ausiliario",
absence_type_VACATION: "Ferie",
absence_type_UNAVAILABLE: "Non disponibile",
absence_type_SICK: "Malattia",
absence_type_SCHOOL: "Scuola",
absence_type_TRAINING: "Formazione",
absence_type_HR_MEETING: "Incontro HR",
absence_status_requested: "Richiesta",
absence_status_approved: "Approvata",
absence_status_rejected: "Rifiutata",
```

Add in `nav` (it):
```typescript
signOut: "Esci",
```

In `employees` (it), update description and add:
```typescript
description: "Gestione dipendenti farmacia TPZ.",
displayCode: "Codice",
employmentStatus: "Stato impiego",
email: "Email",
weeklyHoursPct: "Ore sett. %",
```

In `schedule` (it), update to remove generate-related keys and add:
```typescript
title: "Pianificazione",
description: "Calendario turni mensile con assegnazione manuale drag & drop.",
calendar: "Calendario",
activeEmployees: "Dipendenti attivi",
dragHint: "Trascina un badge in uno slot per assegnarlo.",
loadingEmployees: "Caricamento dipendenti...",
closed: "Chiuso",
rolePharmacist: "Farmacista",
roleOperator: "Operatore",
roleLabel: "Ruolo",
weeklyHoursLabel: "Ore settimanali",
noPlanAvailable: "Nessun turno per questo mese.",
```

Repeat equivalent additions for `de`, `fr`, `en` blocks.

- [ ] **Step 3: Check useT still compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "translations" | head -20
```

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/i18n/ && git commit -m "i18n: extend translations with Supabase-specific labels"
```

---

## Task 3: AppShell + PageHeader + router

**Files:**
- Replace: `frontend/src/components/AppShell.tsx`
- Copy: `frontend/src/components/PageHeader.tsx` (from pharma-plan, unchanged)
- Replace: `frontend/src/routes/router.tsx`

- [ ] **Step 1: Copy PageHeader from pharma-plan**

Read `/Users/gianmichele/Development/Personal/pharma-plan/frontend/src/components/PageHeader.tsx` and write identical content to `frontend/src/components/PageHeader.tsx`.

- [ ] **Step 2: Write AppShell**

Write `frontend/src/components/AppShell.tsx`:
```typescript
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { LANG_FLAGS, LANG_NAMES, nextLang } from "../i18n/translations";
import { useT } from "../i18n/useT";

const navRoutes = [
  { to: "/", key: "dashboard" as const },
  { to: "/rules", key: "rules" as const },
  { to: "/employees", key: "employees" as const },
  { to: "/availability", key: "availability" as const },
  { to: "/absences", key: "absences" as const },
  { to: "/schedule", key: "schedule" as const },
];

export function AppShell() {
  const { lang, setLang } = useLanguage();
  const { session, signOut } = useAuth();
  const nav = useT("nav");

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">PP</span>
          <div>
            <h1>Pharma Plan</h1>
            <p>TPZ Muhen</p>
          </div>
        </div>
        <nav className="nav">
          {navRoutes.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {nav[item.key]}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          {session?.user?.email ? (
            <p className="user-info">{session.user.email}</p>
          ) : null}
          <button className="secondary" onClick={() => signOut()} style={{ width: "100%", marginBottom: "0.5rem" }}>
            {nav.signOut}
          </button>
          <button
            className="lang-switcher"
            onClick={() => setLang(nextLang(lang))}
            title={`Switch to ${LANG_NAMES[nextLang(lang)]}`}
          >
            <span className="lang-icon">{LANG_FLAGS[lang]}</span>
            <span className="lang-label">{LANG_NAMES[lang]}</span>
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Write router**

Write `frontend/src/routes/router.tsx`:
```typescript
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AbsencesPage } from "../pages/AbsencesPage";
import { AvailabilityPage } from "../pages/AvailabilityPage";
import { DashboardPage } from "../pages/DashboardPage";
import { EmployeesPage } from "../pages/EmployeesPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { RulesPage } from "../pages/RulesPage";
import { SchedulePage } from "../pages/SchedulePage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/",
    element: <ProtectedRoute><AppShell /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "employees", element: <EmployeesPage /> },
      { path: "availability", element: <AvailabilityPage /> },
      { path: "absences", element: <AbsencesPage /> },
      { path: "rules", element: <RulesPage /> },
      { path: "schedule", element: <SchedulePage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
```

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/ src/routes/ && git commit -m "feat: AppShell with auth signout + router with all 6 routes"
```

---

## Task 4: Login and Register pages (CSS-based)

**Files:**
- Replace: `frontend/src/pages/LoginPage.tsx`
- Replace: `frontend/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Write LoginPage**

Write `frontend/src/pages/LoginPage.tsx`:
```typescript
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accesso non riuscito");
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" style={{ margin: "0 auto 0.75rem", display: "block", width: "3rem", height: "3rem" }}>PP</span>
          <h1>Pharma Plan</h1>
          <p>TPZ Muhen</p>
        </div>

        <div className="auth-tabs">
          <button type="button" className="auth-tab active">Accedi</button>
          <Link to="/register" style={{ flex: 1, textDecoration: "none" }}>
            <button type="button" className="auth-tab" style={{ width: "100%" }}>Registrati</button>
          </Link>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Accesso..." : "Accedi"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write RegisterPage**

Write `frontend/src/pages/RegisterPage.tsx`:
```typescript
import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export function RegisterPage() {
  const { session, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUp(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registrazione non riuscita");
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark" style={{ margin: "0 auto 0.75rem", display: "block", width: "3rem", height: "3rem" }}>PP</span>
          <h1>Pharma Plan</h1>
          <p>TPZ Muhen</p>
        </div>

        <div className="auth-tabs">
          <Link to="/login" style={{ flex: 1, textDecoration: "none" }}>
            <button type="button" className="auth-tab" style={{ width: "100%" }}>Accedi</button>
          </Link>
          <button type="button" className="auth-tab active">Registrati</button>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min. 6 caratteri"
              required
              minLength={6}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Registrazione..." : "Crea account"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Check AuthContext has signUp**

```bash
grep -n "signUp\|signIn\|signOut" frontend/src/contexts/AuthContext.tsx
```

If `signUp` is not exported, add it: it's `supabase.auth.signUp({ email, password })`.

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "LoginPage\|RegisterPage" | head -10
```

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/LoginPage.tsx src/pages/RegisterPage.tsx && git commit -m "feat: login and register pages with app.css design"
```

---

## Task 5: DashboardPage

**Files:**
- Replace: `frontend/src/pages/DashboardPage.tsx`

Shows live counts from Supabase: active employees, absences this month, shifts this week.

- [ ] **Step 1: Write DashboardPage**

Write `frontend/src/pages/DashboardPage.tsx`:
```typescript
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function getWeekRange() {
  const now = new Date();
  const weekday = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - weekday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export function DashboardPage() {
  const t = useT("dashboard");
  const { start: monthStart, end: monthEnd } = getMonthRange();
  const { start: weekStart, end: weekEnd } = getWeekRange();

  const employeesQuery = useQuery({
    queryKey: ["dashboard-employees"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["dashboard-absences", monthStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("absences")
        .select("id", { count: "exact", head: true })
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["dashboard-shifts", weekStart],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards">
        <article className="card">
          <p className="eyebrow">{t.minCoverageTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {employeesQuery.isLoading ? "—" : employeesQuery.data}
          </h2>
          <p>{t.minCoverageText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{t.periodTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {absencesQuery.isLoading ? "—" : absencesQuery.data}
          </h2>
          <p>{t.periodText}</p>
        </article>
        <article className="card">
          <p className="eyebrow">{t.emergenciesTitle}</p>
          <h2 style={{ margin: "0.25rem 0", fontSize: "2.5rem", color: "#173f2f" }}>
            {shiftsQuery.isLoading ? "—" : shiftsQuery.data}
          </h2>
          <p>{t.emergenciesText}</p>
        </article>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update dashboard translations to match new card meanings**

In translations.ts, update all four languages' `dashboard` section:
```typescript
// it
dashboard: {
  title: "Dashboard",
  description: "Panoramica operativa della farmacia TPZ.",
  minCoverageTitle: "Dipendenti attivi",
  minCoverageText: "Dipendenti con stato attivo in questo momento.",
  periodTitle: "Assenze questo mese",
  periodText: "Assenze registrate nel mese corrente.",
  emergenciesTitle: "Turni questa settimana",
  emergenciesText: "Turni pianificati nella settimana corrente.",
},
```

Repeat equivalents for de/fr/en.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/DashboardPage.tsx src/i18n/ && git commit -m "feat: dashboard with live Supabase counts"
```

---

## Task 6: EmployeesPage

**Files:**
- Replace: `frontend/src/pages/EmployeesPage.tsx`

Uses pharma-plan's layout. Key differences: `id` is `string` (UUID), `weekly_hours_pct` instead of `weekly_hours`, role has 5 values, add `display_code`.

- [ ] **Step 1: Write EmployeesPage**

Write `frontend/src/pages/EmployeesPage.tsx`:
```typescript
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;

type EmployeeForm = {
  first_name: string;
  last_name: string;
  display_code: string;
  role: Employee["role"];
  weekly_hours_pct: string;
  active: boolean;
};

const initialForm: EmployeeForm = {
  first_name: "",
  last_name: "",
  display_code: "",
  role: "pha",
  weekly_hours_pct: "100",
  active: true,
};

const ROLES: Employee["role"][] = ["pharmacist", "pha", "apprentice_pha", "driver", "auxiliary"];

export function EmployeesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EmployeeForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "all">("active");
  const t = useT("employees");
  const c = useT("common");

  const { data, isLoading, error } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const resetForm = () => { setForm(initialForm); setEditingId(null); };

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<Employee, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("employees").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Employee> }) => {
      const { error } = await supabase.from("employees").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["employees"] }); resetForm(); },
  });

  const submitForm = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      display_code: form.display_code.trim() || form.first_name.slice(0, 2).toUpperCase() + form.last_name.slice(0, 2).toUpperCase(),
      role: form.role,
      weekly_hours_pct: Number(form.weekly_hours_pct),
      active: form.active,
      employment_status: "active" as const,
    };
    if (editingId === null) { createMutation.mutate(payload); return; }
    updateMutation.mutate({ id: editingId, payload });
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({
      first_name: emp.first_name,
      last_name: emp.last_name,
      display_code: emp.display_code,
      role: emp.role,
      weekly_hours_pct: String(emp.weekly_hours_pct ?? 100),
      active: emp.active,
    });
  };

  const filteredEmployees = useMemo(() => {
    const items = [...(data ?? [])].sort((a, b) => a.last_name.localeCompare(b.last_name));
    return filter === "active" ? items.filter((e) => e.active) : items;
  }, [data, filter]);

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards two-columns">
        <div className="card">
          <h3>{editingId === null ? t.newEmployee : t.editEmployee}</h3>
          <form className="form-grid" onSubmit={submitForm}>
            <label className="field">
              <span>{t.firstName}</span>
              <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.lastName}</span>
              <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.displayCode}</span>
              <input value={form.display_code} onChange={(e) => setForm((f) => ({ ...f, display_code: e.target.value }))} placeholder="Es. MA-BI" />
            </label>
            <label className="field">
              <span>{c.role}</span>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Employee["role"] }))}>
                {ROLES.map((r) => <option key={r} value={r}>{(c as Record<string, string>)[`role_${r}`] ?? r}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{t.weeklyHoursPct}</span>
              <input type="number" min="0" max="100" value={form.weekly_hours_pct} onChange={(e) => setForm((f) => ({ ...f, weekly_hours_pct: e.target.value }))} required />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
              <span>{t.activeLabel}</span>
            </label>
            <div className="toolbar">
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId === null ? (createMutation.isPending ? t.creating : t.create) : (updateMutation.isPending ? t.saving : c.save)}
              </button>
              {editingId !== null ? <button type="button" className="secondary" onClick={resetForm}>{c.cancel}</button> : null}
            </div>
          </form>
        </div>

        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{t.filterLabel}</span>
              <select value={filter} onChange={(e) => setFilter(e.target.value as "active" | "all")}>
                <option value="active">{c.filterActive}</option>
                <option value="all">{c.filterAll}</option>
              </select>
            </label>
          </div>
          {isLoading ? <p>{t.loadingEmployees}</p> : null}
          {error ? <p>{t.errorLoading}</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>{t.nameHeader}</th>
                <th>{t.roleHeader}</th>
                <th>%</th>
                <th>{t.statusHeader}</th>
                <th>{t.actionsHeader}</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td>{emp.first_name} {emp.last_name} <small style={{ color: "#6f816f" }}>({emp.display_code})</small></td>
                  <td>{(c as Record<string, string>)[`role_${emp.role}`] ?? emp.role}</td>
                  <td>{emp.weekly_hours_pct ?? "—"}</td>
                  <td><span className={emp.active ? "status-badge active" : "status-badge inactive"}>{emp.active ? c.active : c.inactive}</span></td>
                  <td><div className="table-actions"><button type="button" className="secondary" onClick={() => startEdit(emp)}>{c.modify}</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TS**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep "EmployeesPage" | head -10
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/EmployeesPage.tsx && git commit -m "feat: EmployeesPage with Supabase CRUD"
```

---

## Task 7: AvailabilityPage (weekly_patterns)

**Files:**
- Replace: `frontend/src/pages/AvailabilityPage.tsx`

Maps pharma-plan's slot availability matrix to `weekly_patterns` table. Slot names: "AM", "PM", "FULL". The table has one row per (employee_id, weekday, slot) with `active: boolean`.

- [ ] **Step 1: Write AvailabilityPage**

Write `frontend/src/pages/AvailabilityPage.tsx`:
```typescript
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Pattern = Tables<"weekly_patterns">;

const SLOTS = ["AM", "PM", "FULL"] as const;
const SLOT_TIMES: Record<string, string> = { AM: "08:00-12:15", PM: "13:30-18:30", FULL: "08:00-15:00" };

export function AvailabilityPage() {
  const queryClient = useQueryClient();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const t = useT("availability");
  const c = useT("common");

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  useEffect(() => {
    if (selectedEmployeeId === null && employeesQuery.data?.length) {
      setSelectedEmployeeId(employeesQuery.data[0].id);
    }
  }, [employeesQuery.data, selectedEmployeeId]);

  const patternsQuery = useQuery({
    queryKey: ["weekly_patterns", selectedEmployeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_patterns")
        .select("*")
        .eq("employee_id", selectedEmployeeId!);
      if (error) throw error;
      return data as Pattern[];
    },
    enabled: selectedEmployeeId !== null,
  });

  useEffect(() => {
    if (!patternsQuery.data) return;
    const map: Record<string, boolean> = {};
    // Initialize all to false
    for (let weekday = 0; weekday < 6; weekday++) {
      for (const slot of SLOTS) {
        map[`${weekday}-${slot}`] = false;
      }
    }
    // Set from DB
    for (const p of patternsQuery.data) {
      map[`${p.weekday}-${p.slot}`] = p.active;
    }
    setDraft(map);
  }, [patternsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployeeId) throw new Error("No employee selected");
      // Delete existing patterns for this employee
      const { error: delError } = await supabase
        .from("weekly_patterns")
        .delete()
        .eq("employee_id", selectedEmployeeId);
      if (delError) throw delError;
      // Insert new patterns (only active ones to keep DB lean, or all for explicit state)
      const rows = Object.entries(draft)
        .filter(([, active]) => active)
        .map(([key]) => {
          const [weekday, slot] = key.split("-");
          return { employee_id: selectedEmployeeId, weekday: Number(weekday), slot, active: true };
        });
      if (rows.length > 0) {
        const { error: insError } = await supabase.from("weekly_patterns").insert(rows);
        if (insError) throw insError;
      }
      queryClient.invalidateQueries({ queryKey: ["weekly_patterns", selectedEmployeeId] });
    },
  });

  const toggleSlot = (weekday: number, slot: string) => {
    setDraft((d) => ({ ...d, [`${weekday}-${slot}`]: !d[`${weekday}-${slot}`] }));
  };

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <label className="field">
            <span>{c.employee}</span>
            <select
              value={selectedEmployeeId ?? ""}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              disabled={employeesQuery.isLoading}
            >
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || patternsQuery.isLoading}>
            {saveMutation.isPending ? t.saving : t.saveAvailability}
          </button>
        </div>

        {saveMutation.isSuccess ? <p>{t.savedSuccess}</p> : null}
        {saveMutation.error ? <p>{t.errorSaving}</p> : null}

        <table className="table availability-table">
          <thead>
            <tr>
              <th>{t.dayHeader}</th>
              {SLOTS.map((s) => <th key={s}>{s} <small style={{ color: "#6f816f", fontWeight: 400 }}>{SLOT_TIMES[s]}</small></th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, weekday) => (
              <tr key={weekday}>
                <td>{c.weekdays[weekday]}</td>
                {SLOTS.map((slot) => (
                  <td key={slot}>
                    <label className="availability-toggle">
                      <input
                        type="checkbox"
                        checked={draft[`${weekday}-${slot}`] ?? false}
                        onChange={() => toggleSlot(weekday, slot)}
                      />
                      <span>{draft[`${weekday}-${slot}`] ? c.active : c.inactive}</span>
                    </label>
                  </td>
                ))}
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
cd frontend && git add src/pages/AvailabilityPage.tsx && git commit -m "feat: AvailabilityPage with weekly_patterns Supabase"
```

---

## Task 8: AbsencesPage

**Files:**
- Replace: `frontend/src/pages/AbsencesPage.tsx`

Maps pharma-plan's time-off UI to `absences` table. Join with employees for display name. Map absence_type enums.

- [ ] **Step 1: Write AbsencesPage**

Write `frontend/src/pages/AbsencesPage.tsx`:
```typescript
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Absence = Tables<"absences"> & { employee: Pick<Employee, "first_name" | "last_name"> | null };
type AbsenceType = Tables<"absences">["type"];
type AbsenceStatus = Tables<"absences">["status"];

const ABSENCE_TYPES: AbsenceType[] = ["VACATION", "UNAVAILABLE", "SICK", "SCHOOL", "TRAINING", "HR_MEETING"];
const ABSENCE_STATUSES: AbsenceStatus[] = ["requested", "approved", "rejected"];

function formatDateCompact(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
}

function intersectsRange(startDate: string, endDate: string, rangeStart: Date, rangeEnd: Date) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  return start <= rangeEnd && end >= rangeStart;
}

export function AbsencesPage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [form, setForm] = useState({ employee_id: "", start_date: "", end_date: "", type: "VACATION" as AbsenceType, status: "approved" as AbsenceStatus });
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const t = useT("absences");
  const c = useT("common");

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("id, first_name, last_name, role").order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const absencesQuery = useQuery({
    queryKey: ["absences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absences")
        .select("*, employee:employees(first_name, last_name)")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Absence[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("absences").insert({
        employee_id: form.employee_id,
        start_date: form.start_date,
        end_date: form.end_date,
        type: form.type,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absences"] });
      setForm({ employee_id: "", start_date: "", end_date: "", type: "VACATION", status: "approved" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("absences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["absences"] }),
  });

  const filteredAbsences = useMemo(() => {
    const rows = absencesQuery.data ?? [];
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    return rows.filter((row) => intersectsRange(row.start_date, row.end_date, start, end));
  }, [absencesQuery.data, selectedMonth, selectedYear]);

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards two-columns">
        <div className="card">
          <h3>{t.newAbsence}</h3>
          <form className="form-grid" onSubmit={(e: FormEvent) => { e.preventDefault(); createMutation.mutate(); }}>
            <label className="field">
              <span>{c.employee}</span>
              <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} required>
                <option value="">{t.selectPlaceholder}</option>
                {(employeesQuery.data ?? []).map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.from}</span>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.to}</span>
              <input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} required />
            </label>
            <label className="field">
              <span>{t.reason}</span>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AbsenceType }))}>
                {ABSENCE_TYPES.map((type) => (
                  <option key={type} value={type}>{(c as Record<string, string>)[`absence_type_${type}`] ?? type}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.status}</span>
              <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AbsenceStatus }))}>
                {ABSENCE_STATUSES.map((s) => (
                  <option key={s} value={s}>{(c as Record<string, string>)[`absence_status_${s}`] ?? s}</option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? t.adding : t.addAbsence}</button>
          </form>
          {createMutation.error ? <p>{t.errorSaving}</p> : null}
        </div>

        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{c.month}</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {c.months.map((label, i) => <option key={label} value={i}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{c.year}</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, offset) => today.getFullYear() - 2 + offset).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          {absencesQuery.isLoading ? <p>{t.loadingAbsences}</p> : null}
          {!absencesQuery.isLoading && filteredAbsences.length === 0 ? <p>{t.noAbsences}</p> : null}
          <table className="table">
            <thead>
              <tr>
                <th>{t.employeeHeader}</th>
                <th>{t.periodHeader}</th>
                <th>{t.reasonHeader}</th>
                <th>{t.statusHeader}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredAbsences.map((row) => (
                <tr key={row.id}>
                  <td>{row.employee ? `${row.employee.first_name} ${row.employee.last_name}` : "—"}</td>
                  <td>{formatDateCompact(row.start_date)} → {formatDateCompact(row.end_date)}</td>
                  <td>{(c as Record<string, string>)[`absence_type_${row.type}`] ?? row.type}</td>
                  <td>{(c as Record<string, string>)[`absence_status_${row.status}`] ?? row.status}</td>
                  <td><button type="button" className="secondary" onClick={() => deleteMutation.mutate(row.id)}>{c.delete}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/pages/AbsencesPage.tsx && git commit -m "feat: AbsencesPage with Supabase CRUD and employee join"
```

---

## Task 9: RulesPage (coverage_rules)

**Files:**
- Replace: `frontend/src/pages/RulesPage.tsx`

Supabase `coverage_rules` has one row per (weekday, slot, role). pharma-plan UI shows pharmacist + operator minimum per row. Reshape on load, split on save.

- [ ] **Step 1: Write RulesPage**

Write `frontend/src/pages/RulesPage.tsx`:
```typescript
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type CoverageRule = Tables<"coverage_rules">;

const SLOT_DEFS = [
  { weekday: 0, slot: "AM", time_window: "08:00-12:15" },
  { weekday: 0, slot: "PM", time_window: "13:30-18:30" },
  { weekday: 1, slot: "AM", time_window: "08:00-12:15" },
  { weekday: 1, slot: "PM", time_window: "13:30-18:30" },
  { weekday: 2, slot: "AM", time_window: "08:00-12:15" },
  { weekday: 2, slot: "PM", time_window: "13:30-18:30" },
  { weekday: 3, slot: "AM", time_window: "08:00-12:15" },
  { weekday: 3, slot: "PM", time_window: "13:30-18:30" },
  { weekday: 4, slot: "AM", time_window: "08:00-12:15" },
  { weekday: 4, slot: "PM", time_window: "13:30-18:30" },
  { weekday: 5, slot: "FULL", time_window: "08:00-15:00" },
];

type DraftRow = { pharmacist: string; operator: string };

export function RulesPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const t = useT("rules");
  const c = useT("common");

  const coverageQuery = useQuery({
    queryKey: ["coverage_rules"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coverage_rules").select("*");
      if (error) throw error;
      return data as CoverageRule[];
    },
  });

  useEffect(() => {
    if (!coverageQuery.data) return;
    const map: Record<string, DraftRow> = {};
    for (const def of SLOT_DEFS) {
      const key = `${def.weekday}-${def.slot}`;
      const pharmRow = coverageQuery.data.find((r) => r.weekday === def.weekday && r.slot === def.slot && r.role === "pharmacist");
      const opRow = coverageQuery.data.find((r) => r.weekday === def.weekday && r.slot === def.slot && r.role !== "pharmacist");
      map[key] = { pharmacist: String(pharmRow?.min_required ?? 1), operator: String(opRow?.min_required ?? 3) };
    }
    setDraft(map);
  }, [coverageQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const rows: Omit<CoverageRule, "id">[] = [];
      for (const def of SLOT_DEFS) {
        const key = `${def.weekday}-${def.slot}`;
        const d = draft[key] ?? { pharmacist: "1", operator: "3" };
        rows.push({ weekday: def.weekday, slot: def.slot, role: "pharmacist", min_required: Number(d.pharmacist), time_window: def.time_window, note: null });
        rows.push({ weekday: def.weekday, slot: def.slot, role: "pha", min_required: Number(d.operator), time_window: def.time_window, note: null });
      }
      // Upsert all rows
      const { error } = await supabase.from("coverage_rules").upsert(rows, { onConflict: "weekday,slot,role" });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["coverage_rules"] });
    },
  });

  const updateCell = (key: string, field: "pharmacist" | "operator", value: string) => {
    setDraft((d) => ({ ...d, [key]: { ...(d[key] ?? { pharmacist: "1", operator: "3" }), [field]: value } }));
  };

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="card">
        <div className="toolbar">
          <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || coverageQuery.isLoading}>
            {saveMutation.isPending ? t.savingRules : t.saveRules}
          </button>
        </div>
        {coverageQuery.isLoading ? <p>{t.loadingRules}</p> : null}
        {saveMutation.isSuccess ? <p>{t.savedSuccess}</p> : null}
        {saveMutation.error ? <p>{t.errorSaving}</p> : null}
        <table className="table rules-table">
          <thead>
            <tr>
              <th>{t.dayHeader}</th>
              <th>{t.slotHeader}</th>
              <th>{t.pharmacistsHeader}</th>
              <th>{t.operatorsHeader}</th>
            </tr>
          </thead>
          <tbody>
            {SLOT_DEFS.map((def) => {
              const key = `${def.weekday}-${def.slot}`;
              return (
                <tr key={key}>
                  <td>{c.weekdaysShort[def.weekday]}</td>
                  <td>{def.time_window}</td>
                  <td><input type="number" min="0" value={draft[key]?.pharmacist ?? "1"} onChange={(e) => updateCell(key, "pharmacist", e.target.value)} /></td>
                  <td><input type="number" min="0" value={draft[key]?.operator ?? "3"} onChange={(e) => updateCell(key, "operator", e.target.value)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

> **Note on upsert:** `coverage_rules` needs a unique constraint on (weekday, slot, role) for upsert to work. If the migration doesn't have this, use delete-then-insert pattern instead (same approach as AvailabilityPage Task 7).

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/pages/RulesPage.tsx && git commit -m "feat: RulesPage with coverage_rules Supabase"
```

---

## Task 10: SchedulePage (shifts calendar)

**Files:**
- Replace: `frontend/src/pages/SchedulePage.tsx`

Uses `shifts` table. No generate endpoint — manual drag-drop only. shift_type maps: MORNING=AM, AFTERNOON=PM, FULL_DAY=FULL.

- [ ] **Step 1: Write SchedulePage**

Write `frontend/src/pages/SchedulePage.tsx`:
```typescript
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n/useT";
import { supabase } from "../lib/supabase";
import type { Tables } from "../lib/database.types";

type Employee = Tables<"employees">;
type Shift = Tables<"shifts"> & { employee: Pick<Employee, "first_name" | "last_name" | "display_code" | "role"> | null };
type ShiftType = Tables<"shifts">["shift_type"];

const SLOT_TIME_LABELS: Record<ShiftType, string> = {
  MORNING: "08:00-12:15",
  AFTERNOON: "13:30-18:30",
  FULL_DAY: "08:00-15:00",
};

const SLOT_LABEL: Record<ShiftType, string> = { MORNING: "AM", AFTERNOON: "PM", FULL_DAY: "FULL" };

function formatDateCompact(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year.slice(-2)}`;
}

type DragPayload =
  | { kind: "employee"; employeeId: string }
  | { kind: "shift"; shiftId: string };

function serializeDrag(p: DragPayload) { return JSON.stringify(p); }
function parseDrag(raw: string | null): DragPayload | null {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function SchedulePage() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [actionError, setActionError] = useState<string | null>(null);
  const t = useT("schedule");
  const c = useT("common");

  const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
  const monthEnd = new Date(selectedYear, selectedMonth + 1, 0).toISOString().slice(0, 10);

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("active", true).order("last_name");
      if (error) throw error;
      return data as Employee[];
    },
  });

  const shiftsQuery = useQuery({
    queryKey: ["shifts", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*, employee:employees(first_name, last_name, display_code, role)")
        .gte("shift_date", monthStart)
        .lte("shift_date", monthEnd);
      if (error) throw error;
      return data as Shift[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ employeeId, date, shiftType }: { employeeId: string; date: string; shiftType: ShiftType }) => {
      const { error } = await supabase.from("shifts").insert({ employee_id: employeeId, shift_date: date, shift_type: shiftType });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); setActionError(null); },
    onError: (e) => setActionError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["shifts"] }); setActionError(null); },
    onError: (e) => setActionError(e.message),
  });

  const calendarWeeks = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    const firstDate = new Date(`${days[0]}T12:00:00`);
    const leadingEmpties = (firstDate.getDay() + 6) % 7;
    const cells = [...Array.from({ length: leadingEmpties }, () => null), ...days];
    const weeks: Array<Array<string | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [selectedMonth, selectedYear]);

  const shiftsByDaySlot = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (const shift of shiftsQuery.data ?? []) {
      const key = `${shift.shift_date}-${shift.shift_type}`;
      map.set(key, [...(map.get(key) ?? []), shift]);
    }
    return map;
  }, [shiftsQuery.data]);

  const handleDrop = (e: React.DragEvent, date: string, shiftType: ShiftType) => {
    e.preventDefault();
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload) return;
    if (payload.kind === "employee") {
      createMutation.mutate({ employeeId: payload.employeeId, date, shiftType });
    }
  };

  const handleDeleteDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const payload = parseDrag(e.dataTransfer.getData("application/pharma-plan") || e.dataTransfer.getData("text/plain"));
    if (!payload || payload.kind !== "shift") return;
    deleteMutation.mutate(payload.shiftId);
  };

  const isBusy = createMutation.isPending || deleteMutation.isPending;

  const activeEmployees = useMemo(
    () => [...(employeesQuery.data ?? [])].sort((a, b) => a.last_name.localeCompare(b.last_name)),
    [employeesQuery.data],
  );

  return (
    <section className="page">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid cards schedule-layout">
        <div className="card">
          <div className="toolbar">
            <label className="field">
              <span>{c.month}</span>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {c.months.map((label, i) => <option key={label} value={i}>{label}</option>)}
              </select>
            </label>
            <label className="field">
              <span>{c.year}</span>
              <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {Array.from({ length: 5 }, (_, offset) => today.getFullYear() - 2 + offset).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <p className="mini-muted">{t.noPlanAvailable}</p>
        </div>

        <div className="card schedule-main-card">
          {actionError ? <p className="schedule-error">{actionError}</p> : null}
          <div className="calendar-board">
            <div className="calendar-header">
              {c.weekdays.map((wd) => <div key={wd} className="calendar-header-cell">{wd.slice(0, 3)}</div>)}
            </div>
            <div className="calendar-grid">
              {calendarWeeks.flatMap((week, wi) =>
                week.map((day, di) => {
                  if (!day) return <div key={`e-${wi}-${di}`} className="calendar-cell empty" />;
                  const dayDate = new Date(`${day}T12:00:00`);
                  const dayOfWeek = dayDate.getDay();
                  const slotTypes: ShiftType[] = dayOfWeek === 0 ? [] : dayOfWeek === 6 ? ["FULL_DAY"] : ["MORNING", "AFTERNOON"];
                  return (
                    <div key={day} className="calendar-cell">
                      <div className="calendar-cell-head">
                        <strong>{formatDateCompact(day)}</strong>
                      </div>
                      <div className="calendar-cell-body slot-stack">
                        {slotTypes.length === 0 ? <span className="mini-muted">{t.closed}</span> : null}
                        {slotTypes.map((shiftType) => {
                          const shifts = shiftsByDaySlot.get(`${day}-${shiftType}`) ?? [];
                          return (
                            <div
                              key={shiftType}
                              className="calendar-slot"
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => handleDrop(e, day, shiftType)}
                            >
                              <div className="calendar-slot-head">
                                <span>{SLOT_TIME_LABELS[shiftType]}</span>
                              </div>
                              <div className="calendar-people">
                                {shifts.map((shift) => (
                                  <div
                                    key={shift.id}
                                    className={["calendar-person", shift.employee?.role === "pharmacist" ? "pharmacist" : "operator"].join(" ")}
                                    draggable
                                    onDragStart={(e) => {
                                      const p = serializeDrag({ kind: "shift", shiftId: shift.id });
                                      e.dataTransfer.effectAllowed = "move";
                                      e.dataTransfer.setData("application/pharma-plan", p);
                                      e.dataTransfer.setData("text/plain", p);
                                    }}
                                  >
                                    <span>{shift.employee?.display_code ?? "—"}</span>
                                    <div className="calendar-tooltip">
                                      <strong>{shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : "—"}</strong>
                                      <span>{SLOT_LABEL[shiftType]}</span>
                                    </div>
                                    <button
                                      type="button"
                                      className="person-remove"
                                      onClick={() => deleteMutation.mutate(shift.id)}
                                      disabled={isBusy}
                                    >x</button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <h3>{t.activeEmployees}</h3>
          <p className="page-description">{t.dragHint}</p>
          {employeesQuery.isLoading ? <p>{t.loadingEmployees}</p> : null}
          <div
            className="employee-pool sidebar-pool"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDeleteDrop}
          >
            {activeEmployees.map((emp) => (
              <div
                key={emp.id}
                className="employee-chip"
                draggable
                onDragStart={(e) => {
                  const p = serializeDrag({ kind: "employee", employeeId: emp.id });
                  e.dataTransfer.effectAllowed = "copyMove";
                  e.dataTransfer.setData("application/pharma-plan", p);
                  e.dataTransfer.setData("text/plain", p);
                }}
              >
                {emp.display_code}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd frontend && git add src/pages/SchedulePage.tsx && git commit -m "feat: SchedulePage with shifts Supabase, manual drag-drop calendar"
```

---

## Task 11: Cleanup and full build verification

**Files:**
- Delete: `frontend/src/features/` (entire directory)
- Modify: `frontend/src/contexts/AuthContext.tsx` (ensure signUp exported)

- [ ] **Step 1: Delete old features directory**

```bash
rm -rf frontend/src/features/
```

- [ ] **Step 2: Verify AuthContext exports signUp**

```bash
grep -n "signUp\|signIn\|signOut" frontend/src/contexts/AuthContext.tsx
```

If `signUp` is missing, add it:
```typescript
const signUp = async (email: string, password: string) => {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
};
// Add to context value
```

- [ ] **Step 3: Full TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1
```

Fix all errors. Common issues:
- `c` typed as specific namespace object — use `(c as Record<string, string>)` for dynamic key access
- Missing translation keys — add to translations.ts
- `Tables<"shifts">["shift_type"]` type mismatch — ensure imports are correct

- [ ] **Step 4: Full build**

```bash
cd frontend && npm run build 2>&1 | tail -30
```

Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 5: Start dev server and manual smoke test**

```bash
cd frontend && npm run dev
```

Test checklist:
- [ ] `/login` shows green auth card with PP brand mark
- [ ] Login with real Supabase credentials works
- [ ] Redirect to `/` after login
- [ ] AppShell sidebar shows all 6 nav links + user email + sign out
- [ ] Dashboard shows 3 stat cards with numbers
- [ ] `/employees` shows form + table, create/edit work
- [ ] `/availability` shows matrix, checkboxes save
- [ ] `/absences` shows form + filtered table, create/delete work
- [ ] `/rules` shows rules table, save works
- [ ] `/schedule` shows calendar for current month, drag-drop from sidebar assigns shifts
- [ ] Sign out redirects to `/login`
- [ ] Language switcher cycles IT → DE → FR → EN

- [ ] **Step 6: Final commit**

```bash
cd frontend && git add -A && git commit -m "feat: complete UI migration to pharma-plan design with Supabase backend"
```

---

## Self-Review

**Spec coverage:** User wants pharma-plan's UI with pharma-plan-pro's data.
- ✅ CSS: pharma-plan's app.css replaces Tailwind
- ✅ All 6 pages: dashboard, employees, availability, absences, rules, schedule
- ✅ Auth: login/register/signout preserved
- ✅ All Supabase tables covered: employees, weekly_patterns, absences, coverage_rules, shifts

**Gaps:**
- `training_courses` and `training_participants` tables not surfaced — out of scope, not in pharma-plan UI
- `daily_notes` table not surfaced — out of scope
- Schedule "generate" removed intentionally — no backend equivalent in Supabase

**Schema note:** RulesPage Task 9 upsert requires unique constraint `(weekday, slot, role)` on `coverage_rules`. If this constraint doesn't exist in the DB, the `onConflict` option will fail — use delete-then-insert instead. Verify with:
```bash
# Check the migration files or run in Supabase SQL editor:
# SELECT conname FROM pg_constraint WHERE conrelid='coverage_rules'::regclass;
```

**Translation keys:** Tasks 5-10 reference dynamic keys like `c.absence_type_VACATION` via `(c as Record<string, string>)`. These require matching keys in Task 2's translation update. The `as Record<string, string>` cast bypasses TypeScript's namespace typing — acceptable for enum-driven labels.
