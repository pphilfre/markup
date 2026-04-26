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
import "katex/dist/katex.min.css";
import { emojify } from "node-emoji";
import { useEditorStore } from "@/lib/store";

function preprocessLine(line: string): string {
  let out = emojify(line, { fallback: (name) => `:${name}:` });
  out = out.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  return out;
}

const ADMONITION_TYPES: Record<string, { color: string; icon: string; label: string }> = {
  NOTE: { color: "#3b82f6", icon: "ℹ️", label: "Note" },
  TIP: { color: "#22c55e", icon: "💡", label: "Tip" },
  IMPORTANT: { color: "#8b5cf6", icon: "📌", label: "Important" },
  WARNING: { color: "#f97316", icon: "⚠️", label: "Warning" },
  CAUTION: { color: "#ef4444", icon: "🔴", label: "Caution" },
};

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

function InlineLine({ lineIndex, text, isActive, onFocus, onBlur, onChange, onKeyDown, onActiveTextarea, onSelectionChange, settings }: LineProps) {
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

  // Empty line — render a non-breaking space so it has height
  if (!text.trim()) {
    return (
      <div
        onClick={() => onFocus(lineIndex)}
        className="min-h-[1.5em] cursor-text w-full"
        style={style}
      >
        &nbsp;
      </div>
    );
  }

  const processed = preprocessLine(text);

  return (
    <div
      onClick={() => onFocus(lineIndex)}
      className="cursor-text w-full [&_p]:m-0 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-bold [&_h3]:text-lg [&_h3]:font-semibold [&_strong]:font-bold [&_em]:italic [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_code]:text-sm [&_mark]:bg-yellow-200 [&_mark]:dark:bg-yellow-800 [&_mark]:px-0.5 [&_del]:line-through [&_del]:opacity-60 [&_sup]:text-xs [&_sup]:align-super [&_sub]:text-xs [&_sub]:align-sub"
      style={style}
    >
      <ReactMarkdown
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath, remarkSupersub, remarkDefinitionList]}
        remarkRehypeOptions={{ handlers: defListHastHandlers, allowDangerousHtml: true }}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          // Prevent wrapping in <p> for single-line content
          p: ({ children }) => <span>{children}</span>,
          blockquote: ({ children, ...props }) => {
            const admonition = parseAdmonition(children);
            if (admonition) {
              const config = ADMONITION_TYPES[admonition.type];
              if (config) {
                return (
                  <div
                    className="admonition my-2 rounded-lg border-l-4 p-3"
                    style={{ borderLeftColor: config.color, background: `${config.color}10` }}
                  >
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-sm" style={{ color: config.color }}>
                      <span>{config.icon}</span>
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

export function InlineMarkdownEditor({ onScroll }: { onScroll?: (fraction: number) => void } = {}) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const updateContent = useEditorStore((s) => s.updateContent);
  const settings = useEditorStore((s) => s.settings);
  const setInlineTextarea = useEditorStore((s) => s.setInlineTextarea);
  const setInlineSelection = useEditorStore((s) => s.setInlineSelection);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => (activeTab?.content ?? "").split("\n"), [activeTab?.content]);

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

  const handleKeyDown = useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (settings.autoPunctuation && e.key === " " && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const input = e.currentTarget;
        const selStart = input.selectionStart ?? 0;
        const selEnd = input.selectionEnd ?? 0;
        const lineText = lines[idx] ?? "";

        if (
          selStart === selEnd &&
          selStart >= 2 &&
          lineText[selStart - 1] === " " &&
          /[A-Za-z0-9\])"']/.test(lineText[selStart - 2])
        ) {
          e.preventDefault();
          if (!activeTab) return;

          const updatedLine = `${lineText.slice(0, selStart - 1)}. ${lineText.slice(selStart)}`;
          const newLines = [...lines];
          newLines[idx] = updatedLine;
          updateContent(activeTab.id, newLines.join("\n"));

          queueMicrotask(() => {
            const cursorPos = selStart + 1;
            input.setSelectionRange(cursorPos, cursorPos);
            setInlineSelection({ lineIndex: idx, from: cursorPos, to: cursorPos });
          });
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!activeTab) return;
        const newLines = [...lines];
        newLines.splice(idx + 1, 0, "");
        updateContent(activeTab.id, newLines.join("\n"));
        setActiveLineIdx(idx + 1);
      } else if (e.key === "Backspace" && lines[idx] === "" && lines.length > 1) {
        e.preventDefault();
        if (!activeTab) return;
        const newLines = [...lines];
        newLines.splice(idx, 1);
        updateContent(activeTab.id, newLines.join("\n"));
        setActiveLineIdx(Math.max(0, idx - 1));
      } else if (e.key === "ArrowUp" && idx > 0) {
        e.preventDefault();
        setActiveLineIdx(idx - 1);
      } else if (e.key === "ArrowDown" && idx < lines.length - 1) {
        e.preventDefault();
        setActiveLineIdx(idx + 1);
      }
    },
    [activeTab, lines, settings.autoPunctuation, setInlineSelection, updateContent]
  );

  // Scroll sync
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !onScroll) return;
    const handler = () => {
      const max = el.scrollHeight - el.clientHeight;
      onScroll(max > 0 ? el.scrollTop / max : 0);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onScroll]);

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
      className="flex-1 overflow-auto"
      style={{ paddingLeft: settings.editorMargin, paddingRight: settings.editorMargin }}
    >
      <div className="mx-auto py-4" style={{ maxWidth: settings.maxLineWidth > 0 ? `${settings.maxLineWidth}ch` : undefined }}>
        {lines.map((line, idx) => (
          <InlineLine
            key={idx}
            lineIndex={idx}
            text={line}
            isActive={activeLineIdx === idx}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onActiveTextarea={(lineIndex, el) => {
              if (activeLineIdx !== lineIndex) return;
              setInlineTextarea(el);
              if (el) {
                setInlineSelection({
                  lineIndex,
                  from: el.selectionStart ?? 0,
                  to: el.selectionEnd ?? 0,
                });
              }
            }}
            onSelectionChange={(lineIndex, from, to) => {
              if (activeLineIdx !== lineIndex) return;
              setInlineSelection({ lineIndex, from, to });
            }}
            settings={settings}
          />
        ))}
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
