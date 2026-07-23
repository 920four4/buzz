#!/usr/bin/env bash
# Merge block/buzz into the current branch while protecting cockpit/.
#
# Usage (from repo root):
#   ./scripts/cockpit/sync-upstream.sh
#   ./scripts/cockpit/sync-upstream.sh --dry-run
#   ./scripts/cockpit/sync-upstream.sh --ref upstream/main
#
# Rules:
#   - cockpit/ is always kept as OURS (your UX)
#   - desktop/ web/ mobile/ prefer THEIRS on conflict (upstream product UI)
#   - pnpm-workspace.yaml always re-ensures "cockpit" is listed
#   - Author for any repair commits: leave to local git config (team@920four.com)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

REF="upstream/main"
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --ref) REF="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not a git repo" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash first." >&2
  git status -sb
  exit 1
fi

if ! git remote get-url upstream >/dev/null 2>&1; then
  echo "Adding upstream → https://github.com/block/buzz.git"
  git remote add upstream https://github.com/block/buzz.git
fi

echo "→ fetching upstream"
git fetch upstream --tags --prune

if ! git rev-parse --verify "$REF" >/dev/null 2>&1; then
  echo "Ref not found: $REF" >&2
  exit 1
fi

BEFORE="$(git rev-parse HEAD)"
UPSTREAM_SHA="$(git rev-parse "$REF")"
echo "  HEAD     $BEFORE"
echo "  upstream $UPSTREAM_SHA ($REF)"

if git merge-base --is-ancestor "$UPSTREAM_SHA" HEAD; then
  echo "Already up to date with $REF"
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry run — commits that would be merged:"
  git log --oneline "HEAD..$REF" | head -40
  COUNT="$(git rev-list --count "HEAD..$REF")"
  echo "… $COUNT commit(s) total"
  exit 0
fi

# Snapshot cockpit in case a pathological merge tries to drop it
SNAPSHOT="$(mktemp -d)"
trap 'rm -rf "$SNAPSHOT"' EXIT
if [[ -d cockpit ]]; then
  cp -a cockpit "$SNAPSHOT/cockpit"
fi

echo "→ merging $REF (no-edit)"
set +e
git merge --no-edit "$REF"
MERGE_STATUS=$?
set -e

if [[ "$MERGE_STATUS" -ne 0 ]]; then
  echo "→ merge conflicts — applying Cockpit protection rules"
  # Prefer upstream product surfaces
  for path in desktop web admin-web mobile crates migrations schema docs; do
    if git ls-files -u -- "$path" | grep -q .; then
      echo "  taking upstream for $path/"
      git checkout --theirs -- "$path" 2>/dev/null || true
      git add "$path" 2>/dev/null || true
    fi
  done
  # Always keep our cockpit
  if [[ -d "$SNAPSHOT/cockpit" ]]; then
    echo "  restoring cockpit/ from pre-merge snapshot"
    rm -rf cockpit
    cp -a "$SNAPSHOT/cockpit" cockpit
    git add -A cockpit
  fi
  # Re-apply workspace membership
  if [[ -f pnpm-workspace.yaml ]]; then
    if ! grep -q '"cockpit"' pnpm-workspace.yaml && ! grep -q "'cockpit'" pnpm-workspace.yaml; then
      # insert under packages:
      if grep -q 'packages:' pnpm-workspace.yaml; then
        awk '
          /^packages:/ { print; print "  - \"cockpit\""; next }
          /cockpit/ { next }
          { print }
        ' pnpm-workspace.yaml > pnpm-workspace.yaml.tmp
        mv pnpm-workspace.yaml.tmp pnpm-workspace.yaml
      fi
    fi
    git add pnpm-workspace.yaml
  fi

  if [[ -n "$(git ls-files -u)" ]]; then
    echo "Remaining unmerged paths:" >&2
    git ls-files -u
    echo "Resolve manually, then: git commit" >&2
    exit 1
  fi

  git commit --no-edit -m "Merge $REF; preserve cockpit/ UX"
fi

# Post-merge guarantees
if [[ ! -d cockpit ]]; then
  echo "ERROR: cockpit/ missing after merge — restoring snapshot" >&2
  cp -a "$SNAPSHOT/cockpit" cockpit
  git add -A cockpit
  git commit -m "Restore cockpit/ after upstream merge"
fi

if [[ -f pnpm-workspace.yaml ]] && ! grep -qE '["'\'']cockpit["'\'']' pnpm-workspace.yaml; then
  echo "→ re-adding cockpit to pnpm-workspace.yaml"
  awk '
    /^packages:/ { print; print "  - \"cockpit\""; next }
    { print }
  ' pnpm-workspace.yaml > pnpm-workspace.yaml.tmp
  mv pnpm-workspace.yaml.tmp pnpm-workspace.yaml
  git add pnpm-workspace.yaml
  git commit -m "chore: keep cockpit in pnpm workspace after upstream sync" || true
fi

# Record sync metadata
mkdir -p .cockpit
cat > .cockpit/last-upstream-sync.json <<EOF
{
  "synced_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "upstream_ref": "$REF",
  "upstream_sha": "$(git rev-parse "$REF")",
  "head_sha": "$(git rev-parse HEAD)",
  "previous_head": "$BEFORE"
}
EOF
git add .cockpit/last-upstream-sync.json
git commit -m "chore(cockpit): record upstream sync $(git rev-parse --short "$REF")" || true

echo ""
echo "✓ Synced with $REF"
echo "  Your UX:     cockpit/"
echo "  Buzz core:   crates/, migrations/, desktop/ (upstream)"
echo "  Next:        just cockpit-doctor   # or just cockpit-up"
echo "  Push:        git push origin HEAD"
