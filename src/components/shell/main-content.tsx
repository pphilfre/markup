"use client";

import { useRef, useCallback, useEffect, useState, type CSSProperties } from "react";
import { getTabWorkspaceId, useEditorStore } from "@/lib/store";
import { MarkdownEditor, MarkdownPreview, InlineMarkdownEditor, SelectionToolbar } from "@/components/editor";
import { GraphView } from "@/components/shell/graph-view";
import { WhiteboardView } from "@/components/shell/whiteboard";
import { MindmapView } from "@/components/shell/mindmap";
import { BoardDocument } from "@/components/workspace/board-document";
import { PdfEditorView } from "@/components/shell/pdf-editor";
import { Dashboard } from "@/components/shell/dashboard";
import { PaneResizeHandle } from "@/components/workspace/pane-resize-handle";
import { EditorControls } from "@/components/workspace/editor-controls";
import { useLayoutSize } from "@/lib/use-layout-size";
import { getSplitLayout } from "@/lib/workbench-layout";

function MarkdownSplit({ style }: { style: CSSProperties }) {
  const splitRatio = useEditorStore((s) => s.settings.splitRatio ?? 0.5);
  const zoom = useEditorStore((s) => s.zoomLevel) / 100;
  const { ref: container, width, height } = useLayoutSize<HTMLElement>();
  const { stacked, minimum, maximum } = getSplitLayout(width, height);
  const [previewRatio, setPreviewRatio] = useState<number | null>(null);
  const ratio = Math.max(minimum, Math.min(maximum, previewRatio ?? Math.round(splitRatio * 100)));
  const length = stacked ? height : width;

  // Synced scroll state — shared between editor and preview
  const scrollingRef = useRef<"editor" | "preview" | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onEditorScroll = useCallback((fraction: number) => {
    if (scrollingRef.current === "preview") return;
    scrollingRef.current = "editor";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = null; }, 100);
    const previewEl = container.current?.querySelector<HTMLElement>("#sync-preview");
    if (previewEl) {
      const max = previewEl.scrollHeight - previewEl.clientHeight;
      previewEl.scrollTop = fraction * max;
    }
  }, [container]);

  const onPreviewScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollingRef.current === "editor") return;
    scrollingRef.current = "preview";
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => { scrollingRef.current = null; }, 100);
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const fraction = max > 0 ? el.scrollTop / max : 0;
    const editorScroller = container.current?.querySelector<HTMLElement>(".cm-scroller");
    if (editorScroller) {
      const eMax = editorScroller.scrollHeight - editorScroller.clientHeight;
      editorScroller.scrollTop = fraction * eMax;
    }
  }, [container]);

  useEffect(() => () => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
  }, []);

  const tracks = `minmax(0, ${ratio}fr) 6px minmax(0, ${100 - ratio}fr)`;
  return (
    <main
      ref={container}
      className="markdown-split-view"
      data-stacked={stacked || undefined}
      style={{ ...style, [stacked ? "gridTemplateRows" : "gridTemplateColumns"]: tracks }}
    >
      <SelectionToolbar />
      <div className="markdown-split-source">
        <div className="markdown-pane-header">
          <span>Source</span>
          <div className="editor-workbar"><EditorControls /></div>
        </div>
        <MarkdownEditor onScroll={onEditorScroll} />
      </div>
      <PaneResizeHandle
        className="markdown-split-handle"
        label="Resize editor and preview"
        axis={stacked ? "y" : "x"}
        value={ratio}
        min={minimum}
        max={maximum}
        step={5}
        unitsPerPixel={100 / Math.max(1, (length - 6) * zoom)}
        unit="%"
        onPreview={setPreviewRatio}
        onCommit={(next) => useEditorStore.getState().updateSettings({ splitRatio: next / 100 })}
      />
      <div className="markdown-split-preview">
        <div className="markdown-pane-header"><span>Preview</span></div>
        <MarkdownPreview id="sync-preview" onScroll={onPreviewScroll} split />
      </div>
    </main>
  );
}

export function MainContent() {
  const viewMode = useEditorStore((s) => s.viewMode);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId && getTabWorkspaceId(t) === activeProfileId));
  const settings = useEditorStore((s) => s.settings);

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

  if (activeTab?.noteType === "whiteboard") {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <WhiteboardView key={activeTabId} />
      </main>
    );
  }

  if (activeTab?.noteType === "mindmap") {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <MindmapView key={activeTabId} />
      </main>
    );
  }

  if (activeTab?.noteType === "kanban") {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <BoardDocument key={activeTabId} />
      </main>
    );
  }

  if (activeTab?.noteType === "pdf") {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <PdfEditorView key={activeTabId} />
      </main>
    );
  }

  if (!activeTabId || !activeTab) {
    return (
      <main className="flex flex-1 overflow-hidden bg-background">
        <Dashboard />
      </main>
    );
  }

  if (viewMode === "split") return <MarkdownSplit style={editorStyle} />;

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-background" style={editorStyle}>
      <SelectionToolbar />
      {viewMode === "editor" ? (
        <>
          <MarkdownEditor />
        </>
      ) : viewMode === "inline" ? (
        <>
          <InlineMarkdownEditor />
        </>
      ) : (
        <MarkdownPreview />
      )}
    </main>
  );
}
