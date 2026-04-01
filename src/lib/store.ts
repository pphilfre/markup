import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { EditorView } from "@codemirror/view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewMode = "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap" | "kanban" | "pdf" | "inline";
export type Theme = "dark" | "light";
export type ThemeMode = "light" | "dark" | "system" | "solarized-light" | "nord-dark" | "catppuccin-mocha" | "catppuccin-latte" | "gruvbox-dark" | "gruvbox-light" | "tokyo-night" | "everforest-light" | "uwu";
export type NoteType = "note" | "whiteboard" | "mindmap" | "kanban" | "pdf";
export type NoteTemplateId = "blank" | "todo" | "calendar" | "moodboard";
export type TabOrigin = "online" | "local";

interface NoteTemplateDefinition {
  id: NoteTemplateId;
  label: string;
  description: string;
  titlePrefix: string;
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplateDefinition[] = [
  {
    id: "blank",
    label: "Blank Note",
    description: "Start from an empty markdown file.",
    titlePrefix: "Untitled",
    content: "",
  },
  {
    id: "todo",
    label: "Todo List",
    description: "Track daily tasks and priorities.",
    titlePrefix: "Todo",
    content: `# Todo List

## Today
- [ ] Top priority
- [ ] Second priority
- [ ] Quick win

## This Week
- [ ]
- [ ]

## Notes
-`,
  },
  {
    id: "calendar",
    label: "Calendar",
    description: "Plan your month and upcoming events.",
    titlePrefix: "Calendar",
    content: `# Calendar

## Month Overview
| Mon | Tue | Wed | Thu | Fri | Sat | Sun |
| --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |

## Upcoming
-`,
  },
  {
    id: "moodboard",
    label: "Moodboard",
    description: "Collect visual direction, palette, and references.",
    titlePrefix: "Moodboard",
    content: `# Moodboard

## Vision
- Theme:
- Keywords:

## Color Palette
- Primary:
- Secondary:
- Accent:

## Inspiration
- [Reference 1](https://)
- [Reference 2](https://)

## Notes
-`,
  },
];

function getTemplate(templateId: NoteTemplateId): NoteTemplateDefinition {
  return NOTE_TEMPLATES.find((t) => t.id === templateId) ?? NOTE_TEMPLATES[0];
}

export interface CustomThemeColors {
  background?: string;
  foreground?: string;
  sidebar?: string;
  sidebarForeground?: string;
  popover?: string;
  popoverForeground?: string;
  border?: string;
  muted?: string;
  mutedForeground?: string;
  accent?: string;
  accentForeground?: string;
  primary?: string;
  primaryForeground?: string;
}

export interface Tab {
  id: string;
  title: string;
  content: string;
  folderId: string | null; // null = root
  tags: string[]; // user-defined tags
  pinned: boolean;
  noteType: NoteType;
  customIcon?: string;  // lucide icon name
  iconColor?: string;   // hex color
  origin?: TabOrigin;
}

export interface Folder {
  id: string;
  name: string;
  color: string; // hex colour
  parentId: string | null;
  sortOrder: number;
}

function normalizeFolderSortOrders(folders: Folder[]): Folder[] {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    const list = byParent.get(key) ?? [];
    list.push(folder);
    byParent.set(key, list);
  }

  const nextSortOrder = new Map<string, number>();
  for (const list of byParent.values()) {
    const sorted = [...list].sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
    sorted.forEach((folder, idx) => {
      nextSortOrder.set(folder.id, idx);
    });
  }

  return folders.map((folder) => {
    const normalizedParentId = folder.parentId ?? null;
    const sortOrder = nextSortOrder.get(folder.id);
    if (sortOrder === undefined) return { ...folder, parentId: normalizedParentId };
    if (folder.parentId === normalizedParentId && folder.sortOrder === sortOrder) return folder;
    return {
      ...folder,
      parentId: normalizedParentId,
      sortOrder,
    };
  });
}

function isFolderAncestor(
  folders: Folder[],
  ancestorId: string,
  childParentId: string | null
): boolean {
  if (!childParentId) return false;
  const parentById = new Map(folders.map((f) => [f.id, f.parentId]));
  let current: string | null = childParentId;
  while (current) {
    if (current === ancestorId) return true;
    current = parentById.get(current) ?? null;
  }
  return false;
}

export interface Profile {
  id: string;
  name: string;
}

