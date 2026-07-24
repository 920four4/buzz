import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Inbox,
  Layers,
  MessageSquare,
  Search,
  Settings2,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { AgentsView } from "@/components/AgentsView";
import { InboxView } from "@/components/InboxView";
import { MessagesView } from "@/components/MessagesView";
import { WorkView } from "@/components/WorkView";
import {
  DEMO_MESSAGES,
  type Agent,
  type InboxItem,
  type WorkItem,
} from "@/lib/demo";
import {
  type AgentTeam,
  type CreateAgentInput,
  createAgent,
  loadAgents,
  loadTeams,
  loadWork,
  makeUpdate,
  parseMentions,
  saveAgents,
  saveTeams,
  saveWork,
} from "@/lib/agents";
import { runAgentJob } from "@/lib/agentRuntime";
import { connectionLabel } from "@/lib/activity";
import {
  addAgentToChannel,
  agentFromManagedEvent,
  ensureAgentKeys,
  ensureWorkChannel,
  fetchManagedAgentsFromRelay,
  mergeRelayAgents,
  publishAgentToRelay,
  publishWorkMessage,
} from "@/lib/buzzWire";
import {
  getOrCreateIdentity,
  resetIdentity,
  shortPubkey,
  type Identity,
} from "@/lib/identity";
import { useToast } from "@/lib/toast";
import {
  getRelayWsUrl,
  RelaySession,
  setRelayWsUrl,
  type ConnectionState,
} from "@/lib/relay";

type Nav = "inbox" | "work" | "agents" | "messages" | "settings";

const navItems: { id: Nav; label: string; icon: typeof Inbox }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "work", label: "Work", icon: Layers },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "messages", label: "Messages", icon: MessageSquare },
];

