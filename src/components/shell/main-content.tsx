"use client";

import { useRef, useCallback, useState } from "react";
import { useEditorStore } from "@/lib/store";
import { MarkdownEditor, MarkdownPreview, InlineMarkdownEditor } from "@/components/editor";
import { GraphView } from "@/components/shell/graph-view";
import { WhiteboardView } from "@/components/shell/whiteboard";
import { MindmapView } from "@/components/shell/mindmap";

export function MainContent() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const settings = useEditorStore((s) => s.settings);
  const updateSettings = useEditorStore((s) => s.updateSettings);

  // Synced scroll state — shared between editor and preview
  const scrollingRef = useRef<"editor" | "preview" | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEditorScroll = useCallback((fraction: number) => {
    if (scrollingRef.current === "preview") return;
    scrollingRef.current = "editor";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = null; }, 100);
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
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = null; }, 100);
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const fraction = max > 0 ? el.scrollTop / max : 0;
    const editorScroller = document.querySelector(".cm-scroller") as HTMLElement | null;
    if (editorScroller) {
      const eMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = fraction * eMax;
    }
  }, []);

  // Split view resize
  const splitRatio = settings.splitRatio ?? 0.5;
  const splitDraggingRef = useRef(false);
  const pendingRatioRef = useRef(splitRatio);
  const containerRef = useRef<HTMLElement>(null);
  const [localRatio, setLocalRatio] = useState<number | null>(null);

  const onSplitResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    splitDraggingRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (ev: MouseEvent) => {
      if (!splitDraggingRef.current || !container) return;
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0.2, Math.min(0.8, (ev.clientX - rect.left) / rect.width));
      pendingRatioRef.current = ratio;
      setLocalRatio(ratio);
    };

    const onUp = () => {
      if (!splitDraggingRef.current) return;
      splitDraggingRef.current = false;
      setLocalRatio(null);
      updateSettings({ splitRatio: pendingRatioRef.current });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [updateSettings]);

  // Build style overrides from settings
  const editorStyle: React.CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
  };

  if (viewMode === "graph") {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <GraphView />
      </main>
    );
  }

  if (activeTab?.noteType === "whiteboard" || (viewMode === "whiteboard" && activeTab?.noteType !== "note")) {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <WhiteboardView key={activeTabId} />
      </main>
    );
  }

  if (activeTab?.noteType === "mindmap" || (viewMode === "mindmap" && activeTab?.noteType !== "note")) {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <MindmapView key={activeTabId} />
      </main>
    );
  }

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
    const ratio = localRatio ?? splitRatio;
    return (
      <main ref={containerRef} className="flex flex-1 overflow-hidden bg-background select-none" style={editorStyle}>
        <div className="flex flex-col overflow-hidden" style={{ width: `${ratio * 100}%` }}>
          <MarkdownEditor onScroll={onEditorScroll} />
        </div>
        {/* Resize handle */}
        <div
          onMouseDown={onSplitResizeMouseDown}
          className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
        />
        <div className="flex flex-col overflow-hidden flex-1">
          <MarkdownPreview id="sync-preview" onScroll={onPreviewScroll} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background" style={editorStyle}>
      {viewMode === "editor" ? <MarkdownEditor /> : viewMode === "inline" ? <InlineMarkdownEditor /> : <MarkdownPreview />}
    </main>
  );
}
