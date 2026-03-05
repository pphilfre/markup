import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { EditorView } from "@codemirror/view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewMode = "editor" | "split" | "preview" | "graph";
export type Theme = "dark" | "light";

export interface Tab {
  id: string;
  title: string;
  content: string;
  folderId: string | null; // null = root
  tags: string[]; // user-defined tags
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
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: 14,
  lineHeight: 1.7,
  tabSize: 2,
  editorMargin: 24,
  accentColor: "#7c3aed",
  hideMdExtensions: false,
};

interface EditorState {
  tabs: Tab[];
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

  // Tab actions
  createTab: (folderId?: string | null) => void;
  closeTab: (id: string) => void;
  switchTab: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  updateTitle: (id: string, title: string) => void;
  renameTab: (id: string, title: string) => void;

  // Tags
  addTag: (tabId: string, tag: string) => void;
  removeTag: (tabId: string, tag: string) => void;
  getAllTags: () => string[];

  // View
  toggleView: () => void;
  setViewMode: (mode: ViewMode) => void;

  // Theme
  toggleTheme: () => void;

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

function newTab(folderId: string | null = null): Tab {
  tabCounter += 1;
  return {
    id: crypto.randomUUID(),
    title: `Untitled-${tabCounter}.md`,
    content: "",
    folderId,
    tags: [],
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
  activeTabId: string | null;
  viewMode: ViewMode;
  theme: Theme;
  folders: Folder[];
  settings: Settings;
  fileTreeOpen: boolean;
  profiles: Profile[];
  activeProfileId: string;
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
    activeTabId: null,
    viewMode: "editor",
    theme: "dark",
    editorView: null,
    _hydrated: false,
    folders: [],
    settings: { ...DEFAULT_SETTINGS },
    fileTreeOpen: true,
    profiles: [...DEFAULT_PROFILES],
    activeProfileId: DEFAULT_PROFILE_ID,

    setEditorView: (view) => set({ editorView: view }),

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
      set((s) => ({
        folders: s.folders.filter((f) => f.id !== id),
        // Move files in that folder to root
        tabs: s.tabs.map((t) =>
          t.folderId === id ? { ...t, folderId: null } : t
        ),
      })),

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
          tabs: saved.tabs.map((t) => ({ ...t, folderId: t.folderId ?? null, tags: t.tags ?? [] })),
          activeTabId: saved.activeTabId,
          viewMode: saved.viewMode,
          theme: saved.theme ?? "dark",
          folders: saved.folders ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
          fileTreeOpen: saved.fileTreeOpen ?? true,
          profiles: saved.profiles?.length ? saved.profiles : [...DEFAULT_PROFILES],
          activeProfileId: saved.activeProfileId ?? DEFAULT_PROFILE_ID,
          _hydrated: true,
        });
      } else {
        const tab = newTab();
        set({
          tabs: [tab],
          activeTabId: tab.id,
          _hydrated: true,
        });
      }
    },

    createTab: (folderId = null) => {
      const tab = newTab(folderId);
      set((s) => ({
        tabs: [...s.tabs, tab],
        activeTabId: tab.id,
        viewMode: s.viewMode === "preview" ? "editor" : s.viewMode,
      }));
    },

    closeTab: (id) => {
      const { tabs, activeTabId } = get();
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;

      const next = tabs.filter((t) => t.id !== id);

      let nextActive = activeTabId;
      if (activeTabId === id) {
        if (next.length === 0) {
          nextActive = null;
        } else if (idx >= next.length) {
          nextActive = next[next.length - 1].id;
        } else {
          nextActive = next[idx].id;
        }
      }

      set({ tabs: next, activeTabId: nextActive });
    },

    switchTab: (id) => set({ activeTabId: id }),

    updateContent: (id, content) =>
      set((s) => ({
        tabs: s.tabs.map((t) => {
          if (t.id !== id) return t;
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
      tabs.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
      return Array.from(tagSet).sort();
    },

    toggleView: () =>
      set((s) => {
        const cycle: ViewMode[] = ["editor", "split", "preview", "graph"];
        const idx = cycle.indexOf(s.viewMode);
        return { viewMode: cycle[(idx + 1) % cycle.length] };
      }),

    setViewMode: (mode) => set({ viewMode: mode }),

    toggleTheme: () =>
      set((s) => ({
        theme: s.theme === "dark" ? "light" : "dark",
      })),

    // Raw snippet insert
    insertSnippet: (snippet) => {
      const { editorView } = get();
      if (!editorView) return;

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
    },

    // Smart line-prefix insert
    insertLinePrefix: (prefix) => {
      const { editorView } = get();
      if (!editorView) return;

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
    },

    // Wrap selection
    wrapSelection: (before, after) => {
      const { editorView } = get();
      if (!editorView) return;

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
    activeTabId: s.activeTabId,
    viewMode: s.viewMode,
    theme: s.theme,
    folders: s.folders,
    settings: s.settings,
    fileTreeOpen: s.fileTreeOpen,
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
  }),
  (slice) => {
    if (persistTimeout) clearTimeout(persistTimeout);
    persistTimeout = setTimeout(() => {
      saveToStorage(slice);
    }, 300);
  },
  { equalityFn: (a, b) => a === b }
);