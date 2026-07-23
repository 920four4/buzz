import { useState } from "react";
import { ArrowLeft, Bot, Plus, Send, Users } from "lucide-react";
import clsx from "clsx";
import type { Agent, WorkItem } from "@/lib/demo";
import { AgentAvatar } from "./AgentAvatar";
import { useToast } from "@/lib/toast";

const statusLabel = {
  waiting: { text: "Waiting on you", className: "bg-honey/15 text-honey-deep" },
  moving: { text: "In progress", className: "bg-sky-soft text-sky" },
  blocked: { text: "Blocked", className: "bg-coral-soft text-coral" },
  done: { text: "Done", className: "bg-mint-soft text-mint" },
};

export function WorkView({
  work,
  agents,
  selectedId,
  onSelect,
  onAddNote,
  onCreate,
}: {
  work: WorkItem[];
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddNote: (workId: string, text: string) => void;
  onCreate: (title: string) => void;
}) {
  const selected = work.find((w) => w.id === selectedId) ?? null;
  const [draft, setDraft] = useState("");
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const { push } = useToast();

  if (selected) {
    const meta = statusLabel[selected.status];
    const roomAgents = agents.filter((a) => selected.agentIds.includes(a.id));
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-mute hover:text-ink"
        >
          <ArrowLeft className="size-4" /> All work
        </button>

        <header className="animate-rise">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={clsx(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                meta.className,
              )}
            >
              {meta.text}
            </span>
            <span className="text-xs text-mute">
              {selected.people} people · {roomAgents.length} agents
            </span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">
            {selected.title}
          </h1>
          <p className="mt-2 text-mute leading-relaxed">{selected.goal}</p>
          <div className="mt-4 flex items-center gap-2">
            {roomAgents.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3">
                <AgentAvatar agent={a} size="sm" />
                <span className="text-sm font-medium">{a.name}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="mt-8 flex-1 space-y-3 overflow-y-auto pb-4">
          {selected.updates.map((u, i) => (
            <article
              key={u.id}
              className="animate-rise rounded-2xl border border-line bg-paper px-4 py-3 shadow-sm"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className={clsx(
                    "font-semibold",
                    u.isAgent ? "text-lilac" : "text-ink",
                  )}
                >
                  {u.author}
                  {u.isAgent && (
                    <span className="ml-1.5 font-normal text-mute">agent</span>
                  )}
                </span>
                <span className="font-mono text-mute">{u.when}</span>
              </div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft">
                {u.text}
              </p>
            </article>
          ))}
        </div>

        <form
          className="sticky bottom-0 mt-2 flex gap-2 border-t border-line bg-cream/90 py-3 backdrop-blur"
          onSubmit={(e) => {
            e.preventDefault();
            const t = draft.trim();
            if (!t) return;
            onAddNote(selected.id, t);
            setDraft("");
            push("Note added");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note to this work…"
            className="flex-1 rounded-2xl border border-line bg-paper px-4 py-3 text-sm shadow-sm outline-none focus:border-honey"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="inline-flex items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-paper disabled:opacity-40"
          >
            <Send className="size-4" />
            Send
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="text-sm font-medium text-honey-deep">Work</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            What you’re finishing
          </h1>
          <p className="mt-2 max-w-md text-mute">
            Not channels — goals. Open one, see people and agents, leave a note.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper shadow-sm hover:bg-ink-soft"
        >
          <Plus className="size-4" />
          New work
        </button>
      </header>

      {creating && (
        <form
          className="mb-6 animate-pop rounded-3xl border border-honey/40 bg-paper p-4 shadow-md"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newTitle.trim();
            if (!t) return;
            onCreate(t);
            setNewTitle("");
            setCreating(false);
            push("Work created");
          }}
        >
          <label className="text-sm font-medium text-ink">Name the goal</label>
          <input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Fix checkout on mobile"
            className="mt-2 w-full rounded-2xl border border-line bg-cream px-4 py-3 text-sm outline-none focus:border-honey"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              className="rounded-2xl bg-honey px-4 py-2 text-sm font-semibold text-ink"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-2xl px-4 py-2 text-sm text-mute hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {work.map((w, i) => {
          const meta = statusLabel[w.status];
          const roomAgents = agents.filter((a) => w.agentIds.includes(a.id));
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onSelect(w.id)}
              className="card-lift animate-rise rounded-3xl border border-line bg-paper p-5 text-left shadow-sm"
              style={{ animationDelay: `${i * 45}ms` }}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">
                  {w.title}
                </h2>
                <span
                  className={clsx(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    meta.className,
                  )}
                >
                  {meta.text}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-mute leading-relaxed">
                {w.goal}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {roomAgents.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-full ring-2 ring-paper"
                      title={a.name}
                    >
                      <AgentAvatar agent={a} size="sm" showStatus={false} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-mute">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" /> {w.people}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Bot className="size-3.5" /> {roomAgents.length}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
