"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import {
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL as string
);

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
      try {
        const res = await fetch("/api/auth/token");
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
  return (
    <ConvexProvider client={convex}>
      <AuthLoader />
      {children}
    </ConvexProvider>
  );
}
