"use client";

import { Sidebar, TabBar, MainContent, FileTree } from "@/components/shell";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { ThemeSync } from "@/components/theme-provider";
import { useEditorStore } from "@/lib/store";
import { useGlobalKeybinds } from "@/lib/keybinds";
import { useEffect } from "react";

export default function Home() {
  const hydrated = useEditorStore((s) => s._hydrated);
  const hydrate = useEditorStore((s) => s.hydrate);

  // Hydrate from IndexedDB on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Register global keyboard shortcuts
  useGlobalKeybinds();

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <ThemeSync />
      <SpotlightSearch />
      <SettingsPanel />
      <Sidebar />
      <FileTree />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TabBar />
        <MainContent />
      </div>
    </div>
  );
}
