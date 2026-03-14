"use client";

/**
 * Inline Markdown Editor
 *
 * Each line renders as formatted Markdown when it loses focus.
 * Clicking/focusing a line returns it to raw Markdown syntax for editing.
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkSupersub from "remark-supersub";
import { remarkDefinitionList, defListHastHandlers } from "remark-definition-list";
import rehypeRaw from "rehype-raw";
import { emojify } from "node-emoji";
import { useEditorStore } from "@/lib/store";

function preprocessLine(line: string): string {
  let out = emojify(line, { fallback: (name) => `:${name}:` });
  out = out.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
  return out;
}

interface LineProps {
  lineIndex: number;
  text: string;
  isActive: boolean;
  onFocus: (idx: number) => void;
  onBlur: () => void;
  onChange: (idx: number, value: string) => void;
  onKeyDown: (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  settings: { fontFamily: string; fontSize: number; lineHeight: number };
}

function InlineLine({ lineIndex, text, isActive, onFocus, onBlur, onChange, onKeyDown, settings }: LineProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus textarea when this line becomes active
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.focus();
      // Place cursor at end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isActive]);

  // Auto-resize textarea height
  useEffect(() => {
    if (isActive && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
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
        rows={1}
        className="w-full resize-none overflow-hidden bg-transparent outline-none border-none p-0 m-0 block"
        style={style}
        spellCheck
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
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkSupersub, remarkDefinitionList]}
        remarkRehypeOptions={{ handlers: defListHastHandlers, allowDangerousHtml: true }}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Prevent wrapping in <p> for single-line content
          p: ({ children }) => <span>{children}</span>,
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

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [activeLineIdx, setActiveLineIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => (activeTab?.content ?? "").split("\n"), [activeTab?.content]);

  const handleFocus = useCallback((idx: number) => setActiveLineIdx(idx), []);

  const handleBlur = useCallback(() => setActiveLineIdx(null), []);

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
    [activeTab, lines, updateContent]
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
