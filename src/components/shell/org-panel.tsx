"use client";

import { useState, useEffect, useRef } from "react";
import {
  X,
  Users,
  Building2,
  ArrowLeftRight,
  Globe,
  Key,
  BookOpen,
  RotateCcw,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiBase, getClientAuthToken, isTauri, openExternal } from "@/lib/tauri";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  WorkOsWidgets,
  OrganizationSwitcher,
  UsersManagement,
  AdminPortalDomainVerification,
  AdminPortalSsoConnection,
  DirectorySync,
  Pipes,
} from "@workos-inc/widgets";

type OrgView = "switcher" | "admin";
type AdminTab = "users" | "domains" | "sso" | "directory" | "pipes";

const ADMIN_TABS: { id: AdminTab; label: string; icon: typeof Users }[] = [
  { id: "users", label: "Users", icon: Users },
  { id: "domains", label: "Domains", icon: Globe },
  { id: "sso", label: "SSO", icon: Key },
  { id: "directory", label: "Directory Sync", icon: BookOpen },
  { id: "pipes", label: "Audit Log", icon: Workflow },
];

function OrgWidgets({
  authToken,
  view,
  adminTab,
}: {
  authToken: string;
  view: OrgView;
  adminTab: AdminTab;
}) {
  const hostname = apiBase()
    ? new URL(apiBase()).hostname
    : typeof window !== "undefined"
    ? window.location.hostname
    : "localhost";
  const port = apiBase()
    ? null
    : typeof window !== "undefined" && window.location.port
    ? Number(window.location.port)
    : null;
  const https = apiBase()
    ? apiBase().startsWith("https://")
    : typeof window !== "undefined"
    ? window.location.protocol === "https:"
    : true;

  const handleSwitchOrg = async ({ organizationId }: { organizationId: string }) => {
    console.log("[OrgSwitcher] Switching to org:", organizationId);
    window.location.reload();
  };

  return (
    <WorkOsWidgets apiHostname={hostname} port={port} https={https}>
      {view === "switcher" ? (
        <OrganizationSwitcher
          authToken={authToken}
          switchToOrganization={handleSwitchOrg}
        />
      ) : (
        <>
          <div style={{ display: adminTab === "users" ? "contents" : "none" }}>
            <UsersManagement authToken={authToken} />
          </div>
          <div style={{ display: adminTab === "domains" ? "contents" : "none" }}>
            <AdminPortalDomainVerification authToken={authToken} />
          </div>
          <div style={{ display: adminTab === "sso" ? "contents" : "none" }}>
            <AdminPortalSsoConnection authToken={authToken} />
          </div>
          <div style={{ display: adminTab === "directory" ? "contents" : "none" }}>
            <DirectorySync authToken={authToken} />
          </div>
          <div style={{ display: adminTab === "pipes" ? "contents" : "none" }}>
            <Pipes authToken={authToken} />
          </div>
        </>
      )}
    </WorkOsWidgets>
  );
}

export function OrgPanel() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<OrgView>("switcher");
  const [adminTab, setAdminTab] = useState<AdminTab>("users");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [widgetTimedOut, setWidgetTimedOut] = useState(false);
  const fetchedRef = useRef(false);
  const [retryKey, setRetryKey] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as OrgView | undefined;
      if (detail) setView(detail);
      setOpen(true);
    };
    document.addEventListener("open-org-panel", handler);
    return () => document.removeEventListener("open-org-panel", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const timeout = setTimeout(() => setFetchFailed(true), 8000);
    (async () => {
      try {
        const data = await getClientAuthToken();
        clearTimeout(timeout);
        if (data.accessToken) {
          setAuthToken(data.accessToken);
        } else {
          setFetchFailed(true);
        }
      } catch {
        clearTimeout(timeout);
        setFetchFailed(true);
      }
    })();
    return () => clearTimeout(timeout);
  }, [open, retryKey]);

  useEffect(() => {
    if (!authToken) return;
    const timeout = setTimeout(() => setWidgetTimedOut(true), 10000);
    return () => clearTimeout(timeout);
  }, [authToken]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleRetry = () => {
    setFetchFailed(false);
    setWidgetTimedOut(false);
    setAuthToken(null);
    fetchedRef.current = false;
    setRetryKey((k) => k + 1);
  };

  if (!open) return null;

  const showError = fetchFailed || widgetTimedOut;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />

      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl h-[70vh] rounded-lg border border-border bg-popover shadow-2xl animate-in slide-in-from-top-2 fade-in duration-150 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Organisation</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="w-44 shrink-0 border-r border-border py-3 px-2 space-y-1 overflow-y-auto">
            <button
              onClick={() => setView("switcher")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                view === "switcher"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Switch Organisation
            </button>

            <div className="pt-3 pb-1 px-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Admin Panel
              </span>
            </div>

            {ADMIN_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { setView("admin"); setAdminTab(id); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  view === "admin" && adminTab === id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {authToken && !showError ? (
              <OrgWidgets authToken={authToken} view={view} adminTab={adminTab} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 h-full text-sm text-muted-foreground">
                {showError ? (
                  <>
                    <Building2 className="h-8 w-8 opacity-30" />
                    <p>Unable to load organisation widgets</p>
                    <p className="text-xs text-center max-w-xs">
                      {isTauri()
                        ? "Check your internet connection. You can also manage your organisation in the browser."
                        : "Check your connection and try refreshing."}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleRetry}>
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Retry
                      </Button>
                      {isTauri() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openExternal(`${apiBase()}/org`)}
                        >
                          Open in browser
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p>Loading…</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">Powered by WorkOS</span>
          <Separator orientation="vertical" className="h-3" />
          <span className="text-[10px] text-muted-foreground">
            Admin features require organisation admin role
          </span>
        </div>
      </div>
    </div>
  );
}
