"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
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
  Pin,
  PinOff,
  Filter,
  X,
  Share2,
  FileOutput,
  PenTool,
  GitBranch,
  KanbanSquare,
  FileType,
  Search,
  Layers,
  MoreHorizontal,
  CloudUpload,
  HardDrive,
  Briefcase,
  GraduationCap,
  SlidersHorizontal,
  icons,
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/tauri";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTabWorkspaceId, useEditorStore, Folder, Tab, WORKSPACE_PRESETS, type WorkspacePresetId, type Settings as WorkspaceSettings } from "@/lib/store";

const TAG_PALETTE = [
  "#7c3aed", "#6366f1", "#ec4899", "#f43f5e",
  "#f97316", "#22c55e", "#06b6d4", "#3b82f6",
];

const FOLDER_PALETTE = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

const ICON_COLOR_PALETTE = [
  "#7c3aed", "#6366f1", "#3b82f6", "#06b6d4",
  "#22c55e", "#eab308", "#f97316", "#f43f5e",
  "#ec4899", "#a1a1aa",
];

const WORKSPACE_COLOR_PALETTE = [
  "#7c3aed", "#0f766e", "#2563eb", "#f97316", "#ec4899", "#06b6d4", "#16a34a", "#dc2626",
];

const PRESET_ICON_BY_ID: Record<WorkspacePresetId, typeof User> = {
  personal: User,
  work: Briefcase,
  school: GraduationCap,
  custom: SlidersHorizontal,
};

const PRESET_THEME_OPTIONS: Array<{ label: string; value: WorkspaceSettings["themeMode"]; swatch: string }> = [
  { label: "Dark", value: "dark", swatch: "#1f2937" },
  { label: "Light", value: "light", swatch: "#f3f4f6" },
  { label: "System", value: "system", swatch: "#9ca3af" },
];

// Curated icons for the icon picker
const ICON_CHOICES = [
  "FileText", "PenTool", "GitBranch", "File", "Notebook", "BookOpen",
  "Star", "Heart", "Zap", "Flame", "Rocket", "Target",
  "Lightbulb", "Puzzle", "Code2", "Terminal", "Globe", "Map",
  "Music", "Camera", "Film", "Gamepad2", "Palette", "Brush",
  "Wrench", "Shield", "Lock", "Key", "Bug", "Coffee",
  "Leaf", "Sun", "Moon", "Cloud", "Umbrella", "Snowflake",
  "Bell", "Flag", "Bookmark", "Archive", "Inbox", "Send",
  "Megaphone", "Trophy", "Medal", "Crown", "Diamond", "Gem",
  "Briefcase", "GraduationCap", "Brain", "Dna", "Atom", "Microscope",
  "Plane", "Car", "Bike", "Ship", "Train", "Home",
] as const;

/**
 * Resolves a lucide icon component by its exported icon name.
 */
function getLucideIcon(name?: string): React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null {
  if (!name) return null;
  const icon = (icons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }
  return null;
}

/** Get the default icon for a tab based on its noteType */
function getTabIcon(tab: Tab): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  if (tab.customIcon) {
    const custom = getLucideIcon(tab.customIcon);
    if (custom) return custom;
  }
  if (tab.noteType === "whiteboard") return PenTool;
  if (tab.noteType === "mindmap") return GitBranch;
  if (tab.noteType === "kanban") return KanbanSquare;
  if (tab.noteType === "pdf") return FileType;
  return FileText;
}

/** Get a display-friendly tab title, optionally hiding supported extensions. */
function getDisplayTabName(tab: Tab, hideMd: boolean): string {
  const hasSupportedExtension = tab.title.endsWith(".md")
    || tab.title.endsWith(".canvas")
    || tab.title.endsWith(".mindmap")
    || tab.title.endsWith(".kanban")
    || tab.title.endsWith(".pdf");

  if (!hideMd || !hasSupportedExtension) {
    return tab.title;
  }

  return tab.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/, "");
}

/** Map note type to its canonical file extension. */
function getExpectedTabExtension(tab: Tab): string {
  if (tab.noteType === "whiteboard") return ".canvas";
  if (tab.noteType === "mindmap") return ".mindmap";
  if (tab.noteType === "kanban") return ".kanban";
  if (tab.noteType === "pdf") return ".pdf";
  return ".md";
}

