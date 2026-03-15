"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthState } from "@/components/convex-client-provider";
import { signIn } from "@/lib/tauri";
import { useEditorStore } from "@/lib/store";
import { isTauri } from "@/lib/tauri";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, ExternalLink, Globe, Check, Pencil, X } from "lucide-react";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId?: string | null;
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function getSiteOrigin(): string {
  if (typeof window === "undefined") return "";
  if (isTauri()) return "https://markup.freddiephilpot.dev";
  return window.location.origin;
}

export function PublishDialog({ open, onOpenChange, tabId }: PublishDialogProps) {
  const { isAuthenticated, user } = useAuthState();
  const userId = user?.id ?? null;

  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const targetTabId = tabId ?? activeTabId;
  const tab = tabs.find((t) => t.id === targetTabId);

  const existingSite = useQuery(
    api.sites.getByOwnerTab,
    userId && targetTabId ? { ownerUserId: userId, tabId: targetTabId } : "skip"
  );

  const publish = useMutation(api.sites.publish);
  const unpublish = useMutation(api.sites.unpublish);

  const [slugInput, setSlugInput] = useState("");
  const normalizedSlug = useMemo(() => normalizeSlug(slugInput), [slugInput]);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initial = existingSite?.slug ?? (tab ? normalizeSlug(tab.title.replace(/\.(md|canvas|mindmap)$/, "")) : "");
    queueMicrotask(() => {
      setSlugInput(initial);
      setError(null);
      setCopied(false);
    });
  }, [open, existingSite?.slug, tab?.title]);

  const siteUrl = existingSite?.slug ? `${getSiteOrigin()}/sites/${existingSite.slug}` : null;

  const handlePublish = useCallback(async () => {
    if (!userId || !tab || !targetTabId) return;
    setPublishing(true);
    setError(null);
    try {
      await publish({
        ownerUserId: userId,
        tabId: targetTabId,
        slug: slugInput,
        title: tab.title,
        content: tab.content,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish site.");
    } finally {
      setPublishing(false);
    }
  }, [publish, slugInput, tab, targetTabId, userId]);

  const handleUnpublish = useCallback(async () => {
    if (!userId || !targetTabId) return;
    setUnpublishing(true);
    setError(null);
    try {
      await unpublish({ ownerUserId: userId, tabId: targetTabId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unpublish site.");
    } finally {
      setUnpublishing(false);
    }
  }, [targetTabId, unpublish, userId]);

  const handleCopyLink = useCallback(async () => {
    if (!siteUrl) return;
    await navigator.clipboard.writeText(siteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [siteUrl]);

  const handleEdit = useCallback(() => {
    if (!existingSite?.tabId) return;
    const url = `${getSiteOrigin()}/?tab=${encodeURIComponent(existingSite.tabId)}`;
    window.location.href = url;
  }, [existingSite?.tabId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" /> Publish as Site
          </DialogTitle>
          <DialogDescription>
            Creates a read-only public page at <span className="font-mono">/sites/&lt;your-url&gt;</span>.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Sign in to publish a site.</p>
            <Button onClick={() => signIn(() => window.location.reload())}>Sign in</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Site URL</Label>
              <Input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="e.g. my-notes"
              />
              <p className="text-[11px] text-muted-foreground">
                Preview: <span className="font-mono">{getSiteOrigin()}/sites/{normalizedSlug || "…"}</span>
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button
                onClick={handlePublish}
                disabled={!tab || publishing || normalizedSlug.length < 3}
                className="gap-2"
              >
                <Globe className="h-4 w-4" />
                {existingSite ? "Update Site" : "Publish Site"}
              </Button>

              <div className="flex items-center gap-2">
                {existingSite?.slug && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnpublish}
                    disabled={publishing || unpublishing}
                  >
                    {unpublishing ? "Unpublishing…" : "Unpublish"}
                  </Button>
                )}
                {siteUrl && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy link
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(siteUrl, "_blank", "noopener,noreferrer")}
                      className="gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Button>
                  </>
                )}
                {existingSite?.tabId && (
                  <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Your site is not editable on the public page. Edit the note in Markup, then publish again to update.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
