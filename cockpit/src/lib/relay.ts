import { makeAuthEvent } from "nostr-tools/nip42";
import type { Identity, SignedEvent } from "./identity";
import { signEvent } from "./identity";
import {
  KIND_CREATE_GROUP,
  KIND_GROUP_META,
  KIND_METADATA,
  KIND_STREAM_MESSAGE,
} from "./kinds";

export type NostrFilter = {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  [tag: `#${string}`]: string[] | undefined;
};

export type ConnectionState =
  | "idle"
  | "connecting"
  | "authenticating"
  | "connected"
  | "error"
  | "closed";

type Listener = (event: SignedEvent) => void;
type StateListener = (state: ConnectionState, detail?: string) => void;

function defaultWsUrl(): string {
  // In dev, hit the Vite proxy so we stay same-origin.
  if (import.meta.env.DEV) {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/relay-ws`;
  }
  const env = import.meta.env.VITE_BUZZ_RELAY_WS as string | undefined;
  if (env) return env;
  // Local default when not proxied
  return "ws://127.0.0.1:3000";
}

export function getRelayWsUrl(): string {
  return (
    (localStorage.getItem("cockpit.relayWs") as string | null) || defaultWsUrl()
  );
}

export function setRelayWsUrl(url: string) {
  localStorage.setItem("cockpit.relayWs", url);
}

/**
 * Persistent NIP-42 session for Cockpit.
 * One socket, multi-subscription fan-in.
 */
export class RelaySession {
  private ws: WebSocket | null = null;
  private identity: Identity;
  private url: string;
  private state: ConnectionState = "idle";
  private stateListeners = new Set<StateListener>();
  private eventListeners = new Map<string, Set<Listener>>();
  private pendingAuthId: string | null = null;
  private connectPromise: Promise<void> | null = null;
  private subCounter = 0;
  private authenticated = false;
  private openResolve: (() => void) | null = null;
  private openReject: ((err: Error) => void) | null = null;

  constructor(identity: Identity, url = getRelayWsUrl()) {
    this.identity = identity;
    this.url = url;
  }

  get connectionState() {
    return this.state;
  }

  get relayUrl() {
    return this.url;
  }

  get ownerIdentity() {
    return this.identity;
  }

  onState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }

  private setState(state: ConnectionState, detail?: string) {
    this.state = state;
    for (const fn of this.stateListeners) fn(state, detail);
  }

  async connect(): Promise<void> {
    if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) {
      return;
    }
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.openResolve = resolve;
      this.openReject = reject;
      this.setState("connecting");
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        this.setState("error", "Failed to open WebSocket");
        reject(e instanceof Error ? e : new Error(String(e)));
        this.connectPromise = null;
        return;
      }

      this.ws.addEventListener("open", () => {
        this.setState("authenticating", "Waiting for AUTH challenge…");
        // If no AUTH within 800ms (non-Buzz relay), proceed unauthenticated.
        window.setTimeout(() => {
          if (!this.authenticated && this.state === "authenticating") {
            this.authenticated = true;
            this.setState("connected", "Connected (no AUTH required)");
            this.openResolve?.();
            this.openResolve = null;
            this.openReject = null;
          }
        }, 800);
      });

      this.ws.addEventListener("message", (msg) => {
        void this.handleMessage(String(msg.data));
      });

      this.ws.addEventListener("error", () => {
        this.setState("error", "WebSocket error");
        this.openReject?.(new Error("WebSocket connection failed"));
        this.openResolve = null;
        this.openReject = null;
        this.connectPromise = null;
      });

      this.ws.addEventListener("close", () => {
        this.authenticated = false;
        this.setState("closed");
        this.connectPromise = null;
      });
    });

    return this.connectPromise;
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.authenticated = false;
    this.setState("closed");
    this.connectPromise = null;
  }

  private async handleMessage(raw: string) {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (!Array.isArray(data)) return;
    const [type] = data;

    if (type === "AUTH" && typeof data[1] === "string") {
      const challenge = data[1];
      // Auth URL should be the real relay origin for NIP-42 tag matching.
      // When using the Vite proxy, override via VITE_BUZZ_RELAY_AUTH_URL.
      const authUrl =
        (import.meta.env.VITE_BUZZ_RELAY_AUTH_URL as string | undefined) ||
        (this.url.includes("/relay-ws")
          ? "ws://127.0.0.1:3000"
          : this.url);
      const template = makeAuthEvent(authUrl, challenge);
      const signed = signEvent(this.identity, {
        kind: template.kind,
        content: template.content,
        tags: template.tags as string[][],
        created_at: template.created_at,
      });
      this.pendingAuthId = signed.id;
      this.ws?.send(JSON.stringify(["AUTH", signed]));
      return;
    }

    if (type === "OK" && data[1] === this.pendingAuthId) {
      if (data[2] === true) {
        this.authenticated = true;
        this.pendingAuthId = null;
        this.setState("connected");
        this.openResolve?.();
        this.openResolve = null;
        this.openReject = null;
      } else {
        const reason =
          typeof data[3] === "string" ? data[3] : "AUTH rejected";
        this.setState("error", reason);
        this.openReject?.(new Error(reason));
        this.openResolve = null;
        this.openReject = null;
        this.connectPromise = null;
      }
      return;
    }

    if (type === "OK" && typeof data[1] === "string") {
      // publish ack — handled via publish promise map if we add one later
      return;
    }

    if (type === "EVENT" && typeof data[1] === "string" && data[2]) {
      const subId = data[1];
      const event = data[2] as SignedEvent;
      const listeners = this.eventListeners.get(subId);
      if (listeners) {
        for (const fn of listeners) fn(event);
      }
      return;
    }

    if (type === "EOSE" && typeof data[1] === "string") {
      const subId = data[1];
      const listeners = this.eventListeners.get(`${subId}::eose`);
      if (listeners) {
        for (const fn of listeners) fn({ id: "eose" } as SignedEvent);
      }
      return;
    }

    if (type === "NOTICE") {
      // optional surface
      return;
    }
  }

  subscribe(filter: NostrFilter, onEvent: Listener): () => void {
    const subId = `c${++this.subCounter}`;
    const set = this.eventListeners.get(subId) ?? new Set();
    set.add(onEvent);
    this.eventListeners.set(subId, set);
    const send = () => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(["REQ", subId, filter]));
      }
    };
    if (this.authenticated) send();
    else {
      const unsub = this.onState((s) => {
        if (s === "connected") {
          send();
          unsub();
        }
      });
    }
    return () => {
      this.eventListeners.delete(subId);
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(["CLOSE", subId]));
      }
    };
  }

  /** One-shot historical query until EOSE. */
  async query(filter: NostrFilter, timeoutMs = 12_000): Promise<SignedEvent[]> {
    await this.connect();
    return new Promise((resolve, reject) => {
      const events: SignedEvent[] = [];
      const timer = window.setTimeout(() => {
        unsub();
        resolve(events);
      }, timeoutMs);

      const unsub = this.subscribe(filter, (ev) => {
        if (ev.id === "eose") {
          window.clearTimeout(timer);
          unsub();
          resolve(events);
          return;
        }
        events.push(ev);
      });

      // EOSE listener via side channel
      const subIds = [...this.eventListeners.keys()];
      const lastSub = subIds[subIds.length - 1];
      if (lastSub) {
        const eoseKey = `${lastSub}::eose`;
        const eoseSet = new Set<Listener>();
        eoseSet.add(() => {
          window.clearTimeout(timer);
          unsub();
          resolve(events);
        });
        this.eventListeners.set(eoseKey, eoseSet);
      }

      // Safety: if subscribe never fires, still resolve
      void reject;
    });
  }

  async publish(event: SignedEvent): Promise<void> {
    await this.connect();
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected"));
        return;
      }
      const timer = window.setTimeout(() => {
        cleanup();
        // Some relays don't always OK; treat timeout as soft success after send
        resolve();
      }, 8_000);

      const onMessage = (msg: MessageEvent) => {
        try {
          const data = JSON.parse(String(msg.data));
          if (
            Array.isArray(data) &&
            data[0] === "OK" &&
            data[1] === event.id
          ) {
            cleanup();
            if (data[2] === true) resolve();
            else
              reject(
                new Error(
                  typeof data[3] === "string" ? data[3] : "Publish rejected",
                ),
              );
          }
        } catch {
          // ignore
        }
      };

      const cleanup = () => {
        window.clearTimeout(timer);
        this.ws?.removeEventListener("message", onMessage);
      };

      this.ws.addEventListener("message", onMessage);
      this.ws.send(JSON.stringify(["EVENT", event]));
    });
  }

  async publishProfile(name: string, about = "Cockpit operator") {
    const event = signEvent(this.identity, {
      kind: KIND_METADATA,
      content: JSON.stringify({
        name,
        display_name: name,
        about,
      }),
      tags: [],
    });
    await this.publish(event);
    return event;
  }

  async createRoom(name: string, about?: string, channelId?: string) {
    const id = channelId ?? crypto.randomUUID();
    const tags: string[][] = [
      ["h", id],
      ["name", name],
      ["visibility", "open"],
      ["channel_type", "stream"],
    ];
    if (about) tags.push(["about", about]);
    const event = signEvent(this.identity, {
      kind: KIND_CREATE_GROUP,
      content: "",
      tags,
    });
    await this.publish(event);
    return { event, channelId: id };
  }

  async sendMessage(
    channelId: string,
    text: string,
    mentionPubkeys: string[] = [],
  ) {
    const tags: string[][] = [
      ["h", channelId],
      ["p", this.identity.pubkey],
    ];
    for (const pk of mentionPubkeys) {
      if (pk && pk !== this.identity.pubkey) {
        tags.push(["p", pk.toLowerCase()]);
      }
    }
    const event = signEvent(this.identity, {
      kind: KIND_STREAM_MESSAGE,
      content: text,
      tags,
    });
    await this.publish(event);
    return event;
  }

  async listRooms(limit = 50): Promise<SignedEvent[]> {
    return this.query({ kinds: [KIND_GROUP_META], limit });
  }

  async listMessages(channelId: string, limit = 80): Promise<SignedEvent[]> {
    return this.query({
      kinds: [KIND_STREAM_MESSAGE],
      "#h": [channelId],
      limit,
    });
  }
}

export function roomNameFromEvent(ev: SignedEvent): string {
  const name = ev.tags.find((t) => t[0] === "name")?.[1];
  return name || "Untitled room";
}

export function roomIdFromEvent(ev: SignedEvent): string {
  return (
    ev.tags.find((t) => t[0] === "d")?.[1] ||
    ev.tags.find((t) => t[0] === "h")?.[1] ||
    ev.id
  );
}

export function roomAboutFromEvent(ev: SignedEvent): string {
  return ev.tags.find((t) => t[0] === "about")?.[1] || "";
}
