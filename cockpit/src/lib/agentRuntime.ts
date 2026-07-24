/**
 * Client-side agent runtime — makes assign/@mention feel real.
 *
 * When you put an agent on work (or @them with a task), we run a multi-step job:
 * acknowledge → read context → produce artifact → done.
 * Each step posts a real timeline update. Optional relay publish for each step.
 */

import type { Agent, WorkItem, WorkUpdate } from "./demo";

export type JobStep = {
  label: string;
  agentMessage: string;
  ms: number;
};

export type AgentJob = {
  id: string;
  agentId: string;
  workId: string;
  task: string;
  status: "running" | "done" | "failed";
  startedAt: number;
  finishedAt?: number;
  artifact?: string;
};

function nowUpdate(author: string, text: string, isAgent: boolean): WorkUpdate {
  return {
    id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author,
    isAgent,
    text,
    when: formatWhen(Date.now()),
  };
}

function formatWhen(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Infer what kind of work from free text. */
export function planJob(
  agent: Agent,
  work: WorkItem,
  task: string,
): { steps: JobStep[]; artifact: string; summary: string } {
  const t = task.toLowerCase();
  const title = work.title;

  if (/review|pr|diff|code|patch/.test(t)) {
    return {
      summary: `Code review on “${title}”`,
      steps: [
        {
          label: "ack",
          agentMessage: `On it — reviewing “${title}”.`,
          ms: 400,
        },
        {
          label: "scan",
          agentMessage: `Scanning recent notes and goal…\n> ${work.goal}`,
          ms: 900,
        },
        {
          label: "findings",
          agentMessage: buildReviewFindings(work, task),
          ms: 1200,
        },
        {
          label: "done",
          agentMessage:
            "Review complete. Marked items that need a human decision.",
          ms: 500,
        },
      ],
      artifact: buildReviewFindings(work, task),
    };
  }

  if (/note|release|changelog|draft|write/.test(t)) {
    return {
      summary: `Draft for “${title}”`,
      steps: [
        {
          label: "ack",
          agentMessage: `Drafting for “${title}”.`,
          ms: 400,
        },
        {
          label: "gather",
          agentMessage: `Pulling ${work.updates.length} updates into a short draft…`,
          ms: 1000,
        },
        {
          label: "draft",
          agentMessage: buildReleaseDraft(work, agent),
          ms: 1100,
        },
        {
          label: "done",
          agentMessage: "Draft ready — please **Approve** or edit in Inbox.",
          ms: 400,
        },
      ],
      artifact: buildReleaseDraft(work, agent),
    };
  }

  if (/test|ci|check|verify/.test(t)) {
    return {
      summary: `Checks for “${title}”`,
      steps: [
        {
          label: "ack",
          agentMessage: `Running checks for “${title}”.`,
          ms: 350,
        },
        {
          label: "run",
          agentMessage: "Lint · typecheck · unit suite…",
          ms: 1400,
        },
        {
          label: "result",
          agentMessage: buildTestResult(work),
          ms: 800,
        },
        {
          label: "done",
          agentMessage: "Checks finished. See result above.",
          ms: 350,
        },
      ],
      artifact: buildTestResult(work),
    };
  }

  // Default: plan + next actions
  return {
    summary: `Plan for “${title}”`,
    steps: [
      {
        label: "ack",
        agentMessage: `Got it${task ? ` — “${clip(task, 80)}”` : ""}. Working on “${title}”.`,
        ms: 400,
      },
      {
        label: "context",
        agentMessage: `Context: ${work.goal}\nPeople on it: ${work.people} · agents: ${work.agentIds.length}`,
        ms: 800,
      },
      {
        label: "plan",
        agentMessage: buildPlan(work, task, agent),
        ms: 1200,
      },
      {
        label: "done",
        agentMessage: `Done. Next step is yours if anything’s blocked — I’m idle and ready.`,
        ms: 450,
      },
    ],
    artifact: buildPlan(work, task, agent),
  };
}

function clip(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function buildReviewFindings(work: WorkItem, task: string): string {
  const lines = work.updates
    .filter((u) => !u.isAgent)
    .slice(0, 3)
    .map((u) => `• ${clip(u.text, 100)}`);
  return [
    `**Review findings** — ${work.title}`,
    task ? `Task: ${clip(task, 120)}` : null,
    "",
    "**Looks good**",
    "• Goal is clear and scoped",
    "• Recent human notes are consistent",
    "",
    "**Watch**",
    lines.length
      ? lines.join("\n")
      : "• No human notes yet — add context before merge",
    "",
    "**Needs you**",
    "• Confirm the approach or request a deeper pass",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildReleaseDraft(work: WorkItem, agent: Agent): string {
  const bullets = work.updates
    .slice(0, 5)
    .map((u) => `- ${clip(u.text, 90)} (${u.author})`);
  return [
    `## ${work.title}`,
    "",
    work.goal,
    "",
    "### What changed",
    ...(bullets.length ? bullets : ["- (no timeline yet)"]),
    "",
    "### Thanks",
    `Drafted by ${agent.name}`,
  ].join("\n");
}

function buildTestResult(work: WorkItem): string {
  const seed = work.id.length + work.updates.length;
  const pass = 40 + (seed % 20);
  const fail = seed % 3 === 0 ? 1 : 0;
  return [
    `**Test report** — ${work.title}`,
    "",
    fail === 0
      ? `✓ ${pass} passed · 0 failed · ready to ship`
      : `✗ ${pass} passed · ${fail} failed · needs a look`,
    "",
    fail
      ? "Failing: flaky assert in setup (re-run recommended)"
      : "No blockers found in this pass.",
  ].join("\n");
}

function buildPlan(work: WorkItem, task: string, agent: Agent): string {
  return [
    `**Plan** — ${work.title}`,
    task ? `You asked: ${clip(task, 140)}` : null,
    "",
    "1. Confirm goal and success criteria",
    `2. ${agent.name} gathers context from this room`,
    "3. Produce a concrete artifact (notes / findings / checklist)",
    "4. Hand back anything that needs a human",
    "",
    `Goal reminder: ${work.goal}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type JobCallbacks = {
  onUpdate: (workId: string, update: WorkUpdate) => void;
  onAgentStatus: (
    agentId: string,
    status: Agent["status"],
    doing: string,
  ) => void;
  onJobDone: (job: AgentJob, needsHuman: boolean) => void;
  /** Optional: push each agent message to the relay channel */
  onRelayNote?: (workId: string, text: string) => Promise<void>;
};

/**
 * Run an agent job. Returns a cancel function.
 */
export function runAgentJob(
  agent: Agent,
  work: WorkItem,
  task: string,
  cb: JobCallbacks,
): { jobId: string; cancel: () => void } {
  const job: AgentJob = {
    id: `job-${Date.now()}-${agent.id}`,
    agentId: agent.id,
    workId: work.id,
    task,
    status: "running",
    startedAt: Date.now(),
  };

  const { steps, artifact, summary } = planJob(agent, work, task);
  let cancelled = false;
  let stepIndex = 0;

  cb.onAgentStatus(agent.id, "working", summary);

  const runNext = () => {
    if (cancelled) return;
    if (stepIndex >= steps.length) {
      job.status = "done";
      job.finishedAt = Date.now();
      job.artifact = artifact;
      cb.onAgentStatus(agent.id, "idle", "Ready for the next task");
      const needsHuman =
        /review|release|draft|approve|changelog/i.test(task) ||
        /\*\*Needs you\*\*|Draft ready|please \*\*Approve/i.test(artifact);
      cb.onJobDone(job, needsHuman);
      return;
    }

    const step = steps[stepIndex]!;
    stepIndex += 1;
    cb.onAgentStatus(agent.id, "working", step.label);

    window.setTimeout(() => {
      if (cancelled) return;
      const update = nowUpdate(agent.name, step.agentMessage, true);
      cb.onUpdate(work.id, update);
      void cb.onRelayNote?.(work.id, step.agentMessage);
      runNext();
    }, step.ms);
  };

  // Small tick so UI can paint "working" first
  window.setTimeout(runNext, 80);

  return {
    jobId: job.id,
    cancel: () => {
      cancelled = true;
      job.status = "failed";
      job.finishedAt = Date.now();
      cb.onAgentStatus(agent.id, "idle", "Stopped");
    },
  };
}

export { nowUpdate, formatWhen };
