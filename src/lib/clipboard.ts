"use client";

import { isTauri } from "@/lib/tauri";

export async function writeClipboardText(text: string): Promise<void> {
  if (isTauri()) {
    try {
      const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
      await writeText(text);
      return;
    } catch {
      // Fall back to the Web Clipboard API.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("Clipboard write is unavailable in this environment.");
}

export async function readClipboardText(): Promise<string> {
  if (isTauri()) {
    try {
      const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
      return await readText();
    } catch {
      // Fall back to the Web Clipboard API.
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
    return await navigator.clipboard.readText();
  }

  throw new Error("Clipboard read is unavailable in this environment.");
}
