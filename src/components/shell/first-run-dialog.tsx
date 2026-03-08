"use client";

import { useState, useCallback } from "react";
import { useEditorStore } from "@/lib/store";
import { isTauri } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen, SkipForward } from "lucide-react";

/**
 * On first install in Tauri, prompts the user to choose a local folder
 * for file sync. Shows a "Skip" button to dismiss.
 */
export function FirstRunDialog() {
  const localSyncFolder = useEditorStore((s) => s.localSyncFolder);
  const setLocalSyncFolder = useEditorStore((s) => s.setLocalSyncFolder);
  const hydrated = useEditorStore((s) => s._hydrated);

  // Track whether the user has dismissed this dialog (persisted via a flag in localStorage)
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("markup-first-run-dismissed") === "true";
  });

  const shouldShow = isTauri() && hydrated && !localSyncFolder && !dismissed;

  const handleChooseFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({
        directory: true,
        title: "Choose where to save your files",
      });
      if (folder) {
        setLocalSyncFolder(folder as string);
        localStorage.setItem("markup-first-run-dismissed", "true");
        setDismissed(true);
      }
    } catch {
      // Dialog cancelled or not available
    }
  }, [setLocalSyncFolder]);

  const handleSkip = useCallback(() => {
    localStorage.setItem("markup-first-run-dismissed", "true");
    setDismissed(true);
  }, []);

  if (!shouldShow) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Markup</DialogTitle>
          <DialogDescription>
            Choose a folder to save your files locally. You can always change this later in Settings → Data.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4">
          <Button onClick={handleChooseFolder} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Choose Folder
          </Button>
          <Button variant="ghost" onClick={handleSkip} className="gap-2 text-muted-foreground">
            <SkipForward className="h-4 w-4" />
            Skip for now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
