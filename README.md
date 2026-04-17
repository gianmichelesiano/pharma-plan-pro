# Pharma Plan Pro

Pharmacy shift planning app for TPZ (Top Pharm Zentrum). React + Vite + TypeScript frontend on Supabase Cloud (Postgres + Auth).

## Requirements

- Node 20+
- Supabase CLI: `brew install supabase/tap/supabase`
- `psql` (optional, for seeding): `brew install libpq && brew link --force libpq`

## First-time setup

See [`docs/APPLY_PHASE.md`](docs/APPLY_PHASE.md) for the step-by-step commands to link the Cloud project, push migrations, run the seed, and create the first admin user. After that one-time setup, day-to-day dev is:

```bash
./scripts/start.sh
```

Opens http://localhost:5173. Log in with the admin user created during apply phase.

## Structure

- `supabase/migrations/` — SQL schema (8 migrations)
- `supabase/seed.sql` — anagrafica + weekly patterns + training courses from `docs/requisiti_muhen.md`
- `frontend/src/features/` — feature-based folders (employees, absences, shifts)
- `frontend/src/lib/supabase.ts` — Supabase client singleton
- `frontend/src/lib/database.types.ts` — HAND-WRITTEN placeholder. After apply phase, regenerate with `supabase gen types typescript --linked > frontend/src/lib/database.types.ts`.

## Roadmap

Next iterations (future plans):
- Weekly-pattern UI editor
- Training courses UI
- Daily notes + meeting events
- Coverage rules + evaluator
- Automatic schedule generator
- Role-based access control + RLS
- Excel import

## Spec

See [`docs/requisiti_muhen.md`](docs/requisiti_muhen.md) and [`docs/superpowers/plans/2026-04-17-pharma-plan-pro-mvp.md`](docs/superpowers/plans/2026-04-17-pharma-plan-pro-mvp.md).
