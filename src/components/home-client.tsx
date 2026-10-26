"use client";

import { AppShell } from "@/components/workspace/app-shell";
import { FirstRunDialog } from "@/components/shell/first-run-dialog";
import { LinkPicker } from "@/components/editor";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { ThemeSync } from "@/components/theme-provider";
import { DatabaseSync } from "@/lib/database-sync";
import { TauriFileSync } from "@/lib/tauri-file-sync";
import { SharedNoteViewer } from "@/components/shell/shared-note-viewer";
import { DesktopDebugNotice } from "@/components/shell/desktop-debug-notice";
import { NewFileTemplateDialog } from "@/components/shell/new-file-template-dialog";
import { AiChatPanel } from "@/components/shell/ai-chat-panel";
import { getTabWorkspaceId, useEditorStore } from "@/lib/store";
import { useGlobalKeybinds } from "@/lib/keybinds";
import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Root application shell that hydrates editor state and selects mobile/desktop layout.
 */
export function HomeClient() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const hydrated = useEditorStore((s) => s._hydrated);
  const hydrate = useEditorStore((s) => s.hydrate);
  const openTab = useEditorStore((s) => s.openTab);
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const compactMode = useEditorStore((s) => s.settings.compactMode);

  useEffect(() => {
    const appRoot = document.getElementById("markup-app-root");
    if (!appRoot) return;
    if (zoomLevel === 100) {
      appRoot.style.removeProperty("zoom");
      appRoot.style.removeProperty("width");
      appRoot.style.removeProperty("height");
      return;
    }
    const zoomFactor = zoomLevel / 100;
    appRoot.style.zoom = `${zoomLevel}%`;
    // Compensate layout size for CSS zoom so fixed-height regions (like sidebar tools)
    // remain fully visible instead of getting clipped at the viewport edge.
    appRoot.style.width = `${100 / zoomFactor}vw`;
    appRoot.style.height = `${100 / zoomFactor}vh`;
  }, [zoomLevel]);

  // Check for shared note URL parameter
  const [shareId, setShareId] = useState<string | null>(null);
  const pendingTabIdRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const note = params.get("note");
    if (note) {
      queueMicrotask(() => setShareId(note));
    }

    const tab = params.get("tab");
    if (tab?.trim()) {
      const requestedTabId = tab.trim();
      pendingTabIdRef.current = requestedTabId;
      // Keep a short-lived override so Convex hydration doesn't switch away
      // from the explicitly requested tab.
      window.sessionStorage.setItem("markup-requested-tab-id", requestedTabId);
    }

    // Desktop OAuth relay: after browser sign-in, redirect to the Tauri
    // app's localhost OAuth server with the auth token.
    const desktopPort = document.cookie
      .split("; ")
      .find((c) => c.startsWith("desktop_port="))
      ?.split("=")[1];

    if (desktopPort) {
      // Clear the cookie immediately
      document.cookie = "desktop_port=; path=/; max-age=0; secure; samesite=lax";
      (async () => {
        try {
          const res = await fetch("/api/auth/token");
          const data = await res.json();
          if (data.accessToken) {
            const userParam = data.user
              ? `&user=${encodeURIComponent(JSON.stringify(data.user))}`
              : "";
            window.location.href = `http://localhost:${desktopPort}?token=${encodeURIComponent(data.accessToken)}${userParam}`;
          }
        } catch {
          // If token fetch fails, just stay on the page
        }
      })();
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const tabId = pendingTabIdRef.current;
    if (!tabId) return;
    const requestedTab = tabs.find((t) => t.id === tabId);
    if (!requestedTab) return;

    const requestedWorkspaceId = getTabWorkspaceId(requestedTab);
    const workspaceMismatch = requestedWorkspaceId !== activeProfileId;

    if (activeTabId !== tabId || workspaceMismatch) {
      openTab(tabId);
      return;
    }

    pendingTabIdRef.current = null;
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.toString());
  }, [activeProfileId, activeTabId, hydrated, openTab, tabs]);

  const handleBackFromShared = useCallback(() => {
    setShareId(null);
    // Clean the URL
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    hydrate().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Device storage could not be opened."));
  }, [hydrate]);

  // Register global keyboard shortcuts
  useGlobalKeybinds();

  // Show shared note viewer if ?note= parameter is present
  if (shareId) {
    return <SharedNoteViewer shareId={shareId} onBack={handleBackFromShared} />;
  }

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        {loadError ? <div className="max-w-md px-6 text-center"><h1 className="text-lg font-medium">Your workspace could not be loaded</h1><p className="mt-3 text-sm text-muted-foreground">{loadError}</p><p className="mt-2 text-sm text-muted-foreground">Your saved data has not been replaced.</p><button className="mt-5 rounded-md border px-4 py-2 text-sm" onClick={() => { setLoadError(null); hydrate().catch((error: unknown) => setLoadError(error instanceof Error ? error.message : "Storage is still unavailable.")); }}>Try again</button></div> : <p className="text-muted-foreground text-sm">Loading…</p>}
      </div>
    );
  }

  return (
    <div id="markup-app-root" className={`h-screen overflow-hidden${compactMode ? " compact-mode" : ""}`}>
      <ThemeSync />
      <DatabaseSync />
      <TauriFileSync />
      <DesktopDebugNotice />
      <SettingsPanel />
      <FirstRunDialog />
      <NewFileTemplateDialog />
      <LinkPicker />
      <AppShell><AiChatPanel /></AppShell>
    </div>
  );
}
