import type { ReactNode } from "react";
import clsx from "clsx";

const tones = {
  live: "bg-mint/15 text-mint border-mint/30",
  warn: "bg-amber/15 text-amber border-amber/30",
  danger: "bg-coral/15 text-coral border-coral/30",
  mute: "bg-ink-3 text-mute border-line",
  info: "bg-sky/15 text-sky border-sky/30",
  violet: "bg-violet/15 text-violet border-violet/30",
} as const;

export function StatusPill({
  children,
  tone = "mute",
  live = false,
}: {
  children: ReactNode;
  tone?: keyof typeof tones;
  live?: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase",
        tones[tone],
      )}
    >
      {live && (
        <span className="live-dot inline-block size-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
