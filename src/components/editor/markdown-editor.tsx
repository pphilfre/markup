"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, ViewUpdate, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, rectangularSelection, highlightWhitespace } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { Prec } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { useEditorStore } from "@/lib/store";
import { darkTheme, darkHighlightStyle, lightTheme, lightHighlightStyle } from "./theme";
import { EditorContextMenu } from "./context-menu";

// ── Smart list indentation ────────────────────────────────────────────────

const listContinueRegex = /^(\s*)([-*+]|(\d+)\.) (\[[ x]\] )?/;

function smartListKeymap() {
  return Prec.high(
    keymap.of([
      {
        key: "Enter",
        run: (view: EditorView) => {
          const { state } = view;
          const { from } = state.selection.main;
          const line = state.doc.lineAt(from);
          const match = line.text.match(listContinueRegex);
          if (!match) return false;

          const [fullMatch, indent, marker, num, checkbox] = match;
          // If the line is ONLY the list prefix (empty item), remove it and exit list
          if (line.text.trim() === fullMatch.trim()) {
            view.dispatch({
              changes: { from: line.from, to: line.to, insert: "" },
              selection: { anchor: line.from },
            });
            return true;
          }

          // Build continuation marker
          let nextMarker = marker;
          if (num !== undefined) {
            nextMarker = (parseInt(num, 10) + 1) + ".";
          }
          const prefix = checkbox ? `${indent}${nextMarker} [ ] ` : `${indent}${nextMarker} `;
          view.dispatch({
            changes: { from, to: from, insert: "\n" + prefix },
            selection: { anchor: from + 1 + prefix.length },
          });
          return true;
        },
      },
      {
        key: "Tab",
        run: (view: EditorView) => {
          const { state } = view;
          const { from, to } = state.selection.main;
          const line = state.doc.lineAt(from);
          if (!listContinueRegex.test(line.text)) return false;
          const startLine = state.doc.lineAt(from);
          const endLine = state.doc.lineAt(to);
          const changes: { from: number; to: number; insert: string }[] = [];
          for (let i = startLine.number; i <= endLine.number; i++) {
            const l = state.doc.line(i);
            changes.push({ from: l.from, to: l.from, insert: "  " });
          }
          view.dispatch({ changes });
          return true;
        },
      },
      {
        key: "Shift-Tab",
        run: (view: EditorView) => {
          const { state } = view;
          const { from, to } = state.selection.main;
          const line = state.doc.lineAt(from);
          if (!listContinueRegex.test(line.text)) return false;
          const startLine = state.doc.lineAt(from);
          const endLine = state.doc.lineAt(to);
          const changes: { from: number; to: number; insert: string }[] = [];
          for (let i = startLine.number; i <= endLine.number; i++) {
            const l = state.doc.line(i);
            if (l.text.startsWith("  ")) {
              changes.push({ from: l.from, to: l.from + 2, insert: "" });
            } else if (l.text.startsWith("\t")) {
              changes.push({ from: l.from, to: l.from + 1, insert: "" });
            }
          }
          if (changes.length) view.dispatch({ changes });
          return true;
        },
      },
    ])
  );
}

// ── Plain Enter — always insert a newline (runs at low priority, after list handler) ──

function plainEnterKeymap() {
  return keymap.of([
    {
      key: "Enter",
      run: (view: EditorView) => {
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: "\n" },
          selection: { anchor: from + 1 },
        });
        return true;
      },
    },
  ]);
}

