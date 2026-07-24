import type { Agent, WorkItem, WorkUpdate } from "./demo";
import { DEMO_AGENTS, DEMO_WORK } from "./demo";

const AGENTS_KEY = "cockpit.agents.v2";
const WORK_KEY = "cockpit.work.v2";
const TEAMS_KEY = "cockpit.teams.v2";

export type AgentTeam = {
  id: string;
  name: string;
  agentIds: string[];
};

export type CreateAgentInput = {
  name: string;
  role: string;
  model?: string;
  color?: string;
};

const PALETTE = [
  "#c5d86d",
  "#c4784a",
  "#5b8fd4",
  "#9b7bde",
  "#e85d4c",
  "#2f9e7a",
  "#f0a202",
  "#6b8cae",
];

export function loadAgents(): Agent[] {
  try {
    const raw = localStorage.getItem(AGENTS_KEY);
    if (!raw) return structuredClone(DEMO_AGENTS);
    const parsed = JSON.parse(raw) as Agent[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return structuredClone(DEMO_AGENTS);
    }
    return parsed;
  } catch {
    return structuredClone(DEMO_AGENTS);
  }
}

export function saveAgents(agents: Agent[]) {
  localStorage.setItem(AGENTS_KEY, JSON.stringify(agents));
}

export function loadWork(): WorkItem[] {
  try {
    const raw = localStorage.getItem(WORK_KEY);
    if (!raw) return structuredClone(DEMO_WORK);
    const parsed = JSON.parse(raw) as WorkItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return structuredClone(DEMO_WORK);
    }
    return parsed;
  } catch {
    return structuredClone(DEMO_WORK);
  }
}

export function saveWork(work: WorkItem[]) {
  localStorage.setItem(WORK_KEY, JSON.stringify(work));
}

export function loadTeams(): AgentTeam[] {
  try {
    const raw = localStorage.getItem(TEAMS_KEY);
    if (!raw) {
      return [
        {
          id: "team-welcome",
          name: "Welcome Team",
          agentIds: DEMO_AGENTS.map((a) => a.id),
        },
      ];
    }
    return JSON.parse(raw) as AgentTeam[];
  } catch {
    return [];
  }
}

export function saveTeams(teams: AgentTeam[]) {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
}

export function createAgent(
  input: CreateAgentInput,
  existing: Agent[],
): Agent {
  const base = slugify(input.name) || `agent-${Date.now()}`;
  let id = base;
  let n = 1;
  while (existing.some((a) => a.id === id)) {
    id = `${base}-${n++}`;
  }
  const color =
    input.color || PALETTE[existing.length % PALETTE.length] || "#5b8fd4";
  return {
    id,
    name: input.name.trim(),
    role: input.role.trim() || "Generalist teammate",
    color,
    accent: color,
    model: input.model || "sonnet",
    status: "idle",
    doing: "Ready for the next task",
    emoji: "🤖",
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
}

/** Find @Name mentions that match agents (longest name first). */
export function parseMentions(text: string, agents: Agent[]): Agent[] {
  const found = new Map<string, Agent>();
  const sorted = [...agents].sort((a, b) => b.name.length - a.name.length);
  for (const agent of sorted) {
    const re = new RegExp(
      `@${escapeRegExp(agent.name)}(?![\\w])`,
      "gi",
    );
    if (re.test(text)) {
      found.set(agent.id, agent);
    }
  }
  return [...found.values()];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function agentReplyForTask(agent: Agent, task: string): string {
  const clean = task
    .replace(new RegExp(`@${escapeRegExp(agent.name)}`, "gi"), "")
    .trim();
  const focus = clean || "this";
  const lines = [
    `On it — working on: ${focus}`,
    `Got it. I'll handle “${focus}” and report back.`,
    `Acknowledged. Queued: ${focus}`,
  ];
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!;
}

export function makeUpdate(
  author: string,
  text: string,
  isAgent: boolean,
): WorkUpdate {
  return {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author,
    isAgent,
    text,
    when: "now",
  };
}

export { PALETTE };
