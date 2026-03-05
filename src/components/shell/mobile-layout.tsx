"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  Plus,
  X,
  Download,
  FolderArchive,
  Sun,
  Moon,
  PenLine,
  Eye,
  Columns2,
  Bold,
  Italic,
  Strikethrough,
  Heading,
  List,
  ListOrdered,
  Quote,
  Code2,
  Link,
  Image,
  Table,
  CheckSquare,
  Settings,
  ChevronLeft,
  LogIn,
  ChevronRight,
  Menu,
  FolderOpen,
  Search,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorStore, ViewMode } from "@/lib/store";
import { MarkdownEditor, MarkdownPreview } from "@/components/editor";
import { FileTree } from "@/components/shell/file-tree";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { ThemeSync } from "@/components/theme-provider";
import { ConvexSync } from "@/lib/convex-sync";
import { InfoButton } from "@/components/shell/info-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Mobile Header ─────────────────────────────────────────────────────────
function MobileHeader({
  onToggleFileTree,
  fileTreeOpen,
}: {
  onToggleFileTree: () => void;
  fileTreeOpen: boolean;
}) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const displayName = activeTab
    ? hideMd && activeTab.title.endsWith(".md")
      ? activeTab.title.slice(0, -3)
      : activeTab.title
    : "Markup";

  return (
    <div className="flex h-11 items-center border-b border-border bg-card px-2 gap-1 shrink-0">
      {/* Menu / File tree toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleFileTree}
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        {fileTreeOpen ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Active file name */}
      <div className="flex-1 min-w-0 text-center">
        <span className="text-sm font-medium truncate block">{displayName}</span>
      </div>

      {/* Search */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => document.dispatchEvent(new CustomEvent("open-spotlight"))}
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        <Search className="h-4 w-4" />
      </Button>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="h-8 w-8 shrink-0 text-muted-foreground"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      <a href="/api/auth/signin">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
          title="Sign in"
        >
          <LogIn className="h-4 w-4" />
        </Button>
      </a>
    </div>
  );
}

