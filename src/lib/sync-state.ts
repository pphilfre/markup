"use client";

import { useEffect, useState } from "react";

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline" | "disabled";

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

let _syncState: SyncState = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
};

const _syncListeners = new Set<() => void>();

export function setSyncState(next: Partial<SyncState>) {
  _syncState = { ..._syncState, ...next };
  _syncListeners.forEach((fn) => fn());
}

export function useSyncState(): SyncState {
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _syncListeners.add(cb);
    return () => {
      _syncListeners.delete(cb);
    };
  }, []);
  return _syncState;
}

let _triggerManualSync: (() => void) | null = null;

export function setManualSyncHandler(handler: (() => void) | null) {
  _triggerManualSync = handler;
}

export function triggerManualSync() {
  _triggerManualSync?.();
}
