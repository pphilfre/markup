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
import { DocumentContext } from "./document-inspector";
import { ShareDialog } from "@/components/shell/share-dialog";
import { PublishDialog } from "@/components/shell/publish-dialog";
import { ExportDialog } from "@/components/shell/export-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export function EditorToolbar() {
  const tab = useEditorStore((s) =>
      s.tabs.find((tab) => tab.id === s.activeTabId),
    ),
    view = useEditorStore((s) => s.viewMode),
    setView = useEditorStore((s) => s.setViewMode);
  const [context, setContext] = useState(false),
    [share, setShare] = useState(false),
    [exportOpen, setExport] = useState(false),
    [publish, setPublish] = useState(false);
  if (!tab) return null;
  return (
    <>
      <div className="editor-workbar">
        {tab.noteType === "note" && (
          <>
            <select
              aria-label="Editor view"
              value={view}
              onChange={(event) => setView(event.target.value as ViewMode)}
            >
              <option value="editor">Source</option>
              <option value="inline">Live editing</option>
              <option value="preview">Preview</option>
              <option value="split">Split view</option>
            </select>
            {view !== "preview" && <EditorControls />}
          </>
        )}
        <div className="editor-document-actions">
          <button
            title="Share"
            aria-label="Share document"
            onClick={() => setShare(true)}
          >
            <Share2 size={16} />
          </button>
          <button
            title="Export"
            aria-label="Export document"
            onClick={() => setExport(true)}
          >
            <FileOutput size={16} />
          </button>
          <button
            title="Inspector"
            aria-label="Open document inspector"
            aria-pressed={context}
            onClick={() => setContext(!context)}
          >
            <PanelRight size={16} />
          </button>
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
              <DropdownMenuItem onClick={() => setContext(true)}>
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
      {context && <DocumentContext onClose={() => setContext(false)} />}
      <ShareDialog open={share} onOpenChange={setShare} />
      <ExportDialog open={exportOpen} onOpenChange={setExport} />
      <PublishDialog open={publish} onOpenChange={setPublish} />
    </>
  );
}
