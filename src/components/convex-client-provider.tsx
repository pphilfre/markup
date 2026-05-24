"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getClientAuthToken } from "@/lib/tauri";
import { getDbProvider } from "@/lib/db-provider";
import { useEditorStore } from "@/lib/store";

const defaultConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

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

export function AuthLoader() {
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    (async () => {
      try {
        const data = await getClientAuthToken();
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
  const provider = getDbProvider();
  const shouldUseConvex = provider === "convex";
  const serverMode = useEditorStore((s) => s.serverMode);
  const localServerUrl = useEditorStore((s) => s.localServerUrl);

  // Resolve the active Convex URL: local override when in local mode, else cloud default
  const convexUrl = useMemo(() => {
    if (serverMode === "local" && localServerUrl.trim()) {
      return localServerUrl.trim();
    }
    return defaultConvexUrl;
  }, [serverMode, localServerUrl]);

  const convex = useMemo(() => {
    if (!shouldUseConvex || !convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [shouldUseConvex, convexUrl]);

  useEffect(() => {
    if (!shouldUseConvex) return;
    if (!convexUrl) {
      // This is especially important in the Tauri build, where missing env
      // variables can silently break sync.
      // eslint-disable-next-line no-console
      console.error(
        "[Convex] NEXT_PUBLIC_CONVEX_URL is not set. Convex sync is disabled. " +
          "Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment URL in the environment used for this build."
      );
    }
  }, [shouldUseConvex]);

  if (!shouldUseConvex) {
    return (
      <>
        <AuthLoader />
        {children}
      </>
    );
  }

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
