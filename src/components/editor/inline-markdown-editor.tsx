"use client";

/**
 * Inline Markdown Editor
 *
 * Each line renders as formatted Markdown when it loses focus.
 * Clicking/focusing a line returns it to raw Markdown syntax for editing.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo, isValidElement, cloneElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import { remarkDefinitionList, defListHastHandlers } from "remark-definition-list";
import rehypeRaw from "rehype-raw";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { resolveDocumentLink } from "@/lib/document-links";
import { titleWithoutExtension } from "@/lib/projects";
import { MermaidBlock } from "./markdown-preview";
import { Button } from "@/components/ui/button";
import { AlertCircle, AlertTriangle, Info, Lightbulb, Pin } from "lucide-react";
import "katex/dist/katex.min.css";
import { emojify } from "node-emoji";
import { useEditorStore } from "@/lib/store";

const HIGHLIGHT_MARK_PATTERN = /==([^=\n]+)==/g;

/**
 * Applies single-line markdown preprocessing shortcuts before rendering.
 */
function preprocessLine(line: string): string {
  let out = emojify(line, { fallback: (name) => `:${name}:` });
  out = out.replace(HIGHLIGHT_MARK_PATTERN, "<mark>$1</mark>");
  return out;
}

const ADMONITION_TYPES: Record<string, { color: string; Icon: typeof Info; label: string }> = {
  NOTE: { color: "var(--primary)", Icon: Info, label: "Note" },
  TIP: { color: "var(--success)", Icon: Lightbulb, label: "Tip" },
  IMPORTANT: { color: "var(--primary)", Icon: Pin, label: "Important" },
  WARNING: { color: "#da9b5d", Icon: AlertTriangle, label: "Warning" },
  CAUTION: { color: "var(--destructive)", Icon: AlertCircle, label: "Caution" },
};

/**
 * Parses GitHub-style admonition markers from blockquote children.
 */
function parseAdmonition(children: React.ReactNode): { type: string; content: React.ReactNode } | null {
  const childArr = Array.isArray(children) ? children : [children];
  if (childArr.length === 0) return null;
  const firstIdx = childArr.findIndex((c) => isValidElement(c));
  if (firstIdx === -1) return null;
  const first = childArr[firstIdx] as React.ReactElement<{ children?: React.ReactNode }>;
  const pChildren = first.props?.children;
  if (pChildren == null) return null;
  const textParts = Array.isArray(pChildren) ? pChildren : [pChildren];
  const firstText = textParts.find((p: unknown) => typeof p === "string") as string | undefined;
  if (!firstText) return null;
  const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
  if (!match) return null;
  const type = match[1].toUpperCase();
  const remainingText = firstText.slice(match[0].length);
  const newFirstParts = [remainingText, ...textParts.filter((p: unknown) => p !== firstText)].filter(Boolean);
  const newFirst = newFirstParts.length > 0
    ? cloneElement(first, {}, ...(newFirstParts.length === 1 ? [newFirstParts[0]] : newFirstParts))
    : null;
  const rest = childArr.slice(firstIdx + 1).filter(
    (c) => typeof c !== "string" || c.trim().length > 0
  );
  const content = newFirst ? [newFirst, ...rest] : rest;
  return { type, content };
}

interface LineProps {
  lineIndex: number;
  text: string;
  isActive: boolean;
  onFocus: (idx: number) => void;
  onBlur: () => void;
  onToggleTask: (idx: number, checked: boolean) => void;
  onChange: (idx: number, value: string) => void;
  onKeyDown: (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onActiveTextarea: (lineIndex: number, el: HTMLTextAreaElement | null) => void;
  onSelectionChange: (lineIndex: number, from: number, to: number) => void;
  settings: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    spellCheck: boolean;
    autoPunctuation: boolean;
    suggestCorrectionsOnDoubleTap: boolean;
  };
}

/**
 * Renders a single editable markdown line, toggling between preview and textarea modes.
 */
