import type { SignedEvent } from "./identity";
import {
  KIND_GROUP_META,
  KIND_JOB_PROGRESS,
  KIND_JOB_RESULT,
  KIND_STREAM_MESSAGE,
  KIND_APPROVAL_REQUEST,
} from "./kinds";

/** Demo data so the UX is usable before a relay is up. */
export type NeedsItem = {
  id: string;
  kind: "approval" | "agent" | "mention" | "decision";
  title: string;
  detail: string;
  room: string;
  when: string;
  urgency: "now" | "soon" | "later";
};

export type AgentActivity = {
  id: string;
  agent: string;
  verb: string;
  object: string;
  outcome: "ok" | "running" | "blocked" | "failed";
  when: string;
};

export type DemoRoom = {
  id: string;
  name: string;
  about: string;
  status: "active" | "blocked" | "shipped" | "quiet";
  lastActivity: string;
  people: number;
  agents: number;
};

export const DEMO_NEEDS: NeedsItem[] = [
  {
    id: "n1",
    kind: "approval",
    title: "Approve release notes for v0.4.23",
    detail: "Scout drafted notes from 12 merged rooms. Waiting on human 👍.",
    room: "release / 0.4.23",
    when: "2m ago",
    urgency: "now",
  },
  {
    id: "n2",
    kind: "agent",
    title: "Reviewer is blocked on permissions",
    detail: "Wants to open a patch on crates/buzz-relay — grant or deny.",
    room: "branch / auth-rewrite",
    when: "8m ago",
    urgency: "now",
  },
  {
    id: "n3",
    kind: "mention",
    title: "Marge tagged you on incident pattern",
    detail: "“Same signature as Feb outage — want me to page on-call?”",
    room: "incident / redis-blip",
    when: "22m ago",
    urgency: "soon",
  },
  {
    id: "n4",
    kind: "decision",
    title: "Record merge decision",
    detail: "CI green, agent first-pass done. Make the call or hand off.",
    room: "branch / cockpit-ui",
    when: "1h ago",
    urgency: "later",
  },
];

export const DEMO_ACTIVITY: AgentActivity[] = [
  {
    id: "a1",
    agent: "Scout",
    verb: "Searched",
    object: "6 months of incident history",
    outcome: "ok",
    when: "1m",
  },
  {
    id: "a2",
    agent: "Reviewer",
    verb: "Reviewed",
    object: "diff in runtime.rs (+12/−3)",
    outcome: "ok",
    when: "4m",
  },
  {
    id: "a3",
    agent: "Ralph",
    verb: "Running",
    object: "test suite (1,248 cases)",
    outcome: "running",
    when: "now",
  },
  {
    id: "a4",
    agent: "Reviewer",
    verb: "Requested",
    object: "write access to buzz-relay",
    outcome: "blocked",
    when: "8m",
  },
  {
    id: "a5",
    agent: "Scout",
    verb: "Drafted",
    object: "release notes for human review",
    outcome: "ok",
    when: "12m",
  },
];

export const DEMO_ROOMS: DemoRoom[] = [
  {
    id: "r1",
    name: "branch / cockpit-ui",
    about: "Custom mission-control client for Buzz",
    status: "active",
    lastActivity: "agent review ready",
    people: 2,
    agents: 1,
  },
  {
    id: "r2",
    name: "incident / redis-blip",
    about: "Intermittent fan-out delay on presence",
    status: "blocked",
    lastActivity: "needs human",
    people: 3,
    agents: 2,
  },
  {
    id: "r3",
    name: "release / 0.4.23",
    about: "Ship notes + checklist",
    status: "active",
    lastActivity: "approval pending",
    people: 1,
    agents: 1,
  },
  {
    id: "r4",
    name: "branch / auth-rewrite",
    about: "NIP-42 path cleanup",
    status: "active",
    lastActivity: "tests running",
    people: 1,
    agents: 2,
  },
  {
    id: "r5",
    name: "culture / weekly",
    about: "Slow forum — wins and kudos",
    status: "quiet",
    lastActivity: "yesterday",
    people: 8,
    agents: 0,
  },
  {
    id: "r6",
    name: "shipped / mesh-llm",
    about: "Archived branch room",
    status: "shipped",
    lastActivity: "merged",
    people: 4,
    agents: 1,
  },
];

export function demoRoomEvents(): SignedEvent[] {
  const now = Math.floor(Date.now() / 1000);
  return DEMO_ROOMS.map((r, i) => ({
    id: `demo-room-${r.id}`,
    pubkey: "0".repeat(64),
    created_at: now - i * 100,
    kind: KIND_GROUP_META,
    tags: [
      ["d", r.id],
      ["name", r.name],
      ["about", r.about],
      ["closed"],
    ],
    content: "",
    sig: "0".repeat(128),
  }));
}

export function demoMessages(roomId: string): SignedEvent[] {
  const now = Math.floor(Date.now() / 1000);
  const lines = [
    {
      author: "a".repeat(64),
      text: "Opening this as a work room — not a chat dump. Goal: ship the cockpit UX.",
    },
    {
      author: "b".repeat(64),
      text: "Scout: pulled last three release threads. Draft notes attached for approval.",
    },
    {
      author: "c".repeat(64),
      text: "Reviewer: first-pass on vite.config — looks clean. Want me to open the patch?",
    },
    {
      author: "a".repeat(64),
      text: "Yes — but only after human signs the release notes card.",
    },
  ];
  return lines.map((line, i) => ({
    id: `demo-msg-${roomId}-${i}`,
    pubkey: line.author,
    created_at: now - (lines.length - i) * 90,
    kind: KIND_STREAM_MESSAGE,
    tags: [["h", roomId]],
    content: line.text,
    sig: "0".repeat(128),
  }));
}

export function demoAgentKinds(): number[] {
  return [KIND_JOB_PROGRESS, KIND_JOB_RESULT, KIND_APPROVAL_REQUEST];
}
