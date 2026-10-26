"use client";
import { useSyncExternalStore } from "react";
const initial: { status: "idle" | "saved" | "error"; error: string | null } = {
  status: "idle",
  error: null,
};
let state = initial;
const listeners = new Set<() => void>();
export function setFileSaveState(next: typeof state) {
  state = next;
  listeners.forEach((listener) => listener());
}
export function useFileSaveState() {
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
