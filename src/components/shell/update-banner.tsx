"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, X, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import packageJson from "../../../package.json";
import {
  checkForUpdate,
  downloadUpdate,
  installUpdate,
  getUpdateState,
  subscribeToUpdateState,
  checkOnStartup,
  type UpdateStatus,
} from "@/lib/tauri-updater";
import { isTauri } from "@/lib/tauri";

export function UpdateBanner() {
  const [state, setState] = useState(getUpdateState);
  const [dismissed, setDismissed] = useState(false);

  // Subscribe to updater state changes
  useEffect(() => {
    const unsub = subscribeToUpdateState(() => setState(getUpdateState()));
    return unsub;
  }, []);

  // Check on startup
  useEffect(() => {
    if (!isTauri()) return;
    checkOnStartup();
  }, []);

  // Listen for manual check event from settings
  useEffect(() => {
    const handler = () => checkForUpdate();
    document.addEventListener("check-for-updates", handler);
    return () => document.removeEventListener("check-for-updates", handler);
  }, []);

  if (!isTauri()) return null;
  if (dismissed) return null;

  const { status, info, error, downloadProgress } = state;
  const currentVersion = packageJson.version;

  if (status === "idle" || status === "checking" || status === "up-to-date") {
    return null;
  }

  if (status === "error") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive shadow-lg backdrop-blur-sm max-w-xs">
        <span className="flex-1">Update check failed: {error}</span>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (status === "available") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg backdrop-blur-sm max-w-xs">
        <ArrowUpCircle className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">Update available: v{info?.version}</p>
          <p className="text-xs text-muted-foreground">You are on v{currentVersion}</p>
          {info?.body && <p className="text-muted-foreground truncate">{info.body}</p>}
        </div>
        <Button size="sm" variant="outline" className="text-xs h-6 px-2 shrink-0" onClick={downloadUpdate}>
          <Download className="h-3 w-3 mr-1" />
          Download
        </Button>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (status === "downloading") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg backdrop-blur-sm max-w-xs">
        <RefreshCw className="h-4 w-4 text-primary shrink-0 animate-spin" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">Downloading update…</p>
          {downloadProgress !== null && (
            <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "ready") {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs shadow-lg backdrop-blur-sm max-w-xs">
        <ArrowUpCircle className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-primary">Ready to install v{info?.version}</p>
          <p className="text-xs text-muted-foreground">You are on v{currentVersion}</p>
          <p className="text-muted-foreground">Restart to apply the update</p>
        </div>
        <Button size="sm" className="text-xs h-6 px-2 shrink-0" onClick={installUpdate}>
          Restart
        </Button>
        <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
