"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiBase } from "@/lib/tauri";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  // This is especially important in the Tauri build, where missing env
  // variables can silently break sync.
  // eslint-disable-next-line no-console
  console.error(
    "[Convex] NEXT_PUBLIC_CONVEX_URL is not set. Convex sync is disabled. " +
      "Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment URL in the environment used for this build."
  );
}

const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

// ---------------------------------------------------------------------------
// Auth state shared across the app
// ---------------------------------------------------------------------------

export interface WorkOSUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profilePictureUrl: string | null;
}

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: WorkOSUser | null;
}

let _authState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
};
const _listeners = new Set<() => void>();

function setAuthState(next: AuthState) {
  _authState = next;
  _listeners.forEach((fn) => fn());
}

/** Hook to read the current auth state from anywhere. */
export function useAuthState(): AuthState {
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  }, []);
  return _authState;
}

// ---------------------------------------------------------------------------
// Fetch auth on mount
// ---------------------------------------------------------------------------

function AuthLoader() {
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      // In Tauri, check sessionStorage first (token stored by desktop OAuth flow)
      const desktopToken = sessionStorage.getItem("desktop_token");
      if (desktopToken) {
        const userRaw = sessionStorage.getItem("desktop_user");
        let user: WorkOSUser | null = null;
        if (userRaw) {
          try {
            user = JSON.parse(userRaw);
          } catch { /* ignore */ }
        }
        setAuthState({
          isLoading: false,
          isAuthenticated: true,
          user,
        });
        return;
      }

      try {
        const res = await fetch(`${apiBase()}/api/auth/token`, { credentials: "include" });
        const data = await res.json();
        setAuthState({
          isLoading: false,
          isAuthenticated: !!data.accessToken,
          user: data.user ?? null,
        });
      } catch {
        setAuthState({ isLoading: false, isAuthenticated: false, user: null });
      }
    })();
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return (
      <>
        <AuthLoader />
        {/* Non-blocking banner so users understand why sync is unavailable */}
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-400 shadow-lg backdrop-blur-sm">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          Sync is unavailable: Convex URL is not configured. Set NEXT_PUBLIC_CONVEX_URL and rebuild the app.
        </div>
        {children}
      </>
    );
  }

  return (
    <ConvexProvider client={convex}>
      <AuthLoader />
      {children}
    </ConvexProvider>
  );
}
