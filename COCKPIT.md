# Cockpit + Buzz — dual-track runbook

You run **two layers**:

| Layer | Path | Update with |
|-------|------|-------------|
| **Buzz core** (hive) | `crates/`, migrations, Docker, optional `desktop/` | `just cockpit-sync` ← `block/buzz` |
| **Cockpit** (your UX) | `cockpit/` only | You. Never replaced by upstream UI |

Same relay = same workspace. Official Buzz desktop can point at the same `ws://` / `wss://` when you need a feature Cockpit doesn’t have yet.

---

## One-time setup

```bash
. ./bin/activate-hermit
./scripts/cockpit/setup-git.sh   # origin=920four4/buzz, upstream=block/buzz, author=team@920four.com
just cockpit-doctor
just cockpit-up                  # docker + migrate + relay + UI
```

Open **http://127.0.0.1:5174**  
Relay **ws://127.0.0.1:3000**

Optional portless:

```bash
portless alias cockpit 5174
# https://cockpit.localhost:1355
```

---

## Daily

```bash
. ./bin/activate-hermit
just cockpit-up          # full stack
# or already have relay:
just cockpit             # UI only
just cockpit-doctor      # health
```

### Official desktop on *your* hive

```bash
export BUZZ_RELAY_URL=ws://127.0.0.1:3000
# launch Buzz desktop from releases or `just desktop-standalone`
```

Same community, different shell. Prefer Cockpit day-to-day.

---

## Getting future Buzz features (without changing UX)

```bash
just cockpit-sync           # merge upstream/main, protect cockpit/
just cockpit-sync --dry-run # preview
git push origin HEAD
```

What that does:

1. `git fetch upstream`
2. Merge `upstream/main`
3. On conflicts: **upstream wins** for `desktop/`, `web/`, `crates/`, …  
4. **`cockpit/` always kept as yours**
5. Ensures `pnpm-workspace.yaml` still lists `cockpit`
6. Writes `.cockpit/last-upstream-sync.json`

You get relay/agent/protocol/security updates.  
You do **not** get forced into their Slack-shaped desktop.

When upstream adds a *capability* you want in product UI, add a thin surface in `cockpit/` yourself.

---

## Deploy Cockpit (Vercel)

Team: **920four4s-projects** · Project: **buzz-cockpit**

```bash
cd cockpit
vercel --prod --yes --scope 920four4s-projects
```

Live: https://buzz-cockpit-coral.vercel.app  

For a real remote hive, set on Vercel:

- `VITE_BUZZ_RELAY_WS=wss://your-relay.example.com`
- rebuild/redeploy (Vite bakes env at build time)

Git commits on this fork: **`920four <team@920four.com>`**

---

## Mental model

```
Cockpit ──NIP-42/WS──► buzz-relay ◄── optional official desktop
                         │
                    Postgres/Redis/S3
```

- **Upgrade hive** → sync upstream / pull new relay image  
- **Upgrade product** → edit `cockpit/` only  
- **Data** lives on the relay, not in the UI  

---

## Commands cheat sheet

| Command | Purpose |
|---------|---------|
| `just cockpit-setup-git` | Remotes + author |
| `just cockpit-doctor` | Health check |
| `just cockpit-up` | Full local stack + UI |
| `just cockpit` | UI only |
| `just cockpit-sync` | Merge `block/buzz`, keep UX |
| `just cockpit-deploy` | Vercel prod (920four4s-projects) |
| `just relay` | Buzz core only |
| `just down` | Stop Docker deps |

---

## Rules of the road

1. Custom product code **only** under `cockpit/` (and `scripts/cockpit/`, `COCKPIT.md`).  
2. Do not productize patches inside `desktop/`.  
3. After every upstream sync, run `just cockpit-doctor`.  
4. Prefer one long-lived product branch (`cockpit-ui` or `main` once merged) + regular `cockpit-sync`.  
