"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorStore } from "@/lib/store";
import { Share2, FileOutput } from "lucide-react";

export function EditorContextMenu({ children }: { children: React.ReactNode }) {
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const editorView = useEditorStore((s) => s.editorView);

  const handleCut = () => {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    const text = editorView.state.sliceDoc(from, to);
    if (text) {
      navigator.clipboard.writeText(text);
      editorView.dispatch({ changes: { from, to, insert: "" } });
    }
    editorView.focus();
  };

  const handleCopy = () => {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    const text = editorView.state.sliceDoc(from, to);
    if (text) navigator.clipboard.writeText(text);
    editorView.focus();
  };

  const handlePaste = async () => {
    if (!editorView) return;
    const text = await navigator.clipboard.readText();
    const { from, to } = editorView.state.selection.main;
    editorView.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    editorView.focus();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={handleCut}>
          Cut
          <ContextMenuShortcut>Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopy}>
          Copy
          <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={handlePaste}>
          Paste
          <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => wrapSelection("**", "**")}>
          Bold
          <ContextMenuShortcut>Ctrl+B</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => wrapSelection("*", "*")}>
          Italic
          <ContextMenuShortcut>Ctrl+I</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => wrapSelection("~~", "~~")}>
          Strikethrough
        </ContextMenuItem>
        <ContextMenuItem onClick={() => wrapSelection("`", "`")}>
          Inline Code
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-share"))}>
          <Share2 className="mr-2 h-3.5 w-3.5" />
          Share Note
        </ContextMenuItem>
        <ContextMenuItem onClick={() => document.dispatchEvent(new CustomEvent("open-export"))}>
          <FileOutput className="mr-2 h-3.5 w-3.5" />
          Export
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
