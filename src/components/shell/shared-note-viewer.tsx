"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthState } from "@/components/convex-client-provider";
import { MarkdownPreviewStandalone } from "@/components/editor/markdown-preview-standalone";
import { PublicThemeMenu } from "@/components/shell/public-theme-menu";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Globe, Lock, Eye, Pencil, ArrowLeft, Copy, Check, Layout, GitBranch } from "lucide-react";
import type { CustomThemeColors, ThemeMode } from "@/lib/store";
import { writeClipboardText } from "@/lib/clipboard";

interface SharedNoteViewerProps {
  shareId: string;
  onBack: () => void;
}

// ── Read-only Whiteboard Canvas ─────────────────────────────────────────
function ReadOnlyWhiteboardCanvas({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => {
    try {
      const obj = JSON.parse(data);
      return {
        elements: JSON.parse(obj.elements || "[]") as Array<Record<string, unknown>>,
        canvasSettings: JSON.parse(obj.canvasSettings || "{}"),
      };
    } catch {
      return { elements: [], canvasSettings: {} };
    }
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Background
    const bg = parsed.canvasSettings.backgroundColor || "#ffffff";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (parsed.elements.length === 0) {
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText("Empty whiteboard", w / 2, h / 2);
      return;
    }

    // Compute bounding box of all elements to fit them into view
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of parsed.elements) {
      const ex = (el.x as number) ?? 0;
      const ey = (el.y as number) ?? 0;
      const ew = (el.width as number) ?? (el.x2 as number) ? Math.abs((el.x2 as number) - ex) : 100;
      const eh = (el.height as number) ?? (el.y2 as number) ? Math.abs((el.y2 as number) - ey) : 100;
      if (ex < minX) minX = ex;
      if (ey < minY) minY = ey;
      if (ex + ew > maxX) maxX = ex + ew;
      if (ey + eh > maxY) maxY = ey + eh;
    }

    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const padding = 40;
    const scale = Math.min((w - padding * 2) / bw, (h - padding * 2) / bh, 2);
    const offsetX = (w - bw * scale) / 2 - minX * scale;
    const offsetY = (h - bh * scale) / 2 - minY * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Draw each element simply
    for (const el of parsed.elements) {
      const type = el.type as string;
      ctx.strokeStyle = (el.strokeColor as string) || "#333";
      ctx.fillStyle = (el.fillColor as string) || "transparent";
      ctx.lineWidth = (el.strokeWidth as number) || 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const x = (el.x as number) || 0;
      const y = (el.y as number) || 0;

      if (type === "rectangle" || type === "diamond" || type === "triangle" || type === "star" || type === "hexagon") {
        const ew = (el.width as number) || 0;
        const eh = (el.height as number) || 0;
        if (type === "rectangle") {
          if (ctx.fillStyle !== "transparent") ctx.fillRect(x, y, ew, eh);
          ctx.strokeRect(x, y, ew, eh);
        } else {
          // Approximate non-rect shapes as rectangles in read-only view
          if (ctx.fillStyle !== "transparent") ctx.fillRect(x, y, ew, eh);
          ctx.strokeRect(x, y, ew, eh);
        }
      } else if (type === "ellipse") {
        const ew = (el.width as number) || 0;
        const eh = (el.height as number) || 0;
        const rx = ew / 2;
        const ry = eh / 2;
        ctx.beginPath();
        ctx.ellipse(x + rx, y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
        if (ctx.fillStyle !== "transparent") ctx.fill();
        ctx.stroke();
      } else if (type === "line" || type === "arrow") {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo((el.x2 as number) || x, (el.y2 as number) || y);
        ctx.stroke();
      } else if (type === "pen") {
        const points = (el.points as Array<{ x: number; y: number }>) || [];
        if (points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
          ctx.stroke();
        }
      } else if (type === "text") {
        ctx.font = `${(el.fontSize as number) || 16}px sans-serif`;
        ctx.fillStyle = (el.strokeColor as string) || "#333";
        ctx.fillText((el.text as string) || "", x, y);
      }
    }

    ctx.restore();
  }, [parsed]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

// ── Read-only Mindmap Canvas ────────────────────────────────────────────
function ReadOnlyMindmapCanvas({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => {
    try {
      const obj = JSON.parse(data);
      return {
        nodes: JSON.parse(obj.nodes || "[]") as Array<Record<string, unknown>>,
        connections: JSON.parse(obj.connections || "[]") as Array<Record<string, unknown>>,
      };
    } catch {
      return { nodes: [], connections: [] };
    }
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "var(--background, #fff)";
    ctx.fillRect(0, 0, w, h);

    if (parsed.nodes.length === 0) {
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.fillText("Empty mindmap", w / 2, h / 2);
      return;
    }

    // Compute bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of parsed.nodes) {
      const nx = (n.x as number) || 0;
      const ny = (n.y as number) || 0;
      const nw = (n.width as number) || 120;
      const nh = (n.height as number) || 40;
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (nx + nw > maxX) maxX = nx + nw;
      if (ny + nh > maxY) maxY = ny + nh;
    }

    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const padding = 40;
    const scale = Math.min((w - padding * 2) / bw, (h - padding * 2) / bh, 2);
    const offsetX = (w - bw * scale) / 2 - minX * scale;
    const offsetY = (h - bh * scale) / 2 - minY * scale;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Build node map for connections
    const nodeMap = new Map<string, Record<string, unknown>>();
    for (const n of parsed.nodes) nodeMap.set(n.id as string, n);

    // Draw connections
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    for (const c of parsed.connections) {
      const from = nodeMap.get(c.fromId as string);
      const to = nodeMap.get(c.toId as string);
      if (!from || !to) continue;
      const fx = ((from.x as number) || 0) + ((from.width as number) || 120) / 2;
      const fy = ((from.y as number) || 0) + ((from.height as number) || 40) / 2;
      const tx = ((to.x as number) || 0) + ((to.width as number) || 120) / 2;
      const ty = ((to.y as number) || 0) + ((to.height as number) || 40) / 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // Draw nodes
    for (const n of parsed.nodes) {
      const nx = (n.x as number) || 0;
      const ny = (n.y as number) || 0;
      const nw = (n.width as number) || 120;
      const nh = (n.height as number) || 40;
      const bg = (n.color as string) || "#7c3aed";
      const textColor = (n.textColor as string) || "#fff";

      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, nh, 8);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.font = `${(n.fontSize as number) || 14}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((n.text as string) || "", nx + nw / 2, ny + nh / 2);
    }

    ctx.restore();
  }, [parsed]);

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

export function SharedNoteViewer({ shareId, onBack }: SharedNoteViewerProps) {
  const { user } = useAuthState();
  const sharedNote = useQuery(api.sharing.getByShareId, { shareId });
  const workspace = useQuery(api.workspace.get, user?.id ? { userId: user.id } : "skip");
  const updateByShareId = useMutation(api.sharing.updateByShareId);

  const [editContent, setEditContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedContent = useRef<string | null>(null);

  // Set edit content when note loads
  useEffect(() => {
    if (sharedNote && editContent === null) {
      queueMicrotask(() => setEditContent(sharedNote.content));
      lastPushedContent.current = sharedNote.content;
    }
  }, [sharedNote, editContent]);

  // Update local content when remote changes (from owner or other collaborators)
  useEffect(() => {
    if (!sharedNote) return;
    if (sharedNote.permission === "read") {
      queueMicrotask(() => setEditContent(sharedNote.content));
    } else if (sharedNote.permission === "edit") {
      // Only apply remote changes we didn't originate
      if (lastPushedContent.current !== null && sharedNote.content !== lastPushedContent.current) {
        queueMicrotask(() => setEditContent(sharedNote.content));
      }
      lastPushedContent.current = sharedNote.content;
    }
  }, [sharedNote]);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setEditContent(newContent);
      lastPushedContent.current = newContent;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        updateByShareId({
          shareId,
          content: newContent,
          title: sharedNote?.title ?? "Untitled",
        }).catch(console.error);
      }, 500);
    },
    [shareId, sharedNote?.title, updateByShareId]
  );

  const handleCopyLink = useCallback(async () => {
    try {
      await writeClipboardText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  if (sharedNote === undefined) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading shared note…</p>
      </div>
    );
  }

  if (sharedNote === null) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-muted-foreground">
          This shared note doesn&apos;t exist or has been unshared.
        </p>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Go back
        </Button>
      </div>
    );
  }

  // Check access for private notes
  if (
    sharedNote.visibility === "private" &&
    sharedNote.ownerUserId !== user?.id &&
    (!user?.email || !sharedNote.allowedUsers.includes(user.email.toLowerCase()))
  ) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          This note is private. You don&apos;t have access.
        </p>
        <Button variant="outline" size="sm" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          Go back
        </Button>
      </div>
    );
  }

  const canEdit = sharedNote.permission === "edit";
  const displayContent = editContent ?? sharedNote.content;
  const noteType = (sharedNote as Record<string, unknown>).noteType as string | undefined;
  const workspaceSettings = (workspace as { settings?: { themeMode?: ThemeMode; customThemeColors?: CustomThemeColors } } | null)?.settings;
  const workspaceThemeMode = workspaceSettings?.themeMode;
  const workspaceCustomThemeColors = workspaceSettings?.customThemeColors;

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-7 w-7 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <h1 className="flex-1 truncate text-sm font-medium">
          {sharedNote.title.replace(/\.md$/, "")}
          {noteType === "whiteboard" && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Layout className="h-3 w-3" /> Whiteboard
            </span>
          )}
          {noteType === "mindmap" && (
            <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <GitBranch className="h-3 w-3" /> Mindmap
            </span>
          )}
        </h1>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {sharedNote.visibility === "public" ? (
            <span className="flex items-center gap-1">
              <Globe className="h-3 w-3" /> Public
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> Private
            </span>
          )}
          <span className="h-3 w-px bg-border" />
          {canEdit ? (
            <span className="flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Editable
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> Read only
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
          className="h-7 gap-1.5 text-xs"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy link"}
        </Button>

        <PublicThemeMenu
          loggedIn={!!user}
          workspaceThemeMode={workspaceThemeMode ?? null}
          workspaceCustomThemeColors={workspaceCustomThemeColors ?? null}
        />
      </div>

      {/* Content */}
      {noteType === "whiteboard" && (sharedNote as Record<string, unknown>).whiteboardData ? (
        <ReadOnlyWhiteboardCanvas data={(sharedNote as Record<string, unknown>).whiteboardData as string} />
      ) : noteType === "mindmap" && (sharedNote as Record<string, unknown>).mindmapData ? (
        <ReadOnlyMindmapCanvas data={(sharedNote as Record<string, unknown>).mindmapData as string} />
      ) : canEdit ? (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Editor */}
          <div className="flex flex-1 min-h-0 flex-col overflow-hidden border-r border-border">
            <textarea
              ref={textareaRef}
              value={displayContent}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none bg-background p-6 font-mono text-sm leading-relaxed outline-none"
              spellCheck={false}
            />
          </div>
          {/* Preview */}
          <div className="flex flex-1 min-h-0 flex-col overflow-auto">
            <MarkdownPreviewStandalone content={displayContent} onContentChange={handleContentChange} />
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <MarkdownPreviewStandalone content={displayContent} />
        </div>
      )}
    </div>
  );
}
