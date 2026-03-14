"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEditorStore, DEFAULT_SETTINGS, type Settings, type NoteType } from "@/lib/store";
import { useAuthState } from "@/components/convex-client-provider";

// ---------------------------------------------------------------------------
// Sync state – shared across the app (same pattern as auth state)
// ---------------------------------------------------------------------------

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline" | "disabled";

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null; // epoch ms
  error: string | null;
}

let _syncState: SyncState = {
  status: "idle",
  lastSyncedAt: null,
  error: null,
};
const _syncListeners = new Set<() => void>();

function setSyncState(next: Partial<SyncState>) {
  _syncState = { ..._syncState, ...next };
  _syncListeners.forEach((fn) => fn());
}

/** Hook to read the current sync state from anywhere. */
export function useSyncState(): SyncState {
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    _syncListeners.add(cb);
    return () => { _syncListeners.delete(cb); };
  }, []);
  return _syncState;
}

// Manual sync trigger – set by ConvexSync, callable from anywhere
let _triggerManualSync: (() => void) | null = null;

export function triggerManualSync() {
  _triggerManualSync?.();
}

/**
 * Bidirectional sync between the Zustand store and Convex.
 *
 * Tables:
 *   users      – upserted on every login
 *   tabs       – one row per file, synced via tabs.syncAll
 *   workspaces – UI state + settings (no tabs)
 *
 * Live sync: after initial hydration, incoming Convex changes from
 * other devices are applied to the local store.
 *
 * Offline support: changes save locally to IndexedDB automatically.
 * When the browser goes offline, Convex pushes are deferred.
 * On reconnect, the current local state is flushed to Convex.
 */
