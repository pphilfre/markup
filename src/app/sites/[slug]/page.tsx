"use client";

import { useMemo, useCallback, isValidElement, cloneElement, Component, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useAuthState } from "@/components/convex-client-provider";
import { PublicThemeMenu } from "@/components/shell/public-theme-menu";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Pencil } from "lucide-react";
import type { CustomThemeColors, ThemeMode } from "@/lib/store";
import { writeClipboardText } from "@/lib/clipboard";

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

  return <PublishedSiteContent key={slug} slug={slug} userId={user?.id ?? null} loggedIn={!!user} />;
}

function PublishedSiteContent({ slug, userId, loggedIn }: { slug: string; userId: string | null; loggedIn: boolean }) {
  const site = useQuery(api.sites.getBySlug, { slug });
  const workspace = useQuery(api.workspace.get, userId ? { userId } : "skip");
  const [timedOut, setTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [renderContent, setRenderContent] = useState("");

  const workspaceSettings = (workspace as { settings?: { themeMode?: ThemeMode; customThemeColors?: CustomThemeColors } } | null)?.settings;
  const workspaceThemeMode = workspaceSettings?.themeMode;
  const workspaceCustomThemeColors = workspaceSettings?.customThemeColors;

  useEffect(() => {
    if (!site) return;
    setRenderContent(site.content);
  }, [site]);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const isOwner = !!(site && userId && site.ownerUserId === userId);

  const handleCopyLink = useCallback(async () => {
    try {
      await writeClipboardText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleEdit = useCallback(() => {
    if (!site?.tabId) return;
    window.sessionStorage.setItem("markup-requested-tab-id", site.tabId);
    window.location.href = `/?tab=${encodeURIComponent(site.tabId)}`;
  }, [site]);

  const handleCheckboxToggle = useCallback((checkboxIndex: number, checked: boolean) => {
    setRenderContent((prev) => {
      const lines = prev.split("\n");
      let currentCheckbox = 0;
      for (let i = 0; i < lines.length; i++) {
        if (/^(\s*[-*+]|\s*\d+\.) \[[ x]\]/.test(lines[i])) {
          if (currentCheckbox === checkboxIndex) {
            lines[i] = lines[i].replace(/\[[ x]\]/, checked ? "[x]" : "[ ]");
            return lines.join("\n");
          }
          currentCheckbox += 1;
        }
      }
      return prev;
    });
  }, []);

  const components = useMemo<Components>(() => {
    let checkboxIdx = 0;

    return {
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
      input: ({ type, checked, disabled, ...props }) => {
        if (type === "checkbox") {
          void disabled;
          const idx = checkboxIdx++;
          return (
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => handleCheckboxToggle(idx, e.target.checked)}
              className="cursor-pointer"
              {...props}
            />
          );
        }
        return <input type={type} {...props} />;
      },
    };
  }, [handleCheckboxToggle]);

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
            <div className="text-sm font-semibold truncate">{site.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/, "")}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PublicThemeMenu
              loggedIn={loggedIn}
              workspaceThemeMode={workspaceThemeMode ?? null}
              workspaceCustomThemeColors={workspaceCustomThemeColors ?? null}
            />
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
            {renderContent}
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
