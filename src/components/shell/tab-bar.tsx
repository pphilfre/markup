"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X, Download, FolderArchive, Sun, Moon, PenLine, Eye, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore, ViewMode } from "@/lib/store";
import { InfoButton } from "./info-button";

function TabItem({ id, title, isActive }: { id: string; title: string; isActive: boolean }) {
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const renameTab = useEditorStore((s) => s.renameTab);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);

  const displayName = hideMd && title.endsWith(".md") ? title.slice(0, -3) : title;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
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
      renameTab(id, trimmed.endsWith(".md") ? trimmed : trimmed + ".md");
    }
    setEditing(false);
  };

  return (
    <div
      onClick={() => switchTab(id)}
      onDoubleClick={() => {
        setDraft(title);
        setEditing(true);
      }}
      className={cn(
        "group flex h-10 shrink-0 cursor-pointer items-center gap-2 border-r border-border px-4 text-sm transition-colors select-none",
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
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const createTab = useEditorStore((s) => s.createTab);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);

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
    tabs.forEach((tab) => {
      zip.file(tab.title, tab.content);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markup-export.zip";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-10 items-center border-b border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="flex items-center">
          {tabs.map((tab) => (
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

      <div className="flex items-center gap-0.5 mx-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => createTab()}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Tab</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={exportSingle}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export current tab (.md)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={exportZip}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <FolderArchive className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export all tabs (.zip)</TooltipContent>
        </Tooltip>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-border" />

        {/* View mode toggle group */}
        <div className="relative flex items-center rounded-md border border-border bg-muted/50 p-0.5">
          {/* Sliding highlight */}
          <div
            className="absolute top-0.5 bottom-0.5 rounded-sm bg-background shadow-sm transition-transform duration-200 ease-out"
            style={{
              width: "calc(33.333% - 1px)",
              transform: `translateX(${
                viewMode === "editor" ? "0%" : viewMode === "split" ? "100%" : "200%"
              })`,
            }}
          />
          {(
            [
              { mode: "editor" as ViewMode, icon: PenLine, label: "Editor" },
              { mode: "split" as ViewMode, icon: Columns2, label: "Split" },
              { mode: "preview" as ViewMode, icon: Eye, label: "Preview" },
            ] as const
          ).map(({ mode, icon: Icon, label }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    "relative z-10 flex h-5 w-6 items-center justify-center rounded-sm transition-colors",
                    viewMode === mode
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Separator */}
        <div className="mx-1 h-5 w-px bg-border" />

        {/* Theme toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          </TooltipContent>
        </Tooltip>

        {/* Info button */}
        <InfoButton />
      </div>
    </div>
  );
}
