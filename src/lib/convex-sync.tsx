"use client";

import { useEffect, useRef } from "react";
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
 */
export function ConvexSync() {
  const { isAuthenticated, isLoading, user } = useAuthState();
  const userId = user?.id ?? null;

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
      }));

      useEditorStore.setState({
        tabs,
        activeTabId: workspace.activeTabId,
        folders: workspace.folders.map((f) => ({
          ...f,
          parentId: f.parentId ?? null,
        })),
        viewMode: workspace.viewMode as "editor" | "split" | "preview",
        theme: workspace.theme as "dark" | "light",
        fileTreeOpen: workspace.fileTreeOpen,
        settings: { ...DEFAULT_SETTINGS, ...workspace.settings },
        profiles: workspace.profiles?.length
          ? workspace.profiles
          : [{ id: "default", name: "Personal" }],
        activeProfileId: workspace.activeProfileId ?? "default",
        _hydrated: true,
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

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
          // Sync tabs
          syncAllTabs({
            userId: userId!,
            tabs: slice.tabs.map((t) => ({
              tabId: t.id,
              title: t.title,
              content: t.content,
              folderId: t.folderId,
            })),
          }).catch(console.error);

          // Sync workspace state
          saveWorkspace({
            userId: userId!,
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
            profiles: slice.profiles.map((p) => ({
              id: p.id,
              name: p.name,
            })),
            activeProfileId: slice.activeProfileId,
          }).catch(console.error);
        }, 500);
      },
      { equalityFn: (a, b) => a === b }
    );

    return () => {
      unsub();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [isAuthenticated, userId, saveWorkspace, syncAllTabs]);

  return null;
}
