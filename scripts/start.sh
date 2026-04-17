#!/usr/bin/env bash
# Bootstrap Pharma Plan Pro dev environment (Supabase Cloud backend).
# Requires: supabase CLI, node 20+. No Docker needed.

set -euo pipefail

cd "$(dirname "$0")/.."

# 1. Check Supabase CLI
if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: supabase CLI not installed. Run: brew install supabase/tap/supabase"
  exit 1
fi

# 2. Ensure project is linked
if [ ! -f supabase/.temp/project-ref ] && [ ! -f supabase/config.toml ]; then
  echo "ERROR: run 'supabase link --project-ref <ref>' first."
  exit 1
fi

# 3. Install frontend deps if missing
if [ ! -d frontend/node_modules ]; then
  echo ">> Installing frontend deps..."
  (cd frontend && npm install)
fi

# 4. Ensure .env.local exists
if [ ! -f frontend/.env.local ]; then
  echo "ERROR: frontend/.env.local is missing. Copy frontend/.env.example → .env.local and fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY from the Supabase dashboard."
  exit 1
fi

# 5. Start Vite
echo ">> Starting frontend on http://localhost:5173"
cd frontend && npm run dev
