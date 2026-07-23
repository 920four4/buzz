import { CheckCircle2, Bot, AtSign, Scale } from "lucide-react";
import type { NeedsItem } from "@/lib/demo";
import { StatusPill } from "./StatusPill";
import clsx from "clsx";

const icons = {
  approval: CheckCircle2,
  agent: Bot,
  mention: AtSign,
  decision: Scale,
};

const urgencyTone = {
  now: "danger" as const,
  soon: "warn" as const,
  later: "mute" as const,
};

export function NeedsCard({
  item,
  onOpen,
}: {
  item: NeedsItem;
  onOpen?: () => void;
}) {
  const Icon = icons[item.kind];
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        "group w-full text-left rounded-2xl border border-line bg-ink-2/80 p-4",
        "hover:border-amber/40 hover:bg-ink-3/80 transition-colors",
        "animate-fade-up",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-mute">
          <Icon className="size-4 text-amber" />
          <span className="text-xs font-mono uppercase tracking-wider">
            {item.kind}
          </span>
        </div>
        <StatusPill tone={urgencyTone[item.urgency]}>
          {item.urgency}
        </StatusPill>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold text-paper leading-snug">
        {item.title}
      </h3>
      <p className="mt-1.5 text-sm text-soft/80 leading-relaxed">{item.detail}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-mute">
        <span className="font-mono text-sky/90">{item.room}</span>
        <span>{item.when}</span>
      </div>
    </button>
  );
}
