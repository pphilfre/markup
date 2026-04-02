"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback, isValidElement, cloneElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import { isTauri, openExternal } from "@/lib/tauri";

// ── Admonition types ──────────────────────────────────────────────────────

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

// ── Mermaid diagram renderer ──────────────────────────────────────────────

let standaloneMermaidCounter = 0;

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    standaloneMermaidCounter += 1;
    const renderId = `mermaid-s-${standaloneMermaidCounter}-${Date.now()}`;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
          securityLevel: "loose",
          suppressErrorRendering: true,
        });
        const { svg: rendered } = await mermaid.render(renderId, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
          setSvg("");
        }
      } finally {
        document.getElementById(renderId)?.remove();
        document.getElementById(`d${renderId}`)?.remove();
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-400">
        <p className="font-semibold mb-1">Mermaid Error</p>
        <pre className="whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 flex items-center justify-center rounded-lg border border-border p-8 text-xs text-muted-foreground">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ── Standalone Preview Component ──────────────────────────────────────────

export function MarkdownPreviewStandalone({
  content,
  onContentChange,
}: {
  content: string;
  onContentChange?: (nextContent: string) => void;
}) {
  const [renderContent, setRenderContent] = useState(content);

  useEffect(() => {
    setRenderContent(content);
  }, [content]);

  const handleCheckboxToggle = useCallback(
    (sourceLine: number | undefined, checkboxIndex: number, checked: boolean) => {
      const lines = renderContent.split("\n");
      const taskRegex = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/;
      const markerRegex = /\[[ xX]\]/;

      if (typeof sourceLine === "number" && sourceLine > 0) {
        const directIndex = sourceLine - 1;
        if (directIndex >= 0 && directIndex < lines.length && taskRegex.test(lines[directIndex])) {
          lines[directIndex] = lines[directIndex].replace(markerRegex, checked ? "[x]" : "[ ]");
          const next = lines.join("\n");
          setRenderContent(next);
          onContentChange?.(next);
          return;
        }
      }

      let currentCheckbox = 0;

      for (let i = 0; i < lines.length; i++) {
        if (taskRegex.test(lines[i])) {
          if (currentCheckbox === checkboxIndex) {
            lines[i] = lines[i].replace(markerRegex, checked ? "[x]" : "[ ]");
            const next = lines.join("\n");
            setRenderContent(next);
            onContentChange?.(next);
            break;
          }
          currentCheckbox += 1;
        }
      }
    },
    [onContentChange, renderContent]
  );

  const processedContent = useMemo(() => {
    return renderContent.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      return `**${title}**`;
    });
  }, [renderContent]);

  const handleExternalLinkClick = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
      if (!href) return;

      if (isTauri()) {
        event.preventDefault();
        await openExternal(href);
        return;
      }

      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  const components = useMemo<Components>(
    () => {
      let checkboxIdx = 0;

      return {
      code: ({ className, children, ...props }) => {
        const match = /language-(\w+)/.exec(className || "");
        if (match && match[1] === "mermaid") {
          let chart = String(children).replace(/\n$/, "");
          // Normalize double-space separators to newlines for single-line mermaid diagrams
          if (!chart.includes("\n") && chart.includes("  ")) {
            chart = chart.replace(/ {2,}/g, "\n");
          }
          return <MermaidBlock chart={chart} />;
        }
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      },
      a: ({ href, children, ...props }) => {
        return (
          <a
            href={href}
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              void handleExternalLinkClick(e, href);
            }}
          >
            {children}
          </a>
        );
      },
      blockquote: ({ children, ...props }) => {
        const admonition = parseAdmonition(children);
        if (admonition) {
          const config = ADMONITION_TYPES[admonition.type];
          if (config) {
            return (
              <div
                className="admonition my-4 rounded-lg border-l-4 p-4"
                style={{
                  borderLeftColor: config.color,
                  background: `${config.color}10`,
                }}
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
      input: ({ type, checked, disabled, node, ...props }) => {
        if (type === "checkbox") {
          void disabled;
          const idx = checkboxIdx++;
          const sourceLine =
            typeof node?.position?.start?.line === "number"
              ? node.position.start.line
              : undefined;
          return (
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => handleCheckboxToggle(sourceLine, idx, e.target.checked)}
              className="cursor-pointer"
              {...props}
            />
          );
        }
        return <input type={type} {...props} />;
      },
    };
    },
    [handleCheckboxToggle, handleExternalLinkClick]
  );

  if (!renderContent.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">Nothing to preview</p>
      </div>
    );
  }

  return (
    <article className="markdown-body mx-auto max-w-3xl px-8 py-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </article>
  );
}