export interface Settings {
  fontFamily: string;
  fontSize: number; // px
  lineHeight: number;
  tabSize: number;
  editorMargin: number; // px horizontal padding
  accentColor: string; // hex
  hideMdExtensions: boolean;
  // Typography
  letterSpacing: number; // em
  maxLineWidth: number; // ch, 0 = unlimited
  showInvisibleCharacters: boolean;
  // Markdown
  autoCloseBrackets: boolean;
  autoCloseMarkdownFormatting: boolean;
  autoFormatLists: boolean;
  continueListOnEnter: boolean;
  spellCheck: boolean;
  autoPunctuation: boolean;
  suggestCorrectionsOnDoubleTap: boolean;
  smartQuotes: boolean;
  smartDashes: boolean;
  convertTabsToSpaces: boolean;
  // Editing
  wordWrap: boolean;
  highlightCurrentLine: boolean;
  highlightMatchingBrackets: boolean;
  cursorAnimation: "smooth" | "blink" | "none";
  multiCursorSupport: boolean;
  // Appearance - Theme
  themeMode: ThemeMode;
  customThemeColors: CustomThemeColors;
  // Appearance - UI
  sidebarPosition: "left" | "right";
  sidebarWidth: number; // px
  compactMode: boolean;
  showIconsInSidebar: boolean;
  showFileExtensions: boolean;
  iconTheme: "default" | "minimal" | "colorful";
  promptForTemplateOnNewFile: boolean;
  // Appearance - Editor Look
  codeBlockTheme: "github" | "monokai" | "dracula" | "nord" | "one-dark" | "solarized";
  headingStyle: "default" | "underlined" | "bordered" | "highlighted";
  linkStyle: "default" | "underlined" | "colored" | "button";
  checkboxStyle: "default" | "rounded" | "filled" | "minimal";
  // Custom fonts
  customFontFamily: string | null;
  // Panel sizes (px) — persisted, desktop only
  fileTreeWidth: number;
  splitRatio: number; // 0–1, fraction for editor in split view
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: 14,
  lineHeight: 1.7,
  tabSize: 2,
  editorMargin: 24,
  accentColor: "#7c3aed",
  hideMdExtensions: false,
  // Typography
  letterSpacing: 0,
  maxLineWidth: 0,
  showInvisibleCharacters: false,
  // Markdown
  autoCloseBrackets: true,
  autoCloseMarkdownFormatting: true,
  autoFormatLists: true,
  continueListOnEnter: true,
  spellCheck: true,
  autoPunctuation: true,
  suggestCorrectionsOnDoubleTap: true,
  smartQuotes: false,
  smartDashes: false,
  convertTabsToSpaces: true,
  // Editing
  wordWrap: true,
  highlightCurrentLine: true,
  highlightMatchingBrackets: true,
  cursorAnimation: "smooth",
  multiCursorSupport: true,
  // Appearance - Theme
  themeMode: "dark",
  customThemeColors: {},
  // Appearance - UI
  sidebarPosition: "left",
  sidebarWidth: 44,
  compactMode: false,
  showIconsInSidebar: true,
  showFileExtensions: true,
  iconTheme: "default",
  promptForTemplateOnNewFile: true,
  // Appearance - Editor Look
  codeBlockTheme: "github",
  headingStyle: "default",
  linkStyle: "default",
  checkboxStyle: "default",
  customFontFamily: null,
  // Panel sizes
  fileTreeWidth: 208,
  splitRatio: 0.5,
};

interface EditorState {
  tabs: Tab[];
  openTabIds: string[]; // IDs of tabs visible in the tab bar
  activeTabId: string | null;
  viewMode: ViewMode;
  theme: Theme;
  _hydrated: boolean;

  // Folders
  folders: Folder[];
  createFolder: (name: string, parentId?: string | null) => string;
  renameFolder: (id: string, name: string) => void;
  colorFolder: (id: string, color: string) => void;
  deleteFolder: (id: string) => void;
  reorderFolder: (folderId: string, targetFolderId: string) => void;
  moveFolderToParent: (folderId: string, parentId: string | null) => void;
  moveTabToFolder: (tabId: string, folderId: string | null) => void;

  // Settings
  settings: Settings;
  updateSettings: (partial: Partial<Settings>) => void;

  // Profiles
  profiles: Profile[];
  activeProfileId: string;
  createProfile: (name: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  switchProfile: (id: string) => void;

  // File tree sidebar
  fileTreeOpen: boolean;
  toggleFileTree: () => void;

  // New note template prompt
  newTabTemplateDialogOpen: boolean;
  newTabTemplateFolderId: string | null;
  requestCreateTab: (folderId?: string | null) => void;
  createTabFromTemplate: (templateId: NoteTemplateId) => void;
  closeTemplateDialog: () => void;

  // Ref to the live CodeMirror EditorView (not serialised)
  editorView: EditorView | null;
  setEditorView: (view: EditorView | null) => void;

  // Inline editor target (not serialised)
  inlineTextarea: HTMLTextAreaElement | null;
  setInlineTextarea: (el: HTMLTextAreaElement | null) => void;
  inlineSelection: { lineIndex: number; from: number; to: number } | null;
  setInlineSelection: (sel: { lineIndex: number; from: number; to: number } | null) => void;

  // Tab actions
  createTab: (folderId?: string | null) => void;
  createWhiteboard: (folderId?: string | null) => void;
  createMindmap: (folderId?: string | null) => void;
  createKanban: (folderId?: string | null) => void;
  createPdf: (folderId?: string | null) => void;
  closeTab: (id: string) => void;
  deleteTab: (id: string) => void;
  openTab: (id: string) => void;
  switchTab: (id: string) => void;
  syncLocalTabToOnline: (localTabId: string) => void;
  updateContent: (id: string, content: string) => void;
  updateTitle: (id: string, title: string) => void;
  renameTab: (id: string, title: string) => void;
  setTabIcon: (id: string, icon?: string, color?: string) => void;

  // Tags
  addTag: (tabId: string, tag: string) => void;
  removeTag: (tabId: string, tag: string) => void;
  getAllTags: () => string[];
  tagColors: Record<string, string>;
  setTagColor: (tag: string, color: string) => void;

  // Pin
  togglePin: (tabId: string) => void;

  // View
  toggleView: () => void;
  setViewMode: (mode: ViewMode) => void;

  // Theme
  toggleTheme: () => void;

  // Zoom
  zoomLevel: number;
  setZoomLevel: (level: number) => void;

  // Local file sync (Tauri)
  localSyncFolder: string | null;
  setLocalSyncFolder: (folder: string | null) => void;

  // Editor helpers — smart, multi-line aware
  insertSnippet: (snippet: string) => void;
  insertLinePrefix: (prefix: string) => void;
  wrapSelection: (before: string, after: string) => void;

  // Persistence
  hydrate: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tabCounter = 0;

function newTab(
  folderId: string | null = null,
  noteType: NoteType = "note",
  templateId: NoteTemplateId = "blank"
): Tab {
  tabCounter += 1;
  const template = getTemplate(templateId);
  const prefix =
    noteType === "whiteboard"
      ? "Whiteboard"
      : noteType === "mindmap"
      ? "Mindmap"
      : noteType === "kanban"
      ? "Kanban"
      : noteType === "pdf"
      ? "PDF"
      : template.titlePrefix;
  const ext = noteType === "whiteboard" ? ".canvas" : noteType === "mindmap" ? ".mindmap" : noteType === "kanban" ? ".kanban" : noteType === "pdf" ? ".pdf" : ".md";
  return {
    id: crypto.randomUUID(),
    title: `${prefix}-${tabCounter}${ext}`,
    content: noteType === "note"
      ? template.content
      : JSON.stringify(
          noteType === "whiteboard"
            ? { elements: [], canvasSettings: {} }
            : noteType === "mindmap"
            ? { nodes: [], connections: [], settings: {} }
            : noteType === "kanban"
            ? {
                version: 2,
                boardTitle: "Project Board",
                showCompleted: true,
                columns: [
                  {
                    id: "todo",
                    title: "To Do",
                    color: "#2563eb",
                    wipLimit: null,
                    cards: [
                      {
                        id: crypto.randomUUID(),
                        title: "Set board goal",
                        description: "Define what this board tracks.",
                        labels: ["planning"],
                        dueDate: null,
                        priority: "medium",
                        completed: false,
                        createdAt: Date.now(),
                      },
                    ],
                  },
                  {
                    id: "in-progress",
                    title: "In Progress",
                    color: "#7c3aed",
                    wipLimit: 5,
                    cards: [],
                  },
                  {
                    id: "done",
                    title: "Done",
                    color: "#16a34a",
                    wipLimit: null,
                    cards: [],
                  },
                ],
              }
            : { version: 1, fileName: null, source: "local", dataBase64: null, storageId: null, annotations: [] }
        ),
    folderId,
    tags: [],
    pinned: false,
    noteType,
    origin: "online",
  };
}

/** Derive a title from the first heading or first non-empty line. */
function deriveTitle(content: string): string | null {
  const firstLine = content.split("\n").find((l) => l.trim().length > 0);
  if (!firstLine) return null;
  const heading = firstLine.match(/^#{1,6}\s+(.+)/);
  if (heading) return heading[1].slice(0, 30);
  return null;
}

const FOLDER_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6",
];

const DEFAULT_PROFILE_ID = "default";
const CUSTOM_FONT_CACHE_KEY = "markup-custom-font-cache-v1";

const DEFAULT_PROFILES: Profile[] = [
  { id: DEFAULT_PROFILE_ID, name: "Personal" },
];

// ---------------------------------------------------------------------------
// Persistence helpers (IndexedDB via idb-keyval)
// ---------------------------------------------------------------------------

interface PersistedState {
  tabs: Tab[];
  openTabIds: string[];
  activeTabId: string | null;
  viewMode: ViewMode;
  theme: Theme;
  folders: Folder[];
  settings: Settings;
  fileTreeOpen: boolean;
  profiles: Profile[];
  activeProfileId: string;
  tagColors: Record<string, string>;
  zoomLevel: number;
  localSyncFolder: string | null;
}

async function saveToStorage(state: PersistedState) {
  const { set } = await import("idb-keyval");
  await set("markup-state", state);
}

async function loadFromStorage(): Promise<PersistedState | null> {
  const { get } = await import("idb-keyval");
  const result = await get("markup-state");
  return result ?? null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    tabs: [],
    openTabIds: [],
    activeTabId: null,
    viewMode: "editor",
    theme: "dark",
    editorView: null,
    inlineTextarea: null,
    inlineSelection: null,
    _hydrated: false,
    folders: [],
    settings: { ...DEFAULT_SETTINGS },
    fileTreeOpen: true,
    newTabTemplateDialogOpen: false,
    newTabTemplateFolderId: null,
    profiles: [...DEFAULT_PROFILES],
    activeProfileId: DEFAULT_PROFILE_ID,
    tagColors: {},
    zoomLevel: 100,
    localSyncFolder: null,

    setEditorView: (view) => set({ editorView: view }),
    setInlineTextarea: (el) => set({ inlineTextarea: el }),
    setInlineSelection: (sel) => set({ inlineSelection: sel }),

    // ── Folders ────────────────────────────────────────────────────────
    createFolder: (name, parentId = null) => {
      const id = crypto.randomUUID();
      const { folders } = get();
      const siblingCount = folders.filter((f) => (f.parentId ?? null) === (parentId ?? null)).length;
      const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
      set({
        folders: [
          ...folders,
          { id, name, color, parentId, sortOrder: siblingCount },
        ],
      });
      return id;
    },

    renameFolder: (id, name) =>
      set((s) => ({
        folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
      })),

    colorFolder: (id, color) =>
      set((s) => ({
        folders: s.folders.map((f) => (f.id === id ? { ...f, color } : f)),
      })),

    deleteFolder: (id) =>
      set((s) => {
        const toDelete = new Set<string>();
        const queue: string[] = [id];
        while (queue.length) {
          const current = queue.pop()!;
          if (toDelete.has(current)) continue;
          toDelete.add(current);
          s.folders.forEach((f) => {
            if (f.parentId === current) queue.push(f.id);
          });
        }

        return {
          folders: normalizeFolderSortOrders(s.folders.filter((f) => !toDelete.has(f.id))),
          tabs: s.tabs.map((t) => (t.folderId && toDelete.has(t.folderId) ? { ...t, folderId: null } : t)),
        };
      }),

    reorderFolder: (folderId, targetFolderId) =>
      set((s) => {
        if (folderId === targetFolderId) return {};

        const moving = s.folders.find((f) => f.id === folderId);
        const target = s.folders.find((f) => f.id === targetFolderId);
        if (!moving || !target) return {};

        const nextParentId = target.parentId ?? null;
        if (isFolderAncestor(s.folders, moving.id, nextParentId)) return {};

        const movedFolder: Folder = { ...moving, parentId: nextParentId };
        const siblings = s.folders
          .filter((f) => (f.parentId ?? null) === nextParentId && f.id !== moving.id)
          .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));

        const targetIndex = siblings.findIndex((f) => f.id === target.id);
        const insertAt = targetIndex >= 0 ? targetIndex : siblings.length;
        siblings.splice(insertAt, 0, movedFolder);

        const nextFolders = s.folders.map((f) => {
          if (f.id === movedFolder.id) return movedFolder;
          const siblingIndex = siblings.findIndex((sibling) => sibling.id === f.id);
          if (siblingIndex === -1) return f;
          return { ...f, sortOrder: siblingIndex, parentId: nextParentId };
        });

        return { folders: normalizeFolderSortOrders(nextFolders) };
      }),

