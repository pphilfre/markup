"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderClosed,
  FileText,
  Plus,
  FolderPlus,
  Download,
  Trash2,
  Palette,
  Pencil,
  PanelLeftClose,
  PanelLeft,
  Tag,
  ChevronsDownUp,
  ChevronsUpDown,
  ArrowDownAZ,
  ArrowUpZA,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEditorStore, Folder, Tab } from "@/lib/store";

const FOLDER_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

// ── Inline rename input ───────────────────────────────────────────────────
function InlineRename({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const t = value.trim();
    if (t) onCommit(t);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
      }}
      className="w-full bg-transparent text-xs outline-none border-b border-primary/50 py-0.5"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

// ── Color picker popover ──────────────────────────────────────────────────
function ColorPicker({
  current,
  onPick,
  children,
}: {
  current: string;
  onPick: (color: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {FOLDER_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                current === c ? "border-foreground" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Folder item ───────────────────────────────────────────────────────────
function FolderItem({
  folder,
  tabs,
  expandedFolders,
  toggleExpand,
  hideMd,
  sortAsc,
}: {
  folder: Folder;
  tabs: Tab[];
  expandedFolders: Set<string>;
  toggleExpand: (id: string) => void;
  hideMd: boolean;
  sortAsc: boolean | null;
}) {
  const [renaming, setRenaming] = useState(false);
  const renameFolder = useEditorStore((s) => s.renameFolder);
  const colorFolder = useEditorStore((s) => s.colorFolder);
  const deleteFolder = useEditorStore((s) => s.deleteFolder);
  const createTab = useEditorStore((s) => s.createTab);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const moveTabToFolder = useEditorStore((s) => s.moveTabToFolder);
  const activeTabId = useEditorStore((s) => s.activeTabId);

  const expanded = expandedFolders.has(folder.id);
  let folderTabs = tabs.filter((t) => t.folderId === folder.id);

  // Sort
  if (sortAsc === true) folderTabs = [...folderTabs].sort((a, b) => a.title.localeCompare(b.title));
  else if (sortAsc === false) folderTabs = [...folderTabs].sort((a, b) => b.title.localeCompare(a.title));

  const exportFolder = () => {
    folderTabs.forEach((tab) => {
      const blob = new Blob([tab.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = tab.title;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Drag-drop: accept files dragged onto folder
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tabId = e.dataTransfer.getData("text/tab-id");
    if (tabId) {
      moveTabToFolder(tabId, folder.id);
      if (!expandedFolders.has(folder.id)) toggleExpand(folder.id);
    }
  };

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button
            onClick={() => toggleExpand(folder.id)}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            {/* Clickable colour dot */}
            <ColorPicker
              current={folder.color}
              onPick={(c) => colorFolder(folder.id, c)}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0 cursor-pointer hover:scale-125 transition-transform"
                style={{ background: folder.color }}
                onClick={(e) => e.stopPropagation()}
              />
            </ColorPicker>
            {renaming ? (
              <InlineRename
                initial={folder.name}
                onCommit={(v) => {
                  renameFolder(folder.id, v);
                  setRenaming(false);
                }}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <span className="truncate">{folder.name}</span>
            )}
            <span className="ml-auto text-[10px] text-muted-foreground/50">
              {folderTabs.length}
            </span>
          </button>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => createTab(folder.id)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
          </ContextMenuItem>
          <ContextMenuItem
            onClick={(e) => {
              // We use the color picker via the dot now, but keep context option too
              e.preventDefault();
            }}
            asChild
          >
            <ColorPicker
              current={folder.color}
              onPick={(c) => colorFolder(folder.id, c)}
            >
              <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                <Palette className="h-3.5 w-3.5" />
                <span>Color</span>
              </div>
            </ColorPicker>
          </ContextMenuItem>
          <ContextMenuItem onClick={exportFolder}>
            <Download className="mr-2 h-3.5 w-3.5" /> Download All
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => deleteFolder(folder.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Files in folder */}
      {expanded && (
        <div className="ml-4 border-l border-border/50">
          {folderTabs.length === 0 ? (
            <p className="px-3 py-1 text-[10px] text-muted-foreground/50 italic">
              Empty
            </p>
          ) : (
            folderTabs.map((tab) => (
              <FileItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSwitch={() => switchTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                hideMd={hideMd}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── File item ─────────────────────────────────────────────────────────────
function FileItem({
  tab,
  isActive,
  onSwitch,
  onClose,
  hideMd,
}: {
  tab: Tab;
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
  hideMd: boolean;
}) {
  const renameTab = useEditorStore((s) => s.renameTab);
  const addTag = useEditorStore((s) => s.addTag);
  const removeTag = useEditorStore((s) => s.removeTag);
  const getAllTags = useEditorStore((s) => s.getAllTags);
  const [renaming, setRenaming] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);

  const displayName = hideMd && tab.title.endsWith(".md")
    ? tab.title.slice(0, -3)
    : tab.title;

  const exportFile = () => {
    const blob = new Blob([tab.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = tab.title;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Make file draggable
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/tab-id", tab.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const commitTag = () => {
    const t = newTag.trim().toLowerCase();
    if (t) addTag(tab.id, t);
    setNewTag("");
    setAddingTag(false);
  };

  const allTags = getAllTags();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group">
          <button
            onClick={onSwitch}
            draggable
            onDragStart={onDragStart}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-sm px-3 py-1 text-xs transition-colors cursor-grab active:cursor-grabbing",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FileText className="h-3 w-3 shrink-0" />
            {renaming ? (
              <InlineRename
                initial={tab.title}
                onCommit={(v) => {
                  renameTab(tab.id, v.endsWith(".md") ? v : v + ".md");
                  setRenaming(false);
                }}
                onCancel={() => setRenaming(false)}
              />
            ) : (
              <span className="truncate">{displayName}</span>
            )}
          </button>
          {/* Tag chips */}
          {tab.tags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 px-3 pb-0.5">
              {tab.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-sm px-1 py-0 text-[9px] leading-tight"
                  style={{
                    background: "var(--accent-color, #7c3aed)20",
                    color: "var(--accent-color, #7c3aed)",
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => setRenaming(true)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={exportFile}>
          <Download className="mr-2 h-3.5 w-3.5" /> Download
        </ContextMenuItem>
        <ContextMenuSeparator />
        {/* Tag management */}
        <div className="px-2 py-1.5">
          <p className="text-[10px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Tags
          </p>
          <div className="flex flex-wrap gap-1 mb-1">
            {tab.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px]"
                style={{
                  background: "var(--accent-color, #7c3aed)20",
                  color: "var(--accent-color, #7c3aed)",
                }}
              >
                #{tag}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTag(tab.id, tag);
                  }}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          {addingTag ? (
            <input
              ref={tagInputRef}
              autoFocus
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onBlur={commitTag}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTag();
                if (e.key === "Escape") { setNewTag(""); setAddingTag(false); }
                e.stopPropagation();
              }}
              placeholder="tag name"
              className="w-full rounded-sm border border-border bg-background px-1.5 py-0.5 text-[10px] outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAddingTag(true);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add tag
            </button>
          )}
          {/* Quick-add: show existing tags not yet on this file */}
          {allTags.filter((t) => !tab.tags.includes(t)).length > 0 && !addingTag && (
            <div className="mt-1 flex flex-wrap gap-0.5">
              {allTags.filter((t) => !tab.tags.includes(t)).slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    addTag(tab.id, tag);
                  }}
                  className="rounded-sm border border-border px-1 py-0 text-[9px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>
          )}
        </div>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={onClose}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Profile selector ──────────────────────────────────────────────────────
function ProfileSelector() {
  const profiles = useEditorStore((s) => s.profiles);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const createProfile = useEditorStore((s) => s.createProfile);
  const renameProfile = useEditorStore((s) => s.renameProfile);
  const deleteProfile = useEditorStore((s) => s.deleteProfile);
  const switchProfile = useEditorStore((s) => s.switchProfile);

  const active = profiles.find((p) => p.id === activeProfileId);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <User className="h-3 w-3" />
              <span className="max-w-[60px] truncate">{active?.name ?? "Profile"}</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Switch Profile</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {profiles.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => {
              if (renamingId === p.id) return;
              switchProfile(p.id);
            }}
            className={cn(
              "gap-2 text-xs",
              p.id === activeProfileId && "bg-accent"
            )}
          >
            {renamingId === p.id ? (
              <InlineRename
                initial={p.name}
                onCommit={(v) => {
                  renameProfile(p.id, v);
                  setRenamingId(null);
                }}
                onCancel={() => setRenamingId(null)}
              />
            ) : (
              <>
                <span className="flex-1 truncate">{p.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(p.id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {profiles.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProfile(p.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => createProfile("New Profile")}
          className="text-xs"
        >
          <Plus className="mr-2 h-3 w-3" /> New Profile
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Main FileTree component ───────────────────────────────────────────────
export function FileTree() {
  const fileTreeOpen = useEditorStore((s) => s.fileTreeOpen);
  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const tabs = useEditorStore((s) => s.tabs);
  const folders = useEditorStore((s) => s.folders);
  const createFolder = useEditorStore((s) => s.createFolder);
  const createTab = useEditorStore((s) => s.createTab);
  const switchTab = useEditorStore((s) => s.switchTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const moveTabToFolder = useEditorStore((s) => s.moveTabToFolder);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions);

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  // null = no sort, true = A-Z, false = Z-A
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = () => setExpandedFolders(new Set());
  const expandAll = () => setExpandedFolders(new Set(folders.map((f) => f.id)));

  // Root-level tabs (no folder)
  let rootTabs = tabs.filter((t) => !t.folderId);
  if (sortAsc === true) rootTabs = [...rootTabs].sort((a, b) => a.title.localeCompare(b.title));
  else if (sortAsc === false) rootTabs = [...rootTabs].sort((a, b) => b.title.localeCompare(a.title));

  // Drop on root area — move file out of folder
  const onRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tabId = e.dataTransfer.getData("text/tab-id");
    if (tabId) moveTabToFolder(tabId, null);
  };

  // Uncollapse strip when file tree is closed
  if (!fileTreeOpen) {
    return (
      <button
        onClick={toggleFileTree}
        className="flex h-full w-6 flex-col items-center justify-center border-r border-border bg-card hover:bg-muted transition-colors"
        title="Open File Tree (Alt+B)"
      >
        <PanelLeft className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    );
  }

  return (
    <aside className="flex h-full w-52 flex-col border-r border-border bg-card">
      {/* Header row 1: title + main controls */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Files
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => createTab()}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New File</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => createFolder("New Folder")}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">New Folder</TooltipContent>
          </Tooltip>
          {/* Sort A-Z / Z-A */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setSortAsc((prev) =>
                    prev === null ? true : prev === true ? false : null
                  )
                }
                className={cn(
                  "h-6 w-6 text-muted-foreground hover:text-foreground",
                  sortAsc !== null && "text-foreground"
                )}
              >
                {sortAsc === false ? (
                  <ArrowUpZA className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownAZ className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sortAsc === null ? "Sort A→Z" : sortAsc ? "Sort Z→A" : "Unsort"}
            </TooltipContent>
          </Tooltip>
          {/* Collapse / Expand all */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={expandedFolders.size > 0 ? collapseAll : expandAll}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                {expandedFolders.size > 0 ? (
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {expandedFolders.size > 0 ? "Collapse All" : "Expand All"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFileTree}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Close Sidebar <kbd className="ml-1 text-[10px] opacity-60">Alt+B</kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Header row 2: profile selector */}
      <div className="flex items-center px-2 py-1 border-b border-border/50">
        <ProfileSelector />
      </div>

      {/* Tree content — right-click context menu on empty space */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 overflow-y-auto px-1 py-1"
            onDragOver={onRootDragOver}
            onDrop={onRootDrop}
          >
            {/* Folders */}
            {folders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                tabs={tabs}
                expandedFolders={expandedFolders}
                toggleExpand={toggleExpand}
                hideMd={hideMd}
                sortAsc={sortAsc}
              />
            ))}

            {/* Root files (no folder) */}
            {folders.length > 0 && rootTabs.length > 0 && (
              <div className="mt-1 pt-1 border-t border-border/50">
                <p className="px-2 py-0.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                  Unsorted
                </p>
              </div>
            )}
            {rootTabs.map((tab) => (
              <FileItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSwitch={() => switchTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                hideMd={hideMd}
              />
            ))}

            {tabs.length === 0 && (
              <p className="px-3 py-4 text-center text-[10px] text-muted-foreground/50">
                No files yet
              </p>
            )}

            {/* Spacer to ensure there's droppable area */}
            <div className="min-h-[40px]" />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => createTab()}>
            <Plus className="mr-2 h-3.5 w-3.5" /> New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createFolder("New Folder")}>
            <FolderPlus className="mr-2 h-3.5 w-3.5" /> New Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </aside>
  );
}
