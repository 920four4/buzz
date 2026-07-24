#!/usr/bin/env bash
# One-shot: deps + migrations + relay + cockpit UI.
# Leaves relay in background; cockpit in foreground (or both background with --bg).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/bin:$PATH"

BG=0
SKIP_RELAY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --bg) BG=1; shift ;;
    --ui-only) SKIP_RELAY=1; shift ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "→ Docker services (postgres, redis, minio + bucket init)"
docker compose up -d postgres redis minio minio-init

echo "→ waiting for postgres"
for i in $(seq 1 40); do
  if docker compose exec -T postgres pg_isready -U buzz >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "→ migrations"
if command -v just >/dev/null 2>&1 || [[ -x "$ROOT/bin/just" ]]; then
  just migrate
else
  cargo run -p buzz-admin -- migrate
fi

if [[ "$SKIP_RELAY" -eq 0 ]]; then
  if curl -sf -o /dev/null -H 'Accept: application/nostr+json' http://127.0.0.1:3000/; then
    echo "→ relay already up on :3000"
  else
    echo "→ starting buzz-relay (background log: .cockpit/relay.log)"
    mkdir -p .cockpit
    # Prefer just relay so hermit/env match project
    nohup just relay >.cockpit/relay.log 2>&1 &
    echo $! >.cockpit/relay.pid
    for i in $(seq 1 90); do
      if curl -sf -o /dev/null -H 'Accept: application/nostr+json' http://127.0.0.1:3000/; then
        echo "→ relay ready"
        break
      fi
      if [[ "$i" -eq 90 ]]; then
        echo "Relay did not become ready. Tail .cockpit/relay.log" >&2
        tail -40 .cockpit/relay.log || true
        exit 1
      fi
      sleep 2
    done
  fi
fi

echo "→ cockpit deps"
if [[ ! -d cockpit/node_modules ]]; then
  pnpm install --filter buzz-cockpit...
fi

echo ""
echo "┌─────────────────────────────────────────────────────┐"
echo "│  Cockpit (your UX)     http://127.0.0.1:5174        │"
echo "│  Buzz relay            ws://127.0.0.1:3000          │"
echo "│  Portless (if set)     https://cockpit.localhost:1355│"
echo "│  Official desktop      BUZZ_RELAY_URL=ws://127.0.0.1:3000 │"
echo "└─────────────────────────────────────────────────────┘"
echo ""

if [[ "$BG" -eq 1 ]]; then
  nohup pnpm --dir cockpit dev --host 127.0.0.1 --port 5174 >.cockpit/ui.log 2>&1 &
  echo $! >.cockpit/ui.pid
  echo "Cockpit UI backgrounded (pid $(cat .cockpit/ui.pid), log .cockpit/ui.log)"
else
  exec pnpm --dir cockpit dev --host 127.0.0.1 --port 5174
fi
