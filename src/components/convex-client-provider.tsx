"use client";

import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth } from "convex/react";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getClientAuthToken, signIn } from "@/lib/tauri";
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
  desktopSessionEnded?: boolean;
}

let _authState: AuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null,
};
const _listeners = new Set<() => void>();
const ConvexAuthStatus = createContext<ReturnType<typeof useConvexAuth> | null>(null);

/** Publish the verified WorkOS session to active consumers. */
function setAuthState(next: AuthState) {
  _authState = next;
  _listeners.forEach((fn) => fn());
}

/** Hook to read the current auth state from anywhere. */
function useWorkOSAuthState(): AuthState {
  const [, rerender] = useState(0);
  useEffect(() => {
    /** Refresh this subscriber when the shared session changes. */
    const cb = () => rerender((n) => n + 1);
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  }, []);
  return _authState;
}

/** Expose an authenticated user only after the active backend accepts the session. */
export function useAuthState(): AuthState {
  const auth = useWorkOSAuthState();
  const convex = useContext(ConvexAuthStatus);
  if (!convex || convex.isAuthenticated) return auth;
  return { isLoading: convex.isLoading, isAuthenticated: false, user: null };
}

/** Supply WorkOS credentials to the configured Markup cloud client. */
function useWorkOSForConvex() {
  const { isLoading, isAuthenticated } = useWorkOSAuthState();
  const fetchAccessToken = useCallback(async () => {
    const auth = await getClientAuthToken();
    if (auth.desktopSessionEnded) {
      setAuthState({ isLoading: false, isAuthenticated: false, user: null, desktopSessionEnded: true });
    }
    return auth.accessToken;
  }, []);
  return { isLoading, isAuthenticated, fetchAccessToken };
}

/** A self-hosted deployment cannot use the hosted Markup session. */
const noAccessToken = async () => null;
function useUnauthenticatedConvex() {
  return { isLoading: false, isAuthenticated: false, fetchAccessToken: noAccessToken };
}

function DesktopSessionNotice() {
  const { desktopSessionEnded } = useWorkOSAuthState();
  const [error, setError] = useState(false);
  if (!desktopSessionEnded) return null;
  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-40 flex max-w-[90vw] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2 text-xs shadow-lg">
      <span>{error ? "Could not start sign-in. Please try again." : "Your desktop session ended. Sign in again to resume sync."}</span>
      <button type="button" className="font-medium underline" onClick={() => {
        setError(false);
        void signIn(() => window.location.reload()).catch(() => setError(true));
      }}>Sign in again</button>
    </div>
  );
}

/** Expose Convex's authentication state without requiring Convex on PostgreSQL. */
function ConvexAuthBoundary({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  return <ConvexAuthStatus.Provider value={auth}>{children}</ConvexAuthStatus.Provider>;
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
          isAuthenticated: Boolean(data.accessToken && data.user),
          user: data.user ?? null,
          desktopSessionEnded: data.desktopSessionEnded,
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
      console.error(
        "[Convex] NEXT_PUBLIC_CONVEX_URL is not set. Convex sync is disabled. " +
          "Set NEXT_PUBLIC_CONVEX_URL to your Convex deployment URL in the environment used for this build."
      );
    }
  }, [shouldUseConvex, convexUrl]);

  if (!shouldUseConvex) {
    return (
      <>
        <AuthLoader />
        <DesktopSessionNotice />
        {children}
      </>
    );
  }

  if (!convex) {
    return (
      <>
        <AuthLoader />
        <DesktopSessionNotice />
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
    <ConvexProviderWithAuth
      key={convexUrl}
      client={convex}
      useAuth={convexUrl === defaultConvexUrl ? useWorkOSForConvex : useUnauthenticatedConvex}
    >
      <AuthLoader />
      <DesktopSessionNotice />
      <ConvexAuthBoundary>{children}</ConvexAuthBoundary>
    </ConvexProviderWithAuth>
  );
}
