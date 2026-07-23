#!/usr/bin/env bash
# Dial in remotes + author for the 920four Buzz fork.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# Remotes
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin https://github.com/920four4/buzz.git
else
  git remote add origin https://github.com/920four4/buzz.git
fi

if git remote get-url upstream >/dev/null 2>&1; then
  git remote set-url upstream https://github.com/block/buzz.git
else
  git remote add upstream https://github.com/block/buzz.git
fi

# Author (local to this repo only)
git config user.email "team@920four.com"
git config user.name "920four"

echo "Remotes:"
git remote -v
echo ""
echo "Author: $(git config user.name) <$(git config user.email)>"
echo ""
echo "Fetching upstream (shallow-friendly)…"
git fetch upstream --prune
echo "Done. Branch tip: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"
