# Cockpit · Buzz mission control

A **non-Slack** UX for [Buzz](https://github.com/block/buzz): home is “needs you,” work rooms are outcomes, agents render as verb · object · outcome.

Cockpit is a thin browser client. The Buzz **relay** stays the source of truth (Nostr NIP-01 / NIP-29 / NIP-42).

## Quick start

```bash
# from repo root — deps + Docker + migrations + relay
. ./bin/activate-hermit
just setup          # once
just relay          # ws://127.0.0.1:3000

# cockpit UI
cd cockpit
pnpm install
pnpm dev            # http://localhost:5174  (proxies /relay-ws → :3000)
```

### Portless (named .localhost URL)

```bash
cd cockpit
portless run pnpm dev   # https://cockpit.localhost
```

### Demo mode

If the relay is down, Cockpit loads **demo rooms / needs / agent feed** so you can still review the UX.

## Deploy (Vercel)

```bash
cd cockpit
vercel link --yes --scope 920four   # or your team
vercel --prod --yes
```

Set optional env on the project:

| Env | Purpose |
|-----|---------|
| `VITE_BUZZ_RELAY_WS` | Public `wss://…` relay for production |
| `VITE_BUZZ_RELAY_AUTH_URL` | NIP-42 auth URL if it differs from the WS URL |

Static SPA (`vite` → `dist`). Author commits as `team@920four.com`.

## Stack

- Vite + React 19 + Tailwind 4
- `nostr-tools` (sign + NIP-42)
- Proxy in dev: `/relay-ws` → Buzz relay
