import type { Agent, MessageThread } from "@/lib/demo";
import { AgentAvatar } from "./AgentAvatar";
import { useToast } from "@/lib/toast";

export function MessagesView({
  threads,
  agents,
}: {
  threads: MessageThread[];
  agents: Agent[];
}) {
  const { push } = useToast();

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <header className="mb-8 animate-rise">
        <p className="text-sm font-medium text-honey-deep">Messages</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight">
          Direct & small groups
        </h1>
        <p className="mt-2 text-mute">
          Side conversations — not the center of the product.
        </p>
      </header>

      <ul className="space-y-2">
        {threads.map((t, i) => {
          const agent = agents.find((a) => a.id === t.agentId);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => push(`Opening chat with ${t.name}`)}
                className="card-lift animate-rise flex w-full items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-left shadow-sm"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                {agent ? (
                  <AgentAvatar agent={agent} size="sm" />
                ) : (
                  <div className="flex size-9 items-center justify-center rounded-full bg-cream-2 text-sm font-semibold text-ink-soft">
                    {t.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-xs text-mute">{t.when}</span>
                  </div>
                  <p className="truncate text-sm text-mute">{t.preview}</p>
                </div>
                {t.unread > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-honey text-[10px] font-bold text-ink">
                    {t.unread}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
