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
  FolderOpen,
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
  const folders = useEditorStore((s) => s.folders);
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

  // File matches: search by filename (shown in default mode when query is non-empty)
  const fileMatches = useMemo(() => {
    if (isTextSearch) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return tabs.filter((t) =>
      t.title.toLowerCase().includes(q)
    );
  }, [query, isTextSearch, tabs]);

  // Folder matches: search by folder name
  const folderMatches = useMemo(() => {
    if (isTextSearch) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return folders.filter((f) =>
      f.name.toLowerCase().includes(q)
    );
  }, [query, isTextSearch, folders]);

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

  // Combined items: files first, then folders, then features
  type ResultItem =
    | { kind: "file"; tab: typeof tabs[0] }
    | { kind: "folder"; folder: typeof folders[0] }
    | { kind: "feature"; feature: Feature }
    | { kind: "text"; match: TextMatch };

  const allItems = useMemo<ResultItem[]>(() => {
    if (isTextSearch) {
      return textResults.map((m) => ({ kind: "text" as const, match: m }));
    }
    return [
      ...fileMatches.map((tab) => ({ kind: "file" as const, tab })),
      ...folderMatches.map((folder) => ({ kind: "folder" as const, folder })),
      ...filteredFeatures.map((feature) => ({ kind: "feature" as const, feature })),
    ];
  }, [isTextSearch, textResults, fileMatches, folderMatches, filteredFeatures]);

  const totalItems = allItems.length;

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

  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const expandFolderById = useCallback(
    (folderId: string) => {
      // Focus the sidebar and open the folder — open the file tree if closed
      const s = useEditorStore.getState();
      if (!s.fileTreeOpen) toggleFileTree();
    },
    [toggleFileTree]
  );

  const execute = useCallback(
    (index: number) => {
      const item = allItems[index];
      if (!item) { setOpen(false); return; }

      switch (item.kind) {
        case "text": {
          switchTab(item.match.tabId);
          const match = item.match;
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
              requestAnimationFrame(() => view.focus());
            } else if (attempts > 0) {
              setTimeout(() => tryScroll(attempts - 1), 50);
            }
          };
          tryScroll(10);
          break;
        }
        case "file":
          switchTab(item.tab.id);
          break;
        case "folder":
          expandFolderById(item.folder.id);
          break;
        case "feature":
          item.feature.action();
          break;
      }
      setOpen(false);
    },
    [allItems, switchTab, expandFolderById]
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
            placeholder="Search files, folders, features… or ?query for text"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
          {allItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {isTextSearch && !textQuery
                ? "Type after ? to search text in all files"
                : "No results found"}
            </p>
          ) : (
            allItems.map((item, i) => {
              const isActive = i === selectedIndex;
              const cls = cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-muted"
              );

              switch (item.kind) {
                case "file": {
                  const folder = folders.find((f) => f.id === item.tab.folderId);
                  return (
                    <button
                      key={`file-${item.tab.id}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cls}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.tab.title}</span>
                      {folder && (
                        <span className="ml-auto text-[10px] text-muted-foreground/60 truncate max-w-[80px]">
                          {folder.name}
                        </span>
                      )}
                    </button>
                  );
                }
                case "folder":
                  return (
                    <button
                      key={`folder-${item.folder.id}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cls}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: item.folder.color }} />
                      <span className="truncate">{item.folder.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60">folder</span>
                    </button>
                  );
                case "feature":
                  return (
                    <button
                      key={`feat-${item.feature.label}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cls}
                    >
                      <span className="text-muted-foreground">{item.feature.icon}</span>
                      <span>{item.feature.label}</span>
                    </button>
                  );
                case "text":
                  return (
                    <button
                      key={`text-${item.match.tabId}-${item.match.lineNumber}-${i}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cn(cls, "items-start")}
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">
                            {item.match.tabTitle}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            :{item.match.lineNumber}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.match.lineContent.trim()}
                        </p>
                      </div>
                    </button>
                  );
              }
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {isTextSearch ? "Text search across all files" : "Files, folders & features"}
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