/** Download text content in browsers using an object URL. */
function downloadTabContent(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown" });
  const objectUrl = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = objectUrl;
  downloadLink.download = fileName;
  downloadLink.click();
  URL.revokeObjectURL(objectUrl);
}

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

  function commitRename() {
    const trimmedValue = value.trim();
    if (trimmedValue) onCommit(trimmedValue);
    else onCancel();
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === "Enter") commitRename();
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
  modal,
}: {
  current: string;
  onPick: (color: string) => void;
  children: React.ReactNode;
  modal?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-auto p-2" onPointerDownOutside={(e) => { if (modal) e.preventDefault(); }}>
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

// ── Icon picker popover ───────────────────────────────────────────────────
function IconPickerPopover({
  tab,
  children,
}: {
  tab: Tab;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const setTabIcon = useEditorStore((s) => s.setTabIcon);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  const filtered = search
    ? ICON_CHOICES.filter((name) => name.toLowerCase().includes(search.toLowerCase()))
    : ICON_CHOICES;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }} modal>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-64 p-2" onPointerDownOutside={(e) => e.preventDefault()}>
        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons…"
              className="w-full rounded-md border border-input bg-background pl-7 pr-2 py-1 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {/* Color swatches */}
          <div className="flex flex-wrap gap-1">
            {ICON_COLOR_PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => setTabIcon(tab.id, tab.customIcon, c)}
                className={cn(
                  "h-4 w-4 rounded-full border-2 transition-transform hover:scale-110",
                  tab.iconColor === c ? "border-foreground" : "border-transparent"
                )}
                style={{ background: c }}
              />
            ))}
            {tab.iconColor && (
              <button
                onClick={() => setTabIcon(tab.id, tab.customIcon)}
                className="h-4 w-4 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                title="Reset color"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
          {/* Icon grid */}
          <div className="grid grid-cols-8 gap-1 max-h-40 overflow-y-auto">
            {filtered.map((name) => {
              const Icon = getLucideIcon(name);
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  onClick={() => {
                    setTabIcon(tab.id, name, tab.iconColor);
                    setOpen(false);
                    setSearch("");
                  }}
                  title={name}
                  className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition-colors",
                    tab.customIcon === name && "bg-accent text-accent-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-8 text-center text-[10px] text-muted-foreground py-2">No icons found</p>
            )}
          </div>
          {/* Reset */}
          {tab.customIcon && (
            <button
              onClick={() => {
                setTabIcon(tab.id);
                setOpen(false);
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset to default
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FolderHeaderButton({
  folder,
  expanded,
  depth,
  mobile,
  mobileDraggingTabId,
  renaming,
  folderTabCount,
  onHeaderClick,
  onDragStart,
  onDragOver,
  onDrop,
  onColorPick,
  onRenameCommit,
  onRenameCancel,
}: {
  folder: Folder;
  expanded: boolean;
  depth: number;
  mobile?: boolean;
  mobileDraggingTabId?: string | null;
  renaming: boolean;
  folderTabCount: number;
  onHeaderClick: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onColorPick: (color: string) => void;
  onRenameCommit: (nextName: string) => void;
  onRenameCancel: () => void;
}) {
  return (
    <button
      onClick={onHeaderClick}
      draggable={!mobile}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-sm pr-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group",
        mobile ? "py-2 text-[13px]" : "py-1 text-xs",
        mobile && mobileDraggingTabId && "border border-dashed border-primary/50 bg-primary/5 text-foreground"
      )}
      style={{ paddingLeft: (mobile ? 10 : 8) + depth * (mobile ? 14 : 12) }}
    >
      {expanded ? (
        <ChevronDown className={cn("shrink-0", mobile ? "h-4 w-4" : "h-3 w-3")} />
      ) : (
        <ChevronRight className={cn("shrink-0", mobile ? "h-4 w-4" : "h-3 w-3")} />
      )}
      <ColorPicker current={folder.color} onPick={onColorPick}>
        <span
          className={cn("rounded-sm shrink-0 cursor-pointer hover:scale-125 transition-transform", mobile ? "h-3.5 w-3.5" : "h-2.5 w-2.5")}
          style={{ background: folder.color }}
          onClick={(event) => event.stopPropagation()}
        />
      </ColorPicker>
      {renaming ? (
        <InlineRename
          initial={folder.name}
          onCommit={onRenameCommit}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className="truncate">{folder.name}</span>
      )}
      <span className="ml-auto text-[10px] text-muted-foreground/50">
        {folderTabCount}
      </span>
    </button>
  );
}

// ── Folder item ───────────────────────────────────────────────────────────
function FolderItem({
  folder,
  tabs,
  childFolders,
  expandedFolders,
  toggleExpand,
  hideMd,
  sortAsc,
  sortByType,
  tabFilter,
  depth,
  renderFolder,
  mobile,
  mobileDraggingTabId,
  onStartMobileDrag,
  onMobileDropTab,
}: {
  folder: Folder;
  tabs: Tab[];
  childFolders: Folder[];
  expandedFolders: Set<string>;
  toggleExpand: (id: string) => void;
  hideMd: boolean;
  sortAsc: boolean | null;
  sortByType: boolean;
  tabFilter?: (tab: Tab) => boolean;
  depth: number;
  renderFolder: (folder: Folder, depth: number) => React.ReactNode;
  mobile?: boolean;
  mobileDraggingTabId?: string | null;
  onStartMobileDrag?: (tabId: string) => void;
  onMobileDropTab?: (folderId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const renameFolder = useEditorStore((s) => s.renameFolder);
  const colorFolder = useEditorStore((s) => s.colorFolder);
  const deleteFolder = useEditorStore((s) => s.deleteFolder);
  const createFolder = useEditorStore((s) => s.createFolder);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const createKanban = useEditorStore((s) => s.createKanban);
  const createPdf = useEditorStore((s) => s.createPdf);
  const switchTab = useEditorStore((s) => s.switchTab);
  const deleteTab = useEditorStore((s) => s.deleteTab);
  const moveTabToFolder = useEditorStore((s) => s.moveTabToFolder);
  const reorderFolder = useEditorStore((s) => s.reorderFolder);
  const activeTabId = useEditorStore((s) => s.activeTabId);

  const expanded = expandedFolders.has(folder.id);
  let folderTabs = tabs.filter((t) => t.folderId === folder.id && (!tabFilter || tabFilter(t)));

  // Sort
  if (sortByType) folderTabs = [...folderTabs].sort((a, b) => (a.noteType ?? "note").localeCompare(b.noteType ?? "note"));
  if (sortAsc === true) folderTabs = [...folderTabs].sort((a, b) => a.title.localeCompare(b.title));
  else if (sortAsc === false) folderTabs = [...folderTabs].sort((a, b) => b.title.localeCompare(a.title));

  async function exportFolder() {
    if (isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const dirPath = await open({ directory: true, title: "Choose folder to save files" });
        if (dirPath) {
          for (const tab of folderTabs) {
            await writeTextFile(`${dirPath}/${tab.title}`, tab.content);
          }
        }
        return;
      } catch {
        // Fall through to web download
      }
    }
    folderTabs.forEach((tab) => {
      downloadTabContent(tab.title, tab.content);
    });
  }

  // Drag-drop: accept files dragged onto folder
  function onFolderDragStart(e: React.DragEvent) {
    if (mobile) return;
    e.dataTransfer.setData("text/folder-id", folder.id);
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    const draggedFolderId = e.dataTransfer.getData("text/folder-id");
    if (draggedFolderId) {
      if (draggedFolderId !== folder.id) {
        reorderFolder(draggedFolderId, folder.id);
      }
      return;
    }

    const tabId = e.dataTransfer.getData("text/tab-id");
    if (tabId) {
      moveTabToFolder(tabId, folder.id);
      if (!expandedFolders.has(folder.id)) toggleExpand(folder.id);
    }
  }

  function onFolderHeaderClick() {
    if (mobile && mobileDraggingTabId) {
      onMobileDropTab?.(folder.id);
      if (!expandedFolders.has(folder.id)) toggleExpand(folder.id);
      return;
    }
    toggleExpand(folder.id);
  }

  function onFolderRenameCommit(nextName: string) {
    renameFolder(folder.id, nextName);
    setRenaming(false);
  }

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <FolderHeaderButton
            folder={folder}
            expanded={expanded}
            depth={depth}
            mobile={mobile}
            mobileDraggingTabId={mobileDraggingTabId}
            renaming={renaming}
            folderTabCount={folderTabs.length}
            onHeaderClick={onFolderHeaderClick}
            onDragStart={onFolderDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onColorPick={(color) => colorFolder(folder.id, color)}
            onRenameCommit={onFolderRenameCommit}
            onRenameCancel={() => setRenaming(false)}
          />
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => requestCreateTab(folder.id)}>
            <Plus className="mr-2 h-3.5 w-3.5" /> New File
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              createFolder("New Folder", folder.id);
              if (!expandedFolders.has(folder.id)) toggleExpand(folder.id);
            }}
          >
            <FolderPlus className="mr-2 h-3.5 w-3.5" /> New Subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createWhiteboard(folder.id)}>
            <PenTool className="mr-2 h-3.5 w-3.5" /> New Whiteboard
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createMindmap(folder.id)}>
            <GitBranch className="mr-2 h-3.5 w-3.5" /> New Mindmap
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createKanban(folder.id)}>
            <KanbanSquare className="mr-2 h-3.5 w-3.5" /> New Kanban
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createPdf(folder.id)}>
            <FileType className="mr-2 h-3.5 w-3.5" /> New PDF
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
              modal
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
        <div className="border-l border-border/50" style={{ marginLeft: 16 + depth * 12 }}>
          {childFolders.map((child) => renderFolder(child, depth + 1))}
          {folderTabs.length === 0 && childFolders.length === 0 ? (
            <p className="px-3 py-1 text-[10px] text-muted-foreground/50 italic">Empty</p>
          ) : (
            folderTabs.map((tab) => (
              <FileItem
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onSwitch={() => switchTab(tab.id)}
                onClose={() => deleteTab(tab.id)}
                hideMd={hideMd}
                mobile={mobile}
                mobileDraggingTabId={mobileDraggingTabId}
                onStartMobileDrag={onStartMobileDrag}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── File item ─────────────────────────────────────────────────────────────
type WorkspaceOption = {
  id: string;
  name: string;
  color: string;
};

function PinToggleMenuLabel({ pinned }: { pinned: boolean }) {
  if (pinned) {
    return <><PinOff className="mr-2 h-3.5 w-3.5" /> Unpin</>;
  }
  return <><Pin className="mr-2 h-3.5 w-3.5" /> Pin to Top</>;
}

function FileItemQuickActions({
  mobile,
  tab,
  allTags,
  profiles,
  currentWorkspaceId,
  addTag,
  moveTabToWorkspace,
  togglePin,
  onStartRename,
  onExportFile,
  onOpenShare,
  onOpenExport,
  onClose,
}: {
  mobile?: boolean;
  tab: Tab;
  allTags: string[];
  profiles: WorkspaceOption[];
  currentWorkspaceId: string;
  addTag: (tabId: string, tag: string) => void;
  moveTabToWorkspace: (tabId: string, workspaceId: string) => void;
  togglePin: (tabId: string) => void;
  onStartRename: () => void;
  onExportFile: () => void;
  onOpenShare: () => void;
  onOpenExport: () => void;
  onClose: () => void;
}) {
  const availableTags = allTags.filter((tagName) => !tab.tags.includes(tagName));

  return (
    <div className={cn("flex items-center shrink-0 transition-opacity", mobile ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
      {!mobile && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              onClick={(event) => event.stopPropagation()}
              className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Quick add tag"
            >
              <Tag className="h-2.5 w-2.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-48 p-2" onPointerDownOutside={(event) => event.stopPropagation()}>
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Add tag</p>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {availableTags.map((tagName) => (
                <button
                  key={tagName}
                  onClick={(event) => {
                    event.stopPropagation();
                    addTag(tab.id, tagName);
                  }}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  +{tagName}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input
                placeholder="New tag…"
                className="flex-1 rounded-sm border border-input bg-background px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    const normalizedTag = (event.target as HTMLInputElement).value.trim().toLowerCase();
                    if (normalizedTag) {
                      addTag(tab.id, normalizedTag);
                      (event.target as HTMLInputElement).value = "";
                    }
                  }
                  event.stopPropagation();
                }}
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </PopoverContent>
        </Popover>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(event) => event.stopPropagation()}
            className={cn(
              "flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
              mobile ? "h-7 w-7" : "h-5 w-5"
            )}
            title="More actions"
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => togglePin(tab.id)}>
            <PinToggleMenuLabel pinned={tab.pinned} />
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStartRename}>
            <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExportFile}>
            <Download className="mr-2 h-3.5 w-3.5" /> Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenShare}>
            <Share2 className="mr-2 h-3.5 w-3.5" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenExport}>
            <FileOutput className="mr-2 h-3.5 w-3.5" /> Export As…
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <User className="mr-2 h-3.5 w-3.5" /> Move to Workspace
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {profiles.map((profile) => (
                <DropdownMenuItem
                  key={profile.id}
                  onClick={() => moveTabToWorkspace(tab.id, profile.id)}
                  className={cn(profile.id === currentWorkspaceId && "bg-accent")}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: profile.color }} />
                  <span>{profile.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onClose}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FileItemContextPanel({
  tab,
  profiles,
  currentWorkspaceId,
  addingTag,
  newTag,
  allTags,
  tagInputRef,
  getTagColor,
  addTag,
  removeTag,
  setTagColor,
  setNewTag,
  setAddingTag,
  commitTag,
  togglePin,
  moveTabToWorkspace,
  onStartRename,
  onExportFile,
  onOpenShare,
  onOpenExport,
  onClose,
}: {
  tab: Tab;
  profiles: WorkspaceOption[];
  currentWorkspaceId: string;
  addingTag: boolean;
  newTag: string;
  allTags: string[];
  tagInputRef: React.RefObject<HTMLInputElement | null>;
  getTagColor: (tag: string) => string;
  addTag: (tabId: string, tag: string) => void;
  removeTag: (tabId: string, tag: string) => void;
  setTagColor: (tag: string, color: string) => void;
  setNewTag: (nextTag: string) => void;
  setAddingTag: (isAdding: boolean) => void;
  commitTag: () => void;
  togglePin: (tabId: string) => void;
  moveTabToWorkspace: (tabId: string, workspaceId: string) => void;
  onStartRename: () => void;
  onExportFile: () => void;
  onOpenShare: () => void;
  onOpenExport: () => void;
  onClose: () => void;
}) {
  const availableTags = allTags.filter((tagName) => !tab.tags.includes(tagName));

  return (
    <ContextMenuContent className="w-52">
      <ContextMenuItem onClick={() => togglePin(tab.id)}>
        <PinToggleMenuLabel pinned={tab.pinned} />
      </ContextMenuItem>
      <ContextMenuItem onClick={onStartRename}>
        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
      </ContextMenuItem>
      <ContextMenuItem onClick={onExportFile}>
        <Download className="mr-2 h-3.5 w-3.5" /> Download
      </ContextMenuItem>
      <ContextMenuItem asChild onSelect={(event) => event.preventDefault()}>
        <IconPickerPopover tab={tab}>
          <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
            <Palette className="h-3.5 w-3.5" />
            <span>Change Icon</span>
          </div>
        </IconPickerPopover>
      </ContextMenuItem>
      <ContextMenuItem onClick={onOpenShare}>
        <Share2 className="mr-2 h-3.5 w-3.5" /> Share
      </ContextMenuItem>
      <ContextMenuItem onClick={onOpenExport}>
        <FileOutput className="mr-2 h-3.5 w-3.5" /> Export As…
      </ContextMenuItem>
      <ContextMenuSeparator />
      <div className="px-2 py-1.5">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Move to Workspace</p>
        <div className="space-y-1">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={(event) => {
                event.stopPropagation();
                moveTabToWorkspace(tab.id, profile.id);
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-left text-xs transition-colors",
                profile.id === currentWorkspaceId
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: profile.color }} />
              <span className="truncate">{profile.name}</span>
            </button>
          ))}
        </div>
      </div>
      <ContextMenuSeparator />
      <div className="px-2 py-1.5" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
          <Tag className="h-3 w-3" /> Tags
        </p>
        <div className="flex flex-wrap gap-1 mb-1.5">
          {tab.tags.map((tagName) => (
            <span
              key={tagName}
              className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs"
              style={{
                background: `${getTagColor(tagName)}20`,
                color: getTagColor(tagName),
              }}
            >
              #{tagName}
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  removeTag(tab.id, tagName);
                }}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                ×
              </button>
              <span className="ml-1 inline-flex gap-0.5">
                {TAG_PALETTE.map((colorOption) => (
                  <button
                    key={colorOption}
                    onClick={(event) => {
                      event.stopPropagation();
                      setTagColor(tagName, colorOption);
                    }}
                    className={cn(
                      "h-2.5 w-2.5 rounded-full border",
                      getTagColor(tagName) === colorOption
                        ? "border-foreground scale-125"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                    style={{ background: colorOption }}
                  />
                ))}
              </span>
            </span>
          ))}
        </div>
        {addingTag ? (
          <input
            ref={tagInputRef}
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
            onBlur={commitTag}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitTag();
              if (event.key === "Escape") {
                setNewTag("");
                setAddingTag(false);
              }
              event.stopPropagation();
            }}
            placeholder="tag name"
            className="w-full rounded-sm border border-border bg-background px-1.5 py-0.5 text-xs outline-none"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <button
            onClick={(event) => {
              event.stopPropagation();
              setAddingTag(true);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            + Add tag
          </button>
        )}
        {availableTags.length > 0 && !addingTag && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {availableTags.slice(0, 6).map((tagName) => (
              <button
                key={tagName}
                onClick={(event) => {
                  event.stopPropagation();
                  addTag(tab.id, tagName);
                }}
                className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                +{tagName}
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
  );
}

function FileItem({
  tab,
  isActive,
  onSwitch,
  onClose,
  hideMd,
  mobile,
  mobileDraggingTabId,
  onStartMobileDrag,
}: {
  tab: Tab;
  isActive: boolean;
  onSwitch: () => void;
  onClose: () => void;
  hideMd: boolean;
  mobile?: boolean;
  mobileDraggingTabId?: string | null;
  onStartMobileDrag?: (tabId: string) => void;
}) {
  const renameTab = useEditorStore((s) => s.renameTab);
  const switchTab = useEditorStore((s) => s.switchTab);
  const addTag = useEditorStore((s) => s.addTag);
  const removeTag = useEditorStore((s) => s.removeTag);
  const getAllTags = useEditorStore((s) => s.getAllTags);
  const profiles = useEditorStore((s) => s.profiles);
  const moveTabToWorkspace = useEditorStore((s) => s.moveTabToWorkspace);
  const togglePin = useEditorStore((s) => s.togglePin);
  const tagColors = useEditorStore((s) => s.tagColors);
  const setTagColor = useEditorStore((s) => s.setTagColor);
  const getTagColor = useCallback(
    (tag: string) => tagColors[tag] || "#7c3aed",
    [tagColors]
  );
  const [renaming, setRenaming] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const displayName = getDisplayTabName(tab, hideMd);
  const expectedExt = getExpectedTabExtension(tab);
  const currentWorkspaceId = getTabWorkspaceId(tab);

  async function exportFile() {
    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({
          defaultPath: tab.title,
          filters: [{ name: "Files", extensions: [tab.title.split(".").pop() || "md"] }],
        });
        if (filePath) {
          await writeTextFile(filePath, tab.content);
        }
        return;
      } catch {
        // Fall through to web download
      }
    }
    downloadTabContent(tab.title, tab.content);
  }

  // Make file draggable
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/tab-id", tab.id);
    e.dataTransfer.effectAllowed = "move";
  }

  /** Clear any pending long-press timer used for mobile drag start. */
  function clearLongPressTimer() {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  /** Begin touch tracking for long-press drag on mobile. */
  function onTouchStart(e: React.TouchEvent) {
    if (!mobile || !onStartMobileDrag) return;
    if (e.touches.length !== 1) return;
    longPressTriggeredRef.current = false;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onStartMobileDrag(tab.id);
    }, 300);
  }

  /** Cancel long-press drag if touch movement exceeds the threshold. */
  function onTouchMove(e: React.TouchEvent) {
    if (!mobile || !touchStartRef.current || e.touches.length !== 1) return;
    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
    if (dx > 8 || dy > 8) {
      clearLongPressTimer();
    }
  }

  /** Reset touch state once the current touch interaction ends. */
  function onTouchEnd() {
    clearLongPressTimer();
    touchStartRef.current = null;
  }

  /** Commit the currently typed tag and close tag-entry mode. */
  function commitTag() {
    const normalizedTag = newTag.trim().toLowerCase();
    if (normalizedTag) addTag(tab.id, normalizedTag);
    setNewTag("");
    setAddingTag(false);
  }

  function startRename() {
    setRenaming(true);
  }

  function stopRename() {
    setRenaming(false);
  }

  function commitRename(nextTitle: string) {
    const baseTitle = nextTitle.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
    renameTab(tab.id, `${baseTitle}${expectedExt}`);
    setRenaming(false);
  }

  function openShareDialog() {
    switchTab(tab.id);
    document.dispatchEvent(new CustomEvent("open-share"));
  }

  function openExportDialog() {
    switchTab(tab.id);
    document.dispatchEvent(new CustomEvent("open-export"));
  }

  function onPrimaryButtonClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (mobile && longPressTriggeredRef.current) {
      event.preventDefault();
      event.stopPropagation();
      longPressTriggeredRef.current = false;
      return;
    }
    onSwitch();
  }

  useEffect(() => {
    if (addingTag) {
      tagInputRef.current?.focus();
    }
  }, [addingTag]);

  const allTags = getAllTags();
  const TabIcon = getTabIcon(tab);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group">
          <div className="flex w-full items-center">
            <button
              onClick={onPrimaryButtonClick}
              draggable={!mobile}
              onDragStart={onDragStart}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className={cn(
                "flex flex-1 min-w-0 items-center gap-1.5 rounded-sm px-3 transition-colors",
                mobile ? "py-2 text-[13px]" : "py-1 text-xs",
                mobile ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
                mobileDraggingTabId === tab.id && "border border-dashed border-primary/60 bg-primary/10 text-foreground",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <TabIcon className={cn("shrink-0", mobile ? "h-4 w-4" : "h-3 w-3")} style={tab.iconColor ? { color: tab.iconColor } : undefined} />
              {renaming ? (
                <InlineRename
                  initial={tab.title}
                  onCommit={commitRename}
                  onCancel={stopRename}
                />
              ) : (
                <span className="truncate">{displayName}</span>
              )}
              {tab.pinned && (
                <Pin className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
              )}
            </button>
            <FileItemQuickActions
              mobile={mobile}
              tab={tab}
              allTags={allTags}
              profiles={profiles}
              currentWorkspaceId={currentWorkspaceId}
              addTag={addTag}
              moveTabToWorkspace={moveTabToWorkspace}
              togglePin={togglePin}
              onStartRename={startRename}
              onExportFile={exportFile}
              onOpenShare={openShareDialog}
              onOpenExport={openExportDialog}
              onClose={onClose}
            />
          </div>
          {tab.tags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 px-3 pb-0.5">
              {tab.tags.map((tagName) => (
                <span
                  key={tagName}
                  className="inline-flex items-center rounded-sm px-1 py-0 text-[9px] leading-tight"
                  style={{
                    background: `${getTagColor(tagName)}20`,
                    color: getTagColor(tagName),
                  }}
                >
                  #{tagName}
                </span>
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <FileItemContextPanel
        tab={tab}
        profiles={profiles}
        currentWorkspaceId={currentWorkspaceId}
        addingTag={addingTag}
        newTag={newTag}
        allTags={allTags}
        tagInputRef={tagInputRef}
        getTagColor={getTagColor}
        addTag={addTag}
        removeTag={removeTag}
        setTagColor={setTagColor}
        setNewTag={setNewTag}
        setAddingTag={setAddingTag}
        commitTag={commitTag}
        togglePin={togglePin}
        moveTabToWorkspace={moveTabToWorkspace}
        onStartRename={startRename}
        onExportFile={exportFile}
        onOpenShare={openShareDialog}
        onOpenExport={openExportDialog}
        onClose={onClose}
      />
    </ContextMenu>
  );
}

// ── Profile selector ──────────────────────────────────────────────────────
interface WorkspaceDraft {
  name: string;
  color: string;
  preset: WorkspacePresetId;
  copyFromProfileId: string;
  themeMode: WorkspaceSettings["themeMode"];
  fontSize: number;
  lineHeight: number;
  accentColor: string;
  compactMode: boolean;
  spellCheck: boolean;
}

/** Convert workspace draft form state into the persisted settings shape. */
function toWorkspaceSettingsPartial(draft: WorkspaceDraft): Partial<WorkspaceSettings> {
  return {
    themeMode: draft.themeMode,
    fontSize: draft.fontSize,
    lineHeight: draft.lineHeight,
    accentColor: draft.accentColor,
    compactMode: draft.compactMode,
    spellCheck: draft.spellCheck,
  };
}

/** Render editable controls used by the create/edit workspace dialogs. */
function WorkspaceSettingsForm({
  draft,
  profiles,
  onChange,
  allowCopy,
}: {
  draft: WorkspaceDraft;
  profiles: { id: string; name: string }[];
  onChange: (next: WorkspaceDraft) => void;
  allowCopy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Workspace Name</label>
        <input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          placeholder="Workspace name"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Color</label>
        <div className="flex flex-wrap gap-1.5">
          {WORKSPACE_COLOR_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...draft, color })}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                draft.color === color ? "border-foreground" : "border-transparent"
              )}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      {allowCopy && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Duplicate Settings From</label>
          <select
            value={draft.copyFromProfileId}
            onChange={(event) => onChange({ ...draft, copyFromProfileId: event.target.value })}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profile.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Theme</label>
        <div className="grid grid-cols-3 gap-2">
          {PRESET_THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...draft, themeMode: option.value })}
              className={cn(
                "rounded-md border px-2 py-2 text-[11px] font-medium transition-colors",
                draft.themeMode === option.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-input text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="mx-auto mb-1 block h-2.5 w-2.5 rounded-full" style={{ background: option.swatch }} />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Font Size ({draft.fontSize}px)</label>
        <input
          type="range"
          min={12}
          max={22}
          step={1}
          value={draft.fontSize}
          onChange={(event) => onChange({ ...draft, fontSize: Number(event.target.value) })}
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Line Height ({draft.lineHeight.toFixed(1)})</label>
        <input
          type="range"
          min={1.2}
          max={2.2}
          step={0.1}
          value={draft.lineHeight}
          onChange={(event) => onChange({ ...draft, lineHeight: Number(event.target.value) })}
          className="h-1.5 w-full cursor-pointer accent-primary"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Accent Color</label>
        <div className="flex flex-wrap gap-1.5">
          {TAG_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...draft, accentColor: color })}
              className={cn(
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                draft.accentColor === color ? "border-foreground" : "border-transparent"
              )}
              style={{ background: color }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...draft, compactMode: !draft.compactMode })}
          className={cn(
            "rounded-md border px-2 py-1.5 text-xs transition-colors",
            draft.compactMode ? "border-primary bg-primary/10" : "border-input"
          )}
        >
          Compact Mode
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...draft, spellCheck: !draft.spellCheck })}
          className={cn(
            "rounded-md border px-2 py-1.5 text-xs transition-colors",
            draft.spellCheck ? "border-primary bg-primary/10" : "border-input"
          )}
        >
          Spell Check
        </button>
      </div>
    </div>
  );
}

