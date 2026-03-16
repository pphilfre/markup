"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  Pin,
  PinOff,
  Filter,
  X,
  Share2,
  FileOutput,
  PenTool,
  GitBranch,
  Search,
  Layers,
  MoreHorizontal,
  CloudUpload,
  HardDrive,
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
import { isTauri } from "@/lib/tauri";
import { useEditorStore, Folder, Tab, NoteType } from "@/lib/store";

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

// Map of icon names to lucide components — loaded lazily to avoid importing all
import * as LucideIcons from "lucide-react";

function getLucideIcon(name?: string): React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null {
  if (!name) return null;
  const icon = (LucideIcons as Record<string, unknown>)[name];
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
  return FileText;
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
                onClick={() => setTabIcon(tab.id, tab.customIcon, undefined)}
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
                setTabIcon(tab.id, undefined, undefined);
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
}) {
  const [renaming, setRenaming] = useState(false);
  const renameFolder = useEditorStore((s) => s.renameFolder);
  const colorFolder = useEditorStore((s) => s.colorFolder);
  const deleteFolder = useEditorStore((s) => s.deleteFolder);
  const createFolder = useEditorStore((s) => s.createFolder);
  const createTab = useEditorStore((s) => s.createTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const switchTab = useEditorStore((s) => s.switchTab);
  const deleteTab = useEditorStore((s) => s.deleteTab);
  const moveTabToFolder = useEditorStore((s) => s.moveTabToFolder);
  const activeTabId = useEditorStore((s) => s.activeTabId);

  const expanded = expandedFolders.has(folder.id);
  let folderTabs = tabs.filter((t) => t.folderId === folder.id && (!tabFilter || tabFilter(t)));

  // Sort
  if (sortByType) folderTabs = [...folderTabs].sort((a, b) => (a.noteType ?? "note").localeCompare(b.noteType ?? "note"));
  if (sortAsc === true) folderTabs = [...folderTabs].sort((a, b) => a.title.localeCompare(b.title));
  else if (sortAsc === false) folderTabs = [...folderTabs].sort((a, b) => b.title.localeCompare(a.title));

  const exportFolder = async () => {
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
            className="flex w-full items-center gap-1.5 rounded-sm pr-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors group"
            style={{ paddingLeft: 8 + depth * 12 }}
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
  const switchTab = useEditorStore((s) => s.switchTab);
  const addTag = useEditorStore((s) => s.addTag);
  const removeTag = useEditorStore((s) => s.removeTag);
  const getAllTags = useEditorStore((s) => s.getAllTags);
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

  const displayName = hideMd && (tab.title.endsWith(".md") || tab.title.endsWith(".canvas") || tab.title.endsWith(".mindmap"))
    ? tab.title.replace(/\.(md|canvas|mindmap)$/, "")
    : tab.title;

  const exportFile = async () => {
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
          <div className="flex w-full items-center">
            <button
              onClick={onSwitch}
              draggable
              onDragStart={onDragStart}
              className={cn(
                "flex flex-1 min-w-0 items-center gap-1.5 rounded-sm px-3 py-1 text-xs transition-colors cursor-grab active:cursor-grabbing",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {(() => {
                const Icon = getTabIcon(tab);
                return <Icon className="h-3 w-3 shrink-0" style={tab.iconColor ? { color: tab.iconColor } : undefined} />;
              })()}
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
              {tab.pinned && (
                <Pin className="ml-auto h-2.5 w-2.5 shrink-0 text-muted-foreground/60" />
              )}
            </button>
            {/* Quick tag + triple‑dot buttons — visible on hover */}
            <div className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Quick add tag"
                  >
                    <Tag className="h-2.5 w-2.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="start" className="w-48 p-2" onPointerDownOutside={(e) => e.stopPropagation()}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Add tag</p>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {allTags.filter((t) => !tab.tags.includes(t)).map((tag) => (
                      <button
                        key={tag}
                        onClick={(e) => { e.stopPropagation(); addTag(tab.id, tag); }}
                        className="rounded-sm border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      placeholder="New tag…"
                      className="flex-1 rounded-sm border border-input bg-background px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-ring"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
                          if (val) { addTag(tab.id, val); (e.target as HTMLInputElement).value = ""; }
                        }
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="More actions"
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => togglePin(tab.id)}>
                    {tab.pinned
                      ? <><PinOff className="mr-2 h-3.5 w-3.5" /> Unpin</>
                      : <><Pin className="mr-2 h-3.5 w-3.5" /> Pin to Top</>
                    }
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRenaming(true)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportFile}>
                    <Download className="mr-2 h-3.5 w-3.5" /> Download
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    switchTab(tab.id);
                    document.dispatchEvent(new CustomEvent("open-share"));
                  }}>
                    <Share2 className="mr-2 h-3.5 w-3.5" /> Share
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    switchTab(tab.id);
                    document.dispatchEvent(new CustomEvent("open-export"));
                  }}>
                    <FileOutput className="mr-2 h-3.5 w-3.5" /> Export As…
                  </DropdownMenuItem>
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
          </div>
          {/* Tag chips */}
          {tab.tags.length > 0 && (
            <div className="flex flex-wrap gap-0.5 px-3 pb-0.5">
              {tab.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-sm px-1 py-0 text-[9px] leading-tight"
                  style={{
                    background: `${getTagColor(tag)}20`,
                    color: getTagColor(tag),
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={() => togglePin(tab.id)}>
          {tab.pinned
            ? <><PinOff className="mr-2 h-3.5 w-3.5" /> Unpin</>
            : <><Pin className="mr-2 h-3.5 w-3.5" /> Pin to Top</>
          }
        </ContextMenuItem>
        <ContextMenuItem onClick={() => setRenaming(true)}>
          <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={exportFile}>
          <Download className="mr-2 h-3.5 w-3.5" /> Download
        </ContextMenuItem>
        <ContextMenuItem asChild onSelect={(e) => e.preventDefault()}>
          <IconPickerPopover tab={tab}>
            <div className="relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground">
              <Palette className="h-3.5 w-3.5" />
              <span>Change Icon</span>
            </div>
          </IconPickerPopover>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          switchTab(tab.id);
          document.dispatchEvent(new CustomEvent("open-share"));
        }}>
          <Share2 className="mr-2 h-3.5 w-3.5" /> Share
        </ContextMenuItem>
        <ContextMenuItem onClick={() => {
          switchTab(tab.id);
          document.dispatchEvent(new CustomEvent("open-export"));
        }}>
          <FileOutput className="mr-2 h-3.5 w-3.5" /> Export As…
        </ContextMenuItem>
        <ContextMenuSeparator />
        {/* Tag management */}
        <div className="px-2 py-1.5" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Tag className="h-3 w-3" /> Tags
          </p>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {tab.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs"
                style={{
                  background: `${getTagColor(tag)}20`,
                  color: getTagColor(tag),
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
                {/* Color swatches */}
                <span className="ml-1 inline-flex gap-0.5">
                  {TAG_PALETTE.map((c) => (
                    <button
                      key={c}
                      onClick={(e) => {
                        e.stopPropagation();
                        setTagColor(tag, c);
                      }}
                      className={cn(
                        "h-2.5 w-2.5 rounded-full border",
                        getTagColor(tag) === c ? "border-foreground scale-125" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                </span>
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
              className="w-full rounded-sm border border-border bg-background px-1.5 py-0.5 text-xs outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAddingTag(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Add tag
            </button>
          )}
          {/* Quick-add: show existing tags not yet on this file */}
          {allTags.filter((t) => !tab.tags.includes(t)).length > 0 && !addingTag && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {allTags.filter((t) => !tab.tags.includes(t)).slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    addTag(tab.id, tag);
                  }}
                  className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
export function FileTree({ mobile, onMobileClose }: { mobile?: boolean; onMobileClose?: () => void } = {}) {
  const fileTreeOpen = useEditorStore((s) => s.fileTreeOpen);
  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const fileTreeWidth = useEditorStore((s) => s.settings.fileTreeWidth);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const tabs = useEditorStore((s) => s.tabs);
  const folders = useEditorStore((s) => s.folders);
  const createFolder = useEditorStore((s) => s.createFolder);
  const createTab = useEditorStore((s) => s.createTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const switchTab = useEditorStore((s) => s.switchTab);
  const deleteTab = useEditorStore((s) => s.deleteTab);
  const syncLocalTabToOnline = useEditorStore((s) => s.syncLocalTabToOnline);
  const moveTabToFolder = useEditorStore((s) => s.moveTabToFolder);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const hideMd = useEditorStore((s) => s.settings.hideMdExtensions || !s.settings.showFileExtensions);
  const getAllTags = useEditorStore((s) => s.getAllTags);
  const tagColors = useEditorStore((s) => s.tagColors);
  const setTagColor = useEditorStore((s) => s.setTagColor);

  const onlineTabs = useMemo(() => tabs.filter((t) => t.origin !== "local"), [tabs]);
  const localTabs = useMemo(() => tabs.filter((t) => t.origin === "local"), [tabs]);

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

  const collapseAll = () => setExpandedFolders(new Set());
  const expandAll = () => setExpandedFolders(new Set(folders.map((f) => f.id)));

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

  function renderFolder(folder: Folder, depth: number) {
    return (
      <FolderItem
        key={folder.id}
        folder={folder}
        tabs={onlineTabs}
        childFolders={foldersByParent.get(folder.id) ?? []}
        expandedFolders={expandedFolders}
        toggleExpand={toggleExpand}
        hideMd={hideMd}
        sortAsc={sortAsc}
        sortByType={sortByType}
        tabFilter={tabPassesFilter}
        depth={depth}
        renderFolder={renderFolder}
      />
    );
  }

  // Root-level tabs (no folder), filtered
  let rootTabs = onlineTabs.filter((t) => !t.folderId && tabPassesFilter(t));
  if (sortByType) rootTabs = [...rootTabs].sort((a, b) => (a.noteType ?? "note").localeCompare(b.noteType ?? "note"));
  if (sortAsc === true) rootTabs = [...rootTabs].sort((a, b) => a.title.localeCompare(b.title));
  else if (sortAsc === false) rootTabs = [...rootTabs].sort((a, b) => b.title.localeCompare(a.title));

  // Separate pinned and unpinned root tabs
  const pinnedRootTabs = rootTabs.filter((t) => t.pinned);
  const unpinnedRootTabs = rootTabs.filter((t) => !t.pinned);

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

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.max(160, Math.min(480, startWidth + ev.clientX - startX));
      pendingWidthRef.current = next;
      document.documentElement.style.setProperty("--filetree-drag-width", `${next}px`);
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.documentElement.style.removeProperty("--filetree-drag-width");
      updateSettings({ fileTreeWidth: Math.round(pendingWidthRef.current) });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  } : undefined;

  return (
    <aside
      className={cn("relative flex h-full flex-col border-r border-border bg-card overflow-hidden")}
      style={!mobile ? { width: `var(--filetree-drag-width, ${fileTreeWidth}px)`, maxWidth: "100vw" } : undefined}
    >
      {/* Header row 1: title + main controls */}
      <div className="flex items-center px-2 py-1.5 border-b border-border gap-1">
        <div className="flex items-center gap-0.5 flex-wrap">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">New…</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="min-w-[140px]">
              <DropdownMenuItem onClick={() => createTab()}>
                <FileText className="mr-2 h-3.5 w-3.5" /> Note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createWhiteboard()}>
                <PenTool className="mr-2 h-3.5 w-3.5" /> Whiteboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => createMindmap()}>
                <GitBranch className="mr-2 h-3.5 w-3.5" /> Mindmap
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {/* Sort by Type */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSortByType((prev) => !prev)}
                className={cn(
                  "h-6 w-6 text-muted-foreground hover:text-foreground",
                  sortByType && "text-foreground"
                )}
              >
                <Layers className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {sortByType ? "Unsort by type" : "Sort by type"}
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
          {/* Tag filter */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTagFilterOpen((prev) => !prev)}
                className={cn(
                  "h-6 w-6 text-muted-foreground hover:text-foreground",
                  (tagFilterOpen || activeTagFilters.size > 0) && "text-foreground"
                )}
              >
                <Tag className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {tagFilterOpen ? "Hide Tags" : "Filter by Tags"}
              {activeTagFilters.size > 0 && ` (${activeTagFilters.size})`}
            </TooltipContent>
          </Tooltip>
          {/* Close sidebar — desktop only */}
          {!mobile && (
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
          )}
          {/* Close — mobile only */}
          {mobile && onMobileClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMobileClose}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Tag filter panel */}
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

      {/* Active filter chips (when panel is closed) */}
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

      {/* Tree content — right-click context menu on empty space */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="flex-1 overflow-y-auto px-1 py-1"
            onDragOver={onRootDragOver}
            onDrop={onRootDrop}
          >
            {/* Pinned files (across all folders) */}
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
                    />
                  ))}
              </div>
            )}

            {/* Folders */}
            {(foldersByParent.get(null) ?? []).map((folder) => renderFolder(folder, 0))}

            {/* Root files (no folder) */}
            {folders.length > 0 && unpinnedRootTabs.length > 0 && (
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
              />
            ))}

            {onlineTabs.length === 0 && (
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
          <ContextMenuItem onClick={() => createWhiteboard()}>
            <PenTool className="mr-2 h-3.5 w-3.5" /> New Whiteboard
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createMindmap()}>
            <GitBranch className="mr-2 h-3.5 w-3.5" /> New Mindmap
          </ContextMenuItem>
          <ContextMenuItem onClick={() => createFolder("New Folder")}>
            <FolderPlus className="mr-2 h-3.5 w-3.5" /> New Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {isTauri() && (
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
            <div className="max-h-56 overflow-y-auto px-1 py-1">
              {localTabs.length === 0 ? (
                <p className="px-3 py-3 text-center text-[10px] text-muted-foreground/50">
                  No local files
                </p>
              ) : (
                [...localTabs]
                  .sort((a, b) => a.title.localeCompare(b.title))
                  .map((tab) => {
                    const Icon = getTabIcon(tab);
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
                          <Icon className="h-3.5 w-3.5 shrink-0" style={tab.iconColor ? { color: tab.iconColor } : undefined} />
                          <span className="truncate">{hideMd ? tab.title.replace(/\.(md|canvas|mindmap)$/i, "") : tab.title}</span>
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
                      </div>
                    );
                  })
              )}
            </div>
          )}
        </div>
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
