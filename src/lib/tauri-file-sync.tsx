"use client";

import { useEffect, useRef, useCallback } from "react";
import { useEditorStore, type Tab, type NoteType } from "@/lib/store";
import { isTauri } from "@/lib/tauri";

/**
 * TauriFileSync — Bidirectional sync between the app and a local folder.
 *
 * When `localSyncFolder` is set in the store:
 * 1. On mount, scans the folder for .md / .canvas / .mindmap files
 * 2. Merges with existing tabs (by filename matching)
 * 3. Writes new/changed tabs to the folder
 * 4. Watches for external changes and updates the store
 */

const SYNC_EXTENSIONS = [".md", ".canvas", ".mindmap"];
const SYNC_INTERVAL_MS = 5000; // Poll every 5 seconds for changes

function extensionToNoteType(ext: string): NoteType {
  if (ext === ".canvas") return "whiteboard";
  if (ext === ".mindmap") return "mindmap";
  return "note";
}

function noteTypeToExtension(noteType: NoteType): string {
  if (noteType === "whiteboard") return ".canvas";
  if (noteType === "mindmap") return ".mindmap";
  return ".md";
}

interface LocalFile {
  name: string;
  content: string;
  noteType: NoteType;
}

async function readLocalFiles(folder: string): Promise<LocalFile[]> {
  const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(folder);
  const files: LocalFile[] = [];

  for (const entry of entries) {
    if (!entry.name || entry.isDirectory) continue;
    const ext = SYNC_EXTENSIONS.find((e) => entry.name!.endsWith(e));
    if (!ext) continue;
    try {
      const content = await readTextFile(`${folder}/${entry.name}`);
      files.push({
        name: entry.name,
        content,
        noteType: extensionToNoteType(ext),
      });
    } catch {
      // Skip unreadable files
    }
  }
  return files;
}

async function writeTabToFolder(folder: string, tab: Tab): Promise<void> {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const filename = ensureExtension(tab.title, tab.noteType);
  await writeTextFile(`${folder}/${filename}`, tab.content);
}

function ensureExtension(title: string, noteType: NoteType): string {
  const expectedExt = noteTypeToExtension(noteType);
  if (title.endsWith(expectedExt)) return title;
  // Remove any existing known extension before adding the right one
  for (const ext of SYNC_EXTENSIONS) {
    if (title.endsWith(ext)) return title.slice(0, -ext.length) + expectedExt;
  }
  return title + expectedExt;
}

export function TauriFileSync() {
  const localSyncFolder = useEditorStore((s) => s.localSyncFolder);
  const hydrated = useEditorStore((s) => s._hydrated);
  const lastSyncedContent = useRef<Map<string, string>>(new Map());
  const isSyncing = useRef(false);
  const initialSyncDone = useRef(false);

  const syncToFolder = useCallback(async () => {
    if (!localSyncFolder || isSyncing.current) return;
    isSyncing.current = true;

    try {
      const { exists, mkdir } = await import("@tauri-apps/plugin-fs");
      // Ensure folder exists
      const folderExists = await exists(localSyncFolder);
      if (!folderExists) {
        await mkdir(localSyncFolder, { recursive: true });
      }

      const localFiles = await readLocalFiles(localSyncFolder);
      const tabs = useEditorStore.getState().tabs;
      const localFileMap = new Map(localFiles.map((f) => [f.name, f]));
      const tabFilenameMap = new Map(
        tabs.map((t) => [ensureExtension(t.title, t.noteType), t])
      );

      // --- Initial sync: import local-only files into store ---
      if (!initialSyncDone.current) {
        initialSyncDone.current = true;
        const newTabs: Tab[] = [];

        for (const [filename, localFile] of localFileMap) {
          if (!tabFilenameMap.has(filename)) {
            // File exists locally but not in store — import it
            newTabs.push({
              id: crypto.randomUUID(),
              title: filename,
              content: localFile.content,
              folderId: null,
              tags: [],
              pinned: false,
              noteType: localFile.noteType,
            });
          }
        }

        if (newTabs.length > 0) {
          const currentTabs = useEditorStore.getState().tabs;
          useEditorStore.setState({
            tabs: [...currentTabs, ...newTabs],
          });
        }

        // Initialize content tracking
        for (const tab of [...tabs, ...newTabs]) {
          const fn = ensureExtension(tab.title, tab.noteType);
          lastSyncedContent.current.set(fn, tab.content);
        }
      }

      // --- Ongoing sync: write changed tabs to folder ---
      const currentTabs = useEditorStore.getState().tabs;
      for (const tab of currentTabs) {
        const filename = ensureExtension(tab.title, tab.noteType);
        const lastContent = lastSyncedContent.current.get(filename);

        if (lastContent !== tab.content) {
          // Tab content changed — write to local file
          try {
            await writeTabToFolder(localSyncFolder, tab);
            lastSyncedContent.current.set(filename, tab.content);
          } catch {
            // Write failed — skip
          }
        }
      }

      // --- Ongoing sync: read changes from folder back into store ---
      const freshLocalFiles = initialSyncDone.current ? await readLocalFiles(localSyncFolder) : localFiles;
      let storeChanged = false;
      const updatedTabs = [...useEditorStore.getState().tabs];

      for (const localFile of freshLocalFiles) {
        const lastContent = lastSyncedContent.current.get(localFile.name);
        if (lastContent !== undefined && localFile.content !== lastContent) {
          // File changed externally — update store
          const tabIdx = updatedTabs.findIndex(
            (t) => ensureExtension(t.title, t.noteType) === localFile.name
          );
          if (tabIdx !== -1 && updatedTabs[tabIdx].content !== localFile.content) {
            updatedTabs[tabIdx] = { ...updatedTabs[tabIdx], content: localFile.content };
            storeChanged = true;
          }
          lastSyncedContent.current.set(localFile.name, localFile.content);
        }
      }

      if (storeChanged) {
        useEditorStore.setState({ tabs: updatedTabs });
      }
    } catch {
      // Sync error — silently continue
    } finally {
      isSyncing.current = false;
    }
  }, [localSyncFolder]);

  // Run sync on mount and periodically
  useEffect(() => {
    if (!isTauri() || !localSyncFolder || !hydrated) return;

    // Initial sync
    syncToFolder();

    // Periodic sync
    const interval = setInterval(syncToFolder, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [localSyncFolder, hydrated, syncToFolder]);

  // Sync whenever tabs change (debounced via the interval)
  useEffect(() => {
    if (!isTauri() || !localSyncFolder || !hydrated) return;

    const unsub = useEditorStore.subscribe(
      (s) => s.tabs,
      () => {
        // Trigger a sync soon after tab changes
        syncToFolder();
      },
      { equalityFn: (a, b) => a === b }
    );

    return unsub;
  }, [localSyncFolder, hydrated, syncToFolder]);

  return null;
}
