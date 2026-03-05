"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEditorStore, DEFAULT_SETTINGS } from "@/lib/store";
import { useAuthState } from "@/components/convex-client-provider";

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

  const isHydrating = useRef(false);
  const hasHydratedFromConvex = useRef(false);
  const didInitialSave = useRef(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track what we last pushed so we can distinguish our own echoes
  const lastPushedTabs = useRef<string>("");
  const lastPushedWorkspace = useRef<string>("");

  // ── Helper: push current local state to Convex ─────────────────────
  const pushCurrentState = useCallback(() => {
    if (!userId) return;
    const slice = useEditorStore.getState();

    const tabsPayload = slice.tabs.map((t) => ({
      tabId: t.id,
      title: t.title,
      content: t.content,
      folderId: t.folderId,
      tags: t.tags,
    }));

    lastPushedTabs.current = JSON.stringify(
      tabsPayload.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [] }))
    );
    lastPushedWorkspace.current = JSON.stringify({
      activeTabId: slice.activeTabId,
      viewMode: slice.viewMode,
      theme: slice.theme,
      fileTreeOpen: slice.fileTreeOpen,
    });

    syncAllTabs({ userId, tabs: tabsPayload }).catch(console.error);

    saveWorkspace({
      userId,
      activeTabId: slice.activeTabId,
      folders: slice.folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        parentId: f.parentId,
        sortOrder: f.sortOrder,
      })),
      viewMode: slice.viewMode,
      theme: slice.theme,
      fileTreeOpen: slice.fileTreeOpen,
      settings: slice.settings,
      profiles: slice.profiles.map((p) => ({ id: p.id, name: p.name })),
      activeProfileId: slice.activeProfileId,
    }).catch(console.error);
  }, [userId, syncAllTabs, saveWorkspace]);

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
      }));

      useEditorStore.setState({
        tabs,
        activeTabId: workspace.activeTabId,
        folders: workspace.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: workspace.viewMode as "editor" | "split" | "preview" | "graph",
        theme: workspace.theme as "dark" | "light",
        fileTreeOpen: workspace.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...workspace.settings },
        profiles: workspace.profiles?.length
          ? workspace.profiles
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
        _hydrated: true,
      });

      // Record what we just loaded as our "last pushed" baseline
      lastPushedTabs.current = JSON.stringify(
        remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [] }))
      );
      lastPushedWorkspace.current = JSON.stringify({
        activeTabId: workspace.activeTabId,
        viewMode: workspace.viewMode,
        theme: workspace.theme,
        fileTreeOpen: workspace.fileTreeOpen,
      });

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
        })),
      }).catch(console.error);

      saveWorkspace({
        userId,
        activeTabId: s.activeTabId,
        folders: s.folders.map((f) => ({
          id: f.id,
          name: f.name,
          color: f.color,
          parentId: f.parentId,
          sortOrder: f.sortOrder,
        })),
        viewMode: s.viewMode,
        theme: s.theme,
        fileTreeOpen: s.fileTreeOpen,
        settings: s.settings,
        profiles: s.profiles.map((p) => ({ id: p.id, name: p.name })),
        activeProfileId: s.activeProfileId,
      }).catch(console.error);
    }
  }, [isLoading, isAuthenticated, userId, workspace, remoteTabs, saveWorkspace, syncAllTabs]);

  // ── Live sync: apply remote changes from other devices ──────────────
  useEffect(() => {
    if (!hasHydratedFromConvex.current) return;
    if (!remoteTabs || !workspace) return;
    if (isHydrating.current) return;

    // Check if tabs changed from what we last pushed
    const incomingTabsKey = JSON.stringify(
      remoteTabs.map((t) => ({ tabId: t.tabId, title: t.title, content: t.content, folderId: t.folderId, tags: t.tags ?? [] }))
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
      }));

      const currentActiveId = useEditorStore.getState().activeTabId;
      const activeStillExists = tabs.some((t) => t.id === currentActiveId);

      useEditorStore.setState({
        tabs,
        activeTabId: activeStillExists ? currentActiveId : workspace.activeTabId,
        folders: workspace.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: workspace.viewMode as "editor" | "split" | "preview" | "graph",
        theme: workspace.theme as "dark" | "light",
        fileTreeOpen: workspace.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...workspace.settings },
        profiles: workspace.profiles?.length
          ? workspace.profiles
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
      });

      lastPushedTabs.current = incomingTabsKey;

      requestAnimationFrame(() => {
        isHydrating.current = false;
      });
    }
  }, [remoteTabs, workspace]);

  // ── Persist store changes → Convex (debounced 500ms) ───────────────
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const unsub = useEditorStore.subscribe(
      (s) => ({
        tabs: s.tabs,
        activeTabId: s.activeTabId,
        folders: s.folders,
        viewMode: s.viewMode,
        theme: s.theme,
        fileTreeOpen: s.fileTreeOpen,
        settings: s.settings,
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
