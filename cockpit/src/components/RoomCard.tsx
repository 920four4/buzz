import { Bot, Users } from "lucide-react";
import type { DemoRoom } from "@/lib/demo";
import { StatusPill } from "./StatusPill";
import clsx from "clsx";

const statusTone = {
  active: "live" as const,
  blocked: "danger" as const,
  shipped: "violet" as const,
  quiet: "mute" as const,
};

export function RoomCard({
  room,
  selected,
  onSelect,
}: {
  room: DemoRoom;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={clsx(
        "w-full text-left rounded-2xl border p-4 transition-all",
        selected
          ? "border-amber bg-ink-3 shadow-[0_0_0_1px_rgba(240,162,2,0.25)]"
          : "border-line bg-ink-2/70 hover:border-soft/30 hover:bg-ink-3/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-sm font-medium text-paper">{room.name}</h3>
        <StatusPill tone={statusTone[room.status]}>{room.status}</StatusPill>
      </div>
      <p className="mt-1.5 text-sm text-mute line-clamp-2">{room.about}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-mute">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {room.people}
          </span>
          <span className="inline-flex items-center gap-1">
            <Bot className="size-3.5" /> {room.agents}
          </span>
        </div>
        <span className="text-soft/70">{room.lastActivity}</span>
      </div>
    </button>
  );
}
