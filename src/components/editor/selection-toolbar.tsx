"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCheck, Link2 } from "lucide-react";
import { useEditorStore } from "@/lib/store";

const OPEN_LINK_PICKER_EVENT = "open-link-picker";

type ToolbarPosition = {
  x: number;
  y: number;
  above: boolean;
};

function getToolbarPosition(x: number, top: number, bottom: number): ToolbarPosition {
  const width = Math.min(200, window.innerWidth - 16);
  const above = top >= 44 || bottom + 44 > window.innerHeight;
  return {
    x: Math.min(window.innerWidth - width - 8, Math.max(8, x - width / 2)),
    y: above ? Math.min(window.innerHeight - 8, Math.max(40, top - 6)) : Math.max(8, bottom + 6),
    above,
  };
}

export function SelectionToolbar() {
  const editorView = useEditorStore((s) => s.editorView);
  const inlineSelection = useEditorStore((s) => s.inlineSelection);
  const inlineTextarea = useEditorStore((s) => s.inlineTextarea);

  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  useEffect(() => {
    const element = editorView?.dom ?? inlineTextarea;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      if (editorView?.hasFocus) {
        const { from, to } = editorView.state.selection.main;
        const coords = from !== to ? editorView.coordsAtPos(to) : null;
        const pane = editorView.scrollDOM.getBoundingClientRect();
        setPosition(coords && coords.bottom >= pane.top && coords.top <= pane.bottom
          ? getToolbarPosition(coords.left, coords.top, coords.bottom)
          : null);
      } else if (inlineSelection && inlineTextarea && inlineSelection.from !== inlineSelection.to) {
        const rect = inlineTextarea.getBoundingClientRect();
        setPosition(rect.bottom > 0 && rect.top < window.innerHeight
          ? getToolbarPosition(rect.right - 8, rect.top, rect.bottom)
          : null);
      } else {
        setPosition(null);
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const editorEvents = ["mouseup", "keyup", "touchend", "focusout"];
    for (const event of editorEvents) element.addEventListener(event, schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const event of editorEvents) element.removeEventListener(event, schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
    };
  }, [editorView, inlineSelection, inlineTextarea]);

  if (!position || (!editorView && !inlineTextarea)) return null;

  return createPortal(
    <div
      className="fixed z-40 flex w-[min(200px,calc(100dvw-16px))] items-center justify-center gap-1 rounded-full border border-border bg-background/95 px-2 py-1 text-xs text-foreground shadow-sm"
      style={{ left: position.x, top: position.y, transform: position.above ? "translateY(-100%)" : undefined }}
    >
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => document.dispatchEvent(new CustomEvent(OPEN_LINK_PICKER_EVENT))}
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Link2 className="h-3 w-3" />
          Link file
        </button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => useEditorStore.getState().createTaskFromSelection()} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"><CheckCheck className="h-3 w-3" />Create task</button>
    </div>,
    document.body,
  );
}
