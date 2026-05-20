"use client";

import { createContext, useCallback, useContext, useEffect } from "react";
import { useQuery as useConvexQuery, useMutation as useConvexMutation } from "convex/react";
import useSWR from "swr";
import { api } from "../../convex/_generated/api";
import type { DbProvider } from "@/lib/db-provider";
import { apiBase, getDesktopToken, isTauri } from "@/lib/tauri";
import type {
  DbMindmap,
  DbPdfMetadata,
  DbSharedNote,
  DbSite,
  DbTab,
  DbUser,
  DbWhiteboard,
  DbWorkspace,
} from "@/lib/db-types";

export type DbQueryMap = {
  "workspace.get": { args: { userId: string }; result: DbWorkspace | null };
  "tabs.list": { args: { userId: string }; result: DbTab[] };
  "sharing.listByOwner": { args: { ownerUserId: string }; result: DbSharedNote[] };
  "sharing.getByShareId": { args: { shareId: string }; result: DbSharedNote | null };
  "sharing.getByOwnerTab": { args: { ownerUserId: string; tabId: string }; result: DbSharedNote | null };
  "sites.getBySlug": { args: { slug?: string }; result: DbSite | null };
  "sites.getByOwnerTab": { args: { ownerUserId: string; tabId: string }; result: DbSite | null };
  "whiteboards.get": { args: { userId: string }; result: DbWhiteboard | null };
  "mindmaps.get": { args: { userId: string }; result: DbMindmap | null };
  "pdfFiles.getFileUrl": { args: { userId: string; tabId: string }; result: string | null };
};

export type DbMutationMap = {
  "users.upsert": { args: DbUser; result: string };
  "workspace.save": { args: DbWorkspace; result: void };
  "tabs.upsert": { args: DbTab; result: void };
  "tabs.remove": { args: { userId: string; tabId: string }; result: void };
  "tabs.syncAll": { args: { userId: string; tabs: Array<Omit<DbTab, "userId">> }; result: void };
  "sharing.share": {
    args: {
      ownerUserId: string;
      tabId: string;
      title: string;
      content: string;
      visibility: string;
      permission: string;
      allowedUsers: string[];
      noteType?: string;
      whiteboardData?: string;
      mindmapData?: string;
    };
    result: string;
  };
  "sharing.updateContent": {
    args: { ownerUserId: string; tabId: string; title: string; content: string };
    result: void;
  };
  "sharing.updateByShareId": {
    args: { shareId: string; title: string; content: string };
    result: void;
  };
  "sharing.updateSettings": {
    args: { ownerUserId: string; tabId: string; visibility: string; permission: string; allowedUsers: string[] };
    result: void;
  };
  "sharing.unshare": { args: { ownerUserId: string; tabId: string }; result: void };
  "sites.publish": {
    args: { ownerUserId: string; tabId: string; slug: string; title: string; content: string };
    result: { slug: string };
  };
  "sites.unpublish": { args: { ownerUserId: string; tabId: string }; result: { ok: boolean } };
  "pdfFiles.generateUploadUrl": { args: Record<string, never>; result: string };
  "pdfFiles.upsert": { args: DbPdfMetadata & { storageId: string }; result: void };
  "whiteboards.save": { args: DbWhiteboard; result: void };
  "mindmaps.save": { args: DbMindmap; result: void };
};

export type DbQueryKey = keyof DbQueryMap;
export type DbMutationKey = keyof DbMutationMap;

export interface DbHooks {
  useQuery<K extends DbQueryKey>(
    key: K,
    args: DbQueryMap[K]["args"] | "skip"
  ): DbQueryMap[K]["result"] | undefined;
  useMutation<K extends DbMutationKey>(
    key: K
  ): (args: DbMutationMap[K]["args"]) => Promise<DbMutationMap[K]["result"]>;
}

const convexQueryMap: Record<DbQueryKey, unknown> = {
  "workspace.get": api.workspace.get,
  "tabs.list": api.tabs.list,
  "sharing.listByOwner": api.sharing.listByOwner,
  "sharing.getByShareId": api.sharing.getByShareId,
  "sharing.getByOwnerTab": api.sharing.getByOwnerTab,
  "sites.getBySlug": api.sites.getBySlug,
  "sites.getByOwnerTab": api.sites.getByOwnerTab,
  "whiteboards.get": api.whiteboards.get,
  "mindmaps.get": api.mindmaps.get,
  "pdfFiles.getFileUrl": api.pdfFiles.getFileUrl,
};

