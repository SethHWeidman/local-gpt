#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 || $# -gt 2 ]]; then
  echo "Usage: $0 <email> <new_password>" >&2
  exit 1
fi

email="$1"
password="$2"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Run: set -a && source .env && set +a" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;" \
  -c "UPDATE users SET password_hash = crypt('${password}', gen_salt('bf')) WHERE email = '${email}' RETURNING id;"