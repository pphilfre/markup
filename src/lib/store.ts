import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { EditorView } from "@codemirror/view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewMode = "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap" | "inline";
export type Theme = "dark" | "light";
export type ThemeMode = "light" | "dark" | "system" | "solarized-light" | "nord-dark" | "catppuccin-mocha" | "catppuccin-latte" | "gruvbox-dark" | "gruvbox-light" | "tokyo-night" | "everforest-light" | "uwu";
export type NoteType = "note" | "whiteboard" | "mindmap";
export type TabOrigin = "online" | "local";

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
  smartQuotes: false,
  smartDashes: false,
  convertTabsToSpaces: true,
  // Editing
  wordWrap: true,
  highlightCurrentLine: true,
  highlightMatchingBrackets: true,
  cursorAnimation: "blink",
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

function newTab(folderId: string | null = null, noteType: NoteType = "note"): Tab {
  tabCounter += 1;
  const prefix = noteType === "whiteboard" ? "Whiteboard" : noteType === "mindmap" ? "Mindmap" : "Untitled";
  const ext = noteType === "whiteboard" ? ".canvas" : noteType === "mindmap" ? ".mindmap" : ".md";
  return {
    id: crypto.randomUUID(),
    title: `${prefix}-${tabCounter}${ext}`,
    content: noteType === "note" ? "" : JSON.stringify(
      noteType === "whiteboard"
        ? { elements: [], canvasSettings: {} }
        : { nodes: [], connections: [], settings: {} }
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
      const color = FOLDER_COLORS[folders.length % FOLDER_COLORS.length];
      set({
        folders: [
          ...folders,
          { id, name, color, parentId, sortOrder: folders.length },
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
          folders: s.folders.filter((f) => !toDelete.has(f.id)),
          tabs: s.tabs.map((t) => (t.folderId && toDelete.has(t.folderId) ? { ...t, folderId: null } : t)),
        };
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

    // ── Hydrate ────────────────────────────────────────────────────────
    hydrate: async () => {
      const saved = await loadFromStorage();
      if (saved && saved.tabs.length > 0) {
        const maxNum = saved.tabs.reduce((max, t) => {
          const m = t.title.match(/^Untitled-(\d+)\.md$/);
          return m ? Math.max(max, parseInt(m[1], 10)) : max;
        }, 0);
        tabCounter = maxNum;

        set({
          tabs: saved.tabs.map((t) => ({ ...t, folderId: t.folderId ?? null, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: (t as Tab & { noteType?: NoteType }).noteType ?? "note" })),
          openTabIds: saved.openTabIds ?? saved.tabs.map((t) => t.id),
          activeTabId: saved.activeTabId,
          viewMode: saved.viewMode,
          theme: saved.theme ?? "dark",
          folders: saved.folders ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
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
        const vm = (s.viewMode === "preview" || s.viewMode === "whiteboard" || s.viewMode === "mindmap") ? "editor" : s.viewMode;
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
        else if (vm === "whiteboard" || vm === "mindmap") vm = "editor";
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
      else if (vm === "whiteboard" || vm === "mindmap") vm = "editor";
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
        else if (vm === "whiteboard" || vm === "mindmap") vm = "editor";

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
        const cycle: ViewMode[] = ["editor", "split", "preview", "inline", "graph", "whiteboard", "mindmap"];
        const idx = cycle.indexOf(s.viewMode);
        return { viewMode: cycle[(idx + 1) % cycle.length] };
      }),

    setViewMode: (mode) => {
      const activeTab = (() => {
        const s = useEditorStore.getState();
        return s.tabs.find((t) => t.id === s.activeTabId);
      })();

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
