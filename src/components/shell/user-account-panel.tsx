"use client";

import { useState, useEffect, useRef } from "react";
import { X, User, Shield, Monitor, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiBase, getClientAuthToken, isTauri, openExternal } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { WorkOsWidgets, UserProfile, UserSessions, UserSecurity } from "@workos-inc/widgets";

type WidgetTab = "profile" | "sessions" | "security";

function WidgetContent({
  tab,
  authToken,
  sessionId,
}: {
  tab: WidgetTab;
  authToken: string;
  sessionId: string;
}) {
  return (
    <WorkOsWidgets
      apiHostname={apiBase() ? new URL(apiBase()).hostname : window.location.hostname}
      port={apiBase() ? null : window.location.port ? Number(window.location.port) : null}
      https={apiBase() ? apiBase().startsWith("https://") : window.location.protocol === "https:"}
    >
      <div key="profile" style={{ display: tab === "profile" ? "contents" : "none" }}>
        <UserProfile authToken={authToken} />
      </div>
      <div key="sessions" style={{ display: tab === "sessions" ? "contents" : "none" }}>
        <UserSessions authToken={authToken} currentSessionId={sessionId} />
      </div>
      <div key="security" style={{ display: tab === "security" ? "contents" : "none" }}>
        <UserSecurity authToken={authToken} />
      </div>
    </WorkOsWidgets>
  );
}

export function UserAccountPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<WidgetTab>("profile");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [widgetTimedOut, setWidgetTimedOut] = useState(false);
  const fetchedRef = useRef(false);
  const [retryKey, setRetryKey] = useState(0);

  // Listen for custom event to open
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as WidgetTab | undefined;
      if (detail) setActiveTab(detail);
      setOpen(true);
    };
    document.addEventListener("open-user-account", handler);
    return () => document.removeEventListener("open-user-account", handler);
  }, []);

  // Fetch auth token when opened
  useEffect(() => {
    if (!open) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const timeout = setTimeout(() => {
      setFetchFailed(true);
    }, 8000);

    (async () => {
      try {
        const data = await getClientAuthToken();
        clearTimeout(timeout);
        if (data.accessToken) {
          setAuthToken(data.accessToken);
          setSessionId(data.sessionId ?? "current");
        } else {
          setFetchFailed(true);
        }
      } catch (err) {
        clearTimeout(timeout);
        console.error("[WorkOS] Failed to fetch auth token", err);
        setFetchFailed(true);
      }
    })();

    return () => clearTimeout(timeout);
  }, [open, retryKey]);

  // Timeout for widget loading
  useEffect(() => {
    if (!authToken || !sessionId) return;
    const timeout = setTimeout(() => {
      setWidgetTimedOut(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [authToken, sessionId]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const tabs: { id: WidgetTab; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "sessions", label: "Sessions", icon: Monitor },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] rounded-lg border border-border bg-popover shadow-2xl animate-in slide-in-from-bottom-2 fade-in duration-150 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Account</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border px-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
                activeTab === id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Widget content */}
        <div className="flex-1 overflow-y-auto p-4">
          {authToken && sessionId && !widgetTimedOut && !fetchFailed ? (
            <WidgetContent tab={activeTab} authToken={authToken} sessionId={sessionId} />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              {fetchFailed || widgetTimedOut ? (
                <>
                  <p>Unable to load account widgets</p>
                  <p className="text-xs">
                    {isTauri()
                      ? "Check your internet connection. You can also manage your account in the browser."
                      : "Check your connection and try refreshing."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFetchFailed(false);
                        setWidgetTimedOut(false);
                        setAuthToken(null);
                        setSessionId(null);
                        fetchedRef.current = false;
                        setRetryKey((k) => k + 1);
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                    {isTauri() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const base = apiBase() || "";
                          if (base) {
                            openExternal(`${base}/settings/account`);
                          }
                        }}
                      >
                        Open in browser
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                "Loading authentication…"
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
