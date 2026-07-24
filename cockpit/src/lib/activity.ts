/** Shared activity / connection labels for honest UI. */

export type Delivery = "local" | "sending" | "sent" | "failed";

export function connectionLabel(
  live: boolean,
  conn: string,
): { text: string; tone: "ok" | "warn" | "mute" } {
  if (live && conn === "connected") {
    return { text: "Live · relay connected", tone: "ok" };
  }
  if (conn === "connecting" || conn === "authenticating") {
    return { text: "Connecting to relay…", tone: "warn" };
  }
  if (conn === "error") {
    return { text: "Relay error · working offline", tone: "warn" };
  }
  return { text: "Offline · full local workspace", tone: "mute" };
}
