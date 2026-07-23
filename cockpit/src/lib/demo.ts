export type InboxKind = "approve" | "unblock" | "reply";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  title: string;
  body: string;
  workId: string;
  workTitle: string;
  agentId?: string;
  when: string;
  urgency: "now" | "soon" | "later";
};

export type WorkItem = {
  id: string;
  title: string;
  goal: string;
  status: "waiting" | "moving" | "blocked" | "done";
  people: number;
  agentIds: string[];
  updates: WorkUpdate[];
};

export type WorkUpdate = {
  id: string;
  author: string;
  isAgent: boolean;
  text: string;
  when: string;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  color: string;
  accent: string;
  model: string;
  status: "idle" | "working" | "waiting" | "offline";
  doing: string;
  emoji: string;
};

export type MessageThread = {
  id: string;
  name: string;
  preview: string;
  when: string;
  unread: number;
  agentId?: string;
};

export const DEMO_AGENTS: Agent[] = [
  {
    id: "fizz",
    name: "Fizz",
    role: "Finds answers in history",
    color: "#c5d86d",
    accent: "#8fa83a",
    model: "sonnet",
    status: "working",
    doing: "Searching past incidents…",
    emoji: "🐛",
  },
  {
    id: "honey",
    name: "Honey",
    role: "Reviews code & opens patches",
    color: "#c4784a",
    accent: "#9a5430",
    model: "sonnet",
    status: "waiting",
    doing: "Needs write access to ship a fix",
    emoji: "🐝",
  },
  {
    id: "bumble",
    name: "Bumble",
    role: "Drafts notes & checklists",
    color: "#5b8fd4",
    accent: "#3a6db0",
    model: "sonnet",
    status: "idle",
    doing: "Ready for the next task",
    emoji: "🦋",
  },
];

export const DEMO_INBOX: InboxItem[] = [
  {
    id: "i1",
    kind: "approve",
    title: "Approve release notes",
    body: "Bumble drafted notes from 12 finished work items. One tap and they ship.",
    workId: "w-release",
    workTitle: "Ship v0.4.23",
    agentId: "bumble",
    when: "2m ago",
    urgency: "now",
  },
  {
    id: "i2",
    kind: "unblock",
    title: "Honey is stuck",
    body: "Wants permission to open a patch. Allow once, or always for this work.",
    workId: "w-login",
    workTitle: "Fix login bug",
    agentId: "honey",
    when: "8m ago",
    urgency: "now",
  },
  {
    id: "i3",
    kind: "reply",
    title: "Marge asked about last outage",
    body: "“Same signature as February — should we page on-call?”",
    workId: "w-incident",
    workTitle: "App felt slow",
    when: "22m ago",
    urgency: "soon",
  },
];

export const DEMO_WORK: WorkItem[] = [
  {
    id: "w-release",
    title: "Ship v0.4.23",
    goal: "Notes approved, checklist green, tag cut.",
    status: "waiting",
    people: 2,
    agentIds: ["bumble"],
    updates: [
      {
        id: "u1",
        author: "Bumble",
        isAgent: true,
        text: "Drafted release notes from 12 merged items. Ready for your approve.",
        when: "12m",
      },
      {
        id: "u2",
        author: "You",
        isAgent: false,
        text: "Keep the tone short. Call out the login fix.",
        when: "40m",
      },
    ],
  },
  {
    id: "w-login",
    title: "Fix login bug",
    goal: "Users stuck on magic-link redirect on mobile Safari.",
    status: "blocked",
    people: 1,
    agentIds: ["honey", "fizz"],
    updates: [
      {
        id: "u3",
        author: "Honey",
        isAgent: true,
        text: "Found the bad redirect. Patch ready — need write access.",
        when: "8m",
      },
      {
        id: "u4",
        author: "Fizz",
        isAgent: true,
        text: "Same pattern showed up twice last quarter in #incidents.",
        when: "15m",
      },
    ],
  },
  {
    id: "w-incident",
    title: "App felt slow",
    goal: "Figure out the blip, fix it, write down what we learned.",
    status: "moving",
    people: 3,
    agentIds: ["fizz"],
    updates: [
      {
        id: "u5",
        author: "Marge",
        isAgent: false,
        text: "Same signature as Feb outage — want me to page on-call?",
        when: "22m",
      },
      {
        id: "u6",
        author: "Fizz",
        isAgent: true,
        text: "Pulled six months of history. Root cause threads attached.",
        when: "25m",
      },
    ],
  },
  {
    id: "w-cockpit",
    title: "New dashboard",
    goal: "Ship a human-first client that doesn’t feel like chat.",
    status: "moving",
    people: 2,
    agentIds: ["honey"],
    updates: [
      {
        id: "u7",
        author: "You",
        isAgent: false,
        text: "Inbox first. Work as cards. Agents as teammates.",
        when: "1h",
      },
    ],
  },
];

export const DEMO_MESSAGES: MessageThread[] = [
  {
    id: "m1",
    name: "Honey",
    preview: "Patch is ready when you are.",
    when: "8m",
    unread: 1,
    agentId: "honey",
  },
  {
    id: "m2",
    name: "Marge",
    preview: "Can you look at the Feb thread?",
    when: "22m",
    unread: 0,
  },
  {
    id: "m3",
    name: "Welcome Team",
    preview: "Fizz joined the room.",
    when: "Yesterday",
    unread: 0,
  },
];

export function agentById(id: string): Agent | undefined {
  return DEMO_AGENTS.find((a) => a.id === id);
}