function InlineLine({ lineIndex, text, isActive, onFocus, onBlur, onToggleTask, onChange, onKeyDown, onActiveTextarea, onSelectionChange, settings }: LineProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when this line becomes active
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
      onActiveTextarea(lineIndex, textareaRef.current);
      onSelectionChange(lineIndex, len, len);
    }
    if (!isActive) {
      onActiveTextarea(lineIndex, null);
    }
  }, [isActive, lineIndex, onActiveTextarea, onSelectionChange]);

  // Auto-resize textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (isActive && textarea) {
      textarea.style.removeProperty("height");
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [isActive, text]);

  const style: React.CSSProperties = {
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
  };

  if (isActive) {
    return (
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => onChange(lineIndex, e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => onKeyDown(lineIndex, e)}
        onSelect={(e) => {
          onSelectionChange(lineIndex, e.currentTarget.selectionStart ?? 0, e.currentTarget.selectionEnd ?? 0);
        }}
        onFocus={() => {
          if (textareaRef.current) {
            onActiveTextarea(lineIndex, textareaRef.current);
            onSelectionChange(
              lineIndex,
              textareaRef.current.selectionStart ?? 0,
              textareaRef.current.selectionEnd ?? 0
            );
          }
        }}
        aria-label={"Markdown line " + (lineIndex + 1)}
        data-document-line={lineIndex + 1}
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent outline-none border-none p-0 m-0 block"
        style={style}
        spellCheck={settings.spellCheck}
        autoCorrect={settings.spellCheck && settings.suggestCorrectionsOnDoubleTap ? "on" : "off"}
        autoComplete={settings.spellCheck && settings.suggestCorrectionsOnDoubleTap ? "on" : "off"}
        autoCapitalize={settings.autoPunctuation ? "sentences" : "off"}
      />
    );
  }

  if (!text.trim()) {
    return <div onClick={() => onFocus(lineIndex)} className="markdown-live-blank cursor-text w-full" />;
  }

  const readingStyle = { ...style, fontFamily: settings.fontFamily === "var(--font-geist-mono), ui-monospace, monospace" ? "var(--font-geist-sans)" : settings.fontFamily };
  const processed = preprocessLine(text).replace(/\[\[([^\]]+)\]\]/g, (_, title: string) =>
    "[" + title + "](#wiki/" + encodeURIComponent(title) + ")");

  return (
    <div
      data-document-line={lineIndex + 1}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onFocus(lineIndex);
        }
      }}
      onClick={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest("a, button, input")) onFocus(lineIndex);
      }}
      className="cursor-text w-full [&_p]:m-0 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_strong]:font-bold [&_em]:italic [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-sm [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_del]:line-through [&_del]:opacity-60 [&_sup]:text-xs [&_sup]:align-super [&_sub]:text-xs [&_sub]:align-sub"
      style={readingStyle}
    >
      <ReactMarkdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath, remarkSupersub, remarkDefinitionList]}
        remarkRehypeOptions={{ handlers: defListHastHandlers, allowDangerousHtml: true }}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          input: ({ type, checked }) => type === "checkbox" ? (
            <input type="checkbox" aria-label="Toggle checklist item" checked={Boolean(checked)} onChange={(event) => onToggleTask(lineIndex, event.target.checked)} />
          ) : null,
          a: ({ href, children }) => {
            if (!href?.startsWith("#note/") && !href?.startsWith("#wiki/")) {
              return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
            }
            const state = useEditorStore.getState();
            let target = resolveDocumentLink(href, state.tabs, state.activeProfileId);
            if (href.startsWith("#wiki/")) {
              try {
                const name = titleWithoutExtension(decodeURIComponent(href.slice(6))).toLowerCase();
                target = state.tabs.find((tab) => (tab.workspaceId ?? "default") === state.activeProfileId &&
                  titleWithoutExtension(tab.title).toLowerCase() === name);
              } catch { /* A malformed link has no destination. */ }
            }
            return <button type="button" className="text-primary underline underline-offset-2" disabled={!target} onClick={() => target && state.openTab(target.id)}>{children}</button>;
          },
          // Prevent wrapping in <p> for single-line content
          p: ({ children }) => <span>{children}</span>,
          blockquote: ({ children, ...props }) => {
            const admonition = parseAdmonition(children);
            if (admonition) {
              const config = ADMONITION_TYPES[admonition.type];
              if (config) {
                return (
                  <div
                    className="admonition my-1 rounded-md border p-2.5"
                    style={{ borderColor: config.color, background: "color-mix(in srgb, " + config.color + " 9%, var(--background))" }}
                  >
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-sm" style={{ color: config.color }}>
                      <config.Icon size={15} aria-hidden />
                      <span>{config.label}</span>
                    </div>
                    <div className="text-sm leading-relaxed">{admonition.content}</div>
                  </div>
                );
              }
            }
            return <blockquote {...props}>{children}</blockquote>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Main inline markdown editor that manages line-level editing and selection sync.
 */
export function InlineMarkdownEditor({ onScroll }: { onScroll?: (fraction: number) => void } = {}) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const updateContent = useEditorStore((s) => s.updateContent);
  const settings = useEditorStore((s) => s.settings);
  const setInlineTextarea = useEditorStore((s) => s.setInlineTextarea);
  const setInlineSelection = useEditorStore((s) => s.setInlineSelection);
  const insertNoteLink = useEditorStore((s) => s.insertNoteLink);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => (activeTab?.content ?? "").split("\n"), [activeTab?.content]);
  const blocks = useMemo(() => {
    const text = activeTab?.content ?? "";
    const lineStarts = new Map<number, number>();
    let offset = 0;
    lines.forEach((line, index) => {
      lineStarts.set(offset, index);
      offset += line.length + 1;
    });
    const entries = new Map<number, { end: number; kind: string; chart?: string }>();
    markdownLanguage.parser.parse(text).iterate({
      enter(node) {
        if (node.node.parent?.name !== "Document") return;
        if (!["FencedCode", "CodeBlock", "Table", "SetextHeading1", "SetextHeading2"].includes(node.name)) return;
        const start = lineStarts.get(node.from);
        if (start === undefined) return;
        const source = text.slice(node.from, node.to);
        const end = start + source.split("\n").length - 1;
        const info = node.node.getChild("CodeInfo");
        const chart = info && text.slice(info.from, info.to).trim() === "mermaid"
          ? (() => {
              const code = node.node.getChild("CodeText");
              return code ? text.slice(code.from, code.to) : "";
            })()
          : undefined;
        entries.set(start, { end, kind: node.name, chart });
      },
    });
    return entries;
  }, [activeTab?.content, lines]);

  const registerTextarea = useCallback((lineIndex: number, element: HTMLTextAreaElement | null) => {
    if (activeLineIdx !== lineIndex) return;
    setInlineTextarea(element);
  }, [activeLineIdx, setInlineTextarea]);

  const updateSelection = useCallback((lineIndex: number, from: number, to: number) => {
    if (activeLineIdx === lineIndex) setInlineSelection({ lineIndex, from, to });
  }, [activeLineIdx, setInlineSelection]);

  const handleFocus = useCallback((idx: number) => setActiveLineIdx(idx), []);

  const handleBlur = useCallback(() => {
    setActiveLineIdx(null);
    setInlineTextarea(null);
    setInlineSelection(null);
  }, [setInlineTextarea, setInlineSelection]);

  const handleChange = useCallback(
    (idx: number, value: string) => {
      if (!activeTab) return;
      // value may contain newlines from paste — split and insert
      const newLines = [...lines];
      const valueLines = value.split("\n");
      newLines.splice(idx, 1, ...valueLines);
      updateContent(activeTab.id, newLines.join("\n"));
      if (valueLines.length > 1) {
        setActiveLineIdx(idx + valueLines.length - 1);
      }
    },
    [activeTab, lines, updateContent]
  );

  const toggleTask = (idx: number, checked: boolean) => {
    handleChange(idx, lines[idx].replace(/^(\s*(?:[-+*]|\d+[.)])\s+\[)[ xX](\])/, (_, prefix, suffix) =>
      prefix + (checked ? "x" : " ") + suffix));
  };

  const tryAutoPunctuation = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!settings.autoPunctuation || e.key !== " ") return false;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return false;

      const input = e.currentTarget;
      const selStart = input.selectionStart ?? 0;
      const selEnd = input.selectionEnd ?? 0;
      const lineText = lines[idx] ?? "";

      const hasSelection = selStart !== selEnd;
      const canInsertSentenceBreak =
        selStart >= 2 && lineText[selStart - 1] === " " && /[A-Za-z0-9\])"']/.test(lineText[selStart - 2]);

      if (hasSelection || !canInsertSentenceBreak) return false;

      e.preventDefault();
      if (!activeTab) return true;

      const updatedLine = `${lineText.slice(0, selStart - 1)}. ${lineText.slice(selStart)}`;
      const newLines = [...lines];
      newLines[idx] = updatedLine;
      updateContent(activeTab.id, newLines.join("\n"));

      queueMicrotask(() => {
        const cursorPos = selStart + 1;
        input.setSelectionRange(cursorPos, cursorPos);
        setInlineSelection({ lineIndex: idx, from: cursorPos, to: cursorPos });
      });
      return true;
    },
    [activeTab, lines, setInlineSelection, settings.autoPunctuation, updateContent]
  );

  const tryLineNavigation = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!activeTab) return false;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const newLines = [...lines];
        newLines.splice(idx + 1, 0, "");
        updateContent(activeTab.id, newLines.join("\n"));
        setActiveLineIdx(idx + 1);
        return true;
      }

      if (e.key === "Backspace" && lines[idx] === "" && lines.length > 1) {
        e.preventDefault();
        const newLines = [...lines];
        newLines.splice(idx, 1);
        updateContent(activeTab.id, newLines.join("\n"));
        setActiveLineIdx(Math.max(0, idx - 1));
        return true;
      }

      if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        setActiveLineIdx(idx - 1);
        return true;
      }

      if (e.key === "ArrowDown" && idx < lines.length - 1) {
        e.preventDefault();
        setActiveLineIdx(idx + 1);
        return true;
      }

      return false;
    },
    [activeTab, lines, updateContent]
  );

  const handleKeyDown = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (tryAutoPunctuation(idx, e)) return;
      tryLineNavigation(idx, e);
    },
    [tryAutoPunctuation, tryLineNavigation]
  );

  /**
   * Emits normalized scroll progress for parent preview sync.
   */
  const handleContainerScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      if (!onScroll) return;
      const el = event.currentTarget;
      const max = el.scrollHeight - el.clientHeight;
      onScroll(max > 0 ? el.scrollTop / max : 0);
    },
    [onScroll]
  );

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">No tab open</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleContainerScroll}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/tab-id")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "link";
        }
      }}
      onDrop={(event) => {
        const tabId = event.dataTransfer.getData("text/tab-id");
        if (!tabId) return;
        event.preventDefault();
        insertNoteLink(tabId);
      }}
      className="markdown-live-scroll flex-1 overflow-auto"
      style={{ paddingInline: "min(" + settings.editorMargin + "px, 6vw)" }}
    >
      <div className="markdown-live-sheet" style={{
        maxWidth: settings.maxLineWidth > 0 ? settings.maxLineWidth + "ch" : undefined,
      }}>
        {(() => {
          const rendered = [];
          for (let idx = 0; idx < lines.length; idx++) {
            const block = blocks.get(idx);
            if (block && (activeLineIdx === null || activeLineIdx < idx || activeLineIdx > block.end)) {
              const start = idx;
              rendered.push(
                <div className="markdown-live-block markdown-body" key={start} data-document-line={start + 1} tabIndex={-1}>
                  {block.chart !== undefined ? <MermaidBlock chart={block.chart} /> : (
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex, rehypeHighlight]}>
                      {lines.slice(start, block.end + 1).join("\n")}
                    </ReactMarkdown>
                  )}
                  <Button size="xs" variant="ghost" onClick={() => handleFocus(start)}>
                    Edit {block.chart !== undefined ? "diagram" : block.kind === "Table" ? "table" : block.kind.startsWith("Setext") ? "heading" : "code"}
                  </Button>
                </div>,
              );
              idx = block.end;
              continue;
            }
            rendered.push(
              <InlineLine
                key={idx}
                lineIndex={idx}
                text={lines[idx]}
                isActive={activeLineIdx === idx}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onToggleTask={toggleTask}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onActiveTextarea={registerTextarea}
                onSelectionChange={updateSelection}
                settings={settings}
              />,
            );
            if (idx === 0 && /^#\s/.test(lines[0]) && activeTab.tags.length > 0) {
              rendered.push(
                <div className="inspector-tags markdown-live-tags" key="document-tags" aria-label="Document tags">
                  {activeTab.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>,
              );
            }
          }
          return rendered;
        })()}
        {/* Click below last line to add new line */}
        <div
          className="min-h-[40px] cursor-text"
          onClick={() => {
            if (!activeTab) return;
            const newLines = [...lines, ""];
            updateContent(activeTab.id, newLines.join("\n"));
            setActiveLineIdx(newLines.length - 1);
          }}
        />
      </div>
    </div>
  );
}
