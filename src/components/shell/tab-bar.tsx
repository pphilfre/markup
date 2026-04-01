"use client";

import { useState, useRef, useEffect, useCallback, type WheelEvent } from "react";
import { Plus, X, PenLine, Eye, Columns2, Network, Share2, FileOutput, PenTool, GitBranch, KanbanSquare, ZoomIn, ZoomOut, Layers, Globe, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore, ViewMode } from "@/lib/store";
import { ShareDialog } from "./share-dialog";
import { ExportDialog } from "./export-dialog";
import { PublishDialog } from "./publish-dialog";

function TabItem({ id, title, isActive }: { id: string; title: string; isActive: boolean }) {
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const renameTab = useEditorStore((s) => s.renameTab);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);
  const noteType = useEditorStore((s) => s.tabs.find((t) => t.id === id)?.noteType ?? "note");

  const EXT_MAP = { note: ".md", whiteboard: ".canvas", mindmap: ".mindmap", kanban: ".kanban", pdf: ".pdf" } as const;
  const ext = EXT_MAP[noteType];

  // Strip all known extensions for display
  const stripExt = (t: string) => t.replace(/\.(md|canvas|mindmap|kanban|pdf)$/, "");
  const displayName = hideMd && noteType === "note" ? stripExt(title) : title.replace(/\.(canvas|mindmap|kanban|pdf)$/, "");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stripExt(title));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      // Always preserve the correct extension for the file type
      const base = trimmed.replace(/\.(md|canvas|mindmap|kanban|pdf)$/, "");
      renameTab(id, base + ext);
    }
    setEditing(false);
  };

  return (
    <div
      onClick={() => switchTab(id)}
      onDoubleClick={() => {
        setDraft(stripExt(title));
        setEditing(true);
      }}
      className={cn(
        "group flex h-8 shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-3 text-xs transition-colors select-none",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
      )}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-24 bg-transparent text-sm outline-none border-b border-muted-foreground/40"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="max-w-[120px] truncate">{displayName}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          closeTab(id);
        }}
        className={cn(
          "ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100",
          isActive && "opacity-60"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function TabBar() {
  const tabs = useEditorStore((s) => s.tabs);
  const openTabIds = useEditorStore((s) => s.openTabIds);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setZoomLevel = useEditorStore((s) => s.setZoomLevel);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const [shareOpen, setShareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const tabsScrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Listen for custom events to open share / export dialogs
  useEffect(() => {
    const onShare = () => setShareOpen(true);
    const onExport = () => setExportOpen(true);
    const onPublish = () => setPublishOpen(true);
    document.addEventListener("open-share", onShare);
    document.addEventListener("open-export", onExport);
    document.addEventListener("open-publish", onPublish);
    return () => {
      document.removeEventListener("open-share", onShare);
      document.removeEventListener("open-export", onExport);
      document.removeEventListener("open-publish", onPublish);
    };
  }, []);

  const openTabs = openTabIds.map((id) => tabs.find((t) => t.id === id)).filter(Boolean) as typeof tabs;

  const handleTabsWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    const container = tabsScrollContainerRef.current;
    if (!container) return;

    const viewport = container.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
    if (!viewport) return;
    if (viewport.scrollWidth <= viewport.clientWidth) return;

    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (delta === 0) return;

    viewport.scrollLeft += delta;
    event.preventDefault();
  }, []);

  return (
    <div className="flex h-8 items-center border-b border-border bg-card overflow-hidden">
      <div ref={tabsScrollContainerRef} className="flex-1 min-w-0" onWheel={handleTabsWheel}>
        <ScrollArea className="h-full w-full">
          <div className="flex items-center">
            {openTabs.map((tab) => (
              <TabItem
                key={tab.id}
                id={tab.id}
                title={tab.title}
                isActive={tab.id === activeTabId}
              />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <div className="flex items-center gap-0.5 px-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => requestCreateTab()}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Tab</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExportOpen(true)}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <FileOutput className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShareOpen(true)}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Share2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Share</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setPublishOpen(true)}
              className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Globe className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Publish</TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* View mode groups */}
        <div className="relative flex items-center rounded-md border border-border bg-muted/50 p-px">
          {(viewMode === "editor" || viewMode === "split" || viewMode === "preview" || viewMode === "inline") && (
            <div
              className="absolute top-px bottom-px rounded-sm bg-background shadow-sm transition-transform duration-200 ease-out"
              style={{
                width: "calc(25% - 1px)",
                transform: `translateX(${
                  viewMode === "editor" ? "0%" : viewMode === "split" ? "100%" : viewMode === "preview" ? "200%" : "300%"
                })`,
              }}
            />
          )}
          {([
            { mode: "editor" as ViewMode, icon: PenLine, label: "Editor" },
            { mode: "split" as ViewMode, icon: Columns2, label: "Split" },
            { mode: "preview" as ViewMode, icon: Eye, label: "Preview" },
            { mode: "inline" as ViewMode, icon: Layers, label: "Inline" },
          ] as const).map(({ mode, icon: Icon, label }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "relative z-10 flex h-5 w-5 items-center justify-center rounded-sm transition-colors",
                    viewMode === mode ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="relative flex items-center rounded-md border border-border bg-muted/50 p-px">
          {(viewMode === "graph" || viewMode === "whiteboard" || viewMode === "mindmap" || viewMode === "kanban" || viewMode === "pdf") && (
            <div
              className="absolute top-px bottom-px rounded-sm bg-background shadow-sm transition-transform duration-200 ease-out"
              style={{
                width: "calc(20% - 1px)",
                transform: `translateX(${
                  viewMode === "graph" ? "0%" : viewMode === "whiteboard" ? "100%" : viewMode === "mindmap" ? "200%" : viewMode === "kanban" ? "300%" : "400%"
                })`,
              }}
            />
          )}
          {([
            { mode: "graph" as ViewMode, icon: Network, label: "Graph" },
            { mode: "whiteboard" as ViewMode, icon: PenTool, label: "Whiteboard" },
            { mode: "mindmap" as ViewMode, icon: GitBranch, label: "Mindmap" },
            { mode: "kanban" as ViewMode, icon: KanbanSquare, label: "Kanban" },
            { mode: "pdf" as ViewMode, icon: FileText, label: "PDF" },
          ] as const).map(({ mode, icon: Icon, label }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "relative z-10 flex h-5 w-5 items-center justify-center rounded-sm transition-colors",
                    viewMode === mode ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-2.5 w-2.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Global zoom controls */}
        <div className="flex items-center gap-0.5 px-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomLevel(zoomLevel - 10)}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out (Ctrl+-)</TooltipContent>
          </Tooltip>
          <span className="text-[10px] text-muted-foreground w-10 text-center tabular-nums">
            {zoomLevel}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoomLevel(zoomLevel + 10)}
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in (Ctrl+=)</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
