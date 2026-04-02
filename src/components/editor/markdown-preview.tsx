"use client";

import React, { useMemo, useCallback, useEffect, useRef, useState, isValidElement, cloneElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkSupersub from "remark-supersub";
import { remarkDefinitionList, defListHastHandlers } from "remark-definition-list";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "katex/dist/katex.min.css";
import { emojify } from "node-emoji";
import { useEditorStore } from "@/lib/store";
import { isTauri, openExternal } from "@/lib/tauri";
import type { Components } from "react-markdown";

// ── Backlink helpers ──────────────────────────────────────────────────────

export function extractBacklinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  const links: string[] = [];
  for (const m of matches) links.push(m[1]);
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
        if (!cancelled) { setSvg(rendered); setError(""); }
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "Failed to render diagram"); setSvg(""); }
      } finally {
        document.getElementById(renderId)?.remove();
        document.getElementById(`d${renderId}`)?.remove();
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) return (
    <div className="my-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-400">
      <p className="font-semibold mb-1">Mermaid Error</p>
      <pre className="whitespace-pre-wrap">{error}</pre>
    </div>
  );
  if (!svg) return (
    <div className="my-4 flex items-center justify-center rounded-lg border border-border p-8 text-xs text-muted-foreground">
      Rendering diagram…
    </div>
  );
  return (
    <div ref={containerRef} className="my-4 flex justify-center overflow-x-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

// ── Pre-process content ───────────────────────────────────────────────────

/**
 * Pre-process raw markdown before passing to react-markdown:
 * - Convert ==text== to <mark>text</mark>
 * - Convert :emoji: shortcodes to actual emoji
 * - Convert definition blocks (term: definition) to dl/dt/dd
 */
function preprocessMarkdown(content: string): string {
  // Emoji shortcodes
  let out = emojify(content, { fallback: (name) => `:${name}:` });

  // ==highlight== → custom marker (we'll handle in rehype via a remark plugin approach)
  // Use a placeholder that won't conflict with other syntax
  out = out.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

  return out;
}

// ── Preview Component ─────────────────────────────────────────────────────

export function MarkdownPreview({
  id,
  onScroll,
  content: contentProp,
  standalone,
}: {
  id?: string;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  content?: string;
  standalone?: boolean;
} = {}) {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const tabs = useEditorStore((s) => s.tabs);
  const switchTab = useEditorStore((s) => s.switchTab);
  const updateContent = useEditorStore((s) => s.updateContent);

  const activeTab = standalone ? null : tabs.find((t) => t.id === activeTabId);
  const rawContent = contentProp ?? activeTab?.content ?? "";

  // Backlinks
  const backlinks = useMemo(() => {
    if (!activeTab || standalone) return [];
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
  }, [tabs, activeTab, standalone]);

  const handleBacklinkClick = useCallback(
    (title: string) => {
      const target = tabs.find((t) => {
        const tTitle = t.title.replace(/\.md$/, "");
        return tTitle.toLowerCase() === title.toLowerCase() || t.title.toLowerCase() === title.toLowerCase();
      });
      if (target) switchTab(target.id);
    },
    [tabs, switchTab]
  );

  // Pre-process: wiki-links + emoji + highlight marks
  const processedContent = useMemo(() => {
    if (!rawContent) return "";
    let out = rawContent.replace(/\[\[([^\]]+)\]\]/g, (_, title) => `[${title}](backlink:${encodeURIComponent(title)})`);
    out = preprocessMarkdown(out);
    return out;
  }, [rawContent]);

  // Checkbox toggle handler
  const handleCheckboxToggle = useCallback(
    (sourceLine: number | undefined, fallbackIndex: number, checked: boolean) => {
      if (!activeTab) return;
      const lines = activeTab.content.split("\n");

      const taskRegex = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/;
      const markerRegex = /\[[ xX]\]/;

      if (typeof sourceLine === "number" && sourceLine > 0) {
        const directIndex = sourceLine - 1;
        if (directIndex >= 0 && directIndex < lines.length && taskRegex.test(lines[directIndex])) {
          lines[directIndex] = lines[directIndex].replace(markerRegex, checked ? "[x]" : "[ ]");
          updateContent(activeTab.id, lines.join("\n"));
          return;
        }
      }

      let checkboxCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (taskRegex.test(lines[i])) {
          if (checkboxCount === fallbackIndex) {
            lines[i] = lines[i].replace(markerRegex, checked ? "[x]" : "[ ]");
            break;
          }
          checkboxCount += 1;
        }
      }
      updateContent(activeTab.id, lines.join("\n"));
    },
    [activeTab, updateContent]
  );

  const handleExternalLinkClick = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
      if (!href) return;

      if (isTauri()) {
        event.preventDefault();
        await openExternal(href);
        return;
      }

      // Preserve explicit modifier behavior for web clients.
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    []
  );

  // Custom components
  const components = useMemo<Components>(
    () => {
      // Reset checkbox counter each render
      let checkboxIdx = 0;

      return {
        // Code blocks: mermaid diagrams + syntax highlighting scoped to pre>code
        code: ({ className, children, ...props }) => {
          const match = /language-(\w+)/.exec(className || "");
          // Only render mermaid for block code (inside pre)
          if (match && match[1] === "mermaid") {
            let chart = String(children).replace(/\n$/, "");
            if (!chart.includes("\n") && chart.includes("  ")) {
              chart = chart.replace(/ {2,}/g, "\n");
            }
            return <MermaidBlock chart={chart} />;
          }
          return <code className={className} {...props}>{children}</code>;
        },

        // Backlinks
        a: ({ href, children, ...props }) => {
          if (href?.startsWith("backlink:")) {
            const title = decodeURIComponent(href.slice("backlink:".length));
            return (
              <button
                onClick={(e) => { e.preventDefault(); handleBacklinkClick(title); }}
                className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-sm font-medium transition-colors"
                style={{ background: "var(--accent-color, #7c3aed)20", color: "var(--accent-color, #7c3aed)" }}
              >
                <span className="opacity-60">[[</span>{children}<span className="opacity-60">]]</span>
              </button>
            );
          }
          // Footnote back-reference — same page scroll
          if (href?.startsWith("#")) {
            return (
              <a
                href={href}
                {...props}
                onClick={(e) => {
                  e.preventDefault();
                  const target = document.getElementById(href.slice(1));
                  target?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {children}
              </a>
            );
          }
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

        // Admonitions via blockquotes
        blockquote: ({ children, ...props }) => {
          const admonition = parseAdmonition(children);
          if (admonition) {
            const config = ADMONITION_TYPES[admonition.type];
            if (config) {
              return (
                <div className="admonition my-4 rounded-lg border-l-4 p-4"
                  style={{ borderLeftColor: config.color, background: `${config.color}10` }}>
                  <div className="mb-1 flex items-center gap-1.5 font-semibold text-sm" style={{ color: config.color }}>
                    <span>{config.icon}</span><span>{config.label}</span>
                  </div>
                  <div className="text-sm leading-relaxed">{admonition.content}</div>
                </div>
              );
            }
          }
          return <blockquote {...props}>{children}</blockquote>;
        },

        // Clickable checkboxes in preview
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

        // Definition list support
        dl: ({ children, ...props }) => <dl className="my-4 space-y-2" {...props}>{children}</dl>,
        dt: ({ children, ...props }) => {
          // Try to find matching dd sibling via parent traversal — simplified: just render with dashed underline
          return (
            <dt className="font-medium border-b border-dashed border-current/40 inline-block pb-0.5 cursor-help" {...props}>
              {children}
            </dt>
          );
        },
        dd: ({ children, ...props }) => <dd className="ml-4 text-muted-foreground text-sm mt-0.5" {...props}>{children}</dd>,
      };
    },
    [handleBacklinkClick, handleCheckboxToggle, handleExternalLinkClick]
  );

  if (!standalone && !activeTab) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p className="text-sm">No tab open</p>
      </div>
    );
  }

  if (!rawContent.trim()) {
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
          remarkPlugins={[
            [remarkGfm, { singleTilde: false, breaks: true }],
            remarkMath,
            remarkSupersub,
            remarkDefinitionList,
          ]}
          rehypePlugins={[
            rehypeRaw,
            rehypeHighlight,
            rehypeKatex,
          ]}
          remarkRehypeOptions={{ handlers: defListHastHandlers, allowDangerousHtml: true }}
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
