import { useEffect, useState } from "react";
import { Send, X } from "lucide-react";
import type { SignedEvent } from "@/lib/identity";
import { shortPubkey } from "@/lib/identity";
import type { RelaySession } from "@/lib/relay";
import { demoMessages } from "@/lib/demo";
import { StatusPill } from "./StatusPill";

export function RoomPanel({
  roomId,
  roomName,
  roomAbout,
  session,
  demo,
  onClose,
}: {
  roomId: string;
  roomName: string;
  roomAbout: string;
  session: RelaySession | null;
  demo: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<SignedEvent[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      if (demo || !session) {
        setMessages(demoMessages(roomId));
        return;
      }
      try {
        const events = await session.listMessages(roomId);
        if (!cancelled) {
          setMessages(
            [...events].sort((a, b) => a.created_at - b.created_at),
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load messages");
          setMessages(demoMessages(roomId));
        }
      }
    }
    void load();
    if (!demo && session) {
      const unsub = session.subscribe(
        { kinds: [9], "#h": [roomId], limit: 50 },
        (ev) => {
          if (ev.id === "eose") return;
          setMessages((prev) => {
            if (prev.some((p) => p.id === ev.id)) return prev;
            return [...prev, ev].sort((a, b) => a.created_at - b.created_at);
          });
        },
      );
      return () => {
        cancelled = true;
        unsub();
      };
    }
    return () => {
      cancelled = true;
    };
  }, [roomId, session, demo]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (demo || !session) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          pubkey: "you",
          created_at: Math.floor(Date.now() / 1000),
          kind: 9,
          tags: [["h", roomId]],
          content: text,
          sig: "",
        },
      ]);
      setDraft("");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await session.sendMessage(roomId, text);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-ink-2/80">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-mono text-sm font-semibold truncate">
              {roomName}
            </h2>
            <StatusPill tone={demo ? "warn" : "live"} live={!demo}>
              {demo ? "demo" : "room"}
            </StatusPill>
          </div>
          <p className="mt-1 text-xs text-mute line-clamp-2">{roomAbout}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-mute hover:bg-ink-3 hover:text-paper"
          aria-label="Close room"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m) => (
          <article
            key={m.id}
            className="rounded-xl border border-line/60 bg-ink/40 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] text-mute font-mono">
              <span className="text-sky">
                {m.pubkey === "you" ? "you" : shortPubkey(m.pubkey)}
              </span>
              <span>
                {new Date(m.created_at * 1000).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-paper/95 whitespace-pre-wrap leading-relaxed">
              {m.content}
            </p>
          </article>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-mute text-center py-8">
            Quiet room. Start with a goal, not small talk.
          </p>
        )}
      </div>

      {error && (
        <p className="px-4 text-xs text-coral border-t border-line py-2">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSend}
        className="border-t border-line p-3 flex items-end gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Add to the record…"
          className="flex-1 resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-paper placeholder:text-mute/70 focus:outline-none focus:border-amber/50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber px-3 py-2.5 text-sm font-semibold text-ink hover:bg-amber-dim disabled:opacity-40"
        >
          <Send className="size-4" />
          Send
        </button>
      </form>
    </div>
  );
}
