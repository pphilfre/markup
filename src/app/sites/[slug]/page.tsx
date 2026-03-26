"use client";

import { useMemo, useCallback, isValidElement, cloneElement, Component, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { Copy, ExternalLink, Pencil, Palette } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { BUILTIN_THEMES } from "@/components/shell/settings-panel";

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

class SiteErrorBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-sm font-medium">Unable to load site</p>
          <p className="text-xs text-muted-foreground break-words max-w-lg">{this.state.error.message}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => (window.location.href = "/")}>
            <ExternalLink className="h-3.5 w-3.5" /> Open Markup
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PublishedSitePageInner() {
  const { user } = useAuthState();
  const routeParams = useParams<{ slug?: string | string[] }>();
  const slugParam = routeParams?.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;

  if (!slug) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm font-medium">Site not found</p>
        <p className="text-xs text-muted-foreground">Missing site URL.</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => (window.location.href = "/")}>
          <ExternalLink className="h-3.5 w-3.5" /> Open Markup
        </Button>
      </div>
    );
  }

  return <PublishedSiteContent key={slug} slug={slug} userId={user?.id ?? null} />;
}

function PublishedSiteContent({ slug, userId }: { slug: string; userId: string | null }) {
  // Theme selection for unauthenticated users
  const [localTheme, setLocalTheme] = useState<string | null>(null);
  useEffect(() => {
    if (localTheme) {
      document.documentElement.classList.remove(
        ...BUILTIN_THEMES.map((t) => t.id)
      );
      document.documentElement.classList.add(localTheme);
    }
  }, [localTheme]);
  const site = useQuery(api.sites.getBySlug, { slug });
  const [timedOut, setTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const isOwner = !!(site && userId && site.ownerUserId === userId);

  const handleCopyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
        <div className="flex flex-col items-center gap-2 px-6 text-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
          {timedOut && (
            <>
              <p className="text-xs text-muted-foreground">This is taking longer than expected.</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  Retry
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => (window.location.href = "/")}>
                  <ExternalLink className="h-3.5 w-3.5" /> Open Markup
                </Button>
              </div>
            </>
          )}
        </div>
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
    <div className="h-full min-h-0 bg-background flex flex-col">
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
            {/* Theme selector for unauthenticated users */}
            {!userId && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Change theme">
                    <Palette className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {BUILTIN_THEMES.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onClick={() => setLocalTheme(t.id)}
                      className={localTheme === t.id ? "font-bold" : ""}
                    >
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {isOwner && (
              <Button size="sm" className="gap-1.5" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Copied to Clipboard Banner */}
      {copied && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-green-600 text-white px-4 py-2 shadow-lg animate-fade-in">
          <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="10" fill="#22c55e" />
            <path d="M6 10.5l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="font-semibold text-sm">Copied to Clipboard</span>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-auto mx-auto max-w-4xl px-4 py-8">
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

export default function PublishedSitePage() {
  return (
    <SiteErrorBoundary>
      <PublishedSitePageInner />
    </SiteErrorBoundary>
  );
}
