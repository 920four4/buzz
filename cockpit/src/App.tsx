import { useCallback, useEffect, useMemo, useState } from "react";
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
  DEMO_AGENTS,
  DEMO_INBOX,
  DEMO_MESSAGES,
  DEMO_WORK,
  type Agent,
  type InboxItem,
  type WorkItem,
} from "@/lib/demo";
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
  const [nav, setNav] = useState<Nav>("inbox");
  const [inbox, setInbox] = useState<InboxItem[]>(DEMO_INBOX);
  const [work, setWork] = useState<WorkItem[]>(DEMO_WORK);
  const [agents, setAgents] = useState<Agent[]>(DEMO_AGENTS);
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [conn, setConn] = useState<ConnectionState>("idle");
  const [live, setLive] = useState(false);
  const [relayInput, setRelayInput] = useState(getRelayWsUrl());
  const [nameInput, setNameInput] = useState(identity.displayName);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [session, setSession] = useState<RelaySession | null>(null);

  const connect = useCallback(
    async (id: Identity, url: string) => {
      session?.disconnect();
      const next = new RelaySession(id, url);
      setSession(next);
      next.onState((s) => setConn(s));
      try {
        await next.connect();
        try {
          await next.publishProfile(id.displayName || "You");
        } catch {
          /* optional */
        }
        setLive(true);
      } catch {
        setLive(false);
      }
    },
    [session],
  );

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
      if (i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q)) {
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
      if (a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q)) {
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

  function resolveInbox(id: string) {
    setInbox((prev) => prev.filter((i) => i.id !== id));
    const item = inbox.find((i) => i.id === id);
    if (item?.kind === "approve") {
      setWork((prev) =>
        prev.map((w) =>
          w.id === item.workId
            ? {
                ...w,
                status: "done" as const,
                updates: [
                  {
                    id: `u-${Date.now()}`,
                    author: "You",
                    isAgent: false,
                    text: "Approved. Ship it.",
                    when: "now",
                  },
                  ...w.updates,
                ],
              }
            : w,
        ),
      );
      setAgents((prev) =>
        prev.map((a) =>
          a.id === "bumble"
            ? { ...a, status: "idle" as const, doing: "Ready for the next task" }
            : a,
        ),
      );
    }
    if (item?.kind === "unblock") {
      setWork((prev) =>
        prev.map((w) =>
          w.id === item.workId
            ? {
                ...w,
                status: "moving" as const,
                updates: [
                  {
                    id: `u-${Date.now()}`,
                    author: "Honey",
                    isAgent: true,
                    text: "Thanks — opening the patch now.",
                    when: "now",
                  },
                  ...w.updates,
                ],
              }
            : w,
        ),
      );
      setAgents((prev) =>
        prev.map((a) =>
          a.id === "honey"
            ? {
                ...a,
                status: "working" as const,
                doing: "Opening patch for login bug…",
              }
            : a,
        ),
      );
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-cream grain">
      {/* Sidebar */}
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
            {live ? "● Connected to relay" : "○ Preview · sample workspace"}
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

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top */}
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

        {!live && (
          <div className="border-b border-honey/20 bg-honey/10 px-4 py-2 text-center text-sm text-honey-deep">
            <strong className="font-semibold">Preview</strong>
            {" — "}
            sample workspace so you can click around. Connect a Buzz relay in
            Settings when you’re ready.
          </div>
        )}

        <main className="min-h-0 flex-1 overflow-y-auto">
          {nav === "inbox" && (
            <InboxView
              items={inbox}
              agents={agents}
              onResolve={resolveInbox}
              onOpenWork={(workId) => {
                setNav("work");
                setSelectedWork(workId);
              }}
            />
          )}
          {nav === "work" && (
            <WorkView
              work={work}
              agents={agents}
              selectedId={selectedWork}
              onSelect={setSelectedWork}
              onAddNote={(workId, text) => {
                setWork((prev) =>
                  prev.map((w) =>
                    w.id === workId
                      ? {
                          ...w,
                          updates: [
                            {
                              id: `n-${Date.now()}`,
                              author: "You",
                              isAgent: false,
                              text,
                              when: "now",
                            },
                            ...w.updates,
                          ],
                        }
                      : w,
                  ),
                );
              }}
              onCreate={(title) => {
                const id = `w-${Date.now()}`;
                setWork((prev) => [
                  {
                    id,
                    title,
                    goal: "You just created this. Add a note or an agent.",
                    status: "moving",
                    people: 1,
                    agentIds: [],
                    updates: [
                      {
                        id: `n-${Date.now()}`,
                        author: "You",
                        isAgent: false,
                        text: "Opened this work.",
                        when: "now",
                      },
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
            />
          )}
          {nav === "messages" && (
            <MessagesView threads={DEMO_MESSAGES} agents={agents} />
          )}
          {nav === "settings" && (
            <div className="mx-auto max-w-lg px-4 py-10 animate-rise">
              <h1 className="font-display text-3xl font-medium">Settings</h1>
              <p className="mt-2 text-mute">
                Identity and relay. Everything else stays simple on purpose.
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
                    Local: use{" "}
                    <code className="text-sky">/relay-ws</code> via Vite proxy
                    or <code className="text-sky">ws://127.0.0.1:3000</code>
                  </span>
                </label>
                <div className="rounded-2xl bg-cream px-3 py-2 font-mono text-[11px] text-mute">
                  <div>status: {conn}</div>
                  <div className="break-all">pubkey: {identity.pubkey}</div>
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
                </div>
              </form>
            </div>
          )}
        </main>

        {/* Mobile nav */}
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

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
          onKeyDown={() => {}}
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
                  Try “login”, “Honey”, or “release”
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