    moveFolderToParent: (folderId, parentId) =>
      set((s) => {
        const moving = s.folders.find((f) => f.id === folderId);
        if (!moving) return {};

        const nextParentId = parentId ?? null;
        if (isFolderAncestor(s.folders, moving.id, nextParentId)) return {};

        const siblings = s.folders
          .filter((f) => (f.parentId ?? null) === nextParentId && f.id !== moving.id)
          .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
        const movedFolder: Folder = { ...moving, parentId: nextParentId, sortOrder: siblings.length };

        const nextFolders = s.folders.map((f) => (f.id === folderId ? movedFolder : f));
        return { folders: normalizeFolderSortOrders(nextFolders) };
      }),

    moveTabToFolder: (tabId, folderId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, folderId } : t
        ),
      })),

    // ── Settings ───────────────────────────────────────────────────────
    updateSettings: (partial) =>
      set((s) => ({
        settings: { ...s.settings, ...partial },
      })),

    // ── Profiles ───────────────────────────────────────────────────────
    createProfile: (name) => {
      const id = crypto.randomUUID();
      set((s) => ({
        profiles: [...s.profiles, { id, name }],
      }));
      return id;
    },

    renameProfile: (id, name) =>
      set((s) => ({
        profiles: s.profiles.map((p) => (p.id === id ? { ...p, name } : p)),
      })),

    deleteProfile: (id) => {
      const { profiles, activeProfileId } = get();
      if (profiles.length <= 1) return; // can't delete last
      const next = profiles.filter((p) => p.id !== id);
      set({
        profiles: next,
        activeProfileId: activeProfileId === id ? next[0].id : activeProfileId,
      });
    },

    switchProfile: (id) => set({ activeProfileId: id }),

    // ── File tree ──────────────────────────────────────────────────────
    toggleFileTree: () => set((s) => ({ fileTreeOpen: !s.fileTreeOpen })),

    // ── New note template prompt ───────────────────────────────────────
    requestCreateTab: (folderId = null) =>
      set((s) => {
        if (s.settings.promptForTemplateOnNewFile) {
          return {
            newTabTemplateDialogOpen: true,
            newTabTemplateFolderId: folderId,
          };
        }

        const tab = newTab(folderId, "note", "blank");
        const vm =
          s.viewMode === "preview" || s.viewMode === "whiteboard" || s.viewMode === "mindmap" || s.viewMode === "kanban" || s.viewMode === "pdf"
            ? "editor"
            : s.viewMode;

        return {
          tabs: [...s.tabs, tab],
          openTabIds: [...s.openTabIds, tab.id],
          activeTabId: tab.id,
          viewMode: vm,
        };
      }),

    createTabFromTemplate: (templateId) =>
      set((s) => {
        const folderId = s.newTabTemplateFolderId ?? null;
        const tab = newTab(folderId, "note", templateId);
        const vm =
          s.viewMode === "preview" || s.viewMode === "whiteboard" || s.viewMode === "mindmap" || s.viewMode === "kanban" || s.viewMode === "pdf"
            ? "editor"
            : s.viewMode;

        return {
          tabs: [...s.tabs, tab],
          openTabIds: [...s.openTabIds, tab.id],
          activeTabId: tab.id,
          viewMode: vm,
          newTabTemplateDialogOpen: false,
          newTabTemplateFolderId: null,
        };
      }),

    closeTemplateDialog: () => set({ newTabTemplateDialogOpen: false, newTabTemplateFolderId: null }),

    // ── Hydrate ────────────────────────────────────────────────────────
    hydrate: async () => {
      const saved = await loadFromStorage();
      if (saved && saved.tabs.length > 0) {
        const maxNum = saved.tabs.reduce((max, t) => {
          const m = t.title.match(/-(\d+)\.(md|canvas|mindmap|kanban|pdf)$/i);
          return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 0);
        tabCounter = maxNum;

        const cachedCustomFont =
          typeof window !== "undefined"
            ? window.localStorage.getItem(CUSTOM_FONT_CACHE_KEY)
            : null;
        const mergedSettings: Settings = {
          ...DEFAULT_SETTINGS,
          ...(saved.settings ?? {}),
        };
        if (cachedCustomFont) {
          const hasSavedCustomFont = Boolean(mergedSettings.customFontFamily);
          const usesDefaultFont = mergedSettings.fontFamily === DEFAULT_SETTINGS.fontFamily;
          if (!hasSavedCustomFont || usesDefaultFont) {
            mergedSettings.customFontFamily = cachedCustomFont;
            mergedSettings.fontFamily = cachedCustomFont;
          }
        }

        set({
          tabs: saved.tabs.map((t) => ({ ...t, folderId: t.folderId ?? null, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: (t as Tab & { noteType?: NoteType }).noteType ?? "note" })),
          openTabIds: saved.openTabIds ?? saved.tabs.map((t) => t.id),
          activeTabId: saved.activeTabId,
          viewMode: saved.viewMode,
          theme: saved.theme ?? "dark",
          folders: saved.folders ?? [],
          settings: mergedSettings,
          fileTreeOpen: saved.fileTreeOpen ?? true,
          profiles: saved.profiles?.length ? saved.profiles : [...DEFAULT_PROFILES],
          activeProfileId: saved.activeProfileId ?? DEFAULT_PROFILE_ID,
          tagColors: saved.tagColors ?? {},
          zoomLevel: saved.zoomLevel ?? 100,
          localSyncFolder: saved.localSyncFolder ?? null,
          _hydrated: true,
        });
      } else {
        const tab = newTab();
        set({
          tabs: [tab],
          openTabIds: [tab.id],
          activeTabId: tab.id,
          _hydrated: true,
        });
      }
    },

    createTab: (folderId = null) => {
      const tab = newTab(folderId);
      set((s) => {
        // Reset viewMode to editor for note-type tabs
        const vm = (s.viewMode === "preview" || s.viewMode === "whiteboard" || s.viewMode === "mindmap" || s.viewMode === "kanban" || s.viewMode === "pdf") ? "editor" : s.viewMode;
        return {
          tabs: [...s.tabs, tab],
          openTabIds: [...s.openTabIds, tab.id],
          activeTabId: tab.id,
          viewMode: vm,
        };
      });
    },

    createWhiteboard: (folderId = null) => {
      const tab = newTab(folderId, "whiteboard");
      set((s) => ({
        tabs: [...s.tabs, tab],
        openTabIds: [...s.openTabIds, tab.id],
        activeTabId: tab.id,
        viewMode: "whiteboard" as ViewMode,
      }));
    },

    createMindmap: (folderId = null) => {
      const tab = newTab(folderId, "mindmap");
      set((s) => ({
        tabs: [...s.tabs, tab],
        openTabIds: [...s.openTabIds, tab.id],
        activeTabId: tab.id,
        viewMode: "mindmap" as ViewMode,
      }));
    },

    createKanban: (folderId = null) => {
      const tab = newTab(folderId, "kanban");
      set((s) => ({
        tabs: [...s.tabs, tab],
        openTabIds: [...s.openTabIds, tab.id],
        activeTabId: tab.id,
        viewMode: "kanban" as ViewMode,
      }));
    },

    createPdf: (folderId = null) => {
      const tab = newTab(folderId, "pdf");
      set((s) => ({
        tabs: [...s.tabs, tab],
        openTabIds: [...s.openTabIds, tab.id],
        activeTabId: tab.id,
        viewMode: "pdf" as ViewMode,
      }));
    },

    closeTab: (id) => {
      const { openTabIds, activeTabId } = get();
      const idx = openTabIds.indexOf(id);
      if (idx === -1) return;

      const nextOpen = openTabIds.filter((tid) => tid !== id);

      let nextActive = activeTabId;
      if (activeTabId === id) {
        if (nextOpen.length === 0) {
          nextActive = null;
        } else if (idx >= nextOpen.length) {
          nextActive = nextOpen[nextOpen.length - 1];
        } else {
          nextActive = nextOpen[idx];
        }
      }

      set({ openTabIds: nextOpen, activeTabId: nextActive });
    },

    deleteTab: (id) => {
      const { tabs, openTabIds, activeTabId } = get();
      const next = tabs.filter((t) => t.id !== id);
      const nextOpen = openTabIds.filter((tid) => tid !== id);

      let nextActive = activeTabId;
      if (activeTabId === id) {
        if (nextOpen.length === 0) {
          nextActive = null;
        } else {
          const idx = openTabIds.indexOf(id);
          nextActive = idx >= nextOpen.length ? nextOpen[nextOpen.length - 1] : nextOpen[idx];
        }
      }

      set({ tabs: next, openTabIds: nextOpen, activeTabId: nextActive });
    },

    openTab: (id) => {
      set((s) => {
        const tab = s.tabs.find(t => t.id === id);
        const nt = tab?.noteType ?? "note";
        let vm = s.viewMode;
        if (nt === "whiteboard") vm = "whiteboard";
        else if (nt === "mindmap") vm = "mindmap";
        else if (nt === "kanban") vm = "kanban";
        else if (nt === "pdf") vm = "pdf";
        else if (vm === "whiteboard" || vm === "mindmap" || vm === "kanban" || vm === "pdf") vm = "editor";
        return {
          openTabIds: s.openTabIds.includes(id) ? s.openTabIds : [...s.openTabIds, id],
          activeTabId: id,
          viewMode: vm,
        };
      });
    },

    switchTab: (id) => set((s) => {
      const tab = s.tabs.find(t => t.id === id);
      const nt = tab?.noteType ?? "note";
      let vm = s.viewMode;
      if (nt === "whiteboard") vm = "whiteboard";
      else if (nt === "mindmap") vm = "mindmap";
      else if (nt === "kanban") vm = "kanban";
      else if (nt === "pdf") vm = "pdf";
      else if (vm === "whiteboard" || vm === "mindmap" || vm === "kanban" || vm === "pdf") vm = "editor";
      return {
        activeTabId: id,
        openTabIds: s.openTabIds.includes(id) ? s.openTabIds : [...s.openTabIds, id],
        viewMode: vm,
      };
    }),

    syncLocalTabToOnline: (localTabId) =>
      set((s) => {
        const local = s.tabs.find((t) => t.id === localTabId);
        if (!local || local.origin !== "local") return {};

        const tab: Tab = {
          ...local,
          id: crypto.randomUUID(),
          folderId: null,
          tags: [],
          pinned: false,
          origin: "online",
        };

        let vm = s.viewMode;
        if (tab.noteType === "whiteboard") vm = "whiteboard";
        else if (tab.noteType === "mindmap") vm = "mindmap";
        else if (tab.noteType === "kanban") vm = "kanban";
        else if (tab.noteType === "pdf") vm = "pdf";
        else if (vm === "whiteboard" || vm === "mindmap" || vm === "kanban" || vm === "pdf") vm = "editor";

        return {
          tabs: [...s.tabs, tab],
          openTabIds: s.openTabIds.includes(tab.id) ? s.openTabIds : [...s.openTabIds, tab.id],
          activeTabId: tab.id,
          viewMode: vm,
        };
      }),

    updateContent: (id, content) =>
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== id) return t;
          if (t.noteType !== "note") return { ...t, content };
          const derived = deriveTitle(content);
          return {
            ...t,
            content,
            title: derived ?? t.title,
          };
        }),
      })),

    updateTitle: (id, title) =>
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
      })),

    renameTab: (id, title) =>
      set((s) => ({
        tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
      })),

    setTabIcon: (id, icon, color) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === id ? { ...t, customIcon: icon, iconColor: color } : t
        ),
      })),

    // ── Tags ───────────────────────────────────────────────────────────
    addTag: (tabId, tag) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId && !t.tags.includes(tag)
            ? { ...t, tags: [...t.tags, tag] }
            : t
        ),
      })),

    removeTag: (tabId, tag) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId
            ? { ...t, tags: t.tags.filter((tg) => tg !== tag) }
            : t
        ),
      })),

    getAllTags: () => {
      const { tabs } = get();
      const tagSet = new Set<string>();
      tabs.filter((t) => t.origin !== "local").forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
      return Array.from(tagSet).sort();
    },

    setTagColor: (tag, color) =>
      set((s) => ({
        tagColors: { ...s.tagColors, [tag]: color },
      })),

    togglePin: (tabId) =>
      set((s) => ({
        tabs: s.tabs.map((t) =>
          t.id === tabId ? { ...t, pinned: !t.pinned } : t
        ),
      })),

    toggleView: () =>
      set((s) => {
        const cycle: ViewMode[] = ["editor", "split", "preview", "inline", "graph", "whiteboard", "mindmap", "kanban", "pdf"];
        const idx = cycle.indexOf(s.viewMode);
        return { viewMode: cycle[(idx + 1) % cycle.length] };
      }),

    setViewMode: (mode) => {
      const activeTab = (() => {
        const s = useEditorStore.getState();
        return s.tabs.find((t) => t.id === s.activeTabId);
      })();

      // Note-oriented modes should never try to render non-note content.
      // If a canvas/mindmap/etc. tab is active, create a fresh note tab first.
      if ((mode === "editor" || mode === "split" || mode === "preview" || mode === "inline") && activeTab && activeTab.noteType !== "note") {
        const tab = newTab(activeTab.folderId ?? null, "note", "blank");
        set((s) => ({
          tabs: [...s.tabs, tab],
          openTabIds: [...s.openTabIds, tab.id],
          activeTabId: tab.id,
          viewMode: mode,
        }));
        return;
      }

      // When switching to whiteboard/mindmap, create a new file if the active tab
      // is not already that type — never overwrite an existing file.
      if (mode === "whiteboard") {
        if (!activeTab || activeTab.noteType !== "whiteboard") {
          const tab = newTab(activeTab?.folderId ?? null, "whiteboard");
          set((s) => ({
            tabs: [...s.tabs, tab],
            openTabIds: [...s.openTabIds, tab.id],
            activeTabId: tab.id,
            viewMode: "whiteboard" as ViewMode,
          }));
          return;
        }
      }
      if (mode === "mindmap") {
        if (!activeTab || activeTab.noteType !== "mindmap") {
          const tab = newTab(activeTab?.folderId ?? null, "mindmap");
          set((s) => ({
            tabs: [...s.tabs, tab],
            openTabIds: [...s.openTabIds, tab.id],
            activeTabId: tab.id,
            viewMode: "mindmap" as ViewMode,
          }));
          return;
        }
      }
      if (mode === "kanban") {
        if (!activeTab || activeTab.noteType !== "kanban") {
          const tab = newTab(activeTab?.folderId ?? null, "kanban");
          set((s) => ({
            tabs: [...s.tabs, tab],
            openTabIds: [...s.openTabIds, tab.id],
            activeTabId: tab.id,
            viewMode: "kanban" as ViewMode,
          }));
          return;
        }
      }
      if (mode === "pdf") {
        if (!activeTab || activeTab.noteType !== "pdf") {
          const tab = newTab(activeTab?.folderId ?? null, "pdf");
          set((s) => ({
            tabs: [...s.tabs, tab],
            openTabIds: [...s.openTabIds, tab.id],
            activeTabId: tab.id,
            viewMode: "pdf" as ViewMode,
          }));
          return;
        }
      }
      // For note-type views, if the active tab is a canvas/mindmap, don't change it —
      // just update the viewMode so the next note tab will use it.
      set({ viewMode: mode });
    },

    toggleTheme: () =>
      set((s) => ({
        theme: s.theme === "dark" ? "light" : "dark",
      })),

    setZoomLevel: (level) => set({ zoomLevel: Math.max(50, Math.min(200, level)) }),

    setLocalSyncFolder: (folder) => set({ localSyncFolder: folder }),

    // Raw snippet insert
    insertSnippet: (snippet) => {
      const { editorView } = get();
      if (editorView) {
        const { from, to } = editorView.state.selection.main;
        const selected = editorView.state.sliceDoc(from, to);

        const text = snippet.includes("$SEL")
          ? snippet.replace("$SEL", selected)
          : snippet + selected;

        editorView.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
        });
        editorView.focus();
        return;
      }

      const s = get();
      if (!s.inlineSelection || !s.activeTabId) return;
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      if (!tab) return;

      const { lineIndex, from, to } = s.inlineSelection;
      const lines = tab.content.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return;
      const line = lines[lineIndex] ?? "";
      const selected = line.slice(from, to);

      const text = snippet.includes("$SEL")
        ? snippet.replace("$SEL", selected)
        : snippet + selected;

      lines[lineIndex] = line.slice(0, from) + text + line.slice(to);
      s.updateContent(tab.id, lines.join("\n"));

      queueMicrotask(() => {
        const el = get().inlineTextarea;
        if (!el) return;
        el.focus();
        const anchor = from + text.length;
        el.setSelectionRange(anchor, anchor);
        get().setInlineSelection({ lineIndex, from: anchor, to: anchor });
      });
    },

    // Smart line-prefix insert
    insertLinePrefix: (prefix) => {
      const { editorView } = get();
      if (editorView) {
        const state = editorView.state;
        const { from, to } = state.selection.main;

        const startLine = state.doc.lineAt(from);
        const endLine = state.doc.lineAt(to);

        const lines: string[] = [];
        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = state.doc.line(i);
          if (prefix === "1. ") {
            lines.push(`${i - startLine.number + 1}. ${line.text}`);
          } else if (prefix === "- [ ] ") {
            lines.push(`- [ ] ${line.text}`);
          } else {
            lines.push(`${prefix}${line.text}`);
          }
        }

        const replacement = lines.join("\n");
        editorView.dispatch({
          changes: { from: startLine.from, to: endLine.to, insert: replacement },
          selection: { anchor: startLine.from + replacement.length },
        });
        editorView.focus();
        return;
      }

      const s = get();
      if (!s.inlineSelection || !s.activeTabId) return;
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      if (!tab) return;

      const { lineIndex } = s.inlineSelection;
      const lines = tab.content.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return;

      const line = lines[lineIndex] ?? "";
      const nextLine =
        prefix === "1. "
          ? `1. ${line}`
          : prefix === "- [ ] "
          ? `- [ ] ${line}`
          : `${prefix}${line}`;

      lines[lineIndex] = nextLine;
      s.updateContent(tab.id, lines.join("\n"));

      queueMicrotask(() => {
        const el = get().inlineTextarea;
        if (!el) return;
        el.focus();
        const anchor = Math.min(prefix.length, nextLine.length);
        el.setSelectionRange(anchor, anchor);
        get().setInlineSelection({ lineIndex, from: anchor, to: anchor });
      });
    },

    // Wrap selection
    wrapSelection: (before, after) => {
      const { editorView } = get();
      if (editorView) {
        const { from, to } = editorView.state.selection.main;
        const beforeLen = before.length;
        const afterLen = after.length;

        const textBefore = from >= beforeLen ? editorView.state.sliceDoc(from - beforeLen, from) : "";
        const textAfter = editorView.state.sliceDoc(to, to + afterLen);

        if (textBefore === before && textAfter === after) {
          editorView.dispatch({
            changes: [
              { from: from - beforeLen, to: from, insert: "" },
              { from: to, to: to + afterLen, insert: "" },
            ],
            selection: { anchor: from - beforeLen, head: to - beforeLen },
          });
        } else {
          const selected = editorView.state.sliceDoc(from, to);
          const text = `${before}${selected}${after}`;
          editorView.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + beforeLen, head: from + beforeLen + selected.length },
          });
        }
        editorView.focus();
        return;
      }

      const s = get();
      if (!s.inlineSelection || !s.activeTabId) return;
      const tab = s.tabs.find((t) => t.id === s.activeTabId);
      if (!tab) return;

      const { lineIndex, from, to } = s.inlineSelection;
      const lines = tab.content.split("\n");
      if (lineIndex < 0 || lineIndex >= lines.length) return;
      const line = lines[lineIndex] ?? "";

      const beforeLen = before.length;
      const afterLen = after.length;
      const textBefore = from >= beforeLen ? line.slice(from - beforeLen, from) : "";
      const textAfter = line.slice(to, to + afterLen);

      let nextLine = line;
      let nextFrom = from;
      let nextTo = to;

      if (textBefore === before && textAfter === after) {
        nextLine = line.slice(0, from - beforeLen) + line.slice(from, to) + line.slice(to + afterLen);
        nextFrom = from - beforeLen;
        nextTo = to - beforeLen;
      } else {
        const selected = line.slice(from, to);
        nextLine = line.slice(0, from) + before + selected + after + line.slice(to);
        nextFrom = from + beforeLen;
        nextTo = from + beforeLen + selected.length;
      }

      lines[lineIndex] = nextLine;
      s.updateContent(tab.id, lines.join("\n"));

      queueMicrotask(() => {
        const el = get().inlineTextarea;
        if (!el) return;
        el.focus();
        el.setSelectionRange(nextFrom, nextTo);
        get().setInlineSelection({ lineIndex, from: nextFrom, to: nextTo });
      });
    },
  }))
);

// ---------------------------------------------------------------------------
// Auto-persist
// ---------------------------------------------------------------------------

let persistTimeout: ReturnType<typeof setTimeout> | null = null;

useEditorStore.subscribe(
  (s) => ({
    tabs: s.tabs,
    openTabIds: s.openTabIds,
    activeTabId: s.activeTabId,
    viewMode: s.viewMode,
    theme: s.theme,
    folders: s.folders,
    settings: s.settings,
    fileTreeOpen: s.fileTreeOpen,
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
    tagColors: s.tagColors,
    zoomLevel: s.zoomLevel,
    localSyncFolder: s.localSyncFolder,
  }),
  (slice) => {
    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
      saveToStorage(slice);
    }, 300);
  },
  { equalityFn: (a, b) => a === b }
);
