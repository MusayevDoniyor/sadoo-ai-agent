// Cross-tab sync for the SADOO queue.
// Zustand state is per-tab; without sync, customers in /join are invisible
// to operators in /operator. We mirror the `queue` array via BroadcastChannel
// (live updates) + localStorage (initial load + fallback for browsers that
// don't support BroadcastChannel).

import { useStore } from "./useStore";
import type { QueueCustomer } from "@/types";

const STORAGE_KEY = "sadoo:queue:v1";
const CHANNEL_NAME = "sadoo:queue";

type SyncMessage = {
  type: "queue";
  tabId: string;
  queue: QueueCustomer[];
};

const TAB_ID = `tab_${Math.random().toString(36).slice(2, 10)}`;
let channel: BroadcastChannel | null = null;
let applyingRemote = false;
let initialized = false;

function readFromStorage(): QueueCustomer[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QueueCustomer[];
  } catch {
    return null;
  }
}

function writeToStorage(queue: QueueCustomer[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* quota / private mode — ignore */
  }
}

function applyRemoteQueue(queue: QueueCustomer[]) {
  applyingRemote = true;
  try {
    useStore.setState({ queue });
  } finally {
    applyingRemote = false;
  }
}

export function initQueueSync() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  // 1) Hydrate from localStorage so a freshly-opened tab sees existing customers.
  const existing = readFromStorage();
  if (existing && existing.length > 0) {
    applyRemoteQueue(existing);
  } else {
    // Seed storage with whatever this tab currently has (likely []).
    writeToStorage(useStore.getState().queue);
  }

  // 2) Open BroadcastChannel for live cross-tab updates.
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (ev: MessageEvent<SyncMessage>) => {
      const msg = ev.data;
      if (!msg || msg.type !== "queue" || msg.tabId === TAB_ID) return;
      applyRemoteQueue(msg.queue);
    };
  }

  // 3) Fallback: storage event fires in OTHER tabs when localStorage changes.
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const queue = JSON.parse(e.newValue) as QueueCustomer[];
      applyRemoteQueue(queue);
    } catch {
      /* ignore */
    }
  });

  // 4) Subscribe to local queue changes -> broadcast + persist.
  useStore.subscribe((state, prev) => {
    if (applyingRemote) return;
    if (state.queue === prev.queue) return;
    writeToStorage(state.queue);
    if (channel) {
      try {
        channel.postMessage({ type: "queue", tabId: TAB_ID, queue: state.queue } satisfies SyncMessage);
      } catch {
        /* ignore */
      }
    }
  });
}