/** Workspace switcher dropdown and workspace create/edit dialog flow. */
function ProfileSelector() {
  const profiles = useEditorStore((s) => s.profiles);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const workspaceSettings = useEditorStore((s) => s.workspaceSettings);
  const createProfile = useEditorStore((s) => s.createProfile);
  const updateProfile = useEditorStore((s) => s.updateProfile);
  const duplicateProfileSettings = useEditorStore((s) => s.duplicateProfileSettings);
  const updateWorkspaceSettings = useEditorStore((s) => s.updateWorkspaceSettings);
  const deleteProfile = useEditorStore((s) => s.deleteProfile);
  const switchProfile = useEditorStore((s) => s.switchProfile);

  const active = profiles.find((p) => p.id === activeProfileId);
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [editWorkspaceId, setEditWorkspaceId] = useState<string | null>(null);

  const buildDraft = useCallback((profileId: string, fallbackName: string, preset: WorkspacePresetId): WorkspaceDraft => {
    const sourceSettings = workspaceSettings[profileId];
    const presetDefaults = WORKSPACE_PRESETS.find((workspacePreset) => workspacePreset.id === preset);
    return {
      name: fallbackName,
      color: presetDefaults?.color ?? "#7c3aed",
      preset,
      copyFromProfileId: profileId,
      themeMode: sourceSettings?.themeMode ?? "dark",
      fontSize: sourceSettings?.fontSize ?? 14,
      lineHeight: sourceSettings?.lineHeight ?? 1.7,
      accentColor: sourceSettings?.accentColor ?? "#7c3aed",
      compactMode: sourceSettings?.compactMode ?? false,
      spellCheck: sourceSettings?.spellCheck ?? true,
    };
  }, [workspaceSettings]);

  const [createDraft, setCreateDraft] = useState<WorkspaceDraft>(() =>
    buildDraft(activeProfileId, "New Workspace", "personal")
  );
  const [editDraft, setEditDraft] = useState<WorkspaceDraft | null>(null);

  const openCreateDialog = useCallback(() => {
    setCreateStep(0);
    setCreateDraft(buildDraft(activeProfileId, "New Workspace", "personal"));
    setCreateOpen(true);
  }, [activeProfileId, buildDraft]);

  const openEditDialog = useCallback((workspaceId: string) => {
    const profile = profiles.find((item) => item.id === workspaceId);
    if (!profile) return;
    const settings = workspaceSettings[workspaceId];
    setEditWorkspaceId(workspaceId);
    setEditDraft({
      name: profile.name,
      color: profile.color,
      preset: profile.preset,
      copyFromProfileId: workspaceId,
      themeMode: settings?.themeMode ?? "dark",
      fontSize: settings?.fontSize ?? 14,
      lineHeight: settings?.lineHeight ?? 1.7,
      accentColor: settings?.accentColor ?? "#7c3aed",
      compactMode: settings?.compactMode ?? false,
      spellCheck: settings?.spellCheck ?? true,
    });
  }, [profiles, workspaceSettings]);

  const submitCreate = useCallback(() => {
    const workspaceId = createProfile({
      name: createDraft.name.trim() || "New Workspace",
      color: createDraft.color,
      preset: createDraft.preset,
      copyFromProfileId: createDraft.copyFromProfileId || undefined,
      settings: toWorkspaceSettingsPartial(createDraft),
    });
    switchProfile(workspaceId);
    setCreateOpen(false);
  }, [createDraft, createProfile, switchProfile]);

  const submitEdit = useCallback(() => {
    if (!editWorkspaceId || !editDraft) return;
    updateProfile(editWorkspaceId, {
      name: editDraft.name.trim() || "Workspace",
      color: editDraft.color,
      preset: editDraft.preset,
    });
    if (editDraft.copyFromProfileId && editDraft.copyFromProfileId !== editWorkspaceId) {
      duplicateProfileSettings(editDraft.copyFromProfileId, editWorkspaceId);
    }
    updateWorkspaceSettings(editWorkspaceId, toWorkspaceSettingsPartial(editDraft));
    setEditWorkspaceId(null);
    setEditDraft(null);
  }, [duplicateProfileSettings, editDraft, editWorkspaceId, updateProfile, updateWorkspaceSettings]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            title="Switch Workspace"
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: active?.color ?? "#7c3aed" }} />
            <span className="max-w-[90px] truncate">{active?.name ?? "Workspace"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          {profiles.map((profile) => {
            return (
              <DropdownMenuItem
                key={profile.id}
                onClick={() => switchProfile(profile.id)}
                className={cn("flex items-center gap-2 text-xs", profile.id === activeProfileId && "bg-accent")}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: profile.color }} />
                <span className="flex-1 truncate">{profile.name}</span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    openEditDialog(profile.id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                  title="Edit workspace"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                {profiles.length > 1 && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteProfile(profile.id);
                    }}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete workspace"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openCreateDialog} className="text-xs">
            <Plus className="mr-2 h-3 w-3" /> New Workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Build a workspace with a preset and settings, similar to first-run setup.
            </DialogDescription>
          </DialogHeader>

          {createStep === 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Choose a preset</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                {WORKSPACE_PRESETS.map((preset) => {
                  const Icon = PRESET_ICON_BY_ID[preset.id];
                  const selected = createDraft.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setCreateDraft({
                        ...createDraft,
                        preset: preset.id,
                        color: preset.color,
                        themeMode: (preset.settings.themeMode as WorkspaceSettings["themeMode"]) ?? createDraft.themeMode,
                        fontSize: preset.settings.fontSize ?? createDraft.fontSize,
                        lineHeight: preset.settings.lineHeight ?? createDraft.lineHeight,
                        accentColor: preset.settings.accentColor ?? createDraft.accentColor,
                        compactMode: preset.settings.compactMode ?? createDraft.compactMode,
                        spellCheck: preset.settings.spellCheck ?? createDraft.spellCheck,
                      })}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors",
                        selected ? "border-primary bg-primary/10" : "border-input hover:border-muted-foreground/40"
                      )}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: preset.color }} />
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{preset.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{preset.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <WorkspaceSettingsForm
              draft={createDraft}
              profiles={profiles}
              onChange={setCreateDraft}
              allowCopy
            />
          )}

          <DialogFooter>
            {createStep > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCreateStep(0)}>Back</Button>
            )}
            {createStep === 0 ? (
              <Button size="sm" onClick={() => setCreateStep(1)}>Next</Button>
            ) : (
              <Button size="sm" onClick={submitCreate}>Create Workspace</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editWorkspaceId && editDraft)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditWorkspaceId(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Workspace Settings</DialogTitle>
            <DialogDescription>
              Edit preset, color, and writing preferences for this workspace.
            </DialogDescription>
          </DialogHeader>

          {editDraft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Preset</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WORKSPACE_PRESETS.map((preset) => {
                    const selected = editDraft.preset === preset.id;
                    const Icon = PRESET_ICON_BY_ID[preset.id];
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setEditDraft({
                          ...editDraft,
                          preset: preset.id,
                          color: preset.color,
                          themeMode: (preset.settings.themeMode as WorkspaceSettings["themeMode"]) ?? editDraft.themeMode,
                          fontSize: preset.settings.fontSize ?? editDraft.fontSize,
                          lineHeight: preset.settings.lineHeight ?? editDraft.lineHeight,
                          accentColor: preset.settings.accentColor ?? editDraft.accentColor,
                          compactMode: preset.settings.compactMode ?? editDraft.compactMode,
                          spellCheck: preset.settings.spellCheck ?? editDraft.spellCheck,
                        })}
                        className={cn(
                          "rounded-md border px-2 py-2 text-xs transition-colors",
                          selected ? "border-primary bg-primary/10" : "border-input"
                        )}
                      >
                        <Icon className="mx-auto mb-1 h-3.5 w-3.5" />
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <WorkspaceSettingsForm
                draft={editDraft}
                profiles={profiles.filter((profile) => profile.id !== editWorkspaceId)}
                onChange={setEditDraft}
                allowCopy={profiles.some((profile) => profile.id !== editWorkspaceId)}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditWorkspaceId(null);
                setEditDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={submitEdit}>
              Save Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Toolbar row for primary file tree actions and sorting/filter toggles. */
function FileTreeToolbar({
  mobile,
  onMobileClose,
  toolbarButtonSize,
  toolbarIconSize,
  requestCreateTab,
  createWhiteboard,
  createMindmap,
  createKanban,
  createPdf,
  createFolder,
  sortAsc,
  setSortAsc,
  sortByType,
  setSortByType,
  expandedCount,
  collapseAll,
  expandAll,
  tagFilterOpen,
  setTagFilterOpen,
  activeTagFilterCount,
  toggleFileTree,
}: {
  mobile?: boolean;
  onMobileClose?: () => void;
  toolbarButtonSize: string;
  toolbarIconSize: string;
  requestCreateTab: (folderId?: string | null) => void;
  createWhiteboard: (folderId?: string | null) => void;
  createMindmap: (folderId?: string | null) => void;
  createKanban: (folderId?: string | null) => void;
  createPdf: (folderId?: string | null) => void;
  createFolder: (name?: string, parentId?: string | null) => void;
  sortAsc: boolean | null;
  setSortAsc: React.Dispatch<React.SetStateAction<boolean | null>>;
  sortByType: boolean;
  setSortByType: React.Dispatch<React.SetStateAction<boolean>>;
  expandedCount: number;
  collapseAll: () => void;
  expandAll: () => void;
  tagFilterOpen: boolean;
  setTagFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  activeTagFilterCount: number;
  toggleFileTree: () => void;
}) {
  return (
    <div className={cn("flex items-center px-2 border-b border-border", mobile ? "py-2 gap-1.5" : "py-1.5 gap-1")}>
      <div className={cn("flex items-center flex-wrap", mobile ? "gap-1" : "gap-0.5")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              title="New…"
              className={cn(toolbarButtonSize, "text-muted-foreground hover:text-foreground")}
            >
              <Plus className={toolbarIconSize} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            <DropdownMenuItem onClick={() => requestCreateTab()}>
              <FileText className="mr-2 h-3.5 w-3.5" /> Note
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createWhiteboard()}>
              <PenTool className="mr-2 h-3.5 w-3.5" /> Whiteboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createMindmap()}>
              <GitBranch className="mr-2 h-3.5 w-3.5" /> Mindmap
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createKanban()}>
              <KanbanSquare className="mr-2 h-3.5 w-3.5" /> Kanban
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => createPdf()}>
              <FileType className="mr-2 h-3.5 w-3.5" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => createFolder("New Folder")}
              className={cn(toolbarButtonSize, "text-muted-foreground hover:text-foreground")}
            >
              <FolderPlus className={toolbarIconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">New Folder</TooltipContent>
        </Tooltip>

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
                toolbarButtonSize,
                "text-muted-foreground hover:text-foreground",
                sortAsc !== null && "text-foreground"
              )}
            >
              {sortAsc === false ? (
                <ArrowUpZA className={toolbarIconSize} />
              ) : (
                <ArrowDownAZ className={toolbarIconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {sortAsc === null ? "Sort A→Z" : sortAsc ? "Sort Z→A" : "Unsort"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSortByType((prev) => !prev)}
              className={cn(
                toolbarButtonSize,
                "text-muted-foreground hover:text-foreground",
                sortByType && "text-foreground"
              )}
            >
              <Layers className={toolbarIconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {sortByType ? "Unsort by type" : "Sort by type"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={expandedCount > 0 ? collapseAll : expandAll}
              className={cn(toolbarButtonSize, "text-muted-foreground hover:text-foreground")}
            >
              {expandedCount > 0 ? (
                <ChevronsDownUp className={toolbarIconSize} />
              ) : (
                <ChevronsUpDown className={toolbarIconSize} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {expandedCount > 0 ? "Collapse All" : "Expand All"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTagFilterOpen((prev) => !prev)}
              className={cn(
                toolbarButtonSize,
                "text-muted-foreground hover:text-foreground",
                (tagFilterOpen || activeTagFilterCount > 0) && "text-foreground"
              )}
            >
              <Tag className={toolbarIconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {tagFilterOpen ? "Hide Tags" : "Filter by Tags"}
            {activeTagFilterCount > 0 && ` (${activeTagFilterCount})`}
          </TooltipContent>
        </Tooltip>

        {!mobile && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFileTree}
                className={cn(toolbarButtonSize, "text-muted-foreground hover:text-foreground")}
              >
                <PanelLeftClose className={toolbarIconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Close Sidebar <kbd className="ml-1 text-[10px] opacity-60">Alt+B</kbd>
            </TooltipContent>
          </Tooltip>
        )}

        {mobile && onMobileClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMobileClose}
            className={cn(toolbarButtonSize, "text-muted-foreground hover:text-foreground")}
          >
            <X className={toolbarIconSize} />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Tag filter panel and active-tag chips shown above the tree. */
function FileTreeTagFilterPanel({
  tagFilterOpen,
  allTags,
  activeTagFilters,
  clearTagFilters,
  toggleTagFilter,
  getTagColor,
}: {
  tagFilterOpen: boolean;
  allTags: string[];
  activeTagFilters: Set<string>;
  clearTagFilters: () => void;
  toggleTagFilter: (tag: string) => void;
  getTagColor: (tag: string) => string;
}) {
  return (
    <>
      {tagFilterOpen && allTags.length > 0 && (
        <div className="px-2 py-1.5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Filter by Tags</p>
            {activeTagFilters.size > 0 && (
              <button
                onClick={clearTagFilters}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTagFilter(tag)}
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[10px] border transition-colors",
                  activeTagFilters.has(tag)
                    ? "border-transparent font-medium"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                style={
                  activeTagFilters.has(tag)
                    ? {
                        background: `${getTagColor(tag)}20`,
                        color: getTagColor(tag),
                      }
                    : undefined
                }
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {!tagFilterOpen && activeTagFilters.size > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-border/50 bg-muted/30">
          <Filter className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
          <div className="flex flex-wrap gap-0.5 flex-1">
            {Array.from(activeTagFilters).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-sm px-1 py-0 text-[9px] leading-tight"
                style={{
                  background: `${getTagColor(tag)}20`,
                  color: getTagColor(tag),
                }}
              >
                #{tag}
                <button onClick={() => toggleTagFilter(tag)} className="opacity-60 hover:opacity-100">×</button>
              </span>
            ))}
          </div>
          <button
            onClick={clearTagFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );
}

/** Root tree panel with context menu, pinned list, folders, and root files. */
function FileTreeRootArea({
  onRootDragOver,
  onRootDrop,
  onlineTabs,
  tabPassesFilter,
  activeTabId,
  switchTab,
  deleteTab,
  hideMd,
  mobile,
  mobileDraggedTabId,
  startMobileDrag,
  dropMobileDraggedTab,
  cancelMobileDrag,
  visibleFoldersByParent,
  renderFolder,
  visibleFolderIds,
  unpinnedRootTabs,
  requestCreateTab,
  createWhiteboard,
  createMindmap,
  createKanban,
  createPdf,
  createFolder,
}: {
  onRootDragOver: (e: React.DragEvent) => void;
  onRootDrop: (e: React.DragEvent) => void;
  onlineTabs: Tab[];
  tabPassesFilter: (tab: Tab) => boolean;
  activeTabId: string | null;
  switchTab: (id: string) => void;
  deleteTab: (id: string) => void;
  hideMd: boolean;
  mobile?: boolean;
  mobileDraggedTabId: string | null;
  startMobileDrag: (tabId: string) => void;
  dropMobileDraggedTab: (folderId: string | null) => void;
  cancelMobileDrag: () => void;
  visibleFoldersByParent: Map<string | null, Folder[]>;
  renderFolder: (folder: Folder, depth: number) => React.ReactNode;
  visibleFolderIds: Set<string>;
  unpinnedRootTabs: Tab[];
  requestCreateTab: (folderId?: string | null) => void;
  createWhiteboard: (folderId?: string | null) => void;
  createMindmap: (folderId?: string | null) => void;
  createKanban: (folderId?: string | null) => void;
  createPdf: (folderId?: string | null) => void;
  createFolder: (name?: string, parentId?: string | null) => void;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="flex-1 overflow-y-auto px-1 py-1"
          onDragOver={onRootDragOver}
          onDrop={onRootDrop}
        >
          {onlineTabs.some((t) => t.pinned && tabPassesFilter(t)) && (
            <div className="mb-1 pb-1 border-b border-border/50">
              <p className="px-2 py-0.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider flex items-center gap-1">
                <Pin className="h-2.5 w-2.5" /> Pinned
              </p>
              {onlineTabs
                .filter((t) => t.pinned && tabPassesFilter(t))
                .map((tab) => (
                  <FileItem
                    key={`pinned-${tab.id}`}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                    onSwitch={() => switchTab(tab.id)}
                    onClose={() => deleteTab(tab.id)}
                    hideMd={hideMd}
                    mobile={mobile}
                    mobileDraggingTabId={mobileDraggedTabId}
                    onStartMobileDrag={startMobileDrag}
                  />
                ))}
            </div>
          )}

          {mobile && mobileDraggedTabId && (
            <div className="mx-1 mb-2 rounded-md border border-dashed border-primary/50 bg-primary/5 p-2">
              <p className="text-[10px] text-muted-foreground mb-1">Move file: tap a folder to drop, or place it in root.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dropMobileDraggedTab(null)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-foreground hover:bg-muted transition-colors"
                >
                  Move to Root
                </button>
                <button
                  onClick={cancelMobileDrag}
                  className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(visibleFoldersByParent.get(null) ?? []).map((folder) => renderFolder(folder, 0))}

          {visibleFolderIds.size > 0 && unpinnedRootTabs.length > 0 && (
            <div className="mt-1 pt-1 border-t border-border/50">
              <p className="px-2 py-0.5 text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Unsorted
              </p>
            </div>
          )}
          {unpinnedRootTabs.map((tab) => (
            <FileItem
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSwitch={() => switchTab(tab.id)}
              onClose={() => deleteTab(tab.id)}
              hideMd={hideMd}
              mobile={mobile}
              mobileDraggingTabId={mobileDraggedTabId}
              onStartMobileDrag={startMobileDrag}
            />
          ))}

          {onlineTabs.length === 0 && (
            <p className="px-3 py-4 text-center text-[10px] text-muted-foreground/50">
              No files yet
            </p>
          )}

          <div className="min-h-[40px]" />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => requestCreateTab()}>
          <Plus className="mr-2 h-3.5 w-3.5" /> New File
        </ContextMenuItem>
        <ContextMenuItem onClick={() => createWhiteboard()}>
          <PenTool className="mr-2 h-3.5 w-3.5" /> New Whiteboard
        </ContextMenuItem>
        <ContextMenuItem onClick={() => createMindmap()}>
          <GitBranch className="mr-2 h-3.5 w-3.5" /> New Mindmap
        </ContextMenuItem>
        <ContextMenuItem onClick={() => createKanban()}>
          <KanbanSquare className="mr-2 h-3.5 w-3.5" /> New Kanban
        </ContextMenuItem>
        <ContextMenuItem onClick={() => createPdf()}>
          <FileType className="mr-2 h-3.5 w-3.5" /> New PDF
        </ContextMenuItem>
        <ContextMenuItem onClick={() => createFolder("New Folder")}>
          <FolderPlus className="mr-2 h-3.5 w-3.5" /> New Folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

/** Local-files drawer shown in Tauri builds. */
function LocalFilesDrawer({
  localDrawerOpen,
  setLocalDrawerOpen,
  localTabs,
  mobile,
  onLocalDrawerResizeMouseDown,
  localDrawerHeight,
  activeTabId,
  switchTab,
  syncLocalTabToOnline,
  profiles,
  moveTabToWorkspace,
  hideMd,
}: {
  localDrawerOpen: boolean;
  setLocalDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  localTabs: Tab[];
  mobile?: boolean;
  onLocalDrawerResizeMouseDown?: (e: React.MouseEvent) => void;
  localDrawerHeight: number;
  activeTabId: string | null;
  switchTab: (id: string) => void;
  syncLocalTabToOnline: (id: string) => void;
  profiles: { id: string; name: string; color: string }[];
  moveTabToWorkspace: (tabId: string, workspaceId: string) => void;
  hideMd: boolean;
}) {
  return (
    <div className="border-t border-border">
      <button
        onClick={() => setLocalDrawerOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
      >
        <HardDrive className="h-3.5 w-3.5" />
        <span className="font-medium">Local</span>
        <span className="ml-auto text-[10px] text-muted-foreground/70">{localTabs.length}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", localDrawerOpen ? "rotate-180" : "")} />
      </button>
      {localDrawerOpen && (
        <div className="border-t border-border/60">
          {!mobile && (
            <button
              type="button"
              onMouseDown={onLocalDrawerResizeMouseDown}
              className="block h-1.5 w-full cursor-row-resize bg-transparent hover:bg-primary/20 active:bg-primary/30 transition-colors"
              aria-label="Resize local files drawer"
            />
          )}
          <div
            className="overflow-y-auto px-1 py-1"
            style={!mobile ? { height: localDrawerHeight } : { maxHeight: 224 }}
          >
            {localTabs.length === 0 ? (
              <p className="px-3 py-3 text-center text-[10px] text-muted-foreground/50">
                No local files
              </p>
            ) : (
              [...localTabs]
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((tab) => {
                  const LocalTabIcon = getTabIcon(tab);
                  return (
                    <div
                      key={`local-${tab.id}`}
                      className={cn(
                        "group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50 transition-colors",
                        tab.id === activeTabId && "bg-accent text-accent-foreground"
                      )}
                    >
                      <button
                        onClick={() => switchTab(tab.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs"
                      >
                        <LocalTabIcon className="h-3.5 w-3.5 shrink-0" style={tab.iconColor ? { color: tab.iconColor } : undefined} />
                        <span className="truncate">{hideMd ? tab.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "") : tab.title}</span>
                      </button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              syncLocalTabToOnline(tab.id);
                            }}
                          >
                            <CloudUpload className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Sync to Online</TooltipContent>
                      </Tooltip>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[170px]">
                          {profiles.map((profile) => (
                            <DropdownMenuItem
                              key={profile.id}
                              onClick={() => moveTabToWorkspace(tab.id, profile.id)}
                              className={cn(profile.id === getTabWorkspaceId(tab) && "bg-accent")}
                            >
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: profile.color }} />
                              <span className="truncate">Move to {profile.name}</span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main FileTree component ───────────────────────────────────────────────
export function FileTree({ mobile, onMobileClose }: { mobile?: boolean; onMobileClose?: () => void } = {}) {
  const fileTreeOpen = useEditorStore((s) => s.fileTreeOpen);
  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const fileTreeWidth = useEditorStore((s) => s.settings.fileTreeWidth);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const tabs = useEditorStore((s) => s.tabs);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const folders = useEditorStore((s) => s.folders);
  const createFolder = useEditorStore((s) => s.createFolder);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const createKanban = useEditorStore((s) => s.createKanban);
  const createPdf = useEditorStore((s) => s.createPdf);
  const switchTab = useEditorStore((s) => s.switchTab);
  const deleteTab = useEditorStore((s) => s.deleteTab);
  const syncLocalTabToOnline = useEditorStore((s) => s.syncLocalTabToOnline);
  const moveTabToFolder = useEditorStore((s) => s.moveTabToFolder);
  const moveTabToWorkspace = useEditorStore((s) => s.moveTabToWorkspace);
  const moveFolderToParent = useEditorStore((s) => s.moveFolderToParent);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const profiles = useEditorStore((s) => s.profiles);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions || !s.settings.showFileExtensions);
  const getAllTags = useEditorStore((s) => s.getAllTags);
  const tagColors = useEditorStore((s) => s.tagColors);

  const onlineTabs = useMemo(
    () => tabs.filter((t) => t.origin !== "local" && getTabWorkspaceId(t) === activeProfileId),
    [tabs, activeProfileId]
  );
  const localTabs = useMemo(
    () => tabs.filter((t) => t.origin === "local" && getTabWorkspaceId(t) === activeProfileId),
    [tabs, activeProfileId]
  );

  /** Get the color for a tag, falling back to the default palette color */
  const getTagColor = useCallback(
    (tag: string) => tagColors[tag] || "#7c3aed",
    [tagColors]
  );

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  // null = no sort, true = A-Z, false = Z-A
  const [sortAsc, setSortAsc] = useState<boolean | null>(null);
  const [sortByType, setSortByType] = useState(false);
  // Tag filter
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [localDrawerOpen, setLocalDrawerOpen] = useState(() => isTauri());
  const [localDrawerHeight, setLocalDrawerHeight] = useState(() => {
    if (typeof window === "undefined") return 224;
    const cached = window.localStorage.getItem("markup-local-drawer-height-v1");
    const parsed = cached ? Number(cached) : NaN;
    if (Number.isNaN(parsed)) return 224;
    return Math.max(120, Math.min(420, parsed));
  });
  const localDrawerDraggingRef = useRef(false);
  const pendingLocalDrawerHeightRef = useRef(localDrawerHeight);
  const [mobileDraggedTabId, setMobileDraggedTabId] = useState<string | null>(null);

  const allTags = getAllTags();

  const toggleTagFilter = useCallback((tag: string) => {
    setActiveTagFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const clearTagFilters = useCallback(() => {
    setActiveTagFilters(new Set());
    setTagFilterOpen(false);
  }, []);

  const startMobileDrag = useCallback((tabId: string) => {
    if (!mobile) return;
    setMobileDraggedTabId(tabId);
  }, [mobile]);

  const dropMobileDraggedTab = useCallback((folderId: string | null) => {
    if (!mobileDraggedTabId) return;
    moveTabToFolder(mobileDraggedTabId, folderId);
    setMobileDraggedTabId(null);
  }, [mobileDraggedTabId, moveTabToFolder]);

  const cancelMobileDrag = useCallback(() => {
    setMobileDraggedTabId(null);
  }, []);

  // Filter function: tab passes if it has ALL active tag filters
  const tabPassesFilter = useCallback(
    (tab: Tab) => {
      if (activeTagFilters.size === 0) return true;
      return Array.from(activeTagFilters).every((tag) => tab.tags.includes(tag));
    },
    [activeTagFilters]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const folderIdSet = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);
  const foldersByParent = useMemo(() => {
    const map = new Map<string | null, Folder[]>();
    folders.forEach((f) => {
      const parent = f.parentId && folderIdSet.has(f.parentId) ? f.parentId : null;
      const list = map.get(parent) ?? [];
      list.push({ ...f, parentId: parent });
      map.set(parent, list);
    });
    for (const [key, list] of map) {
      list.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
      map.set(key, list);
    }
    return map;
  }, [folders, folderIdSet]);

  // Render all folders, including empty ones, so newly created folders are immediately visible.
  const visibleFolderIds = new Set<string>(folders.map((folder) => folder.id));

  /** Collapse every expanded folder in the file tree. */
  const collapseAll = () => setExpandedFolders(new Set());
  /** Expand every currently visible folder in the file tree. */
  const expandAll = () => setExpandedFolders(new Set(Array.from(visibleFolderIds)));

  const visibleFoldersByParent = new Map<string | null, Folder[]>();
  for (const [parentId, children] of foldersByParent.entries()) {
    const visibleChildren = children.filter((folder) => visibleFolderIds.has(folder.id));
    if (visibleChildren.length > 0) {
      visibleFoldersByParent.set(parentId, visibleChildren);
    }
  }

  /** Render a folder node and its nested descendants recursively. */
  function renderFolder(folder: Folder, depth: number) {
    return (
      <FolderItem
        key={folder.id}
        folder={folder}
        tabs={onlineTabs}
        childFolders={visibleFoldersByParent.get(folder.id) ?? []}
        expandedFolders={expandedFolders}
        toggleExpand={toggleExpand}
        hideMd={hideMd}
        sortAsc={sortAsc}
        sortByType={sortByType}
        tabFilter={tabPassesFilter}
        depth={depth}
        renderFolder={renderFolder}
        mobile={mobile}
        mobileDraggingTabId={mobileDraggedTabId}
        onStartMobileDrag={startMobileDrag}
        onMobileDropTab={(folderId) => dropMobileDraggedTab(folderId)}
      />
    );
  }

  // Root-level tabs (no folder), filtered
  let rootTabs = onlineTabs.filter((t) => !t.folderId && tabPassesFilter(t));
  if (sortByType) rootTabs = [...rootTabs].sort((a, b) => (a.noteType ?? "note").localeCompare(b.noteType ?? "note"));
  if (sortAsc === true) rootTabs = [...rootTabs].sort((a, b) => a.title.localeCompare(b.title));
  else if (sortAsc === false) rootTabs = [...rootTabs].sort((a, b) => b.title.localeCompare(a.title));

  // Separate pinned and unpinned root tabs
  const unpinnedRootTabs = rootTabs.filter((t) => !t.pinned);

  // Drop on root area — move file out of folder
  const onRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  /**
   * Handle dropping a tab or folder onto the root area.
   * @param e Drag event from the file tree root drop zone.
   */
  function onRootDrop(e: React.DragEvent): void {
    e.preventDefault();
    const folderId = e.dataTransfer.getData("text/folder-id");
    if (folderId) {
      moveFolderToParent(folderId, null);
      return;
    }
    const tabId = e.dataTransfer.getData("text/tab-id");
    if (tabId) moveTabToFolder(tabId, null);
  }

  // Uncollapse strip when file tree is closed (desktop only)
  if (!mobile && !fileTreeOpen) {
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

  // Resize handle logic (desktop only)
  const draggingRef = { current: false };
  const pendingWidthRef = { current: fileTreeWidth };

  const onResizeMouseDown = !mobile ? (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    const startX = e.clientX;
    const startWidth = fileTreeWidth;

    /**
     * Update sidebar width while dragging the desktop resize handle.
     * @param ev Mouse move event while resizing.
     */
    function onMove(ev: MouseEvent): void {
      if (!draggingRef.current) return;
      const next = Math.max(160, Math.min(480, startWidth + ev.clientX - startX));
      pendingWidthRef.current = next;
      document.documentElement.style.setProperty("--filetree-drag-width", `${next}px`);
    }

    /** Finalize sidebar width and remove desktop resize listeners. */
    function onUp(): void {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.documentElement.style.removeProperty("--filetree-drag-width");
      updateSettings({ fileTreeWidth: Math.round(pendingWidthRef.current) });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  } : undefined;

  const toolbarButtonSize = mobile ? "h-9 w-9" : "h-6 w-6";
  const toolbarIconSize = mobile ? "h-4 w-4" : "h-3.5 w-3.5";
  const onLocalDrawerResizeMouseDown = !mobile ? (e: React.MouseEvent) => {
    e.preventDefault();
    localDrawerDraggingRef.current = true;
    const startY = e.clientY;
    const startHeight = localDrawerHeight;

    /**
     * Update local drawer height while dragging the divider.
     * @param ev Mouse move event while resizing.
     */
    function onMove(ev: MouseEvent): void {
      if (!localDrawerDraggingRef.current) return;
      const next = Math.max(120, Math.min(420, startHeight - (ev.clientY - startY)));
      pendingLocalDrawerHeightRef.current = next;
      setLocalDrawerHeight(next);
    }

    /** Commit local drawer height and remove divider listeners. */
    function onUp(): void {
      if (!localDrawerDraggingRef.current) return;
      localDrawerDraggingRef.current = false;
      const committed = Math.round(pendingLocalDrawerHeightRef.current);
      setLocalDrawerHeight(committed);
      window.localStorage.setItem("markup-local-drawer-height-v1", String(committed));
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  } : undefined;

  return (
    <aside
      className={cn("relative flex h-full flex-col border-r border-border bg-card overflow-hidden")}
      style={!mobile ? { width: `var(--filetree-drag-width, ${fileTreeWidth}px)`, maxWidth: "100vw" } : undefined}
    >
      <FileTreeToolbar
        mobile={mobile}
        onMobileClose={onMobileClose}
        toolbarButtonSize={toolbarButtonSize}
        toolbarIconSize={toolbarIconSize}
        requestCreateTab={requestCreateTab}
        createWhiteboard={createWhiteboard}
        createMindmap={createMindmap}
        createKanban={createKanban}
        createPdf={createPdf}
        createFolder={createFolder}
        sortAsc={sortAsc}
        setSortAsc={setSortAsc}
        sortByType={sortByType}
        setSortByType={setSortByType}
        expandedCount={expandedFolders.size}
        collapseAll={collapseAll}
        expandAll={expandAll}
        tagFilterOpen={tagFilterOpen}
        setTagFilterOpen={setTagFilterOpen}
        activeTagFilterCount={activeTagFilters.size}
        toggleFileTree={toggleFileTree}
      />

      <FileTreeTagFilterPanel
        tagFilterOpen={tagFilterOpen}
        allTags={allTags}
        activeTagFilters={activeTagFilters}
        clearTagFilters={clearTagFilters}
        toggleTagFilter={toggleTagFilter}
        getTagColor={getTagColor}
      />

      <FileTreeRootArea
        onRootDragOver={onRootDragOver}
        onRootDrop={onRootDrop}
        onlineTabs={onlineTabs}
        tabPassesFilter={tabPassesFilter}
        activeTabId={activeTabId}
        switchTab={switchTab}
        deleteTab={deleteTab}
        hideMd={hideMd}
        mobile={mobile}
        mobileDraggedTabId={mobileDraggedTabId}
        startMobileDrag={startMobileDrag}
        dropMobileDraggedTab={dropMobileDraggedTab}
        cancelMobileDrag={cancelMobileDrag}
        visibleFoldersByParent={visibleFoldersByParent}
        renderFolder={renderFolder}
        visibleFolderIds={visibleFolderIds}
        unpinnedRootTabs={unpinnedRootTabs}
        requestCreateTab={requestCreateTab}
        createWhiteboard={createWhiteboard}
        createMindmap={createMindmap}
        createKanban={createKanban}
        createPdf={createPdf}
        createFolder={createFolder}
      />

      {isTauri() && (
        <LocalFilesDrawer
          localDrawerOpen={localDrawerOpen}
          setLocalDrawerOpen={setLocalDrawerOpen}
          localTabs={localTabs}
          mobile={mobile}
          onLocalDrawerResizeMouseDown={onLocalDrawerResizeMouseDown}
          localDrawerHeight={localDrawerHeight}
          activeTabId={activeTabId}
          switchTab={switchTab}
          syncLocalTabToOnline={syncLocalTabToOnline}
          profiles={profiles}
          moveTabToWorkspace={moveTabToWorkspace}
          hideMd={hideMd}
        />
      )}
      {/* Profile selector — bottom */}
      <div className="flex items-center px-2 py-1.5 border-t border-border">
        <ProfileSelector />
      </div>

      {/* Resize handle — desktop only */}
      {!mobile && (
        <div
          onMouseDown={onResizeMouseDown}
          className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-10"
        />
      )}
    </aside>
  );
}
