import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { bytesToHex, hexToBytes } from "./hex";

const STORAGE_KEY = "cockpit.identity.v1";

export type UnsignedEvent = {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
};

export type SignedEvent = UnsignedEvent & {
  id: string;
  pubkey: string;
  sig: string;
};

export type Identity = {
  secretKeyHex: string;
  pubkey: string;
  displayName: string;
};

function loadStored(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Identity;
    if (!parsed.secretKeyHex || !parsed.pubkey) return null;
    // Re-derive pubkey to validate key
    const sk = hexToBytes(parsed.secretKeyHex);
    const pubkey = getPublicKey(sk);
    return { ...parsed, pubkey };
  } catch {
    return null;
  }
}

function persist(identity: Identity) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function getOrCreateIdentity(displayName = "Operator"): Identity {
  const existing = loadStored();
  if (existing) {
    if (existing.displayName !== displayName && displayName !== "Operator") {
      const next = { ...existing, displayName };
      persist(next);
      return next;
    }
    return existing;
  }
  const sk = generateSecretKey();
  const identity: Identity = {
    secretKeyHex: bytesToHex(sk),
    pubkey: getPublicKey(sk),
    displayName,
  };
  persist(identity);
  return identity;
}

export function resetIdentity(displayName = "Operator"): Identity {
  localStorage.removeItem(STORAGE_KEY);
  return getOrCreateIdentity(displayName);
}

export function shortPubkey(pubkey: string, chars = 4): string {
  if (pubkey.length < chars * 2) return pubkey;
  return `${pubkey.slice(0, chars)}…${pubkey.slice(-chars)}`;
}

export function signEvent(
  identity: Identity,
  template: Omit<UnsignedEvent, "created_at"> & { created_at?: number },
): SignedEvent {
  const sk = hexToBytes(identity.secretKeyHex);
  return finalizeEvent(
    {
      kind: template.kind,
      content: template.content,
      tags: template.tags,
      created_at: template.created_at ?? Math.floor(Date.now() / 1000),
    },
    sk,
  ) as SignedEvent;
}