export function MarkdownEditor({ onScroll }: { onScroll?: (fraction: number) => void } = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const settingsCompartment = useRef(new Compartment());

  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const updateContent = useEditorStore((s) => s.updateContent);
  const setEditorView = useEditorStore((s) => s.setEditorView);
  const theme = useEditorStore((s) => s.theme);
  const settings = useEditorStore((s) => s.settings);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const onContentChange = useCallback(
    (tabId: string) =>
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) {
          updateContent(tabId, update.state.doc.toString());
        }
      }),
    [updateContent]
  );

  const buildSettingsExtensions = useCallback((s: typeof settings) => [
    EditorView.theme({
      "&": {
        fontFamily: s.fontFamily,
        fontSize: s.fontSize + "px",
      },
      ".cm-content": {
        lineHeight: String(s.lineHeight),
        letterSpacing: s.letterSpacing + "em",
        ...(s.maxLineWidth > 0 ? { maxWidth: s.maxLineWidth + "ch", margin: "0 auto" } : {}),
      },
      ".cm-scroller": {
        paddingLeft: s.editorMargin + "px",
        paddingRight: s.editorMargin + "px",
      },
      // Fix: scope code block highlighting so it doesn't bleed past the closing fence
      ".cm-line .tok-string": { color: "inherit" },
      ...(s.cursorAnimation === "none"
        ? { ".cm-cursor": { animationName: "none" } }
        : s.cursorAnimation === "smooth"
        ? { ".cm-cursor": { transition: "left 80ms ease, top 80ms ease" } }
        : {}),
    }),
    EditorView.contentAttributes.of({
      spellcheck: s.spellCheck ? "true" : "false",
      autocorrect: s.spellCheck && s.suggestCorrectionsOnDoubleTap ? "on" : "off",
      autocomplete: s.spellCheck && s.suggestCorrectionsOnDoubleTap ? "on" : "off",
      autocapitalize: s.autoPunctuation ? "sentences" : "off",
    }),
    EditorView.inputHandler.of((view, from, to, text) => {
      if (!s.autoPunctuation || text !== " " || from !== to || from < 2) return false;
      const trailing = view.state.sliceDoc(from - 2, from);
      if (trailing[1] !== " " || !/[A-Za-z0-9\])"']/.test(trailing[0])) return false;

      view.dispatch({
        changes: { from: from - 1, to: from, insert: ". " },
        selection: { anchor: from + 1 },
      });
      return true;
    }),
    ...(s.wordWrap ? [EditorView.lineWrapping] : []),
    ...(s.showInvisibleCharacters ? [highlightWhitespace()] : []),
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: tags.heading, color: s.accentColor },
      ])
    ),
    EditorState.tabSize.of(s.tabSize),
  ], []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: settingsCompartment.current.reconfigure(buildSettingsExtensions(settings)),
    });
  }, [settings, buildSettingsExtensions]);

  useEffect(() => {
    if (!containerRef.current || !activeTab) return;

    const s = settingsRef.current;

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    settingsCompartment.current = new Compartment();

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
        ...(s.highlightCurrentLine ? [highlightActiveLine(), highlightActiveLineGutter()] : []),
        drawSelection(),
        ...(s.multiCursorSupport ? [rectangularSelection()] : []),
        indentOnInput(),
        ...(s.highlightMatchingBrackets ? [bracketMatching()] : []),
        ...(s.autoCloseBrackets ? [closeBrackets()] : []),
        foldGutter(),
        highlightSelectionMatches(),
        history(),
        // List continuation runs at high priority (before defaultKeymap)
        ...(s.continueListOnEnter ? [smartListKeymap()] : []),
        formattingKeymap,
        // Plain Enter at normal priority — ensures newline always works
        plainEnterKeymap(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          ...(s.autoCloseBrackets ? closeBracketsKeymap : []),
          indentWithTab,
        ]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        ...(theme === "dark"
          ? [darkTheme, darkHighlightStyle]
          : [lightTheme, lightHighlightStyle]),
        settingsCompartment.current.of(buildSettingsExtensions(s)),
        ...(s.convertTabsToSpaces ? [EditorState.languageData.of(() => [{ indentOnInput: /^\s*([-*+] |(\d+)[.)]\s|\[[ x]\]\s)/ }])] : []),
        onContentChange(activeTab.id),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    setEditorView(view);
    view.focus();

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

    // Capture ref for cleanup
    const container = containerRef.current;

    return () => {
      if (scrollHandler) {
        const scroller = container?.querySelector(".cm-scroller") as HTMLElement | null;
        scroller?.removeEventListener("scroll", scrollHandler);
      }
      view.destroy();
      viewRef.current = null;
      setEditorView(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab?.id, theme]);

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
