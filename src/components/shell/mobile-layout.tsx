"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileText,
  Plus,
  X,
  Download,
  FolderArchive,
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
  Menu,
  Search,
  LogOut,
  Network,
  PenTool,
  GitBranch,
  KanbanSquare,
  FileType,
  MoreHorizontal,
  Layers,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditorStore, ViewMode } from "@/lib/store";
import { InlineMarkdownEditor, MarkdownEditor, MarkdownPreview } from "@/components/editor";
import { FileTree } from "@/components/shell/file-tree";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { SettingsPanel } from "@/components/shell/settings-panel";
import { PublishDialog } from "@/components/shell/publish-dialog";
import { ThemeSync } from "@/components/theme-provider";
import { ConvexSync } from "@/lib/convex-sync";
import { GraphView } from "@/components/shell/graph-view";
import { WhiteboardView } from "@/components/shell/whiteboard";
import { MindmapView } from "@/components/shell/mindmap";
import { KanbanView } from "@/components/shell/kanban";
import { PdfEditorView } from "@/components/shell/pdf-editor";
import { NewFileTemplateDialog } from "@/components/shell/new-file-template-dialog";
import { FirstRunDialog } from "@/components/shell/first-run-dialog";
import { useAuthState } from "@/components/convex-client-provider";
import { signIn, signOut } from "@/lib/tauri";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Mobile Navigation Bar (Apple-style top bar) ───────────────────────────
function MobileNavBar({
  onToggleFileTree,
  fileTreeOpen,
}: {
  onToggleFileTree: () => void;
  fileTreeOpen: boolean;
}) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);
  const { isAuthenticated, isLoading: authLoading } = useAuthState();

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const renameTab = useEditorStore((s) => s.renameTab);
  const displayName = activeTab
    ? hideMd
      ? activeTab.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "")
      : activeTab.title
    : "Markup";

  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingName]);

  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && activeTab) {
      const ext =
        activeTab.noteType === "whiteboard"
          ? ".canvas"
          : activeTab.noteType === "mindmap"
          ? ".mindmap"
          : activeTab.noteType === "kanban"
          ? ".kanban"
          : activeTab.noteType === "pdf"
          ? ".pdf"
          : ".md";
      const base = trimmed.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
      renameTab(activeTab.id, `${base}${ext}`);
    }
    setEditingName(false);
  };

  return (
    <div className="flex h-[44px] items-center border-b border-border bg-card/95 backdrop-blur-md px-1.5 gap-0.5 shrink-0">
      {/* Left: File tree toggle */}
      <button
        onClick={onToggleFileTree}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-muted/60 transition-colors"
      >
        {fileTreeOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Center: Active file name — double-click/tap to rename */}
      <div
        className="flex-1 min-w-0 px-1 text-left"
        onDoubleClick={() => {
          if (activeTab) {
            setDraft(activeTab.title);
            setEditingName(true);
          }
        }}
      >
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") setEditingName(false);
            }}
            className="w-full text-left text-[15px] font-semibold bg-transparent outline-none border-b border-primary/50"
          />
        ) : (
          <span className="text-[15px] font-semibold truncate block">{displayName}</span>
        )}
      </div>

      {/* View mode menu */}
      <MobileViewMenu viewMode={viewMode} onSelect={setViewMode} />

      {/* Right: Actions */}
      <button
        onClick={() => document.dispatchEvent(new CustomEvent("open-spotlight"))}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-muted/60 transition-colors"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {!authLoading && (
        isAuthenticated ? (
          <MobileMoreMenu />
        ) : (
          <button
            onClick={() => signIn(() => window.location.reload())}
            className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium bg-primary text-primary-foreground active:opacity-80 transition-opacity"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign in</span>
          </button>
        )
      )}
    </div>
  );
}

