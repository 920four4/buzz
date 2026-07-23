import { useState } from "react";
import { Check, LockOpen, MessageCircle, Sparkles } from "lucide-react";
import clsx from "clsx";
import type { Agent, InboxItem } from "@/lib/demo";
import { AgentAvatar } from "./AgentAvatar";
import { useToast } from "@/lib/toast";

const kindMeta = {
  approve: {
    label: "Approve",
    icon: Check,
    soft: "bg-mint-soft text-mint",
    btn: "bg-mint text-white hover:brightness-95",
    action: "Approve",
  },
  unblock: {
    label: "Unblock",
    icon: LockOpen,
    soft: "bg-honey/15 text-honey-deep",
    btn: "bg-honey text-ink hover:bg-honey-deep hover:text-white",
    action: "Allow",
  },
  reply: {
    label: "Reply",
    icon: MessageCircle,
    soft: "bg-sky-soft text-sky",
    btn: "bg-sky text-white hover:brightness-95",
    action: "Open",
  },
} as const;

export function InboxView({
  items,
  agents,
  onResolve,
  onOpenWork,
}: {
  items: InboxItem[];
  agents: Agent[];
  onResolve: (id: string, action: "done" | "open") => void;
  onOpenWork: (workId: string) => void;
}) {
  const { push } = useToast();
  const [leaving, setLeaving] = useState<Set<string>>(new Set());

  function resolve(item: InboxItem, mode: "primary" | "snooze") {
    if (mode === "snooze") {
      push("Snoozed for later", "info");
      setLeaving((s) => new Set(s).add(item.id));
      window.setTimeout(() => onResolve(item.id, "done"), 280);
      return;
    }
    if (item.kind === "reply") {
      onOpenWork(item.workId);
      return;
    }
    const msg =
      item.kind === "approve"
        ? "Approved — Bumble can ship it"
        : "Allowed — Honey is unblocked";
    push(msg);
    setLeaving((s) => new Set(s).add(item.id));
    window.setTimeout(() => onResolve(item.id, "done"), 280);
  }

  if (items.length === 0) {
    return (
      <div className="animate-rise mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-3xl bg-mint-soft text-mint">
          <Sparkles className="size-7" />
        </div>
        <h2 className="font-display text-3xl font-medium tracking-tight text-ink">
          You’re clear
        </h2>
        <p className="mt-3 text-base text-mute leading-relaxed">
          Nothing needs a human right now. Agents keep working — we’ll surface
          the next decision when it matters.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-8 animate-rise">
        <p className="text-sm font-medium text-honey-deep">Inbox</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight sm:text-4xl">
          Needs a human
        </h1>
        <p className="mt-2 max-w-md text-mute">
          Approvals, stuck agents, and mentions. Clear them and get back to
          building.
        </p>
      </header>

      <ul className="space-y-3">
        {items.map((item, i) => {
          const meta = kindMeta[item.kind];
          const Icon = meta.icon;
          const agent = agents.find((a) => a.id === item.agentId);
          const out = leaving.has(item.id);
          return (
            <li
              key={item.id}
              className={clsx(
                "card-lift animate-rise rounded-3xl border border-line bg-paper p-5 shadow-sm",
                out && "animate-out",
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start gap-4">
                {agent ? (
                  <AgentAvatar agent={agent} size="md" />
                ) : (
                  <div
                    className={clsx(
                      "flex size-14 shrink-0 items-center justify-center rounded-full",
                      meta.soft,
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={clsx(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                        meta.soft,
                      )}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs text-mute">{item.when}</span>
                    {item.urgency === "now" && (
                      <span className="rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold text-coral">
                        Now
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">
                    {item.body}
                  </p>
                  <button
                    type="button"
                    onClick={() => onOpenWork(item.workId)}
                    className="mt-2 text-sm font-medium text-sky hover:underline"
                  >
                    {item.workTitle} →
                  </button>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => resolve(item, "primary")}
                      className={clsx(
                        "rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-sm transition",
                        meta.btn,
                      )}
                    >
                      {meta.action}
                    </button>
                    {item.kind !== "reply" && (
                      <button
                        type="button"
                        onClick={() => resolve(item, "snooze")}
                        className="rounded-2xl border border-line bg-cream px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-cream-2"
                      >
                        Later
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
