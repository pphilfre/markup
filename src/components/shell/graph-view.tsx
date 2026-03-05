"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useEditorStore, Tab } from "@/lib/store";
import { extractBacklinks } from "@/components/editor/markdown-preview";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import { Tag, Filter, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  tags: string[];
  hasContent: boolean;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

// ── Tag Colors ────────────────────────────────────────────────────────────

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#a855f7", "#e11d48",
];

function getTagColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag);
  return TAG_COLORS[idx % TAG_COLORS.length];
}

// ── Graph View Component ──────────────────────────────────────────────────

export function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabs = useEditorStore((s) => s.tabs);
  const switchTab = useEditorStore((s) => s.switchTab);
  const theme = useEditorStore((s) => s.theme);
  const accentColor = useEditorStore((s) => s.settings.accentColor);

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const simRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const draggingRef = useRef<GraphNode | null>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  // Gather all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tabs.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tabs]);

  // Build graph data
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();

    // Create nodes for each tab
    tabs.forEach((tab) => {
      nodeMap.set(tab.id, {
        id: tab.id,
        title: tab.title.replace(/\.md$/, ""),
        tags: tab.tags,
        hasContent: tab.content.trim().length > 0,
      });
    });

    // Create links from backlinks
    const graphLinks: GraphLink[] = [];
    tabs.forEach((tab) => {
      const refs = extractBacklinks(tab.content);
      refs.forEach((ref) => {
        const target = tabs.find((t) => {
          const tTitle = t.title.replace(/\.md$/, "");
          return (
            tTitle.toLowerCase() === ref.toLowerCase() ||
            t.title.toLowerCase() === ref.toLowerCase()
          );
        });
        if (target && target.id !== tab.id) {
          // Avoid duplicate links
          const exists = graphLinks.some(
            (l) =>
              (l.source === tab.id && l.target === target.id) ||
              (l.source === target.id && l.target === tab.id)
          );
          if (!exists) {
            graphLinks.push({ source: tab.id, target: target.id });
          }
        }
      });
    });

    return { nodes: Array.from(nodeMap.values()), links: graphLinks };
  }, [tabs]);

  // Filter nodes by selected tags
  const filteredNodeIds = useMemo(() => {
    if (selectedTags.size === 0) return new Set(nodes.map((n) => n.id));
    return new Set(
      nodes.filter((n) => n.tags.some((t) => selectedTags.has(t))).map((n) => n.id)
    );
  }, [nodes, selectedTags]);

  // Initialize simulation
  useEffect(() => {
    const width = containerRef.current?.clientWidth ?? 800;
    const height = containerRef.current?.clientHeight ?? 600;

    // Copy new positions if nodes already exist
    const oldPositions = new Map<string, { x: number; y: number }>();
    nodesRef.current.forEach((n) => {
      if (n.x !== undefined && n.y !== undefined) {
        oldPositions.set(n.id, { x: n.x, y: n.y });
      }
    });

    const simNodes = nodes.map((n) => {
      const old = oldPositions.get(n.id);
      return {
        ...n,
        x: old?.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: old?.y ?? height / 2 + (Math.random() - 0.5) * 200,
      };
    });

    const simLinks = links.map((l) => ({ ...l }));

    nodesRef.current = simNodes;
    linksRef.current = simLinks;

    if (simRef.current) simRef.current.stop();

    const sim = forceSimulation<GraphNode>(simNodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(simLinks)
          .id((d) => d.id)
          .distance(120)
          .strength(0.5)
      )
      .force("charge", forceManyBody().strength(-300))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide(30))
      .alphaDecay(0.02);

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [nodes, links]);

  // Get node color
  const getNodeColor = useCallback(
    (node: GraphNode): string => {
      if (node.tags.length === 0) return accentColor;
      // Use color of the first matching selected tag, or first tag
      const relevantTag =
        node.tags.find((t) => selectedTags.has(t)) || node.tags[0];
      return getTagColor(relevantTag, allTags);
    },
    [allTags, selectedTags, accentColor]
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = theme === "dark";

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Clear
      ctx.fillStyle = isDark ? "#0a0a0a" : "#fafafa";
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const simNodes = nodesRef.current;
      const simLinks = linksRef.current;

      // Draw links
      simLinks.forEach((link) => {
        const source = typeof link.source === "object" ? link.source : simNodes.find((n) => n.id === link.source);
        const target = typeof link.target === "object" ? link.target : simNodes.find((n) => n.id === link.target);
        if (!source || !target || source.x == null || source.y == null || target.x == null || target.y == null) return;

        const sourceVisible = filteredNodeIds.has(source.id);
        const targetVisible = filteredNodeIds.has(target.id);
        if (!sourceVisible && !targetVisible) return;

        const isHighlighted =
          hoveredNode === source.id || hoveredNode === target.id;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isHighlighted
          ? (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)")
          : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)");
        ctx.lineWidth = isHighlighted ? 2 : 1;
        ctx.stroke();
      });

      // Draw nodes
      simNodes.forEach((node) => {
        if (node.x == null || node.y == null) return;

        const visible = filteredNodeIds.has(node.id);
        const isHovered = hoveredNode === node.id;
        const isConnectedToHover = hoveredNode
          ? simLinks.some((l) => {
              const sId = typeof l.source === "object" ? l.source.id : l.source;
              const tId = typeof l.target === "object" ? l.target.id : l.target;
              return (
                (sId === hoveredNode && tId === node.id) ||
                (tId === hoveredNode && sId === node.id)
              );
            })
          : false;

        const opacity = !visible ? 0.15 : isHovered || isConnectedToHover ? 1 : hoveredNode ? 0.4 : 1;
        const radius = node.hasContent ? (isHovered ? 10 : 7) : (isHovered ? 8 : 5);
        const color = getNodeColor(node);

        // Glow for hovered node
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = color + "30";
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.fill();

        // Border
        ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        if (visible && (isHovered || isConnectedToHover || zoom > 0.8 || !hoveredNode)) {
          ctx.font = `${isHovered ? "bold " : ""}${11 / zoom > 14 ? 14 : 11}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)";
          ctx.globalAlpha = opacity;
          ctx.fillText(node.title, node.x, node.y + radius + 14);
        }

        ctx.globalAlpha = 1;
      });

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [theme, zoom, pan, filteredNodeIds, hoveredNode, getNodeColor]);

  // Coordinate transform helpers
  const canvasToGraph = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const x = (clientX - rect.left - pan.x) / zoom;
      const y = (clientY - rect.top - pan.y) / zoom;
      return { x, y };
    },
    [zoom, pan]
  );

  const findNodeAt = useCallback(
    (gx: number, gy: number): GraphNode | null => {
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.x == null || n.y == null) continue;
        const dx = gx - n.x;
        const dy = gy - n.y;
        if (dx * dx + dy * dy < 15 * 15) return n;
      }
      return null;
    },
    []
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);

      if (node) {
        draggingRef.current = node;
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        isPanningRef.current = true;
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    },
    [canvasToGraph, findNodeAt]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (draggingRef.current) {
        const node = draggingRef.current;
        const { x, y } = canvasToGraph(e.clientX, e.clientY);
        node.fx = x;
        node.fy = y;
        return;
      }

      if (isPanningRef.current) {
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        return;
      }

      // Hover detection
      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);
      setHoveredNode(node?.id ?? null);

      const canvas = canvasRef.current;
      if (canvas) canvas.style.cursor = node ? "pointer" : "grab";
    },
    [canvasToGraph, findNodeAt]
  );

  const handleMouseUp = useCallback(() => {
    if (draggingRef.current) {
      draggingRef.current.fx = null;
      draggingRef.current.fy = null;
      draggingRef.current = null;
      simRef.current?.alphaTarget(0);
    }
    isPanningRef.current = false;
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) return;
      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);
      if (node) {
        switchTab(node.id);
      }
    },
    [canvasToGraph, findNodeAt, switchTab]
  );

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.2, Math.min(3, z * delta)));
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const resetView = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const simNodes = nodesRef.current;
    if (simNodes.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of simNodes) {
      if (n.x != null && n.y != null) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x);
        maxY = Math.max(maxY, n.y);
      }
    }

    if (!isFinite(minX)) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const padding = 60;
    const graphW = maxX - minX + padding * 2;
    const graphH = maxY - minY + padding * 2;
    const rect = container.getBoundingClientRect();
    const scaleX = rect.width / graphW;
    const scaleY = rect.height / graphH;
    const newZoom = Math.max(0.2, Math.min(3, Math.min(scaleX, scaleY)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const newPanX = rect.width / 2 - cx * newZoom;
    const newPanY = rect.height / 2 - cy * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden relative">
      {/* Controls overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card/90 backdrop-blur-sm p-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoom((z) => Math.max(0.2, z * 0.8))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetView}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tag filter panel */}
      {allTags.length > 0 && (
        <div className="absolute top-3 right-3 z-10 max-w-[200px]">
          <div className="rounded-md border border-border bg-card/90 backdrop-blur-sm p-2">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filter by tag
            </p>
            <div className="flex flex-wrap gap-1">
              {allTags.map((tag) => {
                const isSelected = selectedTags.has(tag);
                const color = getTagColor(tag, allTags);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[10px] border transition-colors",
                      isSelected
                        ? "border-transparent text-white"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                    style={
                      isSelected
                        ? { background: color }
                        : { background: color + "15" }
                    }
                  >
                    #{tag}
                  </button>
                );
              })}
              {selectedTags.size > 0 && (
                <button
                  onClick={() => setSelectedTags(new Set())}
                  className="rounded-sm px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{nodes.length} notes</span>
        <span>·</span>
        <span>{links.length} connections</span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full h-full"
        style={{ cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  );
}
