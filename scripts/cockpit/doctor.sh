#!/usr/bin/env bash
# Health check for the Cockpit + Buzz dual-track setup.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/bin:$PATH"

ok=0
warn=0
fail=0

pass() { echo "  ✓ $*"; ok=$((ok + 1)); }
soft() { echo "  ~ $*"; warn=$((warn + 1)); }
bad()  { echo "  ✗ $*"; fail=$((fail + 1)); }

echo "Cockpit doctor"
echo "──────────────"

# Git remotes
if git remote get-url origin >/dev/null 2>&1; then
  pass "origin: $(git remote get-url origin)"
else
  bad "origin remote missing"
fi

if git remote get-url upstream >/dev/null 2>&1; then
  pass "upstream: $(git remote get-url upstream)"
else
  bad "upstream remote missing (want https://github.com/block/buzz.git)"
fi

# Author
email="$(git config user.email || true)"
name="$(git config user.name || true)"
if [[ "$email" == "team@920four.com" ]]; then
  pass "git author $name <$email>"
else
  soft "git author is $name <$email> (expected team@920four.com for this fork)"
fi

# Cockpit package
if [[ -f cockpit/package.json ]]; then
  pass "cockpit/ package present"
else
  bad "cockpit/ missing"
fi

if grep -qE '["'\'']cockpit["'\'']' pnpm-workspace.yaml 2>/dev/null; then
  pass "pnpm-workspace includes cockpit"
else
  soft "pnpm-workspace may not list cockpit"
fi

# Docker
if docker info >/dev/null 2>&1; then
  pass "Docker running"
else
  bad "Docker not running"
fi

for svc in postgres redis minio; do
  if docker compose ps --status running --services 2>/dev/null | grep -qx "$svc"; then
    pass "docker service $svc running"
  else
    soft "docker service $svc not running (just setup / just cockpit-up)"
  fi
done

# Relay
if curl -sf -o /dev/null -H 'Accept: application/nostr+json' http://127.0.0.1:3000/; then
  pass "buzz-relay on :3000 (NIP-11 ok)"
else
  soft "buzz-relay not reachable on :3000"
fi

# Cockpit dev
if curl -sf -o /dev/null http://127.0.0.1:5174/; then
  pass "Cockpit dev on :5174"
else
  soft "Cockpit dev not on :5174 (just cockpit / pnpm --dir cockpit dev)"
fi

# Toolchain
if command -v cargo >/dev/null 2>&1 || [[ -x "$ROOT/bin/cargo" ]]; then
  pass "cargo available (hermit bin ok)"
else
  soft "cargo not on PATH — run: . ./bin/activate-hermit"
fi

# Upstream skew
if git rev-parse upstream/main >/dev/null 2>&1; then
  BEHIND="$(git rev-list --count HEAD..upstream/main 2>/dev/null || echo "?")"
  AHEAD="$(git rev-list --count upstream/main..HEAD 2>/dev/null || echo "?")"
  if [[ "$BEHIND" == "0" ]]; then
    pass "branch includes upstream/main"
  else
    soft "$BEHIND upstream commit(s) not merged — run: just cockpit-sync"
  fi
  echo "  · ahead of upstream by $AHEAD commit(s) (your fork + cockpit)"
else
  soft "upstream/main not fetched — git fetch upstream"
fi

if [[ -f .cockpit/last-upstream-sync.json ]]; then
  pass "last sync recorded in .cockpit/last-upstream-sync.json"
else
  soft "no sync record yet (ok until first just cockpit-sync)"
fi

echo ""
echo "Summary: $ok ok · $warn notes · $fail failures"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
exit 0
