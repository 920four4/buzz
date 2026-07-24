# Cockpit · for Buzz

A **human-first** client for [Buzz](https://github.com/block/buzz) — not Slack with agents.

| Nav | What it is |
|-----|------------|
| **Inbox** | Things that need a human (approve / unblock / reply) |
| **Work** | Goals as cards — not `#channels` |
| **Agents** | Create, edit, assign, team up |
| **Messages** | Side chats only |

**Live:** https://buzz-cockpit-coral.vercel.app

## Agent functionality (full local product surface)

| Action | How |
|--------|-----|
| **Create** | Agents → **New agent** (name, role, model, color) |
| **Edit / stop / delete** | Click agent card |
| **Assign to work** | Agent detail → pick work, **or** Work → **Add agent** |
| **@tag** | In a work note type `@` → autocomplete → Send |
| **Quick tag** | Chips under work header (`@Honey`, …) |
| **Teams** | Agents → **New team** → add whole crew to work |
| **Persist** | Agents / work / teams in `localStorage` |

@mention flow: agent **joins** the work → status **Working** → **replies in-thread**.

## Quick start

```bash
. ./bin/activate-hermit
just cockpit-up            # full stack
# or
pnpm --dir cockpit dev     # http://127.0.0.1:5174
```

Hard-refresh the browser if an old build is cached.

## Deploy

```bash
just cockpit-deploy
# or: cd cockpit && vercel --prod --yes --scope 920four4s-projects
```

Git author: `team@920four.com` · Runbook: [../COCKPIT.md](../COCKPIT.md)
