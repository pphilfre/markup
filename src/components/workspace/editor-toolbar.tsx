"use client";
import { useState } from "react";
import {
  Share2,
  FileOutput,
  PanelRight,
  MoreHorizontal,
  Globe,
  Trash2,
} from "lucide-react";
import { useEditorStore, type ViewMode } from "@/lib/store";
import { EditorControls } from "./editor-controls";
import { ShareDialog } from "@/components/shell/share-dialog";
import { PublishDialog } from "@/components/shell/publish-dialog";
import { ExportDialog } from "@/components/shell/export-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const editorModes: { id: ViewMode; label: string }[] = [
  { id: "inline", label: "Live" }, { id: "editor", label: "Source" },
  { id: "split", label: "Split" }, { id: "preview", label: "Preview" },
];

export function EditorToolbar({ onInspect }: { onInspect: () => void }) {
  const tab = useEditorStore((s) =>
      s.tabs.find((tab) => tab.id === s.activeTabId),
    ),
    view = useEditorStore((s) => s.viewMode),
    setView = useEditorStore((s) => s.setViewMode);
  const [share, setShare] = useState(false),
    [exportOpen, setExport] = useState(false),
    [publish, setPublish] = useState(false);
  if (!tab) return null;
  return (
    <>
      <div className="editor-modebar">
        {tab.noteType === "note" && (
          <div className="editor-modes" role="group" aria-label="Editor view">
            {editorModes.map(({ id, label }) => (
              <button key={id} aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>
            ))}
          </div>
        )}
        <div className="editor-document-actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button title="More actions" aria-label="More document actions">
                <MoreHorizontal size={17} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {tab.noteType === "note" && (
                <DropdownMenuItem
                  onClick={() =>
                    useEditorStore.getState().createTaskFromSelection()
                  }
                >
                  Create task
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShare(true)}>
                <Share2 size={14} />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExport(true)}>
                <FileOutput size={14} />
                Export
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onInspect}>
                <PanelRight size={14} />
                Inspector
              </DropdownMenuItem>
              {tab.noteType === "note" && (
                <DropdownMenuItem onClick={() => setPublish(true)}>
                  <Globe size={14} />
                  Publish
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => useEditorStore.getState().deleteTab(tab.id)}
              >
                <Trash2 size={14} />
                Move to trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {tab.noteType === "note" && view !== "preview" && <div className="editor-workbar"><EditorControls /></div>}
      <ShareDialog open={share} onOpenChange={setShare} />
      <ExportDialog open={exportOpen} onOpenChange={setExport} />
      <PublishDialog open={publish} onOpenChange={setPublish} />
    </>
  );
}
