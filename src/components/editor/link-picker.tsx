"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Link2, PenTool, GitBranch, KanbanSquare, FileType } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";

const OPEN_LINK_PICKER_EVENT = "open-link-picker";
const DEFAULT_TITLE = "Link to file";
const DEFAULT_DESCRIPTION = "Select a file to link.";

type LinkPickerEntry = {
  id: string;
  title: string;
  displayTitle: string;
  noteType: Tab["noteType"];
};

type LinkPickerRequest = {
  onPick?: (tabId: string) => void;
  title?: string;
  description?: string;
};

function getDisplayTitle(title: string): string {
  return title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
}

function getTypeLabel(noteType: Tab["noteType"]): string {
  if (noteType === "whiteboard") return "Whiteboard";
  if (noteType === "mindmap") return "Mindmap";
  if (noteType === "kanban") return "Kanban";
  if (noteType === "pdf") return "PDF";
  return "Note";
}

function getTypeIcon(noteType: Tab["noteType"]) {
  if (noteType === "whiteboard") return PenTool;
  if (noteType === "mindmap") return GitBranch;
  if (noteType === "kanban") return KanbanSquare;
  if (noteType === "pdf") return FileType;
  return FileText;
}

export function LinkPicker() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onPickOverride, setOnPickOverride] = useState<((tabId: string) => void) | null>(null);
  const [dialogTitle, setDialogTitle] = useState(DEFAULT_TITLE);
  const [dialogDescription, setDialogDescription] = useState(DEFAULT_DESCRIPTION);
  const inputRef = useRef<HTMLInputElement>(null);

  const tabs = useEditorStore((s) => s.tabs);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const insertNoteLink = useEditorStore((s) => s.insertNoteLink);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<LinkPickerRequest>).detail;
      setOpen(true);
      setQuery("");
      setOnPickOverride(() => detail?.onPick ?? null);
      setDialogTitle(detail?.title ?? DEFAULT_TITLE);
      setDialogDescription(detail?.description ?? DEFAULT_DESCRIPTION);
      queueMicrotask(() => inputRef.current?.focus());
    };
    document.addEventListener(OPEN_LINK_PICKER_EVENT, handler as EventListener);
    return () => document.removeEventListener(OPEN_LINK_PICKER_EVENT, handler as EventListener);
  }, []);

  const noteTabs = useMemo(() => {
    return tabs
      .filter((tab) => getTabWorkspaceId(tab) === activeProfileId)
      .map((tab) => ({
        id: tab.id,
        title: tab.title,
        displayTitle: getDisplayTitle(tab.title),
        noteType: tab.noteType,
      }));
  }, [tabs, activeProfileId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? noteTabs.filter((tab) =>
          tab.displayTitle.toLowerCase().includes(q) || tab.title.toLowerCase().includes(q)
        )
      : noteTabs;
    return filtered.sort((a, b) => a.displayTitle.localeCompare(b.displayTitle));
  }, [noteTabs, query]);

  const handlePick = (tab: LinkPickerEntry) => {
    if (onPickOverride) {
      onPickOverride(tab.id);
    } else {
      insertNoteLink(tab.id);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setOnPickOverride(null);
          setDialogTitle(DEFAULT_TITLE);
          setDialogDescription(DEFAULT_DESCRIPTION);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes..."
            onKeyDown={(event) => {
              if (event.key === "Enter" && results[0]) {
                event.preventDefault();
                handlePick(results[0]);
              }
              if (event.key === "Escape") setOpen(false);
            }}
          />

          <ScrollArea className="max-h-64 rounded-md border border-border">
            <div className="p-2 space-y-1">
              {results.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No notes match that search.
                </p>
              ) : (
                results.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handlePick(tab)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                      "hover:bg-muted"
                    )}
                  >
                    {(() => {
                      const Icon = getTypeIcon(tab.noteType);
                      return <Icon className="h-3.5 w-3.5 text-muted-foreground" />;
                    })()}
                    <span className="truncate">{tab.displayTitle}</span>
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                      {getTypeLabel(tab.noteType)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Link2 className="h-3 w-3" />
            Links use [[Title]] in notes.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
