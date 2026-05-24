"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link2 } from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const OPEN_LINK_PICKER_EVENT = "open-link-picker";

type ToolbarPosition = {
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function SelectionToolbar() {
  const editorView = useEditorStore((s) => s.editorView);
  const inlineSelection = useEditorStore((s) => s.inlineSelection);
  const inlineTextarea = useEditorStore((s) => s.inlineTextarea);

  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const [visible, setVisible] = useState(false);

  const updateFromEditor = useCallback(() => {
    if (!editorView || !editorView.hasFocus) return false;
    const { from, to } = editorView.state.selection.main;
    if (from === to) return false;

    const coords = editorView.coordsAtPos(to);
    if (!coords) return false;

    const x = clamp(coords.left, 16, window.innerWidth - 16);
    const y = clamp(coords.top - 8, 16, window.innerHeight - 16);
    setPosition({ x, y });
    setVisible(true);
    return true;
  }, [editorView]);

  useEffect(() => {
    if (!editorView) return;

    const handleBlur = () => setVisible(false);
    const handle = () => {
      const shown = updateFromEditor();
      if (!shown) setVisible(false);
    };

    const scroller = editorView.scrollDOM;
    editorView.dom.addEventListener("mouseup", handle);
    editorView.dom.addEventListener("keyup", handle);
    editorView.dom.addEventListener("touchend", handle);
    editorView.dom.addEventListener("blur", handleBlur);
    scroller?.addEventListener("scroll", handle, { passive: true });

    return () => {
      editorView.dom.removeEventListener("mouseup", handle);
      editorView.dom.removeEventListener("keyup", handle);
      editorView.dom.removeEventListener("touchend", handle);
      editorView.dom.removeEventListener("blur", handleBlur);
      scroller?.removeEventListener("scroll", handle);
    };
  }, [editorView, updateFromEditor]);

  useEffect(() => {
    if (editorView && editorView.hasFocus) return;
    if (!inlineSelection || !inlineTextarea) {
      setVisible(false);
      return;
    }
    if (inlineSelection.from === inlineSelection.to) {
      setVisible(false);
      return;
    }

    const rect = inlineTextarea.getBoundingClientRect();
    const x = clamp(rect.left + rect.width - 8, 16, window.innerWidth - 16);
    const y = clamp(rect.top - 8, 16, window.innerHeight - 16);
    setPosition({ x, y });
    setVisible(true);
  }, [editorView, inlineSelection, inlineTextarea]);

  const style = useMemo<CSSProperties | undefined>(() => {
    if (!position) return undefined;
    return {
      left: position.x,
      top: position.y,
    };
  }, [position]);

  if (!visible || !position) return null;

  return (
    <div
      className="fixed z-50"
      style={style}
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-full border border-border bg-background/95 shadow-sm px-2 py-1",
          "text-xs text-foreground"
        )}
        style={{ transform: "translate(-50%, -100%)" }}
      >
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent(OPEN_LINK_PICKER_EVENT))}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Link2 className="h-3 w-3" />
          Link file
        </button>
      </div>
    </div>
  );
}
