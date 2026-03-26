"use client";

import { Sidebar, TabBar, MainContent, FileTree } from "@/components/shell";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { ThemeSync } from "@/components/theme-provider";
import { MobileLayout } from "@/components/shell/mobile-layout";
import { ConvexSync } from "@/lib/convex-sync";
import { TauriFileSync } from "../lib/tauri-file-sync";
import { SharedNoteViewer } from "@/components/shell/shared-note-viewer";
import { FirstRunDialog } from "@/components/shell/first-run-dialog";
import { DesktopDebugNotice } from "@/components/shell/desktop-debug-notice";
import { useEditorStore } from "@/lib/store";
import { useGlobalKeybinds } from "@/lib/keybinds";
import { useIsMobile } from "@/lib/use-mobile";
import { useEffect, useState, useCallback, useRef } from "react";

export default function Home() {
  const hydrated = useEditorStore((s) => s._hydrated);
  const hydrate = useEditorStore((s) => s.hydrate);
  const openTab = useEditorStore((s) => s.openTab);
  const tabs = useEditorStore((s) => s.tabs);
  const isMobile = useIsMobile();
  const sidebarPosition = useEditorStore((s) => s.settings.sidebarPosition);
  const compactMode = useEditorStore((s) => s.settings.compactMode);

  // Removed custom zoom logic to match website behavior in Tauri

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
    if (tab && /^[0-9a-fA-F-]{16,64}$/.test(tab)) {
      pendingTabIdRef.current = tab;
    }

    // Desktop OAuth relay: after browser sign-in, redirect to the Tauri
    // app's localhost OAuth server with the auth token.
    const desktopPort = document.cookie
      .split("; ")
      .find((c) => c.startsWith("desktop_port="))
      ?.split("=")[1];

    if (desktopPort) {
      // Clear the cookie immediately
      document.cookie = "desktop_port=; path=/; max-age=0";
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
    const exists = tabs.some((t) => t.id === tabId);
    if (!exists) return;
    pendingTabIdRef.current = null;
    openTab(tabId);
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.toString());
  }, [hydrated, openTab, tabs]);

  const handleBackFromShared = useCallback(() => {
    setShareId(null);
    // Clean the URL
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    hydrate();
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
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  // Mobile layout — completely rearranged for small screens
  if (isMobile) {
    return <MobileLayout />;
  }

  // Desktop layout — respects appearance settings
  const sidebarElements = (
    <>
      <Sidebar />
      <FileTree />
    </>
  );

  return (
    <div className={`flex h-screen overflow-hidden${compactMode ? " compact-mode" : ""}`}>
      <ThemeSync />
      <ConvexSync />
      <TauriFileSync />
      <DesktopDebugNotice />
      <FirstRunDialog />
      <SpotlightSearch />
      <SettingsPanel />
      {sidebarPosition === "left" && sidebarElements}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar />
        <MainContent />
      </div>
      {sidebarPosition === "right" && sidebarElements}
    </div>
  );
}
