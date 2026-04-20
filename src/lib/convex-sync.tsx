"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { shallow } from "zustand/shallow";
import { api } from "../../convex/_generated/api";
import { getTabWorkspaceId, useEditorStore, DEFAULT_SETTINGS, WORKSPACE_PRESETS, type Settings, type NoteType, type Profile } from "@/lib/store";
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

const ALLOWED_SETTINGS_KEYS: Array<keyof Settings> = [
  "fontFamily", "fontSize", "lineHeight", "tabSize", "editorMargin", "accentColor", "hideMdExtensions",
  "letterSpacing", "maxLineWidth", "showInvisibleCharacters", "autoCloseBrackets", "autoCloseMarkdownFormatting",
  "autoFormatLists", "continueListOnEnter", "spellCheck", "autoPunctuation", "suggestCorrectionsOnDoubleTap", "smartQuotes", "smartDashes", "convertTabsToSpaces", "wordWrap",
  "highlightCurrentLine", "highlightMatchingBrackets", "cursorAnimation", "multiCursorSupport", "themeMode",
  "customThemeColors", "sidebarPosition", "sidebarWidth", "compactMode", "showIconsInSidebar", "showFileExtensions", "iconTheme",
  "promptForTemplateOnNewFile",
  "codeBlockTheme", "headingStyle", "linkStyle", "checkboxStyle", "customFontFamily",
  "fileTreeWidth", "splitRatio",
];

function sanitizeSettings(settings: Settings): Partial<Settings> {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => ALLOWED_SETTINGS_KEYS.includes(key as keyof Settings))
  ) as Partial<Settings>;
}

function mergeProfilesWithLocal(
  remoteProfiles: Array<{ id: string; name: string }> | undefined,
  localProfiles: Profile[]
): Profile[] {
  const baseProfiles = remoteProfiles?.length
    ? remoteProfiles
    : [{ id: "default", name: "Personal" }];

  return baseProfiles.map((remote, index) => {
    const local = localProfiles.find((profile) => profile.id === remote.id);
    return {
      id: remote.id,
      name: remote.name,
      color: local?.color ?? WORKSPACE_PRESETS[index % WORKSPACE_PRESETS.length]?.color ?? "#7c3aed",
      preset: local?.preset ?? "custom",
    };
  });
}

function filterOpenAndActiveToWorkspace(
  tabs: Array<{ id: string; workspaceId?: string }>,
  openTabIds: string[],
  activeTabId: string | null,
  activeProfileId: string
) {
  const visibleTabIds = new Set(
    tabs
      .filter((tab) => getTabWorkspaceId(tab) === activeProfileId)
      .map((tab) => tab.id)
  );

  const scopedOpenTabIds = openTabIds.filter((id) => visibleTabIds.has(id));
  const scopedActiveTabId = activeTabId && visibleTabIds.has(activeTabId)
    ? activeTabId
    : (scopedOpenTabIds[0] ?? null);

  return {
    scopedOpenTabIds,
    scopedActiveTabId,
  };
}

function resolveProfileForRequestedTab(
  tabs: Array<{ id: string; workspaceId?: string }>,
  requestedTabId: string | null,
  fallbackProfileId: string
) {
  if (!requestedTabId) return fallbackProfileId;
  const requestedTab = tabs.find((tab) => tab.id === requestedTabId);
  return requestedTab ? getTabWorkspaceId(requestedTab) : fallbackProfileId;
}

type SyncComparableTab = {
  tabId: string;
  title: string;
  content: string;
  workspaceId?: string;
  folderId: string | null;
  tags?: string[];
  pinned?: boolean;
  noteType?: string;
  customIcon?: string;
  iconColor?: string;
};

const SAVE_DEBOUNCE_MS = 1500;

function getTabSyncKey(tab: SyncComparableTab): string {
  return JSON.stringify([
    tab.title,
    tab.content,
    tab.workspaceId ?? null,
    tab.folderId,
    tab.tags ?? [],
    tab.pinned ?? false,
    tab.noteType ?? "note",
    tab.customIcon ?? null,
    tab.iconColor ?? null,
  ]);
}

function getSharedSyncKey(title: string, content: string): string {
  return JSON.stringify([title, content]);
}

