import { useState } from "react";
import { ArrowLeft, Bot, Plus, UserPlus, Users, X } from "lucide-react";
import clsx from "clsx";
import type { Agent, WorkItem } from "@/lib/demo";
import { AgentAvatar } from "./AgentAvatar";
import { MentionComposer } from "./MentionComposer";
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
  onAssignAgent,
  onRemoveAgent,
}: {
  work: WorkItem[];
  agents: Agent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddNote: (workId: string, text: string) => void;
  onCreate: (title: string) => void;
  onAssignAgent: (workId: string, agentId: string) => void;
  onRemoveAgent: (workId: string, agentId: string) => void;
}) {
  const selected = work.find((w) => w.id === selectedId) ?? null;
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const { push } = useToast();

  if (selected) {
    const meta = statusLabel[selected.status];
    const roomAgents = agents.filter((a) => selected.agentIds.includes(a.id));
    const available = agents.filter((a) => !selected.agentIds.includes(a.id));

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

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-mute">
                Agents on this work
              </span>
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-honey-deep hover:underline"
              >
                <UserPlus className="size-3.5" />
                Add agent
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {roomAgents.map((a) => (
                <div
                  key={a.id}
                  className="group flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-2"
                >
                  <AgentAvatar agent={a} size="sm" />
                  <span className="text-sm font-medium">{a.name}</span>
                  <button
                    type="button"
                    title={`Remove ${a.name}`}
                    className="rounded-full p-0.5 text-mute opacity-0 hover:bg-coral-soft hover:text-coral group-hover:opacity-100"
                    onClick={() => {
                      onRemoveAgent(selected.id, a.id);
                      push(`Removed ${a.name}`);
                    }}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {roomAgents.length === 0 && (
                <span className="text-sm text-mute">
                  No agents yet — add one or @mention in a note
                </span>
              )}
            </div>

            {pickerOpen && (
              <ul className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-line bg-paper py-1 shadow-md">
                {available.length === 0 && (
                  <li className="px-3 py-2 text-sm text-mute">
                    All agents already on this work
                  </li>
                )}
                {available.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-cream"
                      onClick={() => {
                        onAssignAgent(selected.id, a.id);
                        setPickerOpen(false);
                        push(`${a.name} joined “${selected.title}”`);
                      }}
                    >
                      <AgentAvatar agent={a} size="sm" />
                      <span className="font-medium">{a.name}</span>
                      <span className="truncate text-xs text-mute">
                        {a.role}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Quick tag chips */}
            {agents.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[11px] text-mute self-center">
                  Quick tag:
                </span>
                {agents.slice(0, 6).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="rounded-full bg-lilac-soft px-2.5 py-0.5 text-xs font-medium text-lilac hover:brightness-95"
                    onClick={() => {
                      onAddNote(
                        selected.id,
                        `@${a.name} please take a look at this work`,
                      );
                      push(`Tagged @${a.name}`);
                    }}
                  >
                    @{a.name}
                  </button>
                ))}
              </div>
            )}
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
              <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">
                {highlightMentions(u.text, agents)}
              </p>
            </article>
          ))}
        </div>

        <div className="sticky bottom-0 mt-2 border-t border-line bg-cream/90 py-3 backdrop-blur">
          <MentionComposer
            agents={agents}
            placeholder="Note or task… Type @ to tag an agent"
            onSend={(text) => {
              onAddNote(selected.id, text);
              push("Sent");
            }}
          />
        </div>
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
            Goals, not channels. Open one, add agents, tag them with @Name.
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

function highlightMentions(text: string, agents: Agent[]) {
  if (!text.includes("@")) return text;
  const names = [...agents]
    .map((a) => a.name)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return text;

  const pattern = new RegExp(
    `(@(?:${names.map(escapeRegExp).join("|")}))`,
    "gi",
  );
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="font-semibold text-lilac">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
