/**
 * Buzz protocol wire for Cockpit agents/work.
 *
 * Mirrors what the desktop does publicly:
 * - Owner publishes kind:30177 managed-agent projections (NIP-AP)
 * - Agent key publishes kind:0 profile
 * - Work rooms are NIP-29 groups (kind:9007) with optional client h UUID
 * - Agents join via kind:9000
 * - Mentions are kind:9 with ["p", agentPubkey] tags
 *
 * Spawning ACP/LLM subprocesses still requires desktop/buzz-acp on the same
 * hive — Cockpit owns identity, roster, rooms, and mentions on the wire.
 */

import { makeAuthEvent } from "nostr-tools/nip42";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import type { Agent, WorkItem } from "./demo";
import { bytesToHex } from "./hex";
import type { Identity, SignedEvent } from "./identity";
import { signEvent } from "./identity";
import {
  KIND_ADD_USER,
  KIND_CREATE_GROUP,
  KIND_MANAGED_AGENT,
  KIND_METADATA,
  KIND_STREAM_MESSAGE,
} from "./kinds";
import type { RelaySession } from "./relay";

export function ensureAgentKeys(agent: Agent): Agent {
  if (agent.pubkey && agent.secretKeyHex) return agent;
  const sk = generateSecretKey();
  const secretKeyHex = bytesToHex(sk);
  const pubkey = getPublicKey(sk);
  return {
    ...agent,
    id: agent.id || pubkey.slice(0, 12),
    pubkey,
    secretKeyHex,
  };
}

export function mintAgentKeys(): { pubkey: string; secretKeyHex: string } {
  const sk = generateSecretKey();
  return { secretKeyHex: bytesToHex(sk), pubkey: getPublicKey(sk) };
}

function ownerIdentity(session: RelaySession): Identity {
  return session.ownerIdentity;
}

/** Publish public managed-agent record + agent profile to the relay. */
export async function publishAgentToRelay(
  session: RelaySession,
  agent: Agent,
): Promise<Agent> {
  const ready = ensureAgentKeys(agent);
  if (!ready.pubkey || !ready.secretKeyHex) {
    throw new Error("Agent is missing a keypair");
  }

  const owner = ownerIdentity(session);

  // Owner-signed kind:30177 (d = agent pubkey) — public projection only.
  const managedContent = {
    name: ready.name,
    persona_id: null as string | null,
    system_prompt: ready.systemPrompt || ready.role || null,
    model: ready.model || null,
    provider: null as string | null,
    persona_source_version: null as string | null,
    parallelism: 1,
    respond_to: "owner-only",
    respond_to_allowlist: [] as string[],
  };

  const managedEvent = signEvent(owner, {
    kind: KIND_MANAGED_AGENT,
    content: JSON.stringify(managedContent),
    tags: [
      ["d", ready.pubkey],
      ["alt", "managed agent"],
    ],
  });
  await session.publish(managedEvent);

  // Agent kind:0 profile requires a separate NIP-42 session as the agent
  // (relay enforces event.pubkey === auth pubkey). Desktop does this; Cockpit
  // publishes the public 30177 roster entry as owner. Profile is best-effort.
  try {
    await publishAgentProfile(session.relayUrl, {
      ...ready,
      pubkey: ready.pubkey,
      secretKeyHex: ready.secretKeyHex,
    });
  } catch {
    /* 30177 is enough for discovery */
  }

  return {
    ...ready,
    relaySyncedAt: Date.now(),
    relaySyncError: null,
  };
}

async function publishAgentProfile(
  ownerWsUrl: string,
  agent: Agent & { pubkey: string; secretKeyHex: string },
): Promise<void> {
  const direct =
    import.meta.env.DEV ||
    ownerWsUrl.includes("relay-ws") ||
    ownerWsUrl.includes("5174")
      ? "ws://127.0.0.1:3000"
      : ownerWsUrl;

  const identity: Identity = {
    secretKeyHex: agent.secretKeyHex,
    pubkey: agent.pubkey,
    displayName: agent.name,
  };
  const profileEvent = signEvent(identity, {
    kind: KIND_METADATA,
    content: JSON.stringify({
      name: agent.name,
      display_name: agent.name,
      about: agent.role || "Buzz agent (Cockpit)",
    }),
    tags: [],
  });

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(direct);
    let authId: string | null = null;
    let settled = false;
    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* */
      }
      if (err) reject(err);
      else resolve();
    };
    const timer = window.setTimeout(
      () => done(new Error("agent profile timeout")),
      10_000,
    );

    ws.addEventListener("message", (msg) => {
      let data: unknown;
      try {
        data = JSON.parse(String(msg.data));
      } catch {
        return;
      }
      if (!Array.isArray(data)) return;

      if (data[0] === "AUTH" && typeof data[1] === "string") {
        const template = makeAuthEvent("ws://127.0.0.1:3000", data[1]);
        const signed = signEvent(identity, {
          kind: template.kind,
          content: template.content,
          tags: template.tags as string[][],
          created_at: template.created_at,
        });
        authId = signed.id;
        ws.send(JSON.stringify(["AUTH", signed]));
        return;
      }

      if (data[0] === "OK" && data[1] === authId) {
        if (data[2] === true) {
          ws.send(JSON.stringify(["EVENT", profileEvent]));
        } else {
          done(new Error("agent AUTH rejected"));
        }
        return;
      }

      if (data[0] === "OK" && data[1] === profileEvent.id) {
        if (data[2] === true) done();
        else
          done(
            new Error(
              typeof data[3] === "string" ? data[3] : "profile rejected",
            ),
          );
      }
    });

    ws.addEventListener("error", () => done(new Error("agent WS error")));
  });
}

