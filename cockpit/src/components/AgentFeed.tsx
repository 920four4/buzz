import type { AgentActivity } from "@/lib/demo";
import { StatusPill } from "./StatusPill";
import clsx from "clsx";

const outcomeTone = {
  ok: "live" as const,
  running: "info" as const,
  blocked: "warn" as const,
  failed: "danger" as const,
};

export function AgentFeed({ items }: { items: AgentActivity[] }) {
  return (
    <div className="rounded-2xl border border-line bg-ink-2/60 overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">Agent stream</h2>
          <p className="text-xs text-mute mt-0.5">
            Verb · object · outcome — skim, don’t parse
          </p>
        </div>
        <StatusPill tone="live" live>
          live
        </StatusPill>
      </div>
      <ul className="divide-y divide-line/70">
        {items.map((item) => (
          <li
            key={item.id}
            className={clsx(
              "px-4 py-3 flex items-start gap-3 hover:bg-ink-3/40 transition-colors",
            )}
          >
            <div className="mt-0.5 size-8 shrink-0 rounded-lg bg-violet/15 border border-violet/25 flex items-center justify-center text-xs font-semibold text-violet">
              {item.agent.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-paper leading-snug">
                <span className="font-semibold text-violet">{item.agent}</span>{" "}
                <span className="text-soft">{item.verb.toLowerCase()}</span>{" "}
                <span className="text-paper">{item.object}</span>
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusPill
                  tone={outcomeTone[item.outcome]}
                  live={item.outcome === "running"}
                >
                  {item.outcome}
                </StatusPill>
                <span className="text-[11px] text-mute font-mono">
                  {item.when}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
