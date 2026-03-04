"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, ViewUpdate, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { useEditorStore } from "@/lib/store";
import { darkTheme, darkHighlightStyle, lightTheme, lightHighlightStyle } from "./theme";
import { EditorContextMenu } from "./context-menu";

export function MarkdownEditor({ onScroll }: { onScroll?: (fraction: number) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const updateContent = useEditorStore((s) => s.updateContent);
  const setEditorView = useEditorStore((s) => s.setEditorView);
  const theme = useEditorStore((s) => s.theme);
  const settings = useEditorStore((s) => s.settings);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Stable callback for content changes
  const onContentChange = useCallback(
    (tabId: string) =>
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          updateContent(tabId, update.state.doc.toString());
        }
      }),
    [updateContent]
  );

  // Create / recreate editor when active tab changes
  useEffect(() => {
    if (!containerRef.current || !activeTab) return;

    // Destroy previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    // Inline formatting keymaps (Ctrl+B, Ctrl+I)
    const formattingKeymap = keymap.of([
      {
        key: "Mod-b",
        run: (view: EditorView) => {
          const { from, to } = view.state.selection.main;
          const sel = view.state.sliceDoc(from, to);
          const text = `**${sel}**`;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + 2, head: from + 2 + sel.length },
          });
          return true;
        },
      },
      {
        key: "Mod-i",
        run: (view: EditorView) => {
          const { from, to } = view.state.selection.main;
          const sel = view.state.sliceDoc(from, to);
          const text = `*${sel}*`;
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + 1, head: from + 1 + sel.length },
          });
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: activeTab.content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        rectangularSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        foldGutter(),
        highlightSelectionMatches(),
        history(),
        formattingKeymap,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...closeBracketsKeymap,
          indentWithTab,
        ]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        ...(theme === "dark"
          ? [darkTheme, darkHighlightStyle]
          : [lightTheme, lightHighlightStyle]),
        // Override heading colour with user's accent colour
        syntaxHighlighting(
          HighlightStyle.define([
            { tag: tags.heading, color: settings.accentColor, fontWeight: "bold" },
          ])
        ),
        EditorView.lineWrapping,
        EditorView.theme({
          "&": {
            fontFamily: settings.fontFamily,
            fontSize: settings.fontSize + "px",
          },
          ".cm-content": {
            lineHeight: String(settings.lineHeight),
          },
          ".cm-scroller": {
            paddingLeft: settings.editorMargin + "px",
            paddingRight: settings.editorMargin + "px",
          },
        }),
        EditorState.tabSize.of(settings.tabSize),
        onContentChange(activeTab.id),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setEditorView(view);

    // Auto-focus editor
    view.focus();

    // Sync scroll for split mode
    let scrollHandler: (() => void) | null = null;
    if (onScroll) {
      const scroller = containerRef.current.querySelector(".cm-scroller") as HTMLElement | null;
      if (scroller) {
        scrollHandler = () => {
          const max = scroller.scrollHeight - scroller.clientHeight;
          const fraction = max > 0 ? scroller.scrollTop / max : 0;
          onScroll(fraction);
        };
        scroller.addEventListener("scroll", scrollHandler, { passive: true });
      }
    }

    return () => {
      if (scrollHandler) {
        const scroller = containerRef.current?.querySelector(".cm-scroller") as HTMLElement | null;
        scroller?.removeEventListener("scroll", scrollHandler);
      }
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, theme, settings]);

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm">No tab open</p>
          <p className="text-xs text-muted-foreground/60">
            Press{" "}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
              Alt+T
            </kbd>{" "}
            to create a new tab
          </p>
        </div>
      </div>
    );
  }

  return (
    <EditorContextMenu>
      <div
        ref={containerRef}
        className="flex-1 overflow-auto [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:px-6 [&_.cm-scroller]:py-2"
      />
    </EditorContextMenu>
  );
}
