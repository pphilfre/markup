"use client";

import { useRef, useCallback } from "react";
import { useEditorStore } from "@/lib/store";
import { MarkdownEditor, MarkdownPreview } from "@/components/editor";

export function MainContent() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const settings = useEditorStore((s) => s.settings);

  // Synced scroll state — shared between editor and preview
  const scrollingRef = useRef<"editor" | "preview" | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEditorScroll = useCallback((fraction: number) => {
    if (scrollingRef.current === "preview") return;
    scrollingRef.current = "editor";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollingRef.current = null;
    }, 100);
    // Push to preview
    const previewEl = document.getElementById("sync-preview");
    if (previewEl) {
      const max = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = fraction * max;
    }
  }, []);

  const onPreviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollingRef.current === "editor") return;
    scrollingRef.current = "preview";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      scrollingRef.current = null;
    }, 100);
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const fraction = max > 0 ? el.scrollTop / max : 0;
    // Push to editor
    const editorScroller = document.querySelector(".cm-scroller") as HTMLElement | null;
    if (editorScroller) {
      const eMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = fraction * eMax;
    }
  }, []);

  // Build style overrides from settings
  const editorStyle: React.CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
  };

  if (!activeTabId) {
    return (
      <main className="flex flex-1 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <p className="text-sm">Start typing or open a file…</p>
          <p className="text-xs text-muted-foreground/60">
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Alt+T
            </kbd>{" "}
            to create a new tab
          </p>
        </div>
      </main>
    );
  }

  if (viewMode === "split") {
    return (
      <main className="flex flex-1 overflow-hidden bg-background" style={editorStyle}>
        <div className="flex flex-1 flex-col overflow-hidden border-r border-border">
          <MarkdownEditor onScroll={onEditorScroll} />
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <MarkdownPreview id="sync-preview" onScroll={onPreviewScroll} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background" style={editorStyle}>
      {viewMode === "editor" ? <MarkdownEditor /> : <MarkdownPreview />}
    </main>
  );
}
