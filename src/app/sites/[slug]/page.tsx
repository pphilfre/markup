"use client";

import { useMemo, useCallback, isValidElement, cloneElement } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuthState } from "@/components/convex-client-provider";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Pencil } from "lucide-react";

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

export default function PublishedSitePage({ params }: { params: { slug: string } }) {
  const { user } = useAuthState();
  const site = useQuery(api.sites.getBySlug, { slug: params.slug });

  const isOwner = !!(site && user?.id && site.ownerUserId === user.id);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
  }, []);

  const handleEdit = useCallback(() => {
    if (!site?.tabId) return;
    window.location.href = `/?tab=${encodeURIComponent(site.tabId)}`;
  }, [site]);

  const components = useMemo<Components>(() => ({
    a: ({ href, children, ...props }) => (
      <a href={href} {...props} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
        {children}
      </a>
    ),
    blockquote: ({ children, ...props }) => {
      const admonition = parseAdmonition(children);
      if (admonition) {
        const config = ADMONITION_TYPES[admonition.type];
        if (config) {
          return (
            <div
              className="my-4 rounded-lg border-l-4 p-4"
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
  }), []);

  if (site === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (site === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium">Site not found</p>
        <p className="text-xs text-muted-foreground">This page doesn’t exist or has been unpublished.</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => (window.location.href = "/")}>
          <ExternalLink className="h-3.5 w-3.5" /> Open Markup
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">
              Published with <a className="underline underline-offset-2" href="/" target="_blank" rel="noopener noreferrer">Markup</a>
            </div>
            <div className="text-sm font-semibold truncate">{site.title.replace(/\.(md|canvas|mindmap)$/, "")}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyLink}>
              <Copy className="h-3.5 w-3.5" /> Copy link
            </Button>
            {isOwner && (
              <Button size="sm" className="gap-1.5" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <article className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={components}
          >
            {site.content}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