/**
 * Bidirectional sync between the Zustand store and Convex.
 *
 * Tables:
 *   users      – upserted on every login
 *   tabs       – one row per file, synced incrementally via tabs.upsert/remove
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
  const isRecreating = useRef(false);

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
  const convex = useConvex();
  const upsertUser = useMutation(api.users.upsert);
  const saveWorkspace = useMutation(api.workspace.save);
  const upsertTab = useMutation(api.tabs.upsert);
  const removeTab = useMutation(api.tabs.remove);
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
  const lastPushedTabById = useRef<Map<string, string>>(new Map());
  const lastPushedWorkspace = useRef<string>("");
  const lastRemoteTabs = useRef<string>("");
  const lastRemoteWorkspace = useRef<string>("");
  // Track shared note content to detect collaborator edits
  const lastSharedContent = useRef<Map<string, string>>(new Map());
  const lastPushedSharedById = useRef<Map<string, string>>(new Map());
  const upsertedUserId = useRef<string | null>(null);

  const getRequestedTabOverride = useCallback((onlineTabIdSet: Set<string>) => {
    if (typeof window === "undefined") return null;

    const fromUrl = new URLSearchParams(window.location.search).get("tab")?.trim() ?? "";
    const fromSession = window.sessionStorage.getItem("markup-requested-tab-id")?.trim() ?? "";
    const candidate = fromUrl || fromSession;

    if (!candidate || !onlineTabIdSet.has(candidate)) return null;

    window.sessionStorage.removeItem("markup-requested-tab-id");
    return candidate;
  }, []);

  // ── Helper: push current local state to Convex ─────────────────────
  const pushCurrentState = useCallback(async () => {
    if (!userId) return;
    const slice = useEditorStore.getState();

    const onlineTabs = slice.tabs.filter((t) => t.origin !== "local");
    const activeWorkspaceOnlineTabIdSet = new Set(
      onlineTabs
        .filter((tab) => getTabWorkspaceId(tab) === slice.activeProfileId)
        .map((tab) => tab.id)
    );

    const tabsPayload = onlineTabs.map((t) => ({
      tabId: t.id,
      title: t.title,
      content: t.content,
      workspaceId: getTabWorkspaceId(t),
      folderId: t.folderId,
      tags: t.tags,
      pinned: t.pinned,
      noteType: t.noteType ?? "note",
      customIcon: t.customIcon,
      iconColor: t.iconColor,
    }));

    const nextTabStateById = new Map<string, string>();
    const changedTabs: typeof tabsPayload = [];
    for (const tab of tabsPayload) {
      const nextTabKey = getTabSyncKey(tab);
      nextTabStateById.set(tab.tabId, nextTabKey);
      if (lastPushedTabById.current.get(tab.tabId) !== nextTabKey) {
        changedTabs.push(tab);
      }
    }

    const removedTabIds = Array.from(lastPushedTabById.current.keys()).filter(
      (tabId) => !nextTabStateById.has(tabId)
    );

    const nextTabsKey = JSON.stringify(
      tabsPayload.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, workspaceId: t.workspaceId, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: t.noteType ?? "note", customIcon: t.customIcon, iconColor: t.iconColor }))
    );

    const sanitizedSettings = sanitizeSettings(slice.settings);
    // Only allow 'dark' or 'light' for theme
    const themeStr = String(slice.theme);
    const safeTheme = themeStr === "dark" || themeStr === "light" ? themeStr : (themeStr.toLowerCase().includes("dark") ? "dark" : "light");
    const workspacePayload = {
      activeTabId: slice.activeTabId && activeWorkspaceOnlineTabIdSet.has(slice.activeTabId) ? slice.activeTabId : null,
      openTabIds: slice.openTabIds.filter((id) => activeWorkspaceOnlineTabIdSet.has(id)),
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
      settings: sanitizedSettings,
      profiles: slice.profiles.map((p) => ({ id: p.id, name: p.name })),
      activeProfileId: slice.activeProfileId,
    };
    const nextWorkspaceKey = JSON.stringify(workspacePayload);

    const tabsChanged = changedTabs.length > 0 || removedTabIds.length > 0;
    const workspaceChanged = nextWorkspaceKey !== lastPushedWorkspace.current;

    if (!tabsChanged && !workspaceChanged) {
      return;
    }

    setSyncState({ status: "syncing", error: null });

    try {
      if (tabsChanged) {
        const tabWrites: Array<Promise<unknown>> = [];

        for (const tab of changedTabs) {
          tabWrites.push(
            upsertTab({
              userId,
              tabId: tab.tabId,
              title: tab.title,
              content: tab.content,
              workspaceId: tab.workspaceId,
              folderId: tab.folderId,
              tags: tab.tags,
              pinned: tab.pinned,
              noteType: tab.noteType,
              customIcon: tab.customIcon,
              iconColor: tab.iconColor,
            })
          );
        }

        for (const tabId of removedTabIds) {
          tabWrites.push(removeTab({ userId, tabId }));
        }

        if (tabWrites.length > 0) {
          await Promise.all(tabWrites);
        }
      }

      // Sync shared note content in real-time
      if (sharedTabs && changedTabs.length > 0) {
        const sharedTabIds = new Set(sharedTabs.map((s) => s.tabId));
        const sharedWrites: Array<Promise<unknown>> = [];
        for (const t of changedTabs) {
          if (sharedTabIds.has(t.tabId)) {
            const sharedKey = getSharedSyncKey(t.title, t.content);
            if (lastPushedSharedById.current.get(t.tabId) === sharedKey) {
              continue;
            }
            lastPushedSharedById.current.set(t.tabId, sharedKey);
            sharedWrites.push(
              updateSharedContent({
                ownerUserId: userId,
                tabId: t.tabId,
                title: t.title,
                content: t.content,
              })
            );
          }
        }
        if (sharedWrites.length > 0) {
          await Promise.all(sharedWrites);
        }
      }

      if (workspaceChanged) {
        await saveWorkspace({
          userId,
          ...workspacePayload,
        });
      }

      lastPushedTabs.current = nextTabsKey;
      lastPushedTabById.current = nextTabStateById;
      lastPushedWorkspace.current = nextWorkspaceKey;
      for (const removedTabId of removedTabIds) {
        lastPushedSharedById.current.delete(removedTabId);
      }

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });
    } catch (err) {
      console.error("[ConvexSync] push failed:", err);
      setSyncState({ status: "error", error: String(err) });
    }
  }, [userId, upsertTab, removeTab, saveWorkspace, sharedTabs, updateSharedContent]);

  // ── Manual sync: pull from Convex then push local state ────────────
  const manualSync = useCallback(async () => {
    if (!userId || !isAuthenticated) return;

    setSyncState({ status: "syncing", error: null });

    let latestWorkspace = workspace;
    let latestRemoteTabs = remoteTabs;

    try {
      const [freshWorkspace, freshTabs] = await Promise.all([
        convex.query(api.workspace.get, { userId }),
        convex.query(api.tabs.list, { userId }),
      ]);

      latestWorkspace = freshWorkspace;
      latestRemoteTabs = freshTabs;
    } catch (err) {
      console.error("[ConvexSync] manual pull failed:", err);
      // If we have no usable local snapshot, surface the error instead of pushing stale state.
      if (latestWorkspace === undefined || latestRemoteTabs === undefined) {
        setSyncState({ status: "error", error: String(err) });
        return;
      }
    }

    // If we already have remote data, apply it to the store first (pull)
    if (latestRemoteTabs && latestRemoteTabs.length > 0 && latestWorkspace) {
      isHydrating.current = true;

      const tabs = latestRemoteTabs.map((t) => ({
        id: t.tabId,
        title: t.title,
        content: t.content,
        workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined,
        folderId: t.folderId ?? null,
        tags: t.tags ?? [],
        pinned: t.pinned ?? false,
        noteType: (((t as Record<string, unknown>).noteType as string) ?? "note") as NoteType,
        customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
        iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
        origin: "online" as const,
      }));

      const current = useEditorStore.getState();
      const localTabs = current.tabs.filter((t) => t.origin === "local");
      const localTabIdSet = new Set(localTabs.map((t) => t.id));
      const mergedTabs = [...tabs, ...localTabs];
      const onlineTabIdSet = new Set(tabs.map((t) => t.id));
      const requestedTabId = getRequestedTabOverride(onlineTabIdSet);

      const baseRemoteOpenTabIds = latestWorkspace.openTabIds?.length
        ? latestWorkspace.openTabIds.filter((id) => onlineTabIdSet.has(id))
        : tabs.map((t) => t.id);
      const remoteOpenTabIds = requestedTabId
        ? Array.from(new Set([...baseRemoteOpenTabIds, requestedTabId]))
        : baseRemoteOpenTabIds;
      const localOpenTabIds = current.openTabIds.filter((id) => localTabIdSet.has(id));
      const mergedOpenTabIds = Array.from(new Set([...remoteOpenTabIds, ...localOpenTabIds]));

      const requestedActiveTabId =
        current.activeTabId && localTabIdSet.has(current.activeTabId)
          ? current.activeTabId
          : (requestedTabId ?? latestWorkspace.activeTabId ?? null);

      const nextActiveProfileId = resolveProfileForRequestedTab(
        mergedTabs,
        requestedTabId,
        latestWorkspace.activeProfileId ?? "default"
      );
      const { scopedOpenTabIds, scopedActiveTabId } = filterOpenAndActiveToWorkspace(
        mergedTabs,
        mergedOpenTabIds,
        requestedActiveTabId,
        nextActiveProfileId
      );
      const mergedRemoteSettings = { ...DEFAULT_SETTINGS, ...latestWorkspace.settings } as Settings;
      const mergedProfiles = mergeProfilesWithLocal(latestWorkspace.profiles, current.profiles);

      useEditorStore.setState({
        tabs: mergedTabs,
        openTabIds: scopedOpenTabIds,
        activeTabId: scopedActiveTabId,
        folders: (latestWorkspace.folders ?? []).map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: (latestWorkspace.viewMode as "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap" | "kanban" | "pdf") ?? "editor",
        theme: (latestWorkspace.theme === "dark" || latestWorkspace.theme === "light") ? latestWorkspace.theme : (latestWorkspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: latestWorkspace.fileTreeOpen ?? true,
        settings: mergedRemoteSettings,
        workspaceSettings: {
          ...current.workspaceSettings,
          [nextActiveProfileId]: mergedRemoteSettings,
        },
        profiles: mergedProfiles,
        activeProfileId: nextActiveProfileId,
      });

      lastPushedTabs.current = JSON.stringify(
        latestRemoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: ((t as Record<string, unknown>).noteType as string) ?? "note", customIcon: (t as Record<string, unknown>).customIcon as string | undefined, iconColor: (t as Record<string, unknown>).iconColor as string | undefined }))
      );
      lastPushedTabById.current = new Map(
        latestRemoteTabs.map((t) => {
          const comparableTab: SyncComparableTab = {
            tabId: t.tabId,
            title: t.title,
            content: t.content,
            workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined,
            folderId: t.folderId,
            tags: t.tags ?? [],
            pinned: t.pinned ?? false,
            noteType: ((t as Record<string, unknown>).noteType as string) ?? "note",
            customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
            iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
          };
          return [t.tabId, getTabSyncKey(comparableTab)] as const;
        })
      );
      const sanitizedRemoteSettings = sanitizeSettings(mergedRemoteSettings);
      lastPushedWorkspace.current = JSON.stringify({
        activeTabId: latestWorkspace.activeTabId,
        openTabIds: remoteOpenTabIds,
        folders: (latestWorkspace.folders ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          parentId: f.parentId ?? null,
          sortOrder: f.sortOrder,
        })),
        viewMode: latestWorkspace.viewMode,
        theme: (latestWorkspace.theme === "dark" || latestWorkspace.theme === "light") ? latestWorkspace.theme : (latestWorkspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: latestWorkspace.fileTreeOpen,
        settings: sanitizedRemoteSettings,
        profiles: latestWorkspace.profiles?.length
          ? latestWorkspace.profiles.map((p) => ({ id: p.id, name: p.name }))
          : [{ id: "default", name: "Personal" }],
        activeProfileId: latestWorkspace.activeProfileId ?? "default",
      });
      lastRemoteTabs.current = lastPushedTabs.current;
      lastRemoteWorkspace.current = lastPushedWorkspace.current;

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });

      requestAnimationFrame(() => {
        isHydrating.current = false;
      });
    } else {
      // No remote data — push local state up
      await pushCurrentState();
    }
  }, [userId, isAuthenticated, remoteTabs, workspace, pushCurrentState, getRequestedTabOverride, convex]);

  // Register the manual sync trigger so it can be called from UI
  useEffect(() => {
    _triggerManualSync = () => {
      void manualSync();
    };
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
    if (upsertedUserId.current === user.id) return;

    upsertUser({
      workosId: user.id,
      email: user.email,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      profilePictureUrl: user.profilePictureUrl ?? undefined,
    }).then(() => {
      upsertedUserId.current = user.id;
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
        workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined,
        folderId: t.folderId ?? null,
        tags: t.tags ?? [],
        pinned: t.pinned ?? false,
        noteType: (((t as Record<string, unknown>).noteType as string) ?? "note") as NoteType,
        customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
        iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
        origin: "online" as const,
      }));

      const current = useEditorStore.getState();
      const localTabs = current.tabs.filter((t) => t.origin === "local");
      const localTabIdSet = new Set(localTabs.map((t) => t.id));
      const mergedTabs = [...tabs, ...localTabs];
      const onlineTabIdSet = new Set(tabs.map((t) => t.id));
      const requestedTabId = getRequestedTabOverride(onlineTabIdSet);

      const baseRemoteOpenTabIds = workspace.openTabIds?.length
        ? workspace.openTabIds.filter((id) => onlineTabIdSet.has(id))
        : tabs.map((t) => t.id);
      const remoteOpenTabIds = requestedTabId
        ? Array.from(new Set([...baseRemoteOpenTabIds, requestedTabId]))
        : baseRemoteOpenTabIds;
      const localOpenTabIds = current.openTabIds.filter((id) => localTabIdSet.has(id));
      const mergedOpenTabIds = Array.from(new Set([...remoteOpenTabIds, ...localOpenTabIds]));

      const requestedActiveTabId =
        current.activeTabId && localTabIdSet.has(current.activeTabId)
          ? current.activeTabId
          : (requestedTabId ?? workspace.activeTabId ?? null);

      const nextActiveProfileId = resolveProfileForRequestedTab(
        mergedTabs,
        requestedTabId,
        workspace.activeProfileId ?? "default"
      );
      const { scopedOpenTabIds, scopedActiveTabId } = filterOpenAndActiveToWorkspace(
        mergedTabs,
        mergedOpenTabIds,
        requestedActiveTabId,
        nextActiveProfileId
      );
      const mergedRemoteSettings = { ...DEFAULT_SETTINGS, ...workspace.settings } as Settings;
      const mergedProfiles = mergeProfilesWithLocal(workspace.profiles, current.profiles);

      useEditorStore.setState({
        tabs: mergedTabs,
        openTabIds: scopedOpenTabIds,
        activeTabId: scopedActiveTabId,
        folders: (workspace.folders ?? []).map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: (workspace.viewMode as "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap" | "kanban" | "pdf") ?? "editor",
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen ?? true,
        settings: mergedRemoteSettings,
        workspaceSettings: {
          ...current.workspaceSettings,
          [nextActiveProfileId]: mergedRemoteSettings,
        },
        profiles: mergedProfiles,
        activeProfileId: nextActiveProfileId,
        _hydrated: true,
      });

      // Record what we just loaded as our "last pushed" baseline
      lastPushedTabs.current = JSON.stringify(
        remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: ((t as Record<string, unknown>).noteType as string) ?? "note", customIcon: (t as Record<string, unknown>).customIcon as string | undefined, iconColor: (t as Record<string, unknown>).iconColor as string | undefined }))
      );
      lastPushedTabById.current = new Map(
        remoteTabs.map((t) => {
          const comparableTab: SyncComparableTab = {
            tabId: t.tabId,
            title: t.title,
            content: t.content,
            workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined,
            folderId: t.folderId,
            tags: t.tags ?? [],
            pinned: t.pinned ?? false,
            noteType: ((t as Record<string, unknown>).noteType as string) ?? "note",
            customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
            iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
          };
          return [t.tabId, getTabSyncKey(comparableTab)] as const;
        })
      );
      const sanitizedRemoteSettings = sanitizeSettings(mergedRemoteSettings);
      lastPushedWorkspace.current = JSON.stringify({
        activeTabId: workspace.activeTabId,
        openTabIds: remoteOpenTabIds,
        folders: (workspace.folders ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          parentId: f.parentId ?? null,
          sortOrder: f.sortOrder,
        })),
        viewMode: workspace.viewMode,
        theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (workspace.theme?.toString().toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: workspace.fileTreeOpen,
        settings: sanitizedRemoteSettings,
        profiles: workspace.profiles?.length
          ? workspace.profiles.map((p) => ({ id: p.id, name: p.name }))
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
      });
      lastRemoteTabs.current = lastPushedTabs.current;
      lastRemoteWorkspace.current = lastPushedWorkspace.current;

      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });

      requestAnimationFrame(() => {
        isHydrating.current = false;
      });
    } else if (!didInitialSave.current) {
      // No data in Convex yet — push current local state up
      didInitialSave.current = true;
      const s = useEditorStore.getState();
      const initialTabs = s.tabs.filter((t) => t.origin !== "local").map((t) => ({
        tabId: t.id,
        title: t.title,
        content: t.content,
        workspaceId: getTabWorkspaceId(t),
        folderId: t.folderId,
        tags: t.tags,
        pinned: t.pinned,
        noteType: t.noteType ?? "note",
        customIcon: t.customIcon,
        iconColor: t.iconColor,
      }));

      syncAllTabs({
        userId,
        tabs: initialTabs,
      }).catch(console.error);

      setSyncState({ status: "syncing", error: null });

      const sanitizedSettings = sanitizeSettings(s.settings);
      const onlineTabIdsInActiveWorkspace = new Set(
        s.tabs
          .filter((tab) => tab.origin !== "local" && getTabWorkspaceId(tab) === s.activeProfileId)
          .map((tab) => tab.id)
      );
      saveWorkspace({
        userId,
        activeTabId: s.activeTabId && onlineTabIdsInActiveWorkspace.has(s.activeTabId) ? s.activeTabId : null,
        openTabIds: s.openTabIds.filter((id) => onlineTabIdsInActiveWorkspace.has(id)),
        folders: s.folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          parentId: f.parentId,
          sortOrder: f.sortOrder,
        })),
        viewMode: s.viewMode,
        theme: (s.theme === "dark" || s.theme === "light") ? s.theme : (String(s.theme).toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: s.fileTreeOpen,
        settings: sanitizedSettings as Settings,
        profiles: s.profiles.map((p) => ({ id: p.id, name: p.name })),
        activeProfileId: s.activeProfileId,
      }).then(() => {
        lastPushedTabs.current = JSON.stringify(
          initialTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, workspaceId: t.workspaceId, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: t.noteType ?? "note", customIcon: t.customIcon, iconColor: t.iconColor }))
        );
        lastPushedTabById.current = new Map(
          initialTabs.map((t) => [t.tabId, getTabSyncKey(t)] as const)
        );
        lastPushedWorkspace.current = JSON.stringify({
          activeTabId: s.activeTabId && onlineTabIdsInActiveWorkspace.has(s.activeTabId) ? s.activeTabId : null,
          openTabIds: s.openTabIds.filter((id) => onlineTabIdsInActiveWorkspace.has(id)),
          folders: s.folders.map((f) => ({
            id: f.id,
            name: f.name,
            color: f.color,
            parentId: f.parentId,
            sortOrder: f.sortOrder,
          })),
          viewMode: s.viewMode,
          theme: (s.theme === "dark" || s.theme === "light") ? s.theme : (String(s.theme).toLowerCase().includes("dark") ? "dark" : "light"),
          fileTreeOpen: s.fileTreeOpen,
          settings: sanitizeSettings(s.settings),
          profiles: s.profiles.map((p) => ({ id: p.id, name: p.name })),
          activeProfileId: s.activeProfileId,
        });
        setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });
      }).catch((err) => {
        console.error("[ConvexSync] initial push failed:", err);
        setSyncState({ status: "error", error: String(err) });
      });
    }
  }, [isLoading, isAuthenticated, userId, workspace, remoteTabs, saveWorkspace, syncAllTabs, getRequestedTabOverride]);

  // ── Auto-recreate: if data is deleted from Convex, push local state back up ──
  useEffect(() => {
    if (isLoading || !isAuthenticated || !userId || !hasHydratedFromConvex.current) return;
    if (workspace === undefined || remoteTabs === undefined) return;

    // If workspace is missing, recreate it
    if (workspace === null && !isRecreating.current) {
      console.log("[ConvexSync] Workspace missing in Convex, recreating...");
      isRecreating.current = true;
      pushCurrentState().finally(() => {
        isRecreating.current = false;
      });
      return;
    }

    // If tabs are missing (and we have online tabs locally), recreate them
    if (remoteTabs && remoteTabs.length === 0 && useEditorStore.getState().tabs.some((t) => t.origin !== "local") && !isRecreating.current) {
      // Check if we also have an empty workspace (new user) or if this is a deletion
      // But here we assume deletion if we have local tabs but no remote tabs
      console.log("[ConvexSync] Tabs missing in Convex, recreating...");
      isRecreating.current = true;
      pushCurrentState().finally(() => {
        isRecreating.current = false;
      });
    }
  }, [workspace, remoteTabs, isLoading, isAuthenticated, userId, pushCurrentState]);

  // ── Live sync: apply remote changes from other devices ──────────────
  useEffect(() => {
    if (!hasHydratedFromConvex.current) return;
    if (!remoteTabs || !workspace) return;
    if (isHydrating.current) return;

    // Check if tabs changed from what we last pushed
    const incomingTabsKey = JSON.stringify(
      remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: ((t as Record<string, unknown>).noteType as string) ?? "note" }))
    );

    const incomingWorkspaceKey = JSON.stringify({
      activeTabId: workspace.activeTabId ?? null,
      openTabIds: workspace.openTabIds ?? [],
      folders: (workspace.folders ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        parentId: f.parentId ?? null,
        sortOrder: f.sortOrder,
      })),
      viewMode: workspace.viewMode,
      theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (String(workspace.theme).toLowerCase().includes("dark") ? "dark" : "light"),
      fileTreeOpen: workspace.fileTreeOpen ?? true,
      settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...workspace.settings } as Settings),
      profiles: workspace.profiles?.length
        ? workspace.profiles.map((p) => ({ id: p.id, name: p.name }))
        : [{ id: "default", name: "Personal" }],
      activeProfileId: workspace.activeProfileId ?? "default",
    });

    const remoteChanged =
      incomingTabsKey !== lastRemoteTabs.current ||
      incomingWorkspaceKey !== lastRemoteWorkspace.current;

    if (!remoteChanged) return;

    const isOwnEcho =
      incomingTabsKey === lastPushedTabs.current &&
      incomingWorkspaceKey === lastPushedWorkspace.current;

    if (isOwnEcho) {
      lastRemoteTabs.current = incomingTabsKey;
      lastRemoteWorkspace.current = incomingWorkspaceKey;
      setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });
      return;
    }

    // External change detected — apply to store
    isHydrating.current = true;

    const tabs = remoteTabs.map((t) => ({
      id: t.tabId,
      title: t.title,
      content: t.content,
      workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined,
      folderId: t.folderId ?? null,
      tags: t.tags ?? [],
      pinned: t.pinned ?? false,
      noteType: (((t as Record<string, unknown>).noteType as string) ?? "note") as NoteType,
      customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
      iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
      origin: "online" as const,
    }));

    const current = useEditorStore.getState();
    const localTabs = current.tabs.filter((t) => t.origin === "local");
    const localTabIdSet = new Set(localTabs.map((t) => t.id));
    const mergedTabs = [...tabs, ...localTabs];
    const onlineTabIdSet = new Set(tabs.map((t) => t.id));
    const requestedTabId = getRequestedTabOverride(onlineTabIdSet);

    const currentActiveId = current.activeTabId;
    const activeStillExists = currentActiveId ? onlineTabIdSet.has(currentActiveId) : false;
    // Use remote openTabIds if available, otherwise keep current open tabs that still exist
    const baseRemoteOpenTabIds = workspace.openTabIds?.length
      ? workspace.openTabIds.filter((id) => onlineTabIdSet.has(id))
      : current.openTabIds.filter((id) => onlineTabIdSet.has(id));
    const remoteOpenTabIds = requestedTabId
      ? Array.from(new Set([...baseRemoteOpenTabIds, requestedTabId]))
      : baseRemoteOpenTabIds;
    const localOpenTabIds = current.openTabIds.filter((id) => localTabIdSet.has(id));
    const updatedOpenTabIds = Array.from(new Set([...remoteOpenTabIds, ...localOpenTabIds]));

    const requestedActiveTabId =
      currentActiveId && localTabIdSet.has(currentActiveId)
        ? currentActiveId
        : (requestedTabId ?? (activeStillExists ? currentActiveId : (workspace.activeTabId ?? null)));
    const nextActiveProfileId = resolveProfileForRequestedTab(
      mergedTabs,
      requestedTabId,
      workspace.activeProfileId ?? "default"
    );
    const { scopedOpenTabIds, scopedActiveTabId } = filterOpenAndActiveToWorkspace(
      mergedTabs,
      updatedOpenTabIds,
      requestedActiveTabId,
      nextActiveProfileId
    );

    // Only update settings if they actually changed to prevent unnecessary editor recreations
    const currentSettings = useEditorStore.getState().settings;
    const newSettings = { ...DEFAULT_SETTINGS, ...workspace.settings } as Settings;
    const settingsChanged = JSON.stringify(currentSettings) !== JSON.stringify(newSettings);
    const mergedProfiles = mergeProfilesWithLocal(workspace.profiles, current.profiles);

    useEditorStore.setState({
      tabs: mergedTabs,
      openTabIds: scopedOpenTabIds,
      activeTabId: scopedActiveTabId,
      folders: (workspace.folders ?? []).map((f) => ({
        ...f,
        parentId: f.parentId ?? null,
      })),
      viewMode: (workspace.viewMode as "editor" | "split" | "preview" | "graph" | "whiteboard" | "mindmap" | "kanban" | "pdf") ?? "editor",
      theme: (workspace.theme === "dark" || workspace.theme === "light") ? workspace.theme : (String(workspace.theme).toLowerCase().includes("dark") ? "dark" : "light"),
      fileTreeOpen: workspace.fileTreeOpen ?? true,
      ...(settingsChanged ? { settings: newSettings } : {}),
      workspaceSettings: {
        ...current.workspaceSettings,
        [nextActiveProfileId]: newSettings,
      },
      profiles: mergedProfiles,
      activeProfileId: nextActiveProfileId,
    });

    lastPushedTabs.current = incomingTabsKey;
    lastPushedTabById.current = new Map(
      remoteTabs.map((t) => {
        const comparableTab: SyncComparableTab = {
          tabId: t.tabId,
          title: t.title,
          content: t.content,
          workspaceId: (t as Record<string, unknown>).workspaceId as string | undefined,
          folderId: t.folderId,
          tags: t.tags ?? [],
          pinned: t.pinned ?? false,
          noteType: ((t as Record<string, unknown>).noteType as string) ?? "note",
          customIcon: (t as Record<string, unknown>).customIcon as string | undefined,
          iconColor: (t as Record<string, unknown>).iconColor as string | undefined,
        };
        return [t.tabId, getTabSyncKey(comparableTab)] as const;
      })
    );
    lastPushedWorkspace.current = incomingWorkspaceKey;
    lastRemoteTabs.current = incomingTabsKey;
    lastRemoteWorkspace.current = incomingWorkspaceKey;

    setSyncState({ status: "synced", lastSyncedAt: Date.now(), error: null });

    requestAnimationFrame(() => {
      isHydrating.current = false;
    });
  }, [remoteTabs, workspace, getRequestedTabOverride]);

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
          newTabs
            .filter((t) => t.origin !== "local")
            .map((t) => ({ tabId: t.id, title: t.title, content: t.content, workspaceId: t.workspaceId, folderId: t.folderId, tags: t.tags ?? [], pinned: t.pinned ?? false, noteType: t.noteType ?? "note", customIcon: t.customIcon, iconColor: t.iconColor }))
        );
        requestAnimationFrame(() => { isHydrating.current = false; });
      }
    };

    applyCollabUpdates();
  }, [sharedTabs]);

  // ── Persist store changes → Convex (debounced) ─────────────────────
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const unsub = useEditorStore.subscribe(
      (s) => ({
        tabs: s.tabs,
        openTabIds: s.openTabIds,
        activeTabId: s.activeTabId,
        folders: s.folders,
        viewMode: s.viewMode,
        theme: (s.theme === "dark" || s.theme === "light") ? s.theme : (String(s.theme).toLowerCase().includes("dark") ? "dark" : "light"),
        fileTreeOpen: s.fileTreeOpen,
        settings: s.settings,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
      }),
      () => {
        if (isHydrating.current) return;

        // If offline, mark that we have pending changes to push later
        if (!navigator.onLine) {
          pendingPush.current = true;
          return;
        }

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
          pushCurrentState();
        }, SAVE_DEBOUNCE_MS);
      },
      { equalityFn: shallow }
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
