#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load env files if present. .env.local overrides .env.production.
if [ -f ".env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.production"
  set +a
fi

if [ -f ".env.local" ]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi

# Meridian trader runtime may hold the active encryption key used for
# api_credentials.encrypted_api_key values. Load it last as override.
TRADER_ENV="/Users/atlasbuilds/Desktop/meridian-trader/.env"
if [ -f "$TRADER_ENV" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$TRADER_ENV"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL is not set. Sync aborted."
  exit 1
fi

NPX_BIN="$(command -v npx || true)"
if [ -z "$NPX_BIN" ]; then
  echo "❌ npx not found in PATH. Sync aborted."
  exit 1
fi

exec "$NPX_BIN" tsx scripts/sync-tradier-gainloss.ts "$@"
