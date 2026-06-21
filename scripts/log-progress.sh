#!/usr/bin/env bash
# RetailOS progress helper — keeps the live tracker current across agents & compaction.
#
# Usage:
#   scripts/log-progress.sh show         # print LEAN current state (used by the SessionStart hook)
#   scripts/log-progress.sh log "msg"    # prepend a dated entry to the PROGRESS.md changelog
#
# The SessionStart hook runs `show`; its stdout is injected into every new session/agent so
# context is linked to the docs (not bloated) — full board + changelog live in PROGRESS.md.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
F="$ROOT/docs/architecture/PROGRESS.md"
[ -f "$F" ] || exit 0

case "${1:-show}" in
  show)
    # Lean view: header + how-to-resume + work-lanes table (stop before the full task board).
    sed -n '1,/^## Task Board/p' "$F"
    echo "→ Full task board, verified facts, and changelog: docs/architecture/PROGRESS.md"
    echo "→ Governing charter: docs/architecture/retailos-master-charter.md · Lessons: docs/architecture/lessons-learned.md"
    ;;
  log)
    msg="${2:-}"
    [ -n "$msg" ] || { echo "usage: scripts/log-progress.sh log \"message\"" >&2; exit 1; }
    ds="$(date +%Y-%m-%d)"
    awk -v entry="- **${ds}** — ${msg}" '
      /^## Changelog \(newest first\)/ { print; print ""; print entry; injected=1; next }
      { print }
      END { if (!injected) { print ""; print "## Changelog (newest first)"; print ""; print entry } }
    ' "$F" > "$F.tmp" && mv "$F.tmp" "$F"
    echo "logged: $msg"
    ;;
  *)
    echo "usage: scripts/log-progress.sh [show|log \"message\"]" >&2
    exit 1
    ;;
esac