export function ConvexSync() {
  const { isAuthenticated, isLoading, user } = useAuthState();
  const userId = user?.id ?? null;
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const pendingPush = useRef(false);

  // ── Queries ─────────────────────────────────────────────────────────
  const workspace = useQuery(
    api.workspace.get,
    userId ? { userId } : "skip"
  );
  const remoteTabs = useQuery(
    api.tabs.list,
    userId ? { userId } : "skip"
  );

  // ── Mutations ───────────────────────────────────────────────────────
  const upsertUser = useMutation(api.users.upsert);
  const saveWorkspace = useMutation(api.workspace.save);
  const syncAllTabs = useMutation(api.tabs.syncAll);
  const updateSharedContent = useMutation(api.sharing.updateContent);

  // Track which tabs are shared so we can push updates
  const sharedTabs = useQuery(
    api.sharing.listByOwner,
    userId ? { ownerUserId: userId } : "skip"
  );

  const isHydrating = useRef(false);
  const hasHydratedFromConvex = useRef(false);
  const didInitialSave = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track what we last pushed so we can distinguish our own echoes
  const lastPushedTabs = useRef<string>("");
  const lastPushedWorkspace = useRef<string>("");
  // Track shared note content to detect collaborator edits
  const lastSharedContent = useRef<Map<string, string>>(new Map());

  // ── Helper: push current local state to Convex ─────────────────────
  const pushCurrentState = useCallback(async () => {
    if (!userId) return;
    const slice = useEditorStore.getState();

    const tabsPayload = slice.tabs.map((t) => ({
      tabId: t.id,
      title: t.title,
      content: t.content,
      folderId: t.folderId,
      tags: t.tags,
      pinned: t.pinned,
      noteType: t.noteType ?? "note",
      customIcon: t.customIcon,
      iconColor: t.iconColor,
    }));

    lastPushedTabs.current = JSON.stringify(
      tabsPayload.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: t.noteType ?? "note" }))
    );
    // Only allow 'dark' or 'light' for theme
    const safeTheme = slice.theme === "dark" || slice.theme === "light" ? slice.theme : (slice.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light");
    lastPushedWorkspace.current = JSON.stringify({
      activeTabId: slice.activeTabId,
      viewMode: slice.viewMode,
      theme: safeTheme,
      fileTreeOpen: slice.fileTreeOpen,
    });

    setSyncState({ status: "syncing", error: null });

    try {
      await syncAllTabs({ userId, tabs: tabsPayload });

      // Sync shared note content in real-time
      if (sharedTabs) {
        const sharedTabIds = new Set(sharedTabs.map((s) => s.tabId));
        for (const t of slice.tabs) {
          if (sharedTabIds.has(t.id)) {
            updateSharedContent({
              ownerUserId: userId,
              tabId: t.id,
              title: t.title,
              content: t.content,
            }).catch(console.error);
          }
        }
      }


      // Only send allowed fields to Convex (must match settingsValidator)
      const allowedSettingsKeys = [
        "fontFamily", "fontSize", "lineHeight", "tabSize", "editorMargin", "accentColor", "hideMdExtensions",
        "letterSpacing", "maxLineWidth", "showInvisibleCharacters", "autoCloseBrackets", "autoCloseMarkdownFormatting",
        "autoFormatLists", "continueListOnEnter", "smartQuotes", "smartDashes", "convertTabsToSpaces", "wordWrap",
        "highlightCurrentLine", "highlightMatchingBrackets", "cursorAnimation", "multiCursorSupport", "themeMode",
        "sidebarPosition", "sidebarWidth", "compactMode", "showIconsInSidebar", "showFileExtensions", "iconTheme",
        "codeBlockTheme", "headingStyle", "linkStyle", "checkboxStyle", "customFontFamily"
      ];
      const sanitizedSettings = Object.fromEntries(
        Object.entries(slice.settings).filter(([k]) => allowedSettingsKeys.includes(k))
      );

      await saveWorkspace({
        userId,
        activeTabId: slice.activeTabId,
        openTabIds: slice.openTabIds,
        folders: slice.folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          parentId: f.parentId,
          sortOrder: f.sortOrder,
        })),
        viewMode: slice.viewMode,
        theme: safeTheme,
        fileTreeOpen: slice.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...sanitizedSettings } as Settings,
        profiles: slice.profiles.map((p) => ({ id: p.id, name: p.name })),
        activeProfileId: slice.activeProfileId,
      });

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });
    } catch (err) {
      console.error("[ConvexSync] push failed:", err);
      setSyncState({ status: "error", error: String(err) });
    }
  }, [userId, syncAllTabs, saveWorkspace, sharedTabs, updateSharedContent]);

  // ── Manual sync: pull from Convex then push local state ────────────
  const manualSync = useCallback(() => {
    if (!userId || !isAuthenticated) return;

    // If we already have remote data, apply it to the store first (pull)
    if (remoteTabs && remoteTabs.length > 0 && workspace) {
      isHydrating.current = true;

      const tabs = remoteTabs.map((t) => ({
        id: t.tabId,
        title: t.title,
        content: t.content,
        folderId: t.folderId ?? null,
        tags: t.tags ?? [],
        pinned: t.pinned ?? false,
        noteType: (((t as Record<string, unknown>).noteType as string) ?? "note") as NoteType,
        customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
        iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
      }));

      useEditorStore.setState({
        tabs,
        openTabIds: workspace.openTabIds?.length
          ? workspace.openTabIds.filter((id) => tabs.some((t) => t.id === id))
          : tabs.map((t) => t.id),
        activeTabId: workspace.activeTabId,
        folders: workspace.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: workspace.viewMode as "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap",
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...workspace.settings } as Settings,
        profiles: workspace.profiles?.length
          ? workspace.profiles
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
      });

      lastPushedTabs.current = JSON.stringify(
        remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: ((t as Record<string, unknown>).noteType as string) ?? "note" }))
      );
      lastPushedWorkspace.current = JSON.stringify({
        activeTabId: workspace.activeTabId,
        viewMode: workspace.viewMode,
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen,
      });

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });

      requestAnimationFrame(() => {
        isHydrating.current = false;
      });
    } else {
      // No remote data — push local state up
      pushCurrentState();
    }
  }, [userId, isAuthenticated, remoteTabs, workspace, pushCurrentState]);

  // Register the manual sync trigger so it can be called from UI
  useEffect(() => {
    _triggerManualSync = manualSync;
    return () => { _triggerManualSync = null; };
  }, [manualSync]);

  // ── Update sync state based on auth/connection ─────────────────────
  useEffect(() => {
    if (!isAuthenticated || !userId) {
      setSyncState({ status: "disabled", error: null });
    } else if (!isOnline) {
      setSyncState({ status: "offline", error: null });
    }
  }, [isAuthenticated, userId, isOnline]);

  // ── Online / Offline detection ─────────────────────────────────────
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Flush local changes accumulated while offline
      if (pendingPush.current && isAuthenticated && userId) {
        pendingPush.current = false;
        pushCurrentState();
      }
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [isAuthenticated, userId, pushCurrentState]);

  // ── Upsert user on login ────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    upsertUser({
      workosId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      profilePictureUrl: user.profilePictureUrl ?? undefined,
    }).catch(console.error);
  }, [isAuthenticated, user, upsertUser]);

  // ── Hydrate store from Convex ───────────────────────────────────────
  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId) return;
    if (hasHydratedFromConvex.current) return;
    // Wait for both queries to finish loading
    if (workspace === undefined || remoteTabs === undefined) return;

    hasHydratedFromConvex.current = true;

    if (workspace && remoteTabs && remoteTabs.length > 0) {
      // Hydrate from Convex
      isHydrating.current = true;

      const tabs = remoteTabs.map((t) => ({
        id: t.tabId,
        title: t.title,
        content: t.content,
        folderId: t.folderId ?? null,
        tags: t.tags ?? [],
        pinned: t.pinned ?? false,
        noteType: (((t as Record<string, unknown>).noteType as string) ?? "note") as NoteType,
        customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
        iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
      }));

      useEditorStore.setState({
        tabs,
        openTabIds: workspace.openTabIds?.length ? workspace.openTabIds.filter((id) => tabs.some((t) => t.id === id)) : tabs.map((t) => t.id),
        activeTabId: workspace.activeTabId,
        folders: workspace.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: workspace.viewMode as "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap",
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...workspace.settings } as Settings,
        profiles: workspace.profiles?.length
          ? workspace.profiles
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
        _hydrated: true,
      });

      // Record what we just loaded as our "last pushed" baseline
      lastPushedTabs.current = JSON.stringify(
        remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false }))
      );
      lastPushedWorkspace.current = JSON.stringify({
        activeTabId: workspace.activeTabId,
        viewMode: workspace.viewMode,
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen,
      });

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });

      requestAnimationFrame(() => {
        isHydrating.current = false;
      });
    } else if (!didInitialSave.current) {
      // No data in Convex yet — push current local state up
      didInitialSave.current = true;
      const s = useEditorStore.getState();

      syncAllTabs({
        userId,
        tabs: s.tabs.map((t) => ({
          tabId: t.id,
          title: t.title,
          content: t.content,
          folderId: t.folderId,
          tags: t.tags,
          pinned: t.pinned,
          noteType: t.noteType ?? "note",
          customIcon: t.customIcon,
          iconColor: t.iconColor,
        })),
      }).catch(console.error);

      setSyncState({ status: "syncing", error: null });

      // Only send allowed fields to Convex (must match settingsValidator)
      const allowedSettingsKeys = [
        "fontFamily", "fontSize", "lineHeight", "tabSize", "editorMargin", "accentColor", "hideMdExtensions",
        "letterSpacing", "maxLineWidth", "showInvisibleCharacters", "autoCloseBrackets", "autoCloseMarkdownFormatting",
        "autoFormatLists", "continueListOnEnter", "smartQuotes", "smartDashes", "convertTabsToSpaces", "wordWrap",
        "highlightCurrentLine", "highlightMatchingBrackets", "cursorAnimation", "multiCursorSupport", "themeMode",
        "sidebarPosition", "sidebarWidth", "compactMode", "showIconsInSidebar", "showFileExtensions", "iconTheme",
        "codeBlockTheme", "headingStyle", "linkStyle", "checkboxStyle", "customFontFamily"
      ];
      const sanitizedSettings = Object.fromEntries(
        Object.entries(s.settings).filter(([k]) => allowedSettingsKeys.includes(k))
      );
      saveWorkspace({
        userId,
        activeTabId: s.activeTabId,
        openTabIds: s.openTabIds,
        folders: s.folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          parentId: f.parentId,
          sortOrder: f.sortOrder,
        })),
        viewMode: s.viewMode,
        theme: (s.theme === "dark" || s.theme === "light") ? s.theme : (s.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: s.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...sanitizedSettings } as Settings,
        profiles: s.profiles.map((p) => ({ id: p.id, name: p.name })),
        activeProfileId: s.activeProfileId,
      }).then(() => {
        setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });
      }).catch((err) => {
        console.error("[ConvexSync] initial push failed:", err);
        setSyncState({ status: "error", error: String(err) });
      });
    }
  }, [isLoading, isAuthenticated, userId, workspace, remoteTabs, saveWorkspace, syncAllTabs]);

  // ── Live sync: apply remote changes from other devices ──────────────
  useEffect(() => {
    if (!hasHydratedFromConvex.current) return;
    if (!remoteTabs || !workspace) return;
    if (isHydrating.current) return;

    // Check if tabs changed from what we last pushed
    const incomingTabsKey = JSON.stringify(
      remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: ((t as Record<string, unknown>).noteType as string) ?? "note" }))
    );

    if (incomingTabsKey !== lastPushedTabs.current) {
      // External change detected — apply to store
      isHydrating.current = true;

      const tabs = remoteTabs.map((t) => ({
        id: t.tabId,
        title: t.title,
        content: t.content,
        folderId: t.folderId ?? null,
        tags: t.tags ?? [],
        pinned: t.pinned ?? false,
        noteType: (((t as Record<string, unknown>).noteType as string) ?? "note") as NoteType,
        customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
        iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
      }));

      const currentActiveId = useEditorStore.getState().activeTabId;
      const activeStillExists = tabs.some((t) => t.id === currentActiveId);
      // Use remote openTabIds if available, otherwise keep current open tabs that still exist
      const tabIdSet = new Set(tabs.map((t) => t.id));
      const updatedOpenTabIds = workspace.openTabIds?.length
        ? workspace.openTabIds.filter((id) => tabIdSet.has(id))
        : useEditorStore.getState().openTabIds.filter((id) => tabIdSet.has(id));

      // Only update settings if they actually changed to prevent unnecessary editor recreations
      const currentSettings = useEditorStore.getState().settings;
      const newSettings = { ...DEFAULT_SETTINGS, ...workspace.settings } as Settings;
      const settingsChanged = JSON.stringify(currentSettings) !== JSON.stringify(newSettings);

      useEditorStore.setState({
        tabs,
        openTabIds: updatedOpenTabIds,
        activeTabId: activeStillExists ? currentActiveId : workspace.activeTabId,
        folders: workspace.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: workspace.viewMode as "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap",
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen,
        ...(settingsChanged ? { settings: newSettings } : {}),
        profiles: workspace.profiles?.length
          ? workspace.profiles
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
      });

      lastPushedTabs.current = incomingTabsKey;

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });

      requestAnimationFrame(() => {
        isHydrating.current = false;
      });
    }
  }, [remoteTabs, workspace]);

  // ── Reverse sync: apply collaborator edits on shared notes back to owner ──
  useEffect(() => {
    if (!hasHydratedFromConvex.current || !sharedTabs) return;

    const applyCollabUpdates = () => {
      // If another sync is in progress, retry after it clears
      if (isHydrating.current) {
        requestAnimationFrame(applyCollabUpdates);
        return;
      }

      let changed = false;
      const updates: Array<{ tabId: string; content: string; title: string }> = [];

      for (const shared of sharedTabs) {
        if (shared.permission !== "edit") continue;
        const lastContent = lastSharedContent.current.get(shared.tabId);
        // Also compare with the owner's current local content to avoid no-ops
        const localTab = useEditorStore.getState().tabs.find((t) => t.id === shared.tabId);
        const localContent = localTab?.content;
        // Only process if we have a baseline (skip initial load)
        // AND the shared content differs from our local content
        if (lastContent !== undefined && shared.content !== lastContent && shared.content !== localContent) {
          updates.push({ tabId: shared.tabId, content: shared.content, title: shared.title });
          changed = true;
        }
        lastSharedContent.current.set(shared.tabId, shared.content);
      }

      if (changed) {
        const currentTabs = useEditorStore.getState().tabs;
        const newTabs = currentTabs.map((t) => {
          const update = updates.find((u) => u.tabId === t.id);
          if (update) return { ...t, content: update.content, title: update.title };
          return t;
        });
        isHydrating.current = true;
        useEditorStore.setState({ tabs: newTabs });
        // Also update lastPushedTabs to prevent main sync from overwriting
        lastPushedTabs.current = JSON.stringify(
          newTabs.map((t) => ({ tabId: t.id, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false }))
        );
        requestAnimationFrame(() => { isHydrating.current = false; });
      }
    };

    applyCollabUpdates();
  }, [sharedTabs]);

  // ── Persist store changes → Convex (debounced 500ms) ───────────────
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const unsub = useEditorStore.subscribe(
      (s) => ({
        tabs: s.tabs,
        openTabIds: s.openTabIds,
        activeTabId: s.activeTabId,
        folders: s.folders,
        viewMode: s.viewMode,
        theme: (s.theme === "dark" || s.theme === "light") ? s.theme : (s.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: s.fileTreeOpen,
        // Only send allowed fields to Convex (must match settingsValidator)
        settings: Object.fromEntries(
          Object.entries(s.settings).filter(([k]) => [
            "fontFamily", "fontSize", "lineHeight", "tabSize", "editorMargin", "accentColor", "hideMdExtensions",
            "letterSpacing", "maxLineWidth", "showInvisibleCharacters", "autoCloseBrackets", "autoCloseMarkdownFormatting",
            "autoFormatLists", "continueListOnEnter", "smartQuotes", "smartDashes", "convertTabsToSpaces", "wordWrap",
            "highlightCurrentLine", "highlightMatchingBrackets", "cursorAnimation", "multiCursorSupport", "themeMode",
            "sidebarPosition", "sidebarWidth", "compactMode", "showIconsInSidebar", "showFileExtensions", "iconTheme",
            "codeBlockTheme", "headingStyle", "linkStyle", "checkboxStyle", "customFontFamily"
          ].includes(k))
        ),
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
      }),
      (slice) => {
        if (isHydrating.current) return;

        // If offline, mark that we have pending changes to push later
        if (!navigator.onLine) {
          pendingPush.current = true;
          return;
        }

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
          pushCurrentState();
        }, 500);
      },
      { equalityFn: (a, b) => a === b }
    );

    return () => {
      unsub();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [isAuthenticated, userId, pushCurrentState]);

  // ── Offline banner ──────────────────────────────────────────────────
  if (!isOnline) {
    return (
      <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-xs text-yellow-400 shadow-lg backdrop-blur-sm">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
        Offline — changes saved locally, will sync when reconnected
      </div>
    );
  }

  return null;
}
