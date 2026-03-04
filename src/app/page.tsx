"use client";

import { Sidebar, TabBar, MainContent, FileTree } from "@/components/shell";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { ThemeSync } from "@/components/theme-provider";
import { MobileLayout } from "@/components/shell/mobile-layout";
import { useEditorStore } from "@/lib/store";
import { useGlobalKeybinds } from "@/lib/keybinds";
import { useIsMobile } from "@/lib/use-mobile";
import { useEffect } from "react";

export default function Home() {
  const hydrated = useEditorStore((s) => s._hydrated);
  const hydrate = useEditorStore((s) => s.hydrate);
  const isMobile = useIsMobile();

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

  // Mobile layout — completely rearranged for small screens
  if (isMobile) {
    return <MobileLayout />;
  }

  // Desktop layout — unchanged
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
