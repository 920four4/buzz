# Cockpit · for Buzz

A **human-first** client for [Buzz](https://github.com/block/buzz) — not Slack with agents.

| Nav | What it is |
|-----|------------|
| **Inbox** | Things that need a human (approve / unblock / reply) |
| **Work** | Goals as cards — not `#channels` |
| **Agents** | Teammates with faces |
| **Messages** | Side chats only |

Same foundation: NIP-42 auth, stream messages, agent identity. Different front door.

Interactive preview works offline; connect a local relay when you want live events.

**Live:** https://buzz-cockpit-coral.vercel.app

## Quick start

```bash
# relay (repo root)
. ./bin/activate-hermit
just setup && just relay   # ws://127.0.0.1:3000

# cockpit
cd cockpit
pnpm install
pnpm dev                   # http://127.0.0.1:5174
# or: portless alias → https://cockpit.localhost:1355
```

## Try the demo (what “works” means)

1. **Inbox → Approve** release notes — toast, card slides away, work marks done  
2. **Allow** Honey — agent flips to Working, work unblocks  
3. **Work → open a card → add a note**  
4. **Agents** — stop running, inspect status  
5. **⌘K** — search work / inbox / agents  

## Deploy

```bash
cd cockpit
vercel --prod --yes --scope 920four4s-projects
```

Optional env: `VITE_BUZZ_RELAY_WS`, `VITE_BUZZ_RELAY_AUTH_URL`

Git author for this fork: `team@920four.com`
