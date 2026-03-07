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

const DEPLOYED_URL = "https://markup.freddiephilpot.dev";

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
  return process.env.NEXT_PUBLIC_API_URL || DEPLOYED_URL;
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

/**
 * Trigger sign-in. On web, navigates to the API route. In Tauri, starts a
 * localhost OAuth server, opens a fresh webview popup (no existing cookies)
 * to the desktop auth endpoint, and waits for the token redirect.
 *
 * @param onAuthenticated - callback fired once the session is active
 */
export async function signIn(onAuthenticated?: () => void): Promise<void> {
  const base = apiBase();
  if (!isTauri()) {
    window.location.href = `${base}/api/auth/signin`;
    return;
  }

  try {
    const { start, cancel, onUrl } = await import(
      "@fabianlars/tauri-plugin-oauth"
    );
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");

    // Start a temporary localhost server to capture the redirect
    const port = await start();
    let authWindow: InstanceType<typeof WebviewWindow> | null = null;

    // Listen for the redirect from the auth window
    await onUrl((url: string) => {
      cancel(port).catch(() => {});

      // Close the auth popup
      if (authWindow) {
        authWindow.close().catch(() => {});
        authWindow = null;
      }

      const parsed = new URL(url);
      const token = parsed.searchParams.get("token");
      const userJson = parsed.searchParams.get("user");

      if (token) {
        sessionStorage.setItem("desktop_token", token);
        if (userJson) {
          sessionStorage.setItem("desktop_user", userJson);
        }
        onAuthenticated?.();
      }
    });

    // Open a fresh webview window (no shared browser cookies)
    authWindow = new WebviewWindow("auth-login", {
      url: `${base}/api/auth/desktop?port=${port}`,
      title: "Sign in to Markup",
      width: 500,
      height: 700,
      center: true,
      resizable: false,
      focus: true,
    });

    // If the user closes the window manually, clean up
    authWindow.once("tauri://destroyed", () => {
      cancel(port).catch(() => {});
      authWindow = null;
    });

    // Safety: cancel the server after 5 minutes
    setTimeout(() => {
      cancel(port).catch(() => {});
      if (authWindow) {
        authWindow.close().catch(() => {});
        authWindow = null;
      }
    }, 5 * 60 * 1000);
  } catch {
    // Fallback: open sign-in directly in system browser
    await openExternal(`${base}/api/auth/signin`);
  }
}

/**
 * Trigger sign-out. On web, navigates to the signout route. In Tauri, opens
 * the signout URL in the browser and reloads the app state.
 */
export async function signOut(onSignedOut?: () => void): Promise<void> {
  const base = apiBase();
  if (!isTauri()) {
    window.location.href = `${base}/api/auth/signout`;
    return;
  }

  await openExternal(`${base}/api/auth/signout`);
  onSignedOut?.();
}