const convexMutationMap: Record<DbMutationKey, unknown> = {
  "users.upsert": api.users.upsert,
  "workspace.save": api.workspace.save,
  "tabs.upsert": api.tabs.upsert,
  "tabs.remove": api.tabs.remove,
  "tabs.syncAll": api.tabs.syncAll,
  "sharing.share": api.sharing.share,
  "sharing.updateContent": api.sharing.updateContent,
  "sharing.updateByShareId": api.sharing.updateByShareId,
  "sharing.updateSettings": api.sharing.updateSettings,
  "sharing.unshare": api.sharing.unshare,
  "sites.publish": api.sites.publish,
  "sites.unpublish": api.sites.unpublish,
  "pdfFiles.generateUploadUrl": api.pdfFiles.generateUploadUrl,
  "pdfFiles.upsert": api.pdfFiles.upsert,
  "whiteboards.save": api.whiteboards.save,
  "mindmaps.save": api.mindmaps.save,
};

const POSTGRES_POLLING_MS: Partial<Record<DbQueryKey, number>> = {
  "workspace.get": 5000,
  "tabs.list": 5000,
  "sharing.listByOwner": 5000,
  "sharing.getByOwnerTab": 5000,
  "sharing.getByShareId": 2000,
  "sites.getByOwnerTab": 10000,
  "sites.getBySlug": 10000,
  "whiteboards.get": 5000,
  "mindmaps.get": 5000,
};

function buildAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (isTauri()) {
    const token = getDesktopToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

function dbUrl(path: string): string {
  return `${apiBase()}${path}`;
}

async function postDbQuery<K extends DbQueryKey>(
  key: K,
  args: DbQueryMap[K]["args"]
): Promise<DbQueryMap[K]["result"]> {
  const res = await fetch(dbUrl("/api/db/query"), {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ key, args }),
  });

  const payload = (await res.json().catch(() => null)) as
    | { error?: string }
    | DbQueryMap[K]["result"]
    | null;

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Request failed (${res.status}).`;
    throw new Error(message);
  }

  return payload as DbQueryMap[K]["result"];
}

async function postDbMutation<K extends DbMutationKey>(
  key: K,
  args: DbMutationMap[K]["args"]
): Promise<DbMutationMap[K]["result"]> {
  const res = await fetch(dbUrl("/api/db/mutation"), {
    method: "POST",
    headers: buildAuthHeaders(),
    credentials: "include",
    body: JSON.stringify({ key, args }),
  });

  const payload = (await res.json().catch(() => null)) as
    | { error?: string }
    | DbMutationMap[K]["result"]
    | null;

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Request failed (${res.status}).`;
    throw new Error(message);
  }

  return payload as DbMutationMap[K]["result"];
}

const convexHooks: DbHooks = {
  useQuery: (key, args) => {
    const ref = convexQueryMap[key];
    return useConvexQuery(ref as never, args as never) as never;
  },
  useMutation: (key) => {
    const ref = convexMutationMap[key];
    return useConvexMutation(ref as never) as never;
  },
};

const postgresHooks: DbHooks = {
  useQuery: (key, args) => {
    const argsKey = args === "skip" ? null : JSON.stringify(args);
    const refreshInterval = POSTGRES_POLLING_MS[key] ?? 0;
    const swrKey = argsKey ? ["postgres-query", key, argsKey] : null;

    const { data, error } = useSWR(
      swrKey,
      () => postDbQuery(key, args as DbQueryMap[typeof key]["args"]),
      {
        refreshInterval,
        revalidateOnFocus: false,
      }
    );

    useEffect(() => {
      if (error) {
        console.error(`[db] query ${key} failed`, error);
      }
    }, [error, key]);

    return data as DbQueryMap[typeof key]["result"] | undefined;
  },
  useMutation: (key) => {
    return useCallback(
      async (args: DbMutationMap[typeof key]["args"]) =>
        postDbMutation(key, args),
      [key]
    );
  },
};

const DbHooksContext = createContext<DbHooks | null>(null);

export function DbHooksProvider({
  provider,
  children,
}: {
  provider: DbProvider;
  children: React.ReactNode;
}) {
  const value = provider === "postgres" ? postgresHooks : convexHooks;
  return (
    <DbHooksContext.Provider value={value}>
      {children}
    </DbHooksContext.Provider>
  );
}

export function useDbHooks(): DbHooks {
  const ctx = useContext(DbHooksContext);
  if (!ctx) {
    throw new Error("DbHooksProvider is missing in the component tree.");
  }
  return ctx;
}

export function useDbQuery<K extends DbQueryKey>(
  key: K,
  args: DbQueryMap[K]["args"] | "skip"
): DbQueryMap[K]["result"] | undefined {
  const db = useDbHooks();
  return db.useQuery(key, args);
}

export function useDbMutation<K extends DbMutationKey>(
  key: K
): (args: DbMutationMap[K]["args"]) => Promise<DbMutationMap[K]["result"]> {
  const db = useDbHooks();
  return db.useMutation(key);
}
