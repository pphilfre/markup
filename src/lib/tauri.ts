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
const DESKTOP_TOKEN_KEY = "desktop_token";
const DESKTOP_USER_KEY = "desktop_user";

export interface DesktopUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

interface AuthTokenResponse {
  accessToken: string | null;
  sessionId: string | null;
  user: DesktopUser | null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function userFromToken(token: string): DesktopUser | null {
  const payload = decodeJwtPayload(token);
  const userId = payload?.sub;
  if (typeof userId !== "string" || !userId.length) {
    return null;
  }

  return {
    id: userId,
    email: typeof payload?.email === "string" ? payload.email : "",
    firstName: typeof payload?.given_name === "string" ? payload.given_name : null,
    lastName: typeof payload?.family_name === "string" ? payload.family_name : null,
    profilePictureUrl: typeof payload?.picture === "string" ? payload.picture : null,
  };
}

export function getDesktopToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(DESKTOP_TOKEN_KEY) || localStorage.getItem(DESKTOP_TOKEN_KEY);
}

export function getDesktopUser(): DesktopUser | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DESKTOP_USER_KEY) || localStorage.getItem(DESKTOP_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DesktopUser;
  } catch {
    return null;
  }
}

export function storeDesktopSession(token: string, user?: DesktopUser | null): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(DESKTOP_TOKEN_KEY, token);
  localStorage.setItem(DESKTOP_TOKEN_KEY, token);
  if (user) {
    const encoded = JSON.stringify(user);
    sessionStorage.setItem(DESKTOP_USER_KEY, encoded);
    localStorage.setItem(DESKTOP_USER_KEY, encoded);
  }
}

export function clearDesktopSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(DESKTOP_TOKEN_KEY);
  sessionStorage.removeItem(DESKTOP_USER_KEY);
  localStorage.removeItem(DESKTOP_TOKEN_KEY);
  localStorage.removeItem(DESKTOP_USER_KEY);
}

/**
 * Read auth state from API or desktop fallback, avoiding cookie-only failures
 * in Tauri where the embedded webview does not share browser cookies.
 */
export async function getClientAuthToken(): Promise<AuthTokenResponse> {
  const desktopToken = isTauri() ? getDesktopToken() : null;
  const headers: Record<string, string> = {};
  if (desktopToken) {
    headers.Authorization = `Bearer ${desktopToken}`;
  }

  try {
    const res = await fetch(`${apiBase()}/api/auth/token`, {
      credentials: "include",
      headers,
    });

    if (res.ok) {
      const data = (await res.json()) as Partial<AuthTokenResponse>;
      const token = data.accessToken ?? desktopToken ?? null;
      const user = data.user ?? (token ? userFromToken(token) : null);
      const sessionId = data.sessionId ?? null;

      if (isTauri() && token) {
        storeDesktopSession(token, user);
      }

      return {
        accessToken: token,
        sessionId,
        user,
      };
    }
  } catch {
    // Desktop fallback below.
  }

  if (desktopToken) {
    return {
      accessToken: desktopToken,
      sessionId: null,
      user: getDesktopUser() ?? userFromToken(desktopToken),
    };
  }

  return { accessToken: null, sessionId: null, user: null };
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
 * localhost OAuth server, opens the system browser to the desktop auth
 * endpoint, and waits for the token redirect back to localhost.
 *
 * @param onAuthenticated - callback fired once the session is active
 */
export async function signIn(onAuthenticated?: () => void): Promise<void> {
  const base = apiBase();
  if (!isTauri()) {
    window.location.href = `${base}/api/auth/signin`;
    return;
  }

  const { start, cancel, onUrl } = await import(
    "@fabianlars/tauri-plugin-oauth"
  );

  // Start a temporary localhost server to capture the redirect
  const port = await start({
    response: "<html><body style=\"font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff\"><p>Signed in! You can close this tab and return to Markup.</p></body></html>",
  });

  // Listen for the redirect from the browser
  const unlisten = await onUrl((url: string) => {
    cancel(port).catch(() => {});
    unlisten();

    const parsed = new URL(url);
    const token = parsed.searchParams.get("token");
    const userJson = parsed.searchParams.get("user");

    if (token) {
      let user: DesktopUser | null = null;
      if (userJson) {
        try {
          user = JSON.parse(userJson) as DesktopUser;
        } catch {
          user = null;
        }
      }
      storeDesktopSession(token, user);
      onAuthenticated?.();
    }
  });

  // Open auth in the system browser — the user completes sign-in there,
  // and the deployed page.tsx relays the token back to localhost:port.
  await openExternal(`${base}/api/auth/desktop?port=${port}`);

  // Safety: cancel the server after 5 minutes
  setTimeout(() => {
    cancel(port).catch(() => {});
    unlisten();
  }, 5 * 60 * 1000);
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

  clearDesktopSession();

  await openExternal(`${base}/api/auth/signout`);
  onSignedOut?.();
}
