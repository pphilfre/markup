"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  FileText,
  Bold,
  Italic,
  Strikethrough,
  Eye,
  PenLine,
  Columns2,
  Sun,
  Moon,
  Settings,
  Plus,
  Download,
  FolderPlus,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";

// Feature definitions for non-? queries
interface Feature {
  label: string;
  keywords: string[];
  icon: React.ReactNode;
  action: () => void;
}

function useFeatures(): Feature[] {
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const createTab = useEditorStore((s) => s.createTab);
  const createFolder = useEditorStore((s) => s.createFolder);
  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const theme = useEditorStore((s) => s.theme);

  return useMemo<Feature[]>(
    () => [
      {
        label: "Bold",
        keywords: ["bold", "strong", "**"],
        icon: <Bold className="h-4 w-4" />,
        action: () => wrapSelection("**", "**"),
      },
      {
        label: "Italic",
        keywords: ["italic", "emphasis", "*"],
        icon: <Italic className="h-4 w-4" />,
        action: () => wrapSelection("*", "*"),
      },
      {
        label: "Strikethrough",
        keywords: ["strikethrough", "strike", "~~"],
        icon: <Strikethrough className="h-4 w-4" />,
        action: () => wrapSelection("~~", "~~"),
      },
      {
        label: "Editor View",
        keywords: ["editor", "write", "edit"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => setViewMode("editor"),
      },
      {
        label: "Split View",
        keywords: ["split", "both", "dual", "side"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => setViewMode("split"),
      },
      {
        label: "Preview",
        keywords: ["preview", "view", "read"],
        icon: <Eye className="h-4 w-4" />,
        action: () => setViewMode("preview"),
      },
      {
        label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        keywords: ["theme", "dark", "light", "mode", "toggle"],
        icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        action: toggleTheme,
      },
      {
        label: "New File",
        keywords: ["new", "file", "tab", "create"],
        icon: <Plus className="h-4 w-4" />,
        action: () => createTab(),
      },
      {
        label: "New Folder",
        keywords: ["folder", "new folder", "create folder"],
        icon: <FolderPlus className="h-4 w-4" />,
        action: () => createFolder("New Folder"),
      },
      {
        label: "Toggle File Tree",
        keywords: ["sidebar", "file tree", "panel", "tree", "toggle sidebar"],
        icon: <PanelLeft className="h-4 w-4" />,
        action: toggleFileTree,
      },
      {
        label: "Settings",
        keywords: ["settings", "preferences", "config", "font", "size"],
        icon: <Settings className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-settings")),
      },
    ],
    [wrapSelection, toggleTheme, setViewMode, createTab, createFolder, toggleFileTree, theme]
  );
}

// Text search result
interface TextMatch {
  tabId: string;
  tabTitle: string;
  lineNumber: number;
  lineContent: string;
  matchIndex: number;
}

function searchText(tabs: { id: string; title: string; content: string }[], query: string): TextMatch[] {
  const lower = query.toLowerCase();
  const results: TextMatch[] = [];

  for (const tab of tabs) {
    const lines = tab.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].toLowerCase().indexOf(lower);
      if (idx !== -1) {
        results.push({
          tabId: tab.id,
          tabTitle: tab.title,
          lineNumber: i + 1,
          lineContent: lines[i],
          matchIndex: idx,
        });
        if (results.length >= 50) return results;
      }
    }
  }

  return results;
}

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tabs = useEditorStore((s) => s.tabs);
  const switchTab = useEditorStore((s) => s.switchTab);
  const features = useFeatures();

  // Listen for custom event
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setQuery("");
      setSelectedIndex(0);
    };
    document.addEventListener("open-spotlight", handler);
    return () => document.removeEventListener("open-spotlight", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
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

  const isTextSearch = query.startsWith("?");
  const textQuery = query.slice(1).trim();

  const textResults = useMemo(() => {
    if (!isTextSearch || !textQuery) return [];
    return searchText(tabs, textQuery);
  }, [isTextSearch, textQuery, tabs]);

  const filteredFeatures = useMemo(() => {
    if (isTextSearch) return [];
    const q = query.toLowerCase().trim();
    if (!q) return features;
    return features.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.keywords.some((k) => k.includes(q))
    );
  }, [query, isTextSearch, features]);

  const totalItems = isTextSearch ? textResults.length : filteredFeatures.length;

  // Reset selection on filter change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const execute = useCallback(
    (index: number) => {
      if (isTextSearch) {
        const match = textResults[index];
        if (match) {
          switchTab(match.tabId);
          // Scroll to matched line — retry until editor view is ready
          const tryScroll = (attempts: number) => {
            const view = useEditorStore.getState().editorView;
            if (view && view.state.doc.lines >= match.lineNumber) {
              const line = view.state.doc.line(
                Math.min(match.lineNumber, view.state.doc.lines)
              );
              view.dispatch({
                selection: { anchor: line.from + Math.max(0, match.matchIndex) },
                scrollIntoView: true,
              });
              // Also force a second scroll for reliability
              requestAnimationFrame(() => {
                try {
                  const { EditorView: EV } = require("@codemirror/view");
                  view.dispatch({
                    effects: EV.scrollIntoView(line.from, { y: "center" }),
                  });
                } catch {
                  // fallback already handled by scrollIntoView: true above
                }
                view.focus();
              });
            } else if (attempts > 0) {
              setTimeout(() => tryScroll(attempts - 1), 50);
            }
          };
          tryScroll(10);
        }
      } else {
        const feature = filteredFeatures[index];
        if (feature) feature.action();
      }
      setOpen(false);
    },
    [isTextSearch, textResults, filteredFeatures, switchTab]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + Math.max(1, totalItems)) % Math.max(1, totalItems));
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute(selectedIndex);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />

      {/* Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-lg border border-border bg-popover shadow-2xl animate-in slide-in-from-top-2 fade-in duration-150"
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search features… or ?query for text search"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
          {isTextSearch ? (
            textResults.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                {textQuery ? "No matches found" : "Type after ? to search text in all files"}
              </p>
            ) : (
              textResults.map((match, i) => (
                <button
                  key={`${match.tabId}-${match.lineNumber}-${i}`}
                  data-active={i === selectedIndex}
                  onClick={() => execute(i)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    i === selectedIndex
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">
                        {match.tabTitle}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        :{match.lineNumber}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {match.lineContent.trim()}
                    </p>
                  </div>
                </button>
              ))
            )
          ) : filteredFeatures.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matching features
            </p>
          ) : (
            filteredFeatures.map((feature, i) => (
              <button
                key={feature.label}
                data-active={i === selectedIndex}
                onClick={() => execute(i)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  i === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span className="text-muted-foreground">{feature.icon}</span>
                <span>{feature.label}</span>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {isTextSearch ? "Text search across all files" : "Feature search"}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
            <span>navigate</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>
            <span>select</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// (EditorView.scrollIntoView is now used inline in the execute callback)
