"use client";

import React, { useMemo, useCallback, useEffect, useRef, useState, isValidElement, cloneElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useEditorStore } from "@/lib/store";
import type { Components } from "react-markdown";

// ── Backlink helpers ──────────────────────────────────────────────────────

/** Extract all [[wiki-link]] references from content */
export function extractBacklinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  const links: string[] = [];
  for (const m of matches) {
    links.push(m[1]);
  }
  return [...new Set(links)];
}

// ── Admonition types ──────────────────────────────────────────────────────

const ADMONITION_TYPES: Record<string, { color: string; icon: string; label: string }> = {
  NOTE: { color: "#3b82f6", icon: "ℹ️", label: "Note" },
  TIP: { color: "#22c55e", icon: "💡", label: "Tip" },
  IMPORTANT: { color: "#8b5cf6", icon: "📌", label: "Important" },
  WARNING: { color: "#f97316", icon: "⚠️", label: "Warning" },
  CAUTION: { color: "#ef4444", icon: "🔴", label: "Caution" },
};

/** Parse blockquote text for GitHub-style admonition syntax: [!TYPE] */
function parseAdmonition(children: React.ReactNode): { type: string; content: React.ReactNode } | null {
  const childArr = Array.isArray(children) ? children : [children];
  if (childArr.length === 0) return null;

  // Skip whitespace text nodes to find the first React element (should be a <p>)
  const firstIdx = childArr.findIndex((c) => isValidElement(c));
  if (firstIdx === -1) return null;

  const first = childArr[firstIdx] as React.ReactElement<{ children?: React.ReactNode }>;

  // The first child should be a <p> containing the admonition marker
  const pChildren = first.props?.children;
  if (pChildren == null) return null;

  // Could be string or array
  const textParts = Array.isArray(pChildren) ? pChildren : [pChildren];
  const firstText = textParts.find((p: unknown) => typeof p === "string") as string | undefined;
  if (!firstText) return null;

  const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i);
  if (!match) return null;

  const type = match[1].toUpperCase();
  // Rebuild remaining content without the marker
  const remainingText = firstText.slice(match[0].length);
  const newFirstParts = [remainingText, ...textParts.filter((p: unknown) => p !== firstText)].filter(Boolean);

  // Clone element with modified children instead of fragile object spread
  const newFirst = newFirstParts.length > 0
    ? cloneElement(first, {}, ...(newFirstParts.length === 1 ? [newFirstParts[0]] : newFirstParts))
    : null;

  // Gather remaining blockquote children (skip whitespace-only text nodes)
  const rest = childArr.slice(firstIdx + 1).filter(
    (c) => typeof c !== "string" || c.trim().length > 0
  );
  const content = newFirst ? [newFirst, ...rest] : rest;

  return { type, content };
}

// ── Mermaid diagram renderer ──────────────────────────────────────────────

let mermaidCounter = 0;

function MermaidBlock({ chart }: { chart: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    mermaidCounter += 1;
    const renderId = `mermaid-${mermaidCounter}-${Date.now()}`;

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
        // Clean up temp elements mermaid creates in the DOM
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

// ── Preview Component ─────────────────────────────────────────────────────

export function MarkdownPreview({
  id,
  onScroll,
}: {
  id?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
} = {}) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const switchTab = useEditorStore((s) => s.switchTab);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Find backlinks: which tabs reference the current tab
  const backlinks = useMemo(() => {
    if (!activeTab) return [];
    const titleNoExt = activeTab.title.replace(/\.md$/, "");
    return tabs.filter((t) => {
      if (t.id === activeTab.id) return false;
      const refs = extractBacklinks(t.content);
      return refs.some(
        (ref) =>
          ref.toLowerCase() === titleNoExt.toLowerCase() ||
          ref.toLowerCase() === activeTab.title.toLowerCase()
      );
    });
  }, [tabs, activeTab]);

  // Handle clicking a backlink in preview
  const handleBacklinkClick = useCallback(
    (title: string) => {
      const target = tabs.find((t) => {
        const tTitle = t.title.replace(/\.md$/, "");
        return (
          tTitle.toLowerCase() === title.toLowerCase() ||
          t.title.toLowerCase() === title.toLowerCase()
        );
      });
      if (target) switchTab(target.id);
    },
    [tabs, switchTab]
  );

  // Pre-process content: convert [[wiki-links]] to markdown links
  const processedContent = useMemo(() => {
    if (!activeTab) return "";
    return activeTab.content.replace(/\[\[([^\]]+)\]\]/g, (_, title) => {
      return `[${title}](backlink:${encodeURIComponent(title)})`;
    });
  }, [activeTab]);

  // Custom components for react-markdown
  const components = useMemo<Components>(
    () => ({
      // Render mermaid code blocks as diagrams
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
      // Render backlinks as clickable spans
      a: ({ href, children, ...props }) => {
        if (href?.startsWith("backlink:")) {
          const title = decodeURIComponent(href.slice("backlink:".length));
          return (
            <button
              onClick={(e) => {
                e.preventDefault();
                handleBacklinkClick(title);
              }}
              className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-sm font-medium transition-colors"
              style={{
                background: "var(--accent-color, #7c3aed)20",
                color: "var(--accent-color, #7c3aed)",
              }}
            >
              <span className="opacity-60">[[</span>
              {children}
              <span className="opacity-60">]]</span>
            </button>
          );
        }
        return (
          <a href={href} {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
      // Admonition support via blockquotes
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
    }),
    [handleBacklinkClick]
  );

  if (!activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">No tab open</p>
      </div>
    );
  }

  if (!activeTab.content.trim()) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">Nothing to preview</p>
      </div>
    );
  }

  return (
    <div id={id} onScroll={onScroll} className="flex-1 overflow-auto">
      <article className="markdown-body mx-auto max-w-3xl px-8 py-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeHighlight, rehypeKatex]}
          components={components}
        >
          {processedContent}
        </ReactMarkdown>

        {/* Backlinks section */}
        {backlinks.length > 0 && (
          <div className="mt-8 border-t border-border pt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Backlinks
            </h4>
            <div className="flex flex-wrap gap-2">
              {backlinks.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => switchTab(tab.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
                >
                  <span className="opacity-60">←</span>
                  {tab.title.replace(/\.md$/, "")}
                </button>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}
