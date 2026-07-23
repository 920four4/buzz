import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Compass,
  LayoutGrid,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Zap,
} from "lucide-react";
import clsx from "clsx";
import { AgentFeed } from "@/components/AgentFeed";
import { NeedsCard } from "@/components/NeedsCard";
import { RoomCard } from "@/components/RoomCard";
import { RoomPanel } from "@/components/RoomPanel";
import { StatusPill } from "@/components/StatusPill";
import {
  DEMO_ACTIVITY,
  DEMO_NEEDS,
  DEMO_ROOMS,
  type DemoRoom,
} from "@/lib/demo";
import {
  getOrCreateIdentity,
  resetIdentity,
  shortPubkey,
  type Identity,
} from "@/lib/identity";
import {
  getRelayWsUrl,
  RelaySession,
  roomAboutFromEvent,
  roomIdFromEvent,
  roomNameFromEvent,
  setRelayWsUrl,
  type ConnectionState,
} from "@/lib/relay";

type View = "home" | "rooms" | "settings";

export default function App() {
  const [identity, setIdentity] = useState<Identity>(() =>
    getOrCreateIdentity("Operator"),
  );
  const [view, setView] = useState<View>("home");
  const [conn, setConn] = useState<ConnectionState>("idle");
  const [connDetail, setConnDetail] = useState<string | undefined>();
  const [session, setSession] = useState<RelaySession | null>(null);
  const [demo, setDemo] = useState(true);
  const [rooms, setRooms] = useState<DemoRoom[]>(DEMO_ROOMS);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [relayInput, setRelayInput] = useState(getRelayWsUrl());
  const [nameInput, setNameInput] = useState(identity.displayName);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState("");

  const selectedRoom = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );

  const connect = useCallback(
    async (id: Identity, url: string) => {
      setBusy(true);
      setBanner(null);
      session?.disconnect();
      const next = new RelaySession(id, url);
      setSession(next);
      const unsub = next.onState((s, detail) => {
        setConn(s);
        setConnDetail(detail);
      });
      try {
        await next.connect();
        try {
          await next.publishProfile(id.displayName);
        } catch {
          // profile publish optional on locked relays
        }
        const events = await next.listRooms();
        if (events.length > 0) {
          const mapped: DemoRoom[] = events.map((ev) => ({
            id: roomIdFromEvent(ev),
            name: roomNameFromEvent(ev),
            about: roomAboutFromEvent(ev) || "Work room on the relay",
            status: "active",
            lastActivity: "from relay",
            people: 1,
            agents: 0,
          }));
          setRooms(mapped);
          setDemo(false);
          setBanner(null);
        } else {
          setRooms(DEMO_ROOMS);
          setDemo(true);
          setBanner(
            "Connected to relay — no rooms yet. Showing demo rooms until you create one.",
          );
        }
      } catch (e) {
        setDemo(true);
        setRooms(DEMO_ROOMS);
        setBanner(
          e instanceof Error
            ? `Relay unavailable (${e.message}). Running in demo mode.`
            : "Relay unavailable. Running in demo mode.",
        );
      } finally {
        setBusy(false);
        // keep unsub for session lifetime via effect cleanup if we store it
        void unsub;
      }
    },
    [session],
  );

  useEffect(() => {
    void connect(identity, getRelayWsUrl());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- boot once
  }, []);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setRelayWsUrl(relayInput.trim());
    const nextId = getOrCreateIdentity(nameInput.trim() || "Operator");
    setIdentity(nextId);
    await connect(nextId, relayInput.trim());
    setView("home");
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    const name = newRoomName.trim();
    if (!name) return;
    if (demo || !session) {
      const id = `local-${Date.now()}`;
      setRooms((prev) => [
        {
          id,
          name,
          about: "Local demo room",
          status: "active",
          lastActivity: "just now",
          people: 1,
          agents: 0,
        },
        ...prev,
      ]);
      setSelectedRoomId(id);
      setNewRoomName("");
      setView("rooms");
      return;
    }
    setBusy(true);
    try {
      await session.createRoom(name, "Created from Cockpit");
      setNewRoomName("");
      await connect(identity, session.relayUrl);
      setView("rooms");
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Create room failed");
    } finally {
      setBusy(false);
    }
  }

  const connTone =
    conn === "connected"
      ? "live"
      : conn === "error" || conn === "closed"
        ? "danger"
        : conn === "connecting" || conn === "authenticating"
          ? "warn"
          : "mute";

  return (
    <div className="min-h-full flex flex-col">
      {/* Top bar — command strip, not Slack header */}
      <header className="sticky top-0 z-20 border-b border-line/80 bg-ink/90 backdrop-blur-md">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-8 rounded-xl bg-amber text-ink flex items-center justify-center">
              <Zap className="size-4" strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">Cockpit</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-mute">
                Buzz · mission control
              </div>
            </div>
          </div>

          <nav className="hidden sm:flex items-center gap-1 ml-4">
            {(
              [
                ["home", "Needs me", Compass],
                ["rooms", "Work rooms", LayoutGrid],
                ["settings", "Relay", Settings2],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={clsx(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  view === id
                    ? "bg-ink-3 text-paper"
                    : "text-mute hover:text-paper hover:bg-ink-2",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <StatusPill tone={connTone} live={conn === "connected"}>
              {conn}
            </StatusPill>
            {demo && <StatusPill tone="warn">demo data</StatusPill>}
            <div className="hidden md:block text-right">
              <div className="text-xs font-medium text-paper">
                {identity.displayName}
              </div>
              <div className="text-[10px] font-mono text-mute">
                {shortPubkey(identity.pubkey, 5)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {banner && (
        <div className="border-b border-amber/25 bg-amber/10 text-amber text-sm px-4 py-2 text-center">
          {banner}
        </div>
      )}

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 py-6">
        {view === "home" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-fade-up">
            <section className="xl:col-span-5 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Needs you
                  </h1>
                  <p className="text-sm text-mute mt-1">
                    Approvals, blocked agents, mentions — not a channel list.
                  </p>
                </div>
                <StatusPill tone="danger">{DEMO_NEEDS.length} open</StatusPill>
              </div>
              <div className="space-y-3">
                {DEMO_NEEDS.map((item) => (
                  <NeedsCard
                    key={item.id}
                    item={item}
                    onOpen={() => {
                      const match = rooms.find((r) =>
                        item.room.includes(r.name.split("/").pop()?.trim() || "___"),
                      );
                      if (match) {
                        setSelectedRoomId(match.id);
                        setView("rooms");
                      } else if (rooms[0]) {
                        setSelectedRoomId(rooms[0].id);
                        setView("rooms");
                      }
                    }}
                  />
                ))}
              </div>
            </section>

            <section className="xl:col-span-4 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Active rooms</h2>
                  <p className="text-sm text-mute mt-0.5">
                    Outcomes first. Chat lives inside the work.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView("rooms")}
                  className="text-xs text-amber hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="grid gap-3">
                {rooms
                  .filter((r) => r.status === "active" || r.status === "blocked")
                  .slice(0, 4)
                  .map((room) => (
                    <RoomCard
                      key={room.id}
                      room={room}
                      onSelect={() => {
                        setSelectedRoomId(room.id);
                        setView("rooms");
                      }}
                    />
                  ))}
              </div>
            </section>

            <section className="xl:col-span-3">
              <AgentFeed items={DEMO_ACTIVITY} />
            </section>
          </div>
        )}

        {view === "rooms" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[70vh]">
            <aside className="lg:col-span-4 xl:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold">Work rooms</h1>
                <StatusPill tone="mute">{rooms.length}</StatusPill>
              </div>
              <form onSubmit={handleCreateRoom} className="flex gap-2">
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="New room name…"
                  className="flex-1 rounded-xl border border-line bg-ink-2 px-3 py-2 text-sm focus:outline-none focus:border-amber/50"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-ink-3 border border-line px-3 text-amber hover:border-amber/40"
                  aria-label="Create room"
                >
                  <Plus className="size-4" />
                </button>
              </form>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    selected={room.id === selectedRoomId}
                    onSelect={() => setSelectedRoomId(room.id)}
                  />
                ))}
              </div>
            </aside>
            <div className="lg:col-span-8 xl:col-span-9 min-h-[420px]">
              {selectedRoom ? (
                <RoomPanel
                  roomId={selectedRoom.id}
                  roomName={selectedRoom.name}
                  roomAbout={selectedRoom.about}
                  session={session}
                  demo={demo}
                  onClose={() => setSelectedRoomId(null)}
                />
              ) : (
                <div className="h-full min-h-[420px] rounded-2xl border border-dashed border-line flex flex-col items-center justify-center text-center px-6">
                  <Search className="size-8 text-mute mb-3" />
                  <h2 className="text-lg font-medium">Pick a work room</h2>
                  <p className="text-sm text-mute mt-1 max-w-sm">
                    Rooms are outcomes (branches, incidents, releases) — not a
                    FOMO sidebar of #general.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {view === "settings" && (
          <div className="max-w-xl mx-auto animate-fade-up">
            <h1 className="text-2xl font-semibold">Relay & identity</h1>
            <p className="text-sm text-mute mt-1 mb-6">
              Cockpit is a thin client. The Buzz relay is the workspace.
              Author / deploy identity:{" "}
              <span className="font-mono text-soft">team@920four.com</span>
            </p>

            <form
              onSubmit={handleSaveSettings}
              className="space-y-4 rounded-2xl border border-line bg-ink-2/70 p-5"
            >
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-mute">
                  Display name
                </span>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm focus:outline-none focus:border-amber/50"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-mute">
                  Relay WebSocket URL
                </span>
                <input
                  value={relayInput}
                  onChange={(e) => setRelayInput(e.target.value)}
                  placeholder="ws://127.0.0.1:3000 or /relay-ws"
                  className="mt-1.5 w-full rounded-xl border border-line bg-ink px-3 py-2 text-sm font-mono focus:outline-none focus:border-amber/50"
                />
                <span className="mt-1 block text-xs text-mute">
                  Local dev defaults to Vite proxy{" "}
                  <code className="text-sky">/relay-ws</code> →{" "}
                  <code className="text-sky">:3000</code>
                </span>
              </label>

              <div className="rounded-xl border border-line bg-ink/50 p-3 text-xs font-mono text-mute space-y-1">
                <div className="flex justify-between gap-2">
                  <span>pubkey</span>
                  <span className="text-soft break-all text-right">
                    {identity.pubkey}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>state</span>
                  <span className="text-soft">
                    {conn}
                    {connDetail ? ` · ${connDetail}` : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber px-4 py-2 text-sm font-semibold text-ink hover:bg-amber-dim disabled:opacity-50"
                >
                  <Radio className="size-4" />
                  Connect
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void connect(identity, getRelayWsUrl())}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-ink-3 px-4 py-2 text-sm text-paper hover:border-soft/40"
                >
                  <RefreshCw className="size-4" />
                  Retry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = resetIdentity(nameInput || "Operator");
                    setIdentity(next);
                    void connect(next, getRelayWsUrl());
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm text-mute hover:text-coral hover:border-coral/40"
                >
                  New keypair
                </button>
              </div>
            </form>

            <div className="mt-6 rounded-2xl border border-line p-5 text-sm text-soft space-y-2">
              <h2 className="font-semibold text-paper">How this differs from Slack</h2>
              <ul className="list-disc pl-5 space-y-1 text-mute">
                <li>Home is “needs you,” not #general</li>
                <li>Rooms are work units (branch / incident / release)</li>
                <li>Agents show as verb · object · outcome</li>
                <li>Same Buzz relay protocol — different lens</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Mobile nav */}
      <nav className="sm:hidden sticky bottom-0 border-t border-line bg-ink/95 backdrop-blur flex">
        {(
          [
            ["home", "Needs", Compass],
            ["rooms", "Rooms", LayoutGrid],
            ["settings", "Relay", Settings2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={clsx(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px]",
              view === id ? "text-amber" : "text-mute",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