// ── Mobile Tab Strip (horizontal scrollable) ──────────────────────────────
function MobileTabStrip() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const createTab = useEditorStore((s) => s.createTab);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);

  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-9 items-center border-b border-border bg-card/80 shrink-0">
      <div
        ref={scrollRef}
        className="flex flex-1 items-center overflow-x-auto scrollbar-none"
      >
        {tabs.map((tab) => {
          const name = hideMd && tab.title.endsWith(".md") ? tab.title.slice(0, -3) : tab.title;
          return (
            <button
              key={tab.id}
              onClick={() => switchTab(tab.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 px-3 h-9 text-xs border-r border-border transition-colors",
                tab.id === activeTabId
                  ? "bg-background text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <span className="max-w-[100px] truncate">{name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </button>
          );
        })}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => createTab()}
        className="h-9 w-9 shrink-0 text-muted-foreground border-l border-border rounded-none"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ── Mobile View Toggle ────────────────────────────────────────────────────
function MobileViewToggle() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);

  const modes: { mode: ViewMode; icon: typeof PenLine; label: string }[] = [
    { mode: "editor", icon: PenLine, label: "Edit" },
    { mode: "split", icon: Columns2, label: "Split" },
    { mode: "preview", icon: Eye, label: "Preview" },
  ];

  return (
    <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5">
      {modes.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => setViewMode(mode)}
          className={cn(
            "flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] transition-colors",
            viewMode === mode
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground"
          )}
        >
          <Icon className="h-3 w-3" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Mobile Formatting Toolbar (bottom) ────────────────────────────────────
function MobileToolbar() {
  const insertLinePrefix = useEditorStore((s) => s.insertLinePrefix);
  const insertSnippet = useEditorStore((s) => s.insertSnippet);
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const [headingOpen, setHeadingOpen] = useState(false);

  const tools = [
    { icon: Bold, action: () => wrapSelection("**", "**"), label: "Bold" },
    { icon: Italic, action: () => wrapSelection("*", "*"), label: "Italic" },
    { icon: Strikethrough, action: () => wrapSelection("~~", "~~"), label: "Strike" },
    { icon: List, action: () => insertLinePrefix("- "), label: "List" },
    { icon: ListOrdered, action: () => insertLinePrefix("1. "), label: "Ordered" },
    { icon: CheckSquare, action: () => insertLinePrefix("- [ ] "), label: "Task" },
    { icon: Quote, action: () => insertLinePrefix("> "), label: "Quote" },
    { icon: Code2, action: () => insertSnippet("```\n$SEL\n```"), label: "Code" },
    { icon: Link, action: () => insertSnippet("[$SEL](url)"), label: "Link" },
    { icon: Image, action: () => insertSnippet("![alt]($SEL)"), label: "Image" },
    {
      icon: Table,
      action: () =>
        insertSnippet("| Header | Header |\n| ------ | ------ |\n| Cell   | Cell   |"),
      label: "Table",
    },
  ];

  return (
    <div className="flex items-center border-t border-border bg-card shrink-0">
      {/* Heading dropdown */}
      <DropdownMenu open={headingOpen} onOpenChange={setHeadingOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground active:bg-muted">
            <Heading className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-[110px]">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <DropdownMenuItem
              key={level}
              onClick={() => insertLinePrefix("#".repeat(level) + " ")}
              className="gap-2"
            >
              <span className="font-semibold" style={{ fontSize: `${1.3 - level * 0.1}em` }}>
                H{level}
              </span>
              <span className="text-muted-foreground text-xs ml-auto">{"#".repeat(level)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Scrollable formatting tools */}
      <div className="flex flex-1 items-center overflow-x-auto scrollbar-none">
        {tools.map(({ icon: Icon, action, label }) => (
          <button
            key={label}
            onClick={action}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground active:bg-muted transition-colors"
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>

      {/* Settings */}
      <button
        onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}
        className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground active:bg-muted border-l border-border"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Mobile File Tree Overlay ──────────────────────────────────────────────
function MobileFileTreeOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close file tree when a tab is switched (user tapped a file)
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const prevTabRef = useRef(activeTabId);

  useEffect(() => {
    if (prevTabRef.current !== activeTabId && open) {
      onClose();
    }
    prevTabRef.current = activeTabId;
  }, [activeTabId, open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={onClose}
        />
      )}
      {/* Sliding panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-card border-r border-border shadow-xl transition-transform duration-200 ease-out mobile-file-tree",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Override the FileTree to render full width inside this panel */}
        <MobileFileTreeContent onClose={onClose} />
      </div>
    </>
  );
}

/** Simplified file tree wrapper that forces open state and fills the panel */
function MobileFileTreeContent({ onClose }: { onClose: () => void }) {
  // Temporarily force the file tree open for mobile rendering
  const fileTreeOpen = useEditorStore((s) => s.fileTreeOpen);

  useEffect(() => {
    // Ensure the store has fileTreeOpen = true while this is mounted
    const store = useEditorStore.getState();
    if (!store.fileTreeOpen) {
      store.toggleFileTree();
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <FileTree />
    </div>
  );
}

// ── Mobile Content Area (editor/preview) ──────────────────────────────────
function MobileContent() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const settings = useEditorStore((s) => s.settings);

  const scrollingRef = useRef<"editor" | "preview" | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEditorScroll = useCallback((fraction: number) => {
    if (scrollingRef.current === "preview") return;
    scrollingRef.current = "editor";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollingRef.current = null;
    }, 100);
    const previewEl = document.getElementById("sync-preview");
    if (previewEl) {
      const max = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = fraction * max;
    }
  }, []);

  const onPreviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollingRef.current === "editor") return;
    scrollingRef.current = "preview";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollingRef.current = null;
    }, 100);
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const fraction = max > 0 ? el.scrollTop / max : 0;
    const editorScroller = document.querySelector(".cm-scroller") as HTMLElement | null;
    if (editorScroller) {
      const eMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = fraction * eMax;
    }
  }, []);

  const editorStyle: React.CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
  };

  if (!activeTabId) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground text-center">
          <FileText className="h-8 w-8 opacity-40" />
          <p className="text-sm">No file open</p>
          <p className="text-xs text-muted-foreground/60">
            Tap <strong>+</strong> above to create a new file
          </p>
        </div>
      </main>
    );
  }

  if (viewMode === "split") {
    // On mobile, split view stacks vertically
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-background" style={editorStyle}>
        <div className="flex flex-1 flex-col overflow-hidden border-b border-border min-h-0">
          <MarkdownEditor onScroll={onEditorScroll} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden min-h-0">
          <MarkdownPreview id="sync-preview" onScroll={onPreviewScroll} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background" style={editorStyle}>
      {viewMode === "editor" ? <MarkdownEditor /> : <MarkdownPreview />}
    </main>
  );
}

// ── Mobile Export Menu ────────────────────────────────────────────────────
function MobileExportActions() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);

  const exportSingle = () => {
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const blob = new Blob([tab.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab.title;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportZip = async () => {
    if (tabs.length === 0) return;
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    tabs.forEach((tab) => zip.file(tab.title, tab.content));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markup-export.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground"
        >
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportSingle}>
          <Download className="mr-2 h-3.5 w-3.5" /> Export current (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportZip}>
          <FolderArchive className="mr-2 h-3.5 w-3.5" /> Export all (.zip)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main Mobile Layout ────────────────────────────────────────────────────
export function MobileLayout() {
  const [fileTreeOpen, setFileTreeOpen] = useState(false);

  const toggleFileTree = useCallback(() => {
    setFileTreeOpen((prev) => !prev);
  }, []);

  const closeFileTree = useCallback(() => {
    setFileTreeOpen(false);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden mobile-safe-top">
      <ThemeSync />
      <ConvexSync />
      <SpotlightSearch />
      <SettingsPanel />

      {/* Header */}
      <MobileHeader
        onToggleFileTree={toggleFileTree}
        fileTreeOpen={fileTreeOpen}
      />

      {/* View mode toggle + export */}
      <div className="flex items-center justify-between border-b border-border bg-card/50 px-2 py-1 shrink-0">
        <MobileViewToggle />
        <div className="flex items-center gap-0.5">
          <MobileExportActions />
          <InfoButton />
        </div>
      </div>

      {/* Tabs */}
      <MobileTabStrip />

      {/* Editor / Preview content */}
      <MobileContent />

      {/* Bottom formatting toolbar */}
      <div className="mobile-safe-bottom">
        <MobileToolbar />
      </div>

      {/* File tree overlay */}
      <MobileFileTreeOverlay open={fileTreeOpen} onClose={closeFileTree} />
    </div>
  );
}
