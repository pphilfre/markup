"use client";
import { useSyncExternalStore } from "react";
export interface SaveState {
  status: "idle" | "saving" | "saved" | "error";
  savedAt: number | null;
  error: string | null;
}
const initial: SaveState = { status: "idle", savedAt: null, error: null };
let state = initial;
const listeners = new Set<() => void>();
export function setLocalSaveState(next: Partial<SaveState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
export function useLocalSaveState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => state,
    () => initial,
  );
}
