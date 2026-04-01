"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  FileText,
  Bold,
  Italic,
  Strikethrough,
  Heading,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Link,
  Image as ImageIcon,
  Eye,
  PenLine,
  Columns2,
  Layers,
  Network,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings,
  Plus,
  X,
  PenTool,
  GitBranch,
  KanbanSquare,
  FileType,
  FolderPlus,
  FolderOpen,
  PanelLeft,
  Share2,
  FileOutput,
  Globe,
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
  const insertLinePrefix = useEditorStore((s) => s.insertLinePrefix);
  const insertSnippet = useEditorStore((s) => s.insertSnippet);
  const toggleView = useEditorStore((s) => s.toggleView);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const createKanban = useEditorStore((s) => s.createKanban);
  const createPdf = useEditorStore((s) => s.createPdf);
  const createFolder = useEditorStore((s) => s.createFolder);
  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setZoomLevel = useEditorStore((s) => s.setZoomLevel);
  const activeTabId = useEditorStore((s) => s.activeTabId);
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
        label: "Insert Heading",
        keywords: ["heading", "title", "h1", "h2", "markdown"],
        icon: <Heading className="h-4 w-4" />,
        action: () => insertLinePrefix("## "),
      },
      {
        label: "Insert Bullet List",
        keywords: ["list", "bullet", "unordered", "markdown"],
        icon: <List className="h-4 w-4" />,
        action: () => insertLinePrefix("- "),
      },
      {
        label: "Insert Numbered List",
        keywords: ["ordered", "numbered", "list", "markdown"],
        icon: <ListOrdered className="h-4 w-4" />,
        action: () => insertLinePrefix("1. "),
      },
      {
        label: "Insert Task List",
        keywords: ["task", "todo", "checkbox", "list", "markdown"],
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => insertLinePrefix("- [ ] "),
      },
      {
        label: "Insert Blockquote",
        keywords: ["blockquote", "quote", "markdown"],
        icon: <Quote className="h-4 w-4" />,
        action: () => insertLinePrefix("> "),
      },
      {
        label: "Insert Code Block",
        keywords: ["code", "fence", "snippet", "markdown"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => insertSnippet("```\n$SEL\n```"),
      },
      {
        label: "Insert Link",
        keywords: ["link", "url", "markdown"],
        icon: <Link className="h-4 w-4" />,
        action: () => insertSnippet("[$SEL](url)"),
      },
      {
        label: "Insert Image",
        keywords: ["image", "img", "markdown"],
        icon: <ImageIcon className="h-4 w-4" />,
        action: () => insertSnippet("![alt]($SEL)"),
      },
      {
        label: "Editor View",
        keywords: ["editor", "write", "edit"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => setViewMode("editor"),
      },
      {
        label: "Inline View",
        keywords: ["inline", "mixed", "live preview"],
        icon: <Layers className="h-4 w-4" />,
        action: () => setViewMode("inline"),
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
        label: "Graph View",
        keywords: ["graph", "network", "links"],
        icon: <Network className="h-4 w-4" />,
        action: () => setViewMode("graph"),
      },
      {
        label: "Whiteboard View",
        keywords: ["whiteboard", "canvas", "draw"],
        icon: <PenTool className="h-4 w-4" />,
        action: () => setViewMode("whiteboard"),
      },
      {
        label: "Mindmap View",
        keywords: ["mindmap", "map", "nodes"],
        icon: <GitBranch className="h-4 w-4" />,
        action: () => setViewMode("mindmap"),
      },
      {
        label: "Kanban View",
        keywords: ["kanban", "board", "cards"],
        icon: <KanbanSquare className="h-4 w-4" />,
        action: () => setViewMode("kanban"),
      },
      {
        label: "PDF View",
        keywords: ["pdf", "document", "viewer"],
        icon: <FileType className="h-4 w-4" />,
        action: () => setViewMode("pdf"),
      },
      {
        label: "Cycle View Mode",
        keywords: ["cycle", "toggle view", "next view"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => toggleView(),
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
        action: () => requestCreateTab(),
      },
      {
        label: "Close Current File",
        keywords: ["close", "tab", "file"],
        icon: <X className="h-4 w-4" />,
        action: () => {
          if (activeTabId) closeTab(activeTabId);
        },
      },
      {
        label: "New Whiteboard",
        keywords: ["whiteboard", "canvas", "draw"],
        icon: <PenTool className="h-4 w-4" />,
        action: () => createWhiteboard(),
      },
      {
        label: "New Mindmap",
        keywords: ["mindmap", "map", "nodes"],
        icon: <GitBranch className="h-4 w-4" />,
        action: () => createMindmap(),
      },
      {
        label: "New Kanban",
        keywords: ["kanban", "board", "tasks"],
        icon: <KanbanSquare className="h-4 w-4" />,
        action: () => createKanban(),
      },
      {
        label: "New PDF",
        keywords: ["pdf", "document"],
        icon: <FileType className="h-4 w-4" />,
        action: () => createPdf(),
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
        label: "Zoom In",
        keywords: ["zoom", "increase", "bigger"],
        icon: <ZoomIn className="h-4 w-4" />,
        action: () => setZoomLevel(zoomLevel + 10),
      },
      {
        label: "Zoom Out",
        keywords: ["zoom", "decrease", "smaller"],
        icon: <ZoomOut className="h-4 w-4" />,
        action: () => setZoomLevel(zoomLevel - 10),
      },
      {
        label: "Reset Zoom",
        keywords: ["zoom", "reset", "100%"],
        icon: <RotateCcw className="h-4 w-4" />,
        action: () => setZoomLevel(100),
      },
      {
        label: "Settings",
        keywords: ["settings", "preferences", "config", "font", "size"],
        icon: <Settings className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-settings")),
      },
      {
        label: "Share Note",
        keywords: ["share", "collaborate", "link"],
        icon: <Share2 className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-share")),
      },
      {
        label: "Publish Site",
        keywords: ["publish", "site", "website", "public page"],
        icon: <Globe className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-publish")),
      },
      {
        label: "Export",
        keywords: ["export", "download", "pdf", "html", "json", "markdown"],
        icon: <FileOutput className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-export")),
      },
    ],
    [
      wrapSelection,
      toggleTheme,
      setViewMode,
      requestCreateTab,
      createWhiteboard,
      createMindmap,
      createKanban,
      createPdf,
      createFolder,
      closeTab,
      toggleFileTree,
      toggleView,
      theme,
      zoomLevel,
      setZoomLevel,
      activeTabId,
      insertLinePrefix,
      insertSnippet,
    ]
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
    queueMicrotask(() => setSelectedIndex(0));
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const expandFolderById = useCallback(
    () => {
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
          expandFolderById();
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[20vh] px-3 sm:px-0"
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
            placeholder="Search files, features… or ?text"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={() => setOpen(false)}
            className="sm:hidden flex h-6 items-center rounded border border-border bg-muted px-2 text-[11px] text-muted-foreground active:bg-muted/80"
          >
            Cancel
          </button>
          <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[50vh] sm:max-h-64 overflow-y-auto p-1">
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
