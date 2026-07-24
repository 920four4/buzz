import { useState, type ReactNode } from "react";
import {
  Briefcase,
  Pencil,
  Plus,
  Square,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import clsx from "clsx";
import type { Agent, WorkItem } from "@/lib/demo";
import type { AgentTeam, CreateAgentInput } from "@/lib/agents";
import { PALETTE } from "@/lib/agents";
import { AgentAvatar } from "./AgentAvatar";
import { useToast } from "@/lib/toast";

const statusCopy = {
  working: { label: "Working", className: "text-sky" },
  waiting: { label: "Needs you", className: "text-honey-deep" },
  idle: { label: "Ready", className: "text-mint" },
  offline: { label: "Offline", className: "text-mute" },
};

const MODELS = ["sonnet", "opus", "haiku", "gpt-4.1", "gemini"] as const;

export function AgentsView({
  agents,
  work,
  teams,
  onStopAll,
  onCreate,
  onUpdate,
  onDelete,
  onAssignToWork,
  onCreateTeam,
  onDeleteTeam,
  onOpenWork,
}: {
  agents: Agent[];
  work: WorkItem[];
  teams: AgentTeam[];
  onStopAll: () => void;
  onCreate: (input: CreateAgentInput) => void;
  onUpdate: (id: string, patch: Partial<Agent>) => void;
  onDelete: (id: string) => void;
  onAssignToWork: (agentId: string, workId: string) => void;
  onCreateTeam: (name: string, agentIds: string[]) => void;
  onDeleteTeam: (id: string) => void;
  onOpenWork: (workId: string) => void;
}) {
  const { push } = useToast();
  const running = agents.filter((a) => a.status === "working").length;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [detail, setDetail] = useState<Agent | null>(null);
  const [teamForm, setTeamForm] = useState(false);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="text-sm font-medium text-honey-deep">Agents</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Your AI teammates
          </h1>
          <p className="mt-2 max-w-md text-mute">
            Create agents, put them on work, and tag them with{" "}
            <span className="font-mono text-ink">@Name</span> in any work note.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper"
          >
            <Plus className="size-3.5" /> New agent
          </button>
          {running > 0 && (
            <button
              type="button"
              onClick={() => {
                onStopAll();
                push("Stopped running agents");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-2"
            >
              <Square className="size-3" /> Stop running ({running})
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((agent, i) => {
          const st = statusCopy[agent.status];
          const onWork = work.filter((w) => w.agentIds.includes(agent.id));
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => setDetail(agent)}
              className="card-lift animate-rise group rounded-3xl border border-line bg-paper p-5 text-left shadow-sm"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex justify-center py-4">
                <AgentAvatar agent={agent} size="lg" />
              </div>
              <h2 className="text-center text-lg font-semibold">{agent.name}</h2>
              <p className="mt-1 text-center text-sm text-mute line-clamp-2">
                {agent.role}
              </p>
              <div className="mt-4 rounded-2xl bg-cream px-3 py-2.5 text-center">
                <p className={clsx("text-xs font-semibold", st.className)}>
                  {st.label}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                  {agent.doing}
                </p>
                {onWork.length > 0 && (
                  <p className="mt-1 text-[10px] text-mute">
                    On {onWork.length} work item{onWork.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setCreating(true)}
          className="card-lift flex min-h-[260px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line-strong bg-paper/50 text-mute hover:border-honey hover:text-honey-deep"
        >
          <Plus className="size-8 mb-2" />
          <span className="text-sm font-semibold">New agent</span>
        </button>
      </div>

      <section className="mt-12 animate-rise">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Teams</h2>
            <p className="mt-1 text-sm text-mute">
              Assign a whole crew to a work item in one go.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTeamForm(true)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-honey-deep hover:underline"
          >
            <Plus className="size-4" /> New team
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const members = agents.filter((a) => team.agentIds.includes(a.id));
            return (
              <div
                key={team.id}
                className="rounded-3xl border border-line bg-paper p-5 shadow-sm"
              >
                <div className="flex -space-x-2">
                  {members.map((a) => (
                    <div key={a.id} className="rounded-full ring-2 ring-paper">
                      <AgentAvatar agent={a} size="sm" showStatus={false} />
                    </div>
                  ))}
                  {members.length === 0 && (
                    <span className="text-xs text-mute">No members</span>
                  )}
                </div>
                <h3 className="mt-4 font-semibold">{team.name}</h3>
                <p className="text-sm text-mute">
                  {members.length} agent{members.length === 1 ? "" : "s"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AssignMenu
                    work={work}
                    label="Add team to work"
                    onPick={(workId) => {
                      for (const id of team.agentIds) {
                        onAssignToWork(id, workId);
                      }
                      push(`Team “${team.name}” joined work`);
                      onOpenWork(workId);
                    }}
                  />
                  {team.id !== "team-welcome" && (
                    <button
                      type="button"
                      className="text-xs text-coral hover:underline"
                      onClick={() => {
                        onDeleteTeam(team.id);
                        push("Team removed");
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setTeamForm(true)}
            className="flex min-h-[140px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line-strong text-mute hover:border-honey hover:text-honey-deep"
          >
            <Plus className="size-6 mb-1" />
            <span className="text-sm font-semibold">New team</span>
          </button>
        </div>
      </section>

      {creating && (
        <AgentFormModal
          title="Create agent"
          onClose={() => setCreating(false)}
          onSubmit={(input) => {
            onCreate(input);
            setCreating(false);
            push(`Created ${input.name}`);
          }}
        />
      )}

      {editing && (
        <AgentFormModal
          title="Edit agent"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(input) => {
            onUpdate(editing.id, {
              name: input.name,
              role: input.role,
              model: input.model || editing.model,
              color: input.color || editing.color,
            });
            setEditing(null);
            setDetail(null);
            push("Agent updated");
          }}
        />
      )}

      {detail && (
        <AgentDetailModal
          agent={detail}
          work={work}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
          }}
          onDelete={() => {
            onDelete(detail.id);
            setDetail(null);
            push(`Removed ${detail.name}`);
          }}
          onStop={() => {
            onUpdate(detail.id, {
              status: "idle",
              doing: "Ready for the next task",
            });
            push(`${detail.name} stopped`);
            setDetail({
              ...detail,
              status: "idle",
              doing: "Ready for the next task",
            });
          }}
          onAssign={(workId) => {
            onAssignToWork(detail.id, workId);
            push(`${detail.name} joined work`);
            setDetail(null);
            onOpenWork(workId);
          }}
          onOpenWork={onOpenWork}
        />
      )}

      {teamForm && (
        <TeamFormModal
          agents={agents}
          onClose={() => setTeamForm(false)}
          onSubmit={(name, ids) => {
            onCreateTeam(name, ids);
            setTeamForm(false);
            push(`Team “${name}” created`);
          }}
        />
      )}
    </div>
  );
}

function AssignMenu({
  work,
  label,
  onPick,
}: {
  work: WorkItem[];
  label: string;
  onPick: (workId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = work.filter((w) => w.status !== "done");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-full border border-line bg-cream px-2.5 py-1 text-xs font-semibold text-ink hover:border-honey"
      >
        <Briefcase className="size-3" />
        {label}
      </button>
      {open && (
        <ul className="absolute left-0 z-20 mt-1 min-w-[200px] rounded-xl border border-line bg-paper py-1 shadow-lg">
          {active.length === 0 && (
            <li className="px-3 py-2 text-xs text-mute">No open work</li>
          )}
          {active.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                onClick={() => {
                  onPick(w.id);
                  setOpen(false);
                }}
              >
                {w.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AgentFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Agent;
  onClose: () => void;
  onSubmit: (input: CreateAgentInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [model, setModel] = useState(initial?.model ?? "sonnet");
  const [color, setColor] = useState(initial?.color ?? PALETTE[0]!);

  return (
    <ModalShell title={title} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          onSubmit({ name: name.trim(), role: role.trim(), model, color });
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Name
          </span>
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Scout"
            className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-honey"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            What they do
          </span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Reviews PRs and writes tests"
            className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-honey"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Model
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-honey"
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Color
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={clsx(
                  "size-8 rounded-full border-2",
                  color === c ? "border-ink scale-110" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm text-mute hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-2xl bg-honey px-4 py-2 text-sm font-semibold text-ink"
          >
            Save
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function AgentDetailModal({
  agent,
  work,
  onClose,
  onEdit,
  onDelete,
  onStop,
  onAssign,
  onOpenWork,
}: {
  agent: Agent;
  work: WorkItem[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStop: () => void;
  onAssign: (workId: string) => void;
  onOpenWork: (workId: string) => void;
}) {
  const st = statusCopy[agent.status];
  const onWork = work.filter((w) => w.agentIds.includes(agent.id));
  const isBuiltin = ["fizz", "honey", "bumble"].includes(agent.id);

  return (
    <ModalShell title={agent.name} onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <AgentAvatar agent={agent} size="lg" />
        <p className="mt-3 text-sm text-mute">{agent.role}</p>
        <p className={clsx("mt-2 text-sm font-semibold", st.className)}>
          {st.label}
        </p>
        <p className="mt-1 text-sm text-ink-soft">{agent.doing}</p>
        <p className="mt-2 font-mono text-[11px] text-mute">
          model: {agent.model}
        </p>
      </div>

      {onWork.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mute">
            Assigned work
          </h3>
          <ul className="mt-2 space-y-1">
            {onWork.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-line bg-cream px-3 py-2 text-left text-sm hover:border-honey"
                  onClick={() => {
                    onClose();
                    onOpenWork(w.id);
                  }}
                >
                  {w.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-mute">
          Put on work
        </p>
        <div className="flex flex-wrap gap-2">
          {work
            .filter((w) => w.status !== "done")
            .map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => onAssign(w.id)}
                className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium hover:border-honey"
              >
                <UserPlus className="size-3" />
                {w.title}
              </button>
            ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-2xl border border-line px-3 py-2 text-sm font-medium"
        >
          <Pencil className="size-3.5" /> Edit
        </button>
        {agent.status === "working" && (
          <button
            type="button"
            onClick={onStop}
            className="inline-flex items-center gap-1 rounded-2xl border border-line px-3 py-2 text-sm font-medium"
          >
            <Square className="size-3.5" /> Stop
          </button>
        )}
        {!isBuiltin && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-2xl border border-coral/30 px-3 py-2 text-sm font-medium text-coral"
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        )}
      </div>
    </ModalShell>
  );
}

function TeamFormModal({
  agents,
  onClose,
  onSubmit,
}: {
  agents: Agent[];
  onClose: () => void;
  onSubmit: (name: string, agentIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  return (
    <ModalShell title="New team" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || selected.size === 0) return;
          onSubmit(name.trim(), [...selected]);
        }}
      >
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Team name
          </span>
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Review crew"
            className="mt-1.5 w-full rounded-2xl border border-line bg-cream px-3 py-2.5 text-sm outline-none focus:border-honey"
          />
        </label>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-mute">
            Members
          </span>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {agents.map((a) => {
              const on = selected.has(a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(a.id)) next.delete(a.id);
                        else next.add(a.id);
                        return next;
                      });
                    }}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                      on
                        ? "border-honey bg-honey/10"
                        : "border-line bg-paper hover:bg-cream",
                    )}
                  >
                    <AgentAvatar agent={a} size="sm" showStatus={false} />
                    <span className="font-medium">{a.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl px-4 py-2 text-sm text-mute"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || selected.size === 0}
            className="rounded-2xl bg-honey px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Create team
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-line bg-paper p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-mute hover:bg-cream hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