// ── More menu (replaces profile dropdown on mobile) ───────────────────────
function MobileMoreMenu() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const { user } = useAuthState();

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
        <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-muted/60 transition-colors">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {user && (
          <>
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}
          className="gap-3 py-2.5"
        >
          <Settings className="h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => document.dispatchEvent(new CustomEvent("open-publish"))}
          className="gap-3 py-2.5"
        >
          <Globe className="h-4 w-4" />
          Publish
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={exportSingle} className="gap-3 py-2.5">
          <Download className="h-4 w-4" />
          Export note (.md)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportZip} className="gap-3 py-2.5">
          <FolderArchive className="h-4 w-4" />
          Export all (.zip)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut(() => window.location.reload())} className="gap-3 py-2.5">
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Mobile Tab Strip ──────────────────────────────────────────────────────
function MobileTabStrip() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);
  const openTabIds = useEditorStore((s) => s.openTabIds);

  const scrollRef = useRef<HTMLDivElement>(null);
  const activeElRef = useRef<HTMLDivElement>(null);

  // Scroll active tab into view
  useEffect(() => {
    if (activeElRef.current) {
      activeElRef.current.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTabId]);

  const openTabs = openTabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter(Boolean) as typeof tabs;

  if (openTabs.length === 0) return null;

  return (
    <div className="flex h-[36px] items-center border-b border-border bg-card/60 shrink-0">
      <div
        ref={scrollRef}
        className="flex flex-1 items-center overflow-x-auto scrollbar-none"
      >
        {openTabs.map((tab) => {
          const name = hideMd ? tab.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "") : tab.title;
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              ref={isActive ? activeElRef : undefined}
              role="tab"
              tabIndex={0}
              onClick={() => switchTab(tab.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") switchTab(tab.id); }}
              className={cn(
                "flex shrink-0 items-center gap-1 px-3 h-[36px] text-[13px] border-r border-border/50 transition-colors select-none",
                isActive
                  ? "bg-background text-foreground font-medium"
                  : "text-muted-foreground active:bg-muted/40"
              )}
            >
              <FileText className="h-3 w-3 shrink-0 opacity-50" />
              <span className="max-w-[90px] truncate">{name}</span>
              {/* Close button — sized for touch (min 44px tap target) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 flex h-7 w-7 items-center justify-center rounded-md active:bg-muted/80 transition-colors"
                aria-label={`Close ${name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={() => requestCreateTab()}
        className="flex h-[36px] w-11 shrink-0 items-center justify-center text-muted-foreground active:bg-muted/60 border-l border-border/50 transition-colors"
        aria-label="New note"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Mobile View Menu (compact, top bar) ──────────────────────────────────
function MobileViewMenu({
  viewMode,
  onSelect,
}: {
  viewMode: ViewMode;
  onSelect: (mode: ViewMode) => void;
}) {
  const options: { mode: ViewMode; icon: typeof PenLine; label: string }[] = [
    { mode: "editor", icon: PenLine, label: "Editor" },
    { mode: "inline", icon: Layers, label: "Inline" },
    { mode: "split", icon: Columns2, label: "Split" },
    { mode: "preview", icon: Eye, label: "Preview" },
    { mode: "graph", icon: Network, label: "Graph" },
    { mode: "whiteboard", icon: PenTool, label: "Whiteboard" },
    { mode: "mindmap", icon: GitBranch, label: "Mindmap" },
    { mode: "kanban", icon: KanbanSquare, label: "Kanban" },
    { mode: "pdf", icon: FileType, label: "PDF" },
  ];

  const active = options.find((o) => o.mode === viewMode) ?? options[0];
  const ActiveIcon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-muted/60 transition-colors"
          aria-label="Change view mode"
        >
          <ActiveIcon className="h-[18px] w-[18px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {options.map(({ mode, icon: Icon, label }) => (
          <DropdownMenuItem
            key={mode}
            onClick={() => onSelect(mode)}
            className={cn("gap-2.5", viewMode === mode && "bg-accent")}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Apple-style Formatting Toolbar (sits above keyboard) ──────────────────
function MobileFormattingBar({ placement = "bottom" }: { placement?: "top" | "bottom" }) {
  const viewMode = useEditorStore((s) => s.viewMode);
  const insertLinePrefix = useEditorStore((s) => s.insertLinePrefix);
  const insertSnippet = useEditorStore((s) => s.insertSnippet);
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const [headingOpen, setHeadingOpen] = useState(false);

  // Only show for editor modes
  if (viewMode !== "editor" && viewMode !== "split" && viewMode !== "inline") return null;

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
    <div
      className={cn(
        "flex items-center h-[44px] bg-card/95 backdrop-blur-md shrink-0",
        placement === "top" ? "border-b border-border" : "border-t border-border"
      )}
    >
      {/* Heading dropdown */}
      <DropdownMenu open={headingOpen} onOpenChange={setHeadingOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex h-[44px] w-11 shrink-0 items-center justify-center text-muted-foreground active:bg-muted/60 transition-colors">
            <Heading className="h-[18px] w-[18px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side={placement === "top" ? "bottom" : "top"} align="start" className="min-w-[120px]">
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <DropdownMenuItem
              key={level}
              onClick={() => insertLinePrefix("#".repeat(level) + " ")}
              className="gap-2 py-2"
            >
              <span className="font-semibold" style={{ fontSize: `${1.3 - level * 0.1}em` }}>
                H{level}
              </span>
              <span className="text-muted-foreground text-xs ml-auto">{"#".repeat(level)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Divider */}
      <div className="h-5 w-px bg-border/50 shrink-0" />

      {/* Scrollable formatting tools */}
      <div className="flex flex-1 items-center overflow-x-auto scrollbar-none">
        {tools.map(({ icon: Icon, action, label }) => (
          <button
            key={label}
            onClick={action}
            className="flex h-[44px] w-11 shrink-0 items-center justify-center text-muted-foreground active:bg-muted/60 transition-colors"
            aria-label={label}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>

      {/* Settings shortcut */}
      <div className="h-5 w-px bg-border/50 shrink-0" />
      <button
        onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}
        className="flex h-[44px] w-11 shrink-0 items-center justify-center text-muted-foreground active:bg-muted/60 transition-colors"
      >
        <Settings className="h-[18px] w-[18px]" />
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
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const prevTabRef = useRef(activeTabId);

  // Close file tree when a tab is switched (user tapped a file)
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
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}
      {/* Sliding panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[340px] max-w-[92vw] bg-card border-r border-border shadow-2xl transition-transform duration-250 ease-out mobile-file-tree",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <MobileFileTreeContent onClose={onClose} />
      </div>
    </>
  );
}

function MobileFileTreeContent({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const store = useEditorStore.getState();
    if (!store.fileTreeOpen) {
      store.toggleFileTree();
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <FileTree mobile onMobileClose={onClose} />
      </div>
    </div>
  );
}

// ── Mobile Content Area ───────────────────────────────────────────────────
function MobileContent() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
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
      <main className="flex flex-1 items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center gap-4 text-muted-foreground text-center">
          <FileText className="h-10 w-10 opacity-30" />
          <div>
            <p className="text-[15px] font-medium mb-1">No file open</p>
            <p className="text-[13px] text-muted-foreground/60">
              Tap <strong>+</strong> to create a new note
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Canvas-based views — fill the space, their own toolbars are repositioned via CSS
  if (viewMode === "graph") {
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-background mobile-canvas-view">
        <GraphView />
      </main>
    );
  }

  if (viewMode === "whiteboard") {
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-background mobile-canvas-view">
        <WhiteboardView />
      </main>
    );
  }

  if (viewMode === "mindmap") {
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-background mobile-canvas-view">
        <MindmapView />
      </main>
    );
  }

  if (viewMode === "kanban" || activeTab?.noteType === "kanban") {
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-background mobile-canvas-view">
        <KanbanView />
      </main>
    );
  }

  if (viewMode === "pdf" || activeTab?.noteType === "pdf") {
    return (
      <main className="flex flex-1 flex-col overflow-hidden bg-background mobile-canvas-view">
        <PdfEditorView />
      </main>
    );
  }

  if (viewMode === "split") {
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
      {viewMode === "editor" ? <MarkdownEditor /> : viewMode === "inline" ? <InlineMarkdownEditor /> : <MarkdownPreview />}
    </main>
  );
}

// ── Main Mobile Layout ────────────────────────────────────────────────────
export function MobileLayout() {
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const viewMode = useEditorStore((s) => s.viewMode);
  const isCanvasView = viewMode === "graph" || viewMode === "whiteboard" || viewMode === "mindmap" || viewMode === "kanban" || viewMode === "pdf";
  const supportsFormattingBar = viewMode === "editor" || viewMode === "split" || viewMode === "inline";

  const toggleFileTree = useCallback(() => {
    setFileTreeOpen((prev) => !prev);
  }, []);

  const closeFileTree = useCallback(() => {
    setFileTreeOpen(false);
  }, []);

  useEffect(() => {
    const onPublish = () => setPublishOpen(true);
    document.addEventListener("open-publish", onPublish);
    return () => document.removeEventListener("open-publish", onPublish);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const checkKeyboard = () => {
      const viewportDiff = window.innerHeight - vv.height;
      setKeyboardOpen(viewportDiff > 120);
    };

    checkKeyboard();
    vv.addEventListener("resize", checkKeyboard);
    vv.addEventListener("scroll", checkKeyboard);
    window.addEventListener("orientationchange", checkKeyboard);
    return () => {
      vv.removeEventListener("resize", checkKeyboard);
      vv.removeEventListener("scroll", checkKeyboard);
      window.removeEventListener("orientationchange", checkKeyboard);
    };
  }, []);

  const showTopFormattingBar = keyboardOpen && supportsFormattingBar;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden mobile-safe-top mobile-root">
      <ThemeSync />
      <ConvexSync />
      <SpotlightSearch />
      <SettingsPanel />
      <FirstRunDialog />
      <NewFileTemplateDialog />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />

      {/* Keep formatting controls reachable while typing on mobile keyboards */}
      {showTopFormattingBar && <MobileFormattingBar placement="top" />}

      {/* Top navigation bar */}
      <MobileNavBar
        onToggleFileTree={toggleFileTree}
        fileTreeOpen={fileTreeOpen}
      />

      {/* Tab strip — hide in canvas modes for more room */}
      {!isCanvasView && <MobileTabStrip />}

      {/* Main content */}
      <MobileContent />

      {/* Bottom formatting toolbar — only visible in editor modes */}
      {!showTopFormattingBar && (
        <div className="mobile-safe-bottom">
          <MobileFormattingBar placement="bottom" />
        </div>
      )}

      {/* File tree overlay */}
      <MobileFileTreeOverlay open={fileTreeOpen} onClose={closeFileTree} />
    </div>
  );
}