/** Ensure work has a Buzz channel; create one if needed. */
export async function ensureWorkChannel(
  session: RelaySession,
  work: WorkItem,
): Promise<{ work: WorkItem; channelId: string }> {
  if (work.channelId) {
    return { work, channelId: work.channelId };
  }

  const channelId = crypto.randomUUID();
  const tags: string[][] = [
    ["h", channelId],
    ["name", work.title.slice(0, 80)],
    ["visibility", "open"],
    ["channel_type", "stream"],
  ];
  if (work.goal) tags.push(["about", work.goal.slice(0, 280)]);

  const event = signEvent(ownerIdentity(session), {
    kind: KIND_CREATE_GROUP,
    content: "",
    tags,
  });
  await session.publish(event);

  return {
    channelId,
    work: { ...work, channelId },
  };
}

/** Add agent to channel as bot member (kind:9000). */
export async function addAgentToChannel(
  session: RelaySession,
  channelId: string,
  agentPubkey: string,
): Promise<void> {
  const event = signEvent(ownerIdentity(session), {
    kind: KIND_ADD_USER,
    content: "",
    tags: [
      ["h", channelId],
      ["p", agentPubkey.toLowerCase()],
      ["role", "bot"],
    ],
  });
  await session.publish(event);
}

/** Stream message with optional agent mention p-tags. */
export async function publishWorkMessage(
  session: RelaySession,
  channelId: string,
  text: string,
  mentionPubkeys: string[] = [],
): Promise<SignedEvent> {
  const owner = ownerIdentity(session);
  const tags: string[][] = [
    ["h", channelId],
    ["p", owner.pubkey],
  ];
  for (const pk of mentionPubkeys) {
    if (pk && pk !== owner.pubkey) {
      tags.push(["p", pk.toLowerCase()]);
    }
  }
  const event = signEvent(owner, {
    kind: KIND_STREAM_MESSAGE,
    content: text,
    tags,
  });
  await session.publish(event);
  return event;
}

/** Fetch owner-published managed agents from relay. */
export async function fetchManagedAgentsFromRelay(
  session: RelaySession,
  ownerPubkey: string,
  limit = 100,
): Promise<SignedEvent[]> {
  return session.query({
    kinds: [KIND_MANAGED_AGENT],
    authors: [ownerPubkey],
    limit,
  });
}

export function agentFromManagedEvent(ev: SignedEvent): Agent | null {
  try {
    const content = JSON.parse(ev.content) as {
      name?: string;
      system_prompt?: string | null;
      model?: string | null;
    };
    const pubkey = ev.tags.find((t) => t[0] === "d")?.[1];
    if (!pubkey || !content.name) return null;
    return {
      id: pubkey.slice(0, 12),
      name: content.name,
      role: content.system_prompt || "Managed agent",
      color: "#5b8fd4",
      accent: "#3a6db0",
      model: content.model || "sonnet",
      status: "idle",
      doing: "From relay",
      emoji: "🤖",
      pubkey,
      systemPrompt: content.system_prompt || undefined,
      relaySyncedAt: (ev.created_at || 0) * 1000,
    };
  } catch {
    return null;
  }
}

/** Merge local agents with relay projections (local keys win). */
export function mergeRelayAgents(
  local: Agent[],
  remote: Agent[],
): Agent[] {
  const byPubkey = new Map<string, Agent>();
  for (const a of local) {
    if (a.pubkey) byPubkey.set(a.pubkey, a);
  }
  for (const r of remote) {
    if (!r.pubkey) continue;
    const existing = byPubkey.get(r.pubkey);
    if (existing) {
      byPubkey.set(r.pubkey, {
        ...r,
        ...existing,
        // keep local secrets
        secretKeyHex: existing.secretKeyHex,
        color: existing.color,
        accent: existing.accent,
        id: existing.id,
      });
    } else {
      // remote-only (e.g. created on desktop) — visible but no local key
      byPubkey.set(r.pubkey, r);
    }
  }
  // Agents without pubkey stay local-only
  const keyed = new Set([...byPubkey.values()].map((a) => a.id));
  const unkeyed = local.filter((a) => !a.pubkey || !keyed.has(a.id));
  // Prefer map values + unkeyed locals not already represented
  const fromMap = [...byPubkey.values()];
  const extras = unkeyed.filter(
    (a) => !fromMap.some((m) => m.id === a.id || m.pubkey === a.pubkey),
  );
  return [...fromMap, ...extras];
}
