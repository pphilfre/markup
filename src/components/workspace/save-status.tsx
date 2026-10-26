"use client";
import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  HardDrive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useLocalSaveState } from "@/lib/save-state";
import { flushLocalSave, useEditorStore } from "@/lib/store";
import { triggerManualSync, useSyncState } from "@/lib/sync-state";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFileSaveState } from "@/lib/file-save-state";

export function SaveStatus({ compact = false }: { compact?: boolean }) {
  const local = useLocalSaveState(),
    cloud = useSyncState(),
    files = useFileSaveState();
  const folder = useEditorStore((s) => s.localSyncFolder);
  const error =
    local.status === "error" ||
    cloud.status === "error" ||
    files.status === "error";
  const saving = local.status === "saving";
  const Icon = error ? AlertCircle : saving ? Loader2 : Check;
  const label =
    local.status === "error"
      ? "Device save failed"
      : error
        ? "Sync needs attention"
        : saving
          ? "Saving…"
          : local.status === "saved"
            ? "Saved on this device"
            : "Device storage ready";
  return (
    <Popover>
      <PopoverTrigger
        className={`workspace-save-status${error ? " save-error" : ""}${compact ? " save-compact" : ""}`}
      >
        <Icon size={14} className={saving ? "animate-spin" : ""} />
        <span>{label}</span>
      </PopoverTrigger>
      <PopoverContent className="workspace-save-popover" align="start">
        <h3>Where your work is saved</h3>
        <div>
          <HardDrive size={16} />
          <p>
            <strong>This device</strong>
            <span>
              {local.status === "error"
                ? local.error
                : local.savedAt
                  ? `Last saved at ${new Date(local.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "Changes save automatically on this device."}
            </span>
          </p>
        </div>
        {local.status === "error" && (
          <button onClick={() => void flushLocalSave().catch(() => {})}>
            <RefreshCw size={13} />
            Retry device save
          </button>
        )}
        <div>
          {cloud.status === "offline" ? (
            <CloudOff size={16} />
          ) : (
            <Cloud size={16} />
          )}
          <p>
            <strong>Cloud sync</strong>
            <span>
              {cloud.status === "error"
                ? "Cloud sync failed. Your device copy is separate."
                : cloud.status === "synced"
                  ? "Up to date"
                  : cloud.status === "syncing"
                    ? "Syncing changes…"
                    : cloud.status === "offline"
                      ? "Offline. Changes will sync when connected."
                      : "Sign in to sync across devices."}
            </span>
          </p>
        </div>
        {cloud.status === "error" && (
          <button onClick={triggerManualSync}>
            <RefreshCw size={13} />
            Retry cloud sync
          </button>
        )}
        {folder && (
          <div>
            <HardDrive size={16} />
            <p>
              <strong>Folder mirror</strong>
              <span>
                {files.status === "error"
                  ? files.error
                  : files.status === "saved"
                    ? "Last folder write completed"
                    : "Waiting for folder sync"}
              </span>
            </p>
          </div>
        )}
        <p className="save-popover-footnote">
          A device save, cloud sync, and a folder mirror are separate copies.
        </p>
      </PopoverContent>
    </Popover>
  );
}
