"use client";

/**
 * Tauri v2 auto-updater integration.
 *
 * Checks for updates on startup, supports manual checks, downloads in the
 * background, and prompts the user when an update is ready to install.
 */

import { isTauri } from "./tauri";

export interface UpdateInfo {
  version: string;
  date?: string;
  body?: string;
}

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error"
  | "up-to-date";

interface UpdateState {
  status: UpdateStatus;
  info: UpdateInfo | null;
  error: string | null;
  downloadProgress: number | null; // 0-100
}

let _state: UpdateState = {
  status: "idle",
  info: null,
  error: null,
  downloadProgress: null,
};

const _listeners = new Set<() => void>();

function setState(next: Partial<UpdateState>) {
  _state = { ..._state, ...next };
  _listeners.forEach((fn) => fn());
}

export function getUpdateState(): UpdateState {
  return _state;
}

export function subscribeToUpdateState(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

// Stored update object for install
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _pendingUpdate: any = null;

/**
 * Check for updates. Safe to call on non-Tauri environments (no-op).
 */
export async function checkForUpdate(): Promise<void> {
  if (!isTauri()) return;

  setState({ status: "checking", error: null });

  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();

    if (!update) {
      setState({ status: "up-to-date", info: null });
      return;
    }

    _pendingUpdate = update;
    setState({
      status: "available",
      info: {
        version: update.version,
        date: update.date ?? undefined,
        body: update.body ?? undefined,
      },
    });
  } catch (err) {
    console.error("[Updater] Check failed:", err);
    setState({ status: "error", error: String(err) });
  }
}

/**
 * Download the pending update in the background.
 */
export async function downloadUpdate(): Promise<void> {
  if (!_pendingUpdate) return;

  setState({ status: "downloading", downloadProgress: 0 });

  try {
    let downloaded = 0;
    let total = 0;

    await _pendingUpdate.download((event: { event: string; data?: { chunkLength?: number; contentLength?: number } }) => {
      if (event.event === "Started") {
        total = event.data?.contentLength ?? 0;
      } else if (event.event === "Progress") {
        downloaded += event.data?.chunkLength ?? 0;
        const pct = total > 0 ? Math.round((downloaded / total) * 100) : null;
        setState({ downloadProgress: pct });
      } else if (event.event === "Finished") {
        setState({ status: "ready", downloadProgress: 100 });
      }
    });
  } catch (err) {
    console.error("[Updater] Download failed:", err);
    setState({ status: "error", error: String(err) });
  }
}

/**
 * Install the downloaded update and restart the app.
 */
export async function installUpdate(): Promise<void> {
  if (!_pendingUpdate) return;

  try {
    await _pendingUpdate.install();
  } catch (err) {
    console.error("[Updater] Install failed:", err);
    setState({ status: "error", error: String(err) });
  }
}

/**
 * Check for updates on startup (called once from the app root).
 * Automatically downloads if an update is found.
 */
export async function checkOnStartup(): Promise<void> {
  if (!isTauri()) return;

  // Small delay so the app finishes rendering first
  await new Promise((r) => setTimeout(r, 3000));

  await checkForUpdate();

  if (_state.status === "available") {
    await downloadUpdate();
  }
}
