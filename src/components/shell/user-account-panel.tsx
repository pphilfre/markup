"use client";

import { useState, useEffect, useRef } from "react";
import { X, User, Shield, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <WorkOsWidgets apiHostname={window.location.hostname} port={window.location.port ? Number(window.location.port) : null} https={window.location.protocol === "https:"}>
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
  const fetchedRef = useRef(false);

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
    (async () => {
      try {
        const res = await fetch("/api/auth/token");
        const data = await res.json();
        if (data.accessToken) setAuthToken(data.accessToken);
        if (data.sessionId) setSessionId(data.sessionId);
      } catch {
        console.error("Failed to fetch auth token");
      }
    })();
  }, [open]);

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
          {authToken && sessionId ? (
            <WidgetContent tab={activeTab} authToken={authToken} sessionId={sessionId} />
          ) : (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Loading authentication…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
