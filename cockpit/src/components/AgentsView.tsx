import { Plus, Square } from "lucide-react";
import clsx from "clsx";
import type { Agent } from "@/lib/demo";
import { AgentAvatar } from "./AgentAvatar";
import { useToast } from "@/lib/toast";

const statusCopy = {
  working: { label: "Working", className: "text-sky" },
  waiting: { label: "Needs you", className: "text-honey-deep" },
  idle: { label: "Ready", className: "text-mint" },
  offline: { label: "Offline", className: "text-mute" },
};

export function AgentsView({
  agents,
  onStopAll,
}: {
  agents: Agent[];
  onStopAll: () => void;
}) {
  const { push } = useToast();
  const running = agents.filter((a) => a.status === "working").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <div>
          <p className="text-sm font-medium text-honey-deep">Agents</p>
          <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">
            Your AI teammates
          </h1>
          <p className="mt-2 max-w-md text-mute">
            Same foundation as Buzz — agents with their own identity. Manage
            them here, put them on work, not in a channel sidebar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-medium text-mute">
            Default model: sonnet
          </span>
          {running > 0 && (
            <button
              type="button"
              onClick={() => {
                onStopAll();
                push("Stopped running agents");
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:bg-cream-2"
            >
              <Square className="size-3" /> Stop running
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((agent, i) => {
          const st = statusCopy[agent.status];
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => push(`${agent.name}: ${agent.doing}`)}
              className="card-lift animate-rise group rounded-3xl border border-line bg-paper p-5 text-left shadow-sm"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex justify-center py-4">
                <AgentAvatar agent={agent} size="lg" />
              </div>
              <h2 className="text-center text-lg font-semibold">{agent.name}</h2>
              <p className="mt-1 text-center text-sm text-mute">{agent.role}</p>
              <div className="mt-4 rounded-2xl bg-cream px-3 py-2.5 text-center">
                <p className={clsx("text-xs font-semibold", st.className)}>
                  {st.label}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-soft">
                  {agent.doing}
                </p>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => push("Agent creation hooks into Buzz personas next")}
          className="card-lift flex min-h-[260px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line-strong bg-paper/50 text-mute hover:border-honey hover:text-honey-deep"
        >
          <Plus className="size-8 mb-2" />
          <span className="text-sm font-semibold">New agent</span>
        </button>
      </div>

      <section className="mt-12 animate-rise">
        <h2 className="text-lg font-semibold">Teams</h2>
        <p className="mt-1 text-sm text-mute">
          Drop a whole crew onto a work item in one go.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-line bg-paper p-5 shadow-sm">
            <div className="flex -space-x-2">
              {agents.map((a) => (
                <div key={a.id} className="rounded-full ring-2 ring-paper">
                  <AgentAvatar agent={a} size="sm" showStatus={false} />
                </div>
              ))}
            </div>
            <h3 className="mt-4 font-semibold">Welcome Team</h3>
            <p className="text-sm text-mute">Auto · all three agents</p>
          </div>
          <button
            type="button"
            onClick={() => push("Team builder coming soon")}
            className="flex min-h-[140px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-line-strong text-mute hover:border-honey hover:text-honey-deep"
          >
            <Plus className="size-6 mb-1" />
            <span className="text-sm font-semibold">New team</span>
          </button>
        </div>
      </section>
    </div>
  );
}
