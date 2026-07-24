import clsx from "clsx";
import type { Agent } from "@/lib/demo";

const faces: Record<string, { eyes: string; mouth: string; antenna?: string }> =
  {
    fizz: { eyes: "··", mouth: "ω", antenna: "Y" },
    honey: { eyes: "••", mouth: "ᴗ", antenna: "∩" },
    bumble: { eyes: "○○", mouth: "v", antenna: "∨" },
  };

export function AgentAvatar({
  agent,
  size = "md",
  showStatus = true,
}: {
  agent: Pick<Agent, "id" | "name" | "color" | "status">;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
}) {
  const dim =
    size === "sm" ? "size-9 text-sm" : size === "lg" ? "size-20 text-2xl" : "size-14 text-lg";
  const face = faces[agent.id] ?? { eyes: "••", mouth: "ᴗ" };

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={clsx(
          "agent-face flex flex-col items-center justify-center rounded-full font-semibold text-ink/80",
          dim,
        )}
        style={{ backgroundColor: agent.color }}
        aria-hidden
      >
        {face.antenna && (
          <span className="absolute -top-1 text-[10px] opacity-70 leading-none">
            {face.antenna}
          </span>
        )}
        <span className="leading-none tracking-tighter">{face.eyes}</span>
        <span className="-mt-0.5 text-[0.65em] leading-none opacity-80">
          {face.mouth}
        </span>
      </div>
      {showStatus && agent.status !== "offline" && (
        <span
          className={clsx(
            "absolute bottom-0 right-0 size-3 rounded-full border-2 border-paper",
            agent.status === "working" && "bg-sky live-dot",
            agent.status === "waiting" && "bg-honey",
            agent.status === "idle" && "bg-mint",
          )}
        />
      )}
    </div>
  );
}