export default function App() {
  const { push } = useToast();
  const [identity, setIdentity] = useState<Identity>(() =>
    getOrCreateIdentity("You"),
  );
  const [nav, setNav] = useState<Nav>("work");
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [work, setWork] = useState<WorkItem[]>(() => loadWork());
  const [agents, setAgents] = useState<Agent[]>(() => loadAgents());
  const [teams, setTeams] = useState<AgentTeam[]>(() => loadTeams());
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnectionState>("idle");
  const [live, setLive] = useState(false);
  const [busyWorkId, setBusyWorkId] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [relayInput, setRelayInput] = useState(getRelayWsUrl());
  const [nameInput, setNameInput] = useState(identity.displayName);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const sessionRef = useRef<RelaySession | null>(null);
  const jobCancelRef = useRef<Map<string, () => void>>(new Map());
  // Keep latest work for job callbacks without stale closures
  const workRef = useRef(work);
  workRef.current = work;

  // Persist workspace state
  useEffect(() => {
    saveAgents(agents);
  }, [agents]);
  useEffect(() => {
    saveWork(work);
  }, [work]);
  useEffect(() => {
    saveTeams(teams);
  }, [teams]);

  const connect = useCallback(async (id: Identity, url: string) => {
    sessionRef.current?.disconnect();
    const next = new RelaySession(id, url);
    sessionRef.current = next;
    next.onState((s) => setConn(s));
    try {
      await next.connect();
      try {
        await next.publishProfile(id.displayName || "You");
      } catch {
        /* optional */
      }
      setLive(true);
      // Pull owner-published managed agents from the hive (desktop + Cockpit).
      try {
        const events = await fetchManagedAgentsFromRelay(next, id.pubkey);
        const remote = events
          .map(agentFromManagedEvent)
          .filter((a): a is Agent => a != null);
        if (remote.length > 0) {
          setAgents((local) => mergeRelayAgents(local, remote));
          push(`Synced ${remote.length} agent(s) from relay`);
        }
      } catch {
        /* offline-ok */
      }
    } catch {
      setLive(false);
    }
  }, [push]);

  useEffect(() => {
    void connect(identity, getRelayWsUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const searchHits = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    const hits: { type: string; title: string; go: () => void }[] = [];
    for (const i of inbox) {
      if (
        i.title.toLowerCase().includes(q) ||
        i.body.toLowerCase().includes(q)
      ) {
        hits.push({
          type: "Inbox",
          title: i.title,
          go: () => {
            setNav("inbox");
            setSearchOpen(false);
          },
        });
      }
    }
    for (const w of work) {
      if (
        w.title.toLowerCase().includes(q) ||
        w.goal.toLowerCase().includes(q)
      ) {
        hits.push({
          type: "Work",
          title: w.title,
          go: () => {
            setNav("work");
            setSelectedWork(w.id);
            setSearchOpen(false);
          },
        });
      }
    }
    for (const a of agents) {
      if (
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q)
      ) {
        hits.push({
          type: "Agent",
          title: a.name,
          go: () => {
            setNav("agents");
            setSearchOpen(false);
          },
        });
      }
    }
    return hits.slice(0, 8);
  }, [searchQ, inbox, work, agents]);

  function openWork(workId: string) {
    setNav("work");
    setSelectedWork(workId);
  }

  function appendWorkUpdate(
    workId: string,
    update: ReturnType<typeof makeUpdate>,
  ) {
    setWork((prev) =>
      prev.map((w) =>
        w.id === workId ? { ...w, updates: [update, ...w.updates] } : w,
      ),
    );
  }

  function startAgentJob(agent: Agent, item: WorkItem, task: string) {
    // Cancel prior job for this agent on this work
    const key = `${item.id}:${agent.id}`;
    jobCancelRef.current.get(key)?.();

    const { cancel } = runAgentJob(agent, item, task, {
      onUpdate: (workId, update) => appendWorkUpdate(workId, update),
      onAgentStatus: (agentId, status, doing) => {
        setAgents((prev) =>
          prev.map((a) => (a.id === agentId ? { ...a, status, doing } : a)),
        );
      },
      onJobDone: (job, needsHuman) => {
        jobCancelRef.current.delete(key);
        if (!needsHuman) return;
        const ag = agents.find((a) => a.id === job.agentId);
        const w = workRef.current.find((x) => x.id === job.workId);
        if (!ag || !w) return;
        setInbox((prev) => [
          {
            id: `inbox-${job.id}`,
            kind: "approve" as const,
            title: `${ag.name} finished — review`,
            body: job.artifact
              ? job.artifact.slice(0, 180) + (job.artifact.length > 180 ? "…" : "")
              : `Job on “${w.title}” is done.`,
            workId: w.id,
            workTitle: w.title,
            agentId: ag.id,
            when: "just now",
            urgency: "now" as const,
          },
          ...prev.filter((i) => i.id !== `inbox-${job.id}`),
        ]);
        push(`${ag.name} needs a quick review`);
      },
      onRelayNote: async (workId, text) => {
        const session = sessionRef.current;
        const w = workRef.current.find((x) => x.id === workId);
        if (!live || !session || !w?.channelId) return;
        try {
          await publishWorkMessage(session, w.channelId, text, []);
        } catch {
          /* local timeline already has it */
        }
      },
    });
    jobCancelRef.current.set(key, cancel);
  }

  async function assignAgentToWork(workId: string, agentId: string) {
    const agent = agents.find((a) => a.id === agentId);
    const item = work.find((w) => w.id === workId);
    if (!agent || !item) return;

    setBusyWorkId(workId);
    setBusyLabel(`Assigning ${agent.name}…`);
    let nextAgent = ensureAgentKeys(agent);
    let nextWork = item;
    const session = sessionRef.current;

    try {
      if (live && session) {
        setBusyLabel(`Publishing ${agent.name} to hive…`);
        nextAgent = await publishAgentToRelay(session, nextAgent);
        setBusyLabel("Opening work room on relay…");
        const ensured = await ensureWorkChannel(session, nextWork);
        nextWork = ensured.work;
        if (nextAgent.pubkey) {
          setBusyLabel(`Adding ${agent.name} to room…`);
          await addAgentToChannel(
            session,
            ensured.channelId,
            nextAgent.pubkey,
          );
        }
      }

      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId
            ? {
                ...nextAgent,
                status: "working" as const,
                doing: `Joining “${item.title}”`,
              }
            : a,
        ),
      );

      const joined = !item.agentIds.includes(agentId);
      setWork((prev) =>
        prev.map((w) => {
          if (w.id !== workId) return w;
          return {
            ...w,
            channelId: nextWork.channelId ?? w.channelId,
            agentIds: joined ? [...w.agentIds, agentId] : w.agentIds,
            status: w.status === "done" ? w.status : "moving",
            updates: joined
              ? [
                  makeUpdate(
                    "Cockpit",
                    `${agent.name} is on this work.`,
                    false,
                  ),
                  ...w.updates,
                ]
              : w.updates,
          };
        }),
      );

      // Always run a real multi-step job so assign feels productive
      const freshWork = {
        ...item,
        channelId: nextWork.channelId ?? item.channelId,
        agentIds: joined ? [...item.agentIds, agentId] : item.agentIds,
      };
      startAgentJob(
        nextAgent,
        freshWork,
        `Help move “${item.title}” forward. Goal: ${item.goal}`,
      );
      push(
        live
          ? `${agent.name} assigned · working on the hive`
          : `${agent.name} assigned · working now`,
      );
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Could not assign agent",
        "info",
      );
    } finally {
      setBusyWorkId(null);
      setBusyLabel(null);
    }
  }

  function removeAgentFromWork(workId: string, agentId: string) {
    const agent = agents.find((a) => a.id === agentId);
    setWork((prev) =>
      prev.map((w) =>
        w.id === workId
          ? {
              ...w,
              agentIds: w.agentIds.filter((id) => id !== agentId),
              updates: agent
                ? [
                    makeUpdate(
                      "System",
                      `${agent.name} left this work.`,
                      false,
                    ),
                    ...w.updates,
                  ]
                : w.updates,
            }
          : w,
      ),
    );
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id !== agentId) return a;
        const stillOn = work.some(
          (w) => w.id !== workId && w.agentIds.includes(agentId),
        );
        if (stillOn) return a;
        return {
          ...a,
          status: "idle" as const,
          doing: "Ready for the next task",
        };
      }),
    );
  }

  async function handleAddNote(workId: string, text: string) {
    const mentioned = parseMentions(text, agents);
    const item = work.find((w) => w.id === workId);
    if (!item) return;
    const session = sessionRef.current;

    setBusyWorkId(workId);
    setBusyLabel(live ? "Sending…" : "Posting…");

    // Your note first
    const youNote = makeUpdate("You", text, false);
    setWork((prev) =>
      prev.map((w) => {
        if (w.id !== workId) return w;
        const agentIds = new Set(w.agentIds);
        for (const m of mentioned) agentIds.add(m.id);
        return {
          ...w,
          agentIds: [...agentIds],
          status: w.status === "done" ? w.status : "moving",
          updates: [youNote, ...w.updates],
        };
      }),
    );

    let channelId = item.channelId;
    try {
      if (live && session) {
        const ensured = await ensureWorkChannel(session, item);
        channelId = ensured.channelId;
        setWork((prev) =>
          prev.map((w) =>
            w.id === workId ? { ...w, channelId } : w,
          ),
        );

        for (const m of mentioned) {
          const keyed = ensureAgentKeys(m);
          setBusyLabel(`Getting ${m.name} on the hive…`);
          await publishAgentToRelay(session, keyed);
          if (keyed.pubkey && channelId) {
            await addAgentToChannel(session, channelId, keyed.pubkey);
          }
          setAgents((prev) =>
            prev.map((a) =>
              a.id === m.id ? { ...a, ...keyed, relaySyncedAt: Date.now() } : a,
            ),
          );
        }

        setBusyLabel("Sending to room…");
        const mentionPks = mentioned
          .map((m) => ensureAgentKeys(m).pubkey)
          .filter((pk): pk is string => Boolean(pk));
        await publishWorkMessage(session, channelId!, text, mentionPks);
      }

      // Mentioned agents: join + run real multi-step jobs
      const taskBody =
        text.replace(/@[\w-]+/g, "").trim() ||
        `Help with “${item.title}”`;

      for (const m of mentioned) {
        const keyed = ensureAgentKeys(m);
        const joinedWork: WorkItem = {
          ...item,
          channelId,
          agentIds: item.agentIds.includes(m.id)
            ? item.agentIds
            : [...item.agentIds, m.id],
          updates: [youNote, ...item.updates],
        };
        startAgentJob(keyed, joinedWork, taskBody);
      }

      if (mentioned.length === 0) {
        push(live ? "Sent to room" : "Posted");
      } else {
        push(
          `${mentioned.map((m) => m.name).join(", ")} on it`,
        );
      }
    } catch (err) {
      push(
        err instanceof Error ? err.message : "Send failed",
        "info",
      );
    } finally {
      setBusyWorkId(null);
      setBusyLabel(null);
    }
  }

  function resolveInbox(id: string) {
    const item = inbox.find((i) => i.id === id);
    setInbox((prev) => prev.filter((i) => i.id !== id));
    if (!item) return;

    if (item.kind === "approve") {
      setWork((prev) =>
        prev.map((w) =>
          w.id === item.workId
            ? {
                ...w,
                status: "done" as const,
                updates: [
                  makeUpdate("You", "Approved. Ship it.", false),
                  ...w.updates,
                ],
              }
            : w,
        ),
      );
      if (item.agentId) {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === item.agentId
              ? {
                  ...a,
                  status: "idle" as const,
                  doing: "Ready for the next task",
                }
              : a,
          ),
        );
      }
    }
    if (item.kind === "unblock" && item.agentId) {
      const agentName =
        agents.find((a) => a.id === item.agentId)?.name ?? "Agent";
      setWork((prev) =>
        prev.map((w) =>
          w.id === item.workId
            ? {
                ...w,
                status: "moving" as const,
                updates: [
                  makeUpdate(
                    agentName,
                    "Thanks — unblocked and continuing.",
                    true,
                  ),
                  ...w.updates,
                ],
              }
            : w,
        ),
      );
      setAgents((prev) =>
        prev.map((a) =>
          a.id === item.agentId
            ? {
                ...a,
                status: "working" as const,
                doing: `On “${item.workTitle}”`,
              }
            : a,
        ),
      );
    }
  }

  async function handleCreateAgent(input: CreateAgentInput) {
    const agent = createAgent(input, agents);
    setAgents((prev) => [...prev, agent]);

    const session = sessionRef.current;
    if (live && session) {
      try {
        const synced = await publishAgentToRelay(session, agent);
        setAgents((prev) =>
          prev.map((a) => (a.id === agent.id ? synced : a)),
        );
        push(`${agent.name} published to relay (kind:30177)`);
      } catch (err) {
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agent.id
              ? {
                  ...a,
                  relaySyncError:
                    err instanceof Error ? err.message : "publish failed",
                }
              : a,
          ),
        );
        push(
          err instanceof Error
            ? `Agent saved locally; relay: ${err.message}`
            : "Agent saved locally; relay publish failed",
          "info",
        );
      }
    } else {
      push(`${agent.name} created (connect relay to publish kind:30177)`);
    }
  }

  async function syncAllAgentsToRelay() {
    const session = sessionRef.current;
    if (!session || !live) {
      push("Connect to a relay first", "info");
      return;
    }
    let ok = 0;
    let fail = 0;
    for (const agent of agents) {
      try {
        const synced = await publishAgentToRelay(session, ensureAgentKeys(agent));
        setAgents((prev) =>
          prev.map((a) => (a.id === agent.id ? synced : a)),
        );
        ok++;
      } catch {
        fail++;
      }
    }
    push(`Synced ${ok} agent(s)${fail ? ` · ${fail} failed` : ""}`);
  }

  return (
    <div className="flex h-full min-h-0 bg-cream grain">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-line bg-sidebar/90 px-3 py-4 sm:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-honey text-ink shadow-sm">
            <Zap className="size-4" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">Cockpit</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-mute">
              for Buzz
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="mb-4 flex items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-2 text-sm text-mute shadow-sm hover:border-line-strong"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded-md bg-cream-2 px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>

        <nav className="flex flex-1 flex-col gap-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setNav(id);
                if (id !== "work") setSelectedWork(null);
              }}
              className={clsx(
                "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                nav === id
                  ? "bg-paper text-ink shadow-sm"
                  : "text-ink-soft hover:bg-paper/60",
              )}
            >
              <Icon className="size-4 opacity-80" />
              {label}
              {id === "inbox" && inbox.length > 0 && (
                <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-honey text-[10px] font-bold text-ink">
                  {inbox.length}
                </span>
              )}
              {id === "agents" && (
                <span className="ml-auto text-[10px] font-mono text-mute">
                  {agents.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-2 px-1">
          <div
            className={clsx(
              "rounded-2xl border px-3 py-2 text-[11px] font-medium",
              live
                ? "border-mint/30 bg-mint-soft text-mint"
                : "border-line bg-paper text-mute",
            )}
          >
            {live ? "● Connected to relay" : "○ Preview · local workspace"}
          </div>
          <button
            type="button"
            onClick={() => setNav("settings")}
            className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-sm text-mute hover:bg-paper hover:text-ink"
          >
            <Settings2 className="size-4" />
            Settings
          </button>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
              {identity.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {identity.displayName}
              </div>
              <div className="truncate font-mono text-[10px] text-mute">
                {shortPubkey(identity.pubkey, 4)}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-paper/80 px-3 py-2.5 backdrop-blur sm:hidden">
          <div className="flex size-8 items-center justify-center rounded-xl bg-honey">
            <Zap className="size-3.5" />
          </div>
          <span className="font-semibold">Cockpit</span>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="ml-auto rounded-xl border border-line p-2"
          >
            <Search className="size-4" />
          </button>
        </header>

        {(() => {
          const c = connectionLabel(live, conn);
          return (
            <div
              className={clsx(
                "border-b px-4 py-2 text-center text-sm",
                c.tone === "ok" && "border-mint/20 bg-mint-soft text-mint",
                c.tone === "warn" &&
                  "border-honey/20 bg-honey/10 text-honey-deep",
                c.tone === "mute" && "border-line bg-paper text-mute",
              )}
            >
              {c.text}
              {!live && (
                <button
                  type="button"
                  className="ml-2 font-semibold underline"
                  onClick={() => setNav("settings")}
                >
                  Connect relay
                </button>
              )}
            </div>
          );
        })()}

        <main className="min-h-0 flex-1 overflow-y-auto">
          {nav === "inbox" && (
            <InboxView
              items={inbox}
              agents={agents}
              onResolve={resolveInbox}
              onOpenWork={openWork}
            />
          )}
          {nav === "work" && (
            <WorkView
              work={work}
              agents={agents}
              selectedId={selectedWork}
              busyWorkId={busyWorkId}
              busyLabel={busyLabel}
              live={live}
              onSelect={setSelectedWork}
              onAddNote={(workId, text) => {
                void handleAddNote(workId, text);
              }}
              onAssignAgent={(workId, agentId) => {
                void assignAgentToWork(workId, agentId);
              }}
              onRemoveAgent={removeAgentFromWork}
              onCreate={(title) => {
                const id = `w-${Date.now()}`;
                setWork((prev) => [
                  {
                    id,
                    title,
                    goal: "Add agents with + or @mention them in a note with a clear task.",
                    status: "moving",
                    people: 1,
                    agentIds: [],
                    updates: [
                      makeUpdate(
                        "You",
                        "Opened this work. Assign an agent or @tag them with a task.",
                        false,
                      ),
                    ],
                  },
                  ...prev,
                ]);
                setSelectedWork(id);
              }}
            />
          )}
          {nav === "agents" && (
            <AgentsView
              agents={agents}
              work={work}
              teams={teams}
              onStopAll={() =>
                setAgents((prev) =>
                  prev.map((a) =>
                    a.status === "working"
                      ? {
                          ...a,
                          status: "idle",
                          doing: "Ready for the next task",
                        }
                      : a,
                  ),
                )
              }
              onCreate={(input) => {
                void handleCreateAgent(input);
              }}
              onSyncAll={() => {
                void syncAllAgentsToRelay();
              }}
              onUpdate={(id, patch) =>
                setAgents((prev) =>
                  prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
                )
              }
              onDelete={(id) => {
                setAgents((prev) => prev.filter((a) => a.id !== id));
                setWork((prev) =>
                  prev.map((w) => ({
                    ...w,
                    agentIds: w.agentIds.filter((x) => x !== id),
                  })),
                );
                setTeams((prev) =>
                  prev.map((t) => ({
                    ...t,
                    agentIds: t.agentIds.filter((x) => x !== id),
                  })),
                );
              }}
              onAssignToWork={(agentId, workId) => {
                void assignAgentToWork(workId, agentId);
              }}
              onCreateTeam={(name, agentIds) =>
                setTeams((prev) => [
                  {
                    id: `team-${Date.now()}`,
                    name,
                    agentIds,
                  },
                  ...prev,
                ])
              }
              onDeleteTeam={(id) =>
                setTeams((prev) => prev.filter((t) => t.id !== id))
              }
              onOpenWork={openWork}
            />
          )}
          {nav === "messages" && (
            <MessagesView threads={DEMO_MESSAGES} agents={agents} />
          )}
          {nav === "settings" && (
            <div className="mx-auto max-w-lg px-4 py-10 animate-rise">
              <h1 className="font-display text-3xl font-medium">Settings</h1>
              <p className="mt-2 text-mute">
                Identity, relay, and workspace data.
              </p>
              <form
                className="mt-8 space-y-4 rounded-3xl border border-line bg-paper p-5 shadow-sm"
                onSubmit={(e) => {
                  e.preventDefault();
                  setRelayWsUrl(relayInput.trim());
                  const next = getOrCreateIdentity(nameInput.trim() || "You");
                  setIdentity(next);
                  void connect(next, relayInput.trim()).then(() =>
                    push("Saved connection settings"),
                  );
                }}
              >
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                    Display name
                  </span>
                  <input
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-honey"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                    Relay WebSocket
                  </span>
                  <input
                    value={relayInput}
                    onChange={(e) => setRelayInput(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-3 py-2.5 font-mono text-sm outline-none focus:border-honey"
                  />
                  <span className="mt-1 block text-xs text-mute">
                    Local:{" "}
                    <code className="text-sky">/relay-ws</code> or{" "}
                    <code className="text-sky">ws://127.0.0.1:3000</code>
                  </span>
                </label>
                <div className="rounded-2xl bg-cream px-3 py-2 font-mono text-[11px] text-mute">
                  <div>status: {conn}</div>
                  <div className="break-all">pubkey: {identity.pubkey}</div>
                  <div>
                    agents: {agents.length} · work: {work.length} · teams:{" "}
                    {teams.length}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
                  >
                    Save & connect
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = resetIdentity(nameInput || "You");
                      setIdentity(next);
                      void connect(next, getRelayWsUrl());
                      push("New keypair created");
                    }}
                    className="rounded-2xl border border-line px-4 py-2.5 text-sm text-mute hover:text-coral"
                  >
                    New keypair
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem("cockpit.agents.v2");
                      localStorage.removeItem("cockpit.work.v2");
                      localStorage.removeItem("cockpit.teams.v2");
                      setAgents(loadAgents());
                      setWork(loadWork());
                      setTeams(loadTeams());
                      setInbox([]);
                      push("Workspace data cleared");
                    }}
                    className="rounded-2xl border border-line px-4 py-2.5 text-sm text-mute hover:text-ink"
                  >
                    Reset workspace data
                  </button>
                </div>
              </form>
              <div className="mt-6 space-y-3 text-sm text-mute leading-relaxed">
                <p>
                  <strong className="text-ink">Buzz wire (live)</strong> — create
                  agent publishes{" "}
                  <code className="text-sky">kind:30177</code> (owner) +{" "}
                  <code className="text-sky">kind:0</code> (agent profile). Work
                  becomes a NIP-29 channel; agents join as bot; @mentions send{" "}
                  <code className="text-sky">kind:9</code> with p-tags.
                </p>
                <p>
                  <strong className="text-ink">Execution</strong> — LLM/ACP still
                  runs via Buzz desktop / <code className="text-sky">buzz-acp</code>{" "}
                  on this hive. Cockpit owns roster, rooms, and mentions on the
                  wire.
                </p>
                <button
                  type="button"
                  onClick={() => void syncAllAgentsToRelay()}
                  className="rounded-2xl border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink hover:border-honey"
                >
                  Publish all agents to relay
                </button>
              </div>
            </div>
          )}
        </main>

        <nav className="flex border-t border-line bg-paper sm:hidden">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setNav(id)}
              className={clsx(
                "relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium",
                nav === id ? "text-honey-deep" : "text-mute",
              )}
            >
              <Icon className="size-4" />
              {label}
              {id === "inbox" && inbox.length > 0 && (
                <span className="absolute right-1/4 top-1.5 size-1.5 rounded-full bg-honey" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {searchOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="animate-pop w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-paper shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search className="size-4 text-mute" />
              <input
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search work, inbox, agents…"
                className="w-full bg-transparent py-4 text-sm outline-none"
              />
            </div>
            <ul className="max-h-72 overflow-y-auto p-2">
              {searchQ && searchHits.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-mute">
                  Nothing matched
                </li>
              )}
              {!searchQ && (
                <li className="px-3 py-4 text-center text-sm text-mute">
                  Try “login”, “Honey”, or create an agent and search their name
                </li>
              )}
              {searchHits.map((h) => (
                <li key={`${h.type}-${h.title}`}>
                  <button
                    type="button"
                    onClick={h.go}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-cream"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide text-mute">
                      {h.type}
                    </span>
                    <span className="font-medium">{h.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
