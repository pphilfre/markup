"use client";

import { useCallback, useRef } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useEditorStore } from "@/lib/store";
import { readClipboardText, writeClipboardText } from "@/lib/clipboard";
import { Share2, FileOutput } from "lucide-react";

export function EditorContextMenu({ children }: { children: React.ReactNode }) {
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const editorView = useEditorStore((s) => s.editorView);
  const spellCheckEnabled = useEditorStore((s) => s.settings.spellCheck);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const lastContextTargetRef = useRef<EventTarget | null>(null);

  const handleContextCapture = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      lastContextTargetRef.current = event.target;
      // Keep the browser spell suggestions on regular right-click when spell check is enabled.
      // Alt + right-click still opens the app context menu.
      if (
        spellCheckEnabled &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey
      ) {
        event.stopPropagation();
      }
    },
    [spellCheckEnabled]
  );

  const handleCut = async () => {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    const text = editorView.state.sliceDoc(from, to);
    if (text) {
      try {
        await writeClipboardText(text);
      } catch {
        return;
      }
      editorView.dispatch({ changes: { from, to, insert: "" } });
    }
    editorView.focus();
  };

  const handleCopy = async () => {
    if (!editorView) return;
    const { from, to } = editorView.state.selection.main;
    const text = editorView.state.sliceDoc(from, to);
    if (text) {
      try {
        await writeClipboardText(text);
      } catch {
        return;
      }
    }
    editorView.focus();
  };

  const handlePaste = async () => {
    if (!editorView) return;
    let text = "";
    try {
      text = await readClipboardText();
    } catch {
      return;
    }
    const { from, to } = editorView.state.selection.main;
    editorView.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    editorView.focus();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="contents" onContextMenuCapture={handleContextCapture}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {spellCheckEnabled && (
          <>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Spelling</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64">
                <ContextMenuItem disabled>
                  Spell suggestions open on right-click
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => updateSettings({ spellCheck: false })}>
                  Disable spell check
                </ContextMenuItem>
                <ContextMenuItem disabled>
                  Open this custom menu with Alt + Right Click
                </ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
          </>
        )}
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
