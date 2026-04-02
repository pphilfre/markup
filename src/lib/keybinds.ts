"use client";

import { useEffect } from "react";
// @ts-expect-error tinykeys types don't resolve via package.json exports
import { tinykeys } from "tinykeys";
import { getTabWorkspaceId, useEditorStore } from "@/lib/store";
import { isTauri } from "@/lib/tauri";

/**
 * Global keyboard shortcuts using Alt-based combos to avoid
 * browser conflicts (Ctrl+T, Ctrl+W, etc.).
 *
 * Alt+T  — New tab
 * Alt+W  — Close tab
 * Alt+E  — Cycle view mode (editor → split → preview)
 * Alt+L  — Toggle dark / light theme
 * Alt+B  — Toggle file tree sidebar
 * Alt+K  — Open spotlight search (same as Ctrl+K)
 * Alt+S  — Open settings
 * Alt+1…9 — Switch to tab N
 * Ctrl+K — Also opens spotlight search
 */
export function useGlobalKeybinds() {
  useEffect(() => {
    const unsubscribe = tinykeys(window, {
      // New tab
      "Alt+KeyT": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().requestCreateTab();
      },

      // Close tab
      "Alt+KeyW": (e: KeyboardEvent) => {
        e.preventDefault();
        const { activeTabId, closeTab } = useEditorStore.getState();
        if (activeTabId) closeTab(activeTabId);
      },

      // Toggle view mode
      "Alt+KeyE": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().toggleView();
      },

      // Toggle theme
      "Alt+KeyL": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().toggleTheme();
      },

      // Toggle file tree sidebar
      "Alt+KeyB": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().toggleFileTree();
      },

      // Spotlight search — Ctrl+K
      "Control+KeyK": (e: KeyboardEvent) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-spotlight"));
      },

      // Spotlight search — Alt+K alias
      "Alt+KeyK": (e: KeyboardEvent) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-spotlight"));
      },

      // Settings — Alt+S (also dispatched as custom event)
      "Alt+KeyS": (e: KeyboardEvent) => {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent("open-settings"));
      },

      // Strikethrough — Alt+X
      "Alt+KeyX": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().wrapSelection("~~", "~~");
      },

      // Heading — Alt+H (inserts ## )
      "Alt+KeyH": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertLinePrefix("## ");
      },

      // Bullet list — Alt+U
      "Alt+KeyU": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertLinePrefix("- ");
      },

      // Numbered list — Alt+O
      "Alt+KeyO": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertLinePrefix("1. ");
      },

      // Task list — Alt+C
      "Alt+KeyC": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertLinePrefix("- [ ] ");
      },

      // Blockquote — Alt+Q
      "Alt+KeyQ": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertLinePrefix("> ");
      },

      // Code block — Alt+`
      "Alt+Backquote": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertSnippet("```\n$SEL\n```");
      },

      // Link — Alt+N
      "Alt+KeyN": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertSnippet("[$SEL](url)");
      },

      // Image — Alt+I
      "Alt+KeyI": (e: KeyboardEvent) => {
        e.preventDefault();
        useEditorStore.getState().insertSnippet("![alt]($SEL)");
      },

      // Zoom in — Ctrl+=
      "Control+Equal": (e: KeyboardEvent) => {
        if (!isTauri()) return;
        e.preventDefault();
        const { zoomLevel, setZoomLevel } = useEditorStore.getState();
        setZoomLevel(zoomLevel + 10);
      },

      // Zoom out — Ctrl+-
      "Control+Minus": (e: KeyboardEvent) => {
        if (!isTauri()) return;
        e.preventDefault();
        const { zoomLevel, setZoomLevel } = useEditorStore.getState();
        setZoomLevel(zoomLevel - 10);
      },

      // Reset zoom — Ctrl+0
      "Control+Digit0": (e: KeyboardEvent) => {
        if (!isTauri()) return;
        e.preventDefault();
        useEditorStore.getState().setZoomLevel(100);
      },

      // Tab switching: Alt+1 through Alt+9
      "Alt+Digit1": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(0); },
      "Alt+Digit2": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(1); },
      "Alt+Digit3": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(2); },
      "Alt+Digit4": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(3); },
      "Alt+Digit5": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(4); },
      "Alt+Digit6": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(5); },
      "Alt+Digit7": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(6); },
      "Alt+Digit8": (e: KeyboardEvent) => { e.preventDefault(); switchToTabIndex(7); },
      "Alt+Digit9": (e: KeyboardEvent) => {
        e.preventDefault();
        const { tabs, openTabIds, activeProfileId, switchTab } = useEditorStore.getState();
        const visibleOpenTabs = openTabIds
          .map((id) => tabs.find((tab) => tab.id === id))
          .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
          .filter((tab) => getTabWorkspaceId(tab) === activeProfileId);
        if (visibleOpenTabs.length > 0) {
          switchTab(visibleOpenTabs[visibleOpenTabs.length - 1].id);
        }
      },
    });

    return unsubscribe;
  }, []);
}

function switchToTabIndex(index: number) {
  const { tabs, openTabIds, activeProfileId, switchTab } = useEditorStore.getState();
  const visibleOpenTabs = openTabIds
    .map((id) => tabs.find((tab) => tab.id === id))
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
    .filter((tab) => getTabWorkspaceId(tab) === activeProfileId);
  if (index < visibleOpenTabs.length) {
    switchTab(visibleOpenTabs[index].id);
  }
}
