#!/usr/bin/env bash
# RetailOS disposable-Postgres gate harness (see docs/plans/sonnet-execution-playbook.md).
#
# The ONLY sanctioned way to start/stop a test database. It exists because a
# broad `docker stop --filter ancestor=postgres:18-alpine` once took down the
# PROD shared DB (postgres-central) — lessons-learned 2026-06-29. This script
# only ever stops the exact container id it created, recorded in .gate-db.cid.
#
# Usage:
#   scripts/gate-db.sh up        # start disposable PG18, bootstrap roles, migrate
#   scripts/gate-db.sh env       # print `export` lines for the test env vars
#   scripts/gate-db.sh psql ...  # run psql inside the disposable container
#   scripts/gate-db.sh down      # stop+remove ONLY the container this script made
#   scripts/gate-db.sh status    # show the disposable container (if any)
#
# Typical gate run:
#   scripts/gate-db.sh up
#   eval "$(scripts/gate-db.sh env)"
#   bun run test        # expect "N passed", ZERO skipped, in db + api suites
#   scripts/gate-db.sh down
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_FILE="$REPO_ROOT/.gate-db.cid"
PORT="${GATE_DB_PORT:-55462}"
IMAGE="postgres:18-alpine"
NAME="retailos-gate-$$-$(date +%s)"

fail() {
  echo "gate-db: $1" >&2
  exit 1
}

cid_from_state() {
  [ -s "$STATE_FILE" ] || fail "no $STATE_FILE — nothing started by this harness"
  cat "$STATE_FILE"
}

cmd_up() {
  if [ -s "$STATE_FILE" ] && docker ps -q --no-trunc | grep -q "$(cat "$STATE_FILE")"; then
    echo "gate-db: already running ($(cat "$STATE_FILE" | cut -c1-12)) on port $PORT"
    return 0
  fi
  local cid
  cid=$(docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres \
    -p "127.0.0.1:${PORT}:5432" "$IMAGE")
  echo "$cid" > "$STATE_FILE"
  echo "gate-db: started ${cid:0:12} ($NAME) on 127.0.0.1:$PORT"

  echo "gate-db: waiting for postgres..."
  for _ in $(seq 1 60); do
    if docker exec "$cid" pg_isready -U postgres -q 2>/dev/null; then break; fi
    sleep 1
  done
  docker exec "$cid" pg_isready -U postgres -q || fail "postgres never became ready"

  echo "gate-db: bootstrapping roles (ADR 0006)..."
  docker exec -i "$cid" psql -q -U postgres -d postgres \
    < "$REPO_ROOT/packages/db/src/bootstrap/roles.sql"

  echo "gate-db: running migrations as retailos_migrator..."
  MIGRATION_DATABASE_URL="postgresql://retailos_migrator:retailos_migrator@localhost:${PORT}/postgres" \
    bun --cwd "$REPO_ROOT/packages/db" db:migrate

  echo "gate-db: ready. Next: eval \"\$(scripts/gate-db.sh env)\" && bun run test"
}

cmd_env() {
  echo "export DATABASE_URL=postgresql://retailos_app:retailos_app@localhost:${PORT}/postgres"
  echo "export RLS_TEST_DATABASE_URL=postgresql://retailos_app:retailos_app@localhost:${PORT}/postgres"
  echo "export MIGRATION_DATABASE_URL=postgresql://retailos_migrator:retailos_migrator@localhost:${PORT}/postgres"
}

cmd_psql() {
  local cid
  cid=$(cid_from_state)
  docker exec -i "$cid" psql -U postgres -d postgres "$@"
}

cmd_down() {
  local cid
  cid=$(cid_from_state)
  # Belt-and-suspenders: refuse to touch anything not named retailos-gate-*.
  local name
  name=$(docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's|^/||' || true)
  if [ -z "$name" ]; then
    echo "gate-db: container already gone; clearing state"
    rm -f "$STATE_FILE"
    return 0
  fi
  case "$name" in
    retailos-gate-*) ;;
    *) fail "refusing to stop '$name' — not a gate container (protects postgres-central)" ;;
  esac
  docker stop "$cid" >/dev/null && docker rm "$cid" >/dev/null
  rm -f "$STATE_FILE"
  echo "gate-db: removed $name"
  # Prove shared infra untouched.
  docker ps --filter name=postgres-central --format 'postgres-central: {{.Status}}'
}

cmd_status() {
  if [ -s "$STATE_FILE" ]; then
    docker ps -a --no-trunc --filter "id=$(cat "$STATE_FILE")" \
      --format 'gate container: {{.Names}} {{.Status}}'
  else
    echo "gate-db: none running (no $STATE_FILE)"
  fi
}

case "${1:-}" in
  up) cmd_up ;;
  env) cmd_env ;;
  psql) shift; cmd_psql "$@" ;;
  down) cmd_down ;;
  status) cmd_status ;;
  *) fail "usage: gate-db.sh {up|env|psql|down|status}" ;;
esac
