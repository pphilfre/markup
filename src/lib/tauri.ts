/**
 * Tauri desktop environment detection and helpers.
 *
 * In production Tauri builds the frontend is a static export, so Next.js API
 * routes don't exist locally.  API calls are routed to the deployed backend
 * and auth flows open in the system browser via the Tauri shell plugin.
 */

/** Whether we are running inside a Tauri webview. */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window;
}

/**
 * Base URL for server API calls.
 *
 * - Web (dev / Vercel): empty string → relative fetch (e.g. `/api/auth/token`)
 * - Tauri prod build  : the deployed backend URL so the request reaches the
 *   real Next.js server that handles auth, sessions, etc.
 *
 * Set NEXT_PUBLIC_API_URL to override the default deployed URL.
 */
export function apiBase(): string {
  if (!isTauri()) return "";
  return (
    process.env.NEXT_PUBLIC_API_URL || "https://markup-editor.vercel.app"
  );
}

/**
 * Open a URL in the user's default browser.
 * Falls back to window.location for non-Tauri environments.
 */
export async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(url);
      return;
    } catch {
      // fallback
    }
  }
  window.location.href = url;
}
