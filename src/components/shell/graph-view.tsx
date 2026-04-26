"use client";

import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import { useEditorStore } from "@/lib/store";
import { extractBacklinks } from "@/components/editor/markdown-preview";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";
import {
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Link2,
  ChevronDown,
  ChevronRight,
  Eye,
  Play,
  Settings2,
  Layers,
  Move,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;
  title: string;
  tags: string[];
  hasContent: boolean;
  groupId?: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  manual?: boolean;
}

interface GraphGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: Set<string>;
}

// ── Tag Colors ────────────────────────────────────────────────────────────

const TAG_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#06b6d4", "#3b82f6", "#a855f7", "#e11d48",
];

const GROUP_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

/** Return a deterministic color for a tag from the shared palette. */
function getTagColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag);
  return TAG_COLORS[idx % TAG_COLORS.length];
}

// ── Display settings ──────────────────────────────────────────────────────

interface DisplaySettings {
  showArrows: boolean;
  textFadeThreshold: number;
  nodeSize: number;
  lineThickness: number;
  showTags: boolean;
  showOrphans: boolean;
}

interface ForceSettings {
  chargeStrength: number;
  linkDistance: number;
  linkStrength: number;
  centerStrength: number;
  collideRadius: number;
}

const DEFAULT_DISPLAY: DisplaySettings = {
  showArrows: false,
  textFadeThreshold: 0.4,
  nodeSize: 1,
  lineThickness: 1,
  showTags: true,
  showOrphans: true,
};

const DEFAULT_FORCES: ForceSettings = {
  chargeStrength: -300,
  linkDistance: 120,
  linkStrength: 0.5,
  centerStrength: 0.1,
  collideRadius: 30,
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

/** Clamp zoom values to the graph view's safe range. */
function clampZoom(value: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
}

// ── Collapsible panel section ─────────────────────────────────────────────

function PanelSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border/50 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Icon className="h-3 w-3" />
        <span>{title}</span>
      </button>
      {open && <div className="px-2.5 pb-2.5 space-y-2">{children}</div>}
    </div>
  );
}

/** Render a compact slider control used by graph settings rows. */
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-primary cursor-pointer"
      />
      <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums">
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}

/** Render a compact toggle control used by graph settings rows. */
function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-2.5 w-2.5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-3" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

// ── Graph View Component ──────────────────────────────────────────────────

export function GraphView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabs = useEditorStore((s) => s.tabs);
  const updateContent = useEditorStore((s) => s.updateContent);
  const switchTab = useEditorStore((s) => s.switchTab);
  const theme = useEditorStore((s) => s.theme);
  const accentColor = useEditorStore((s) => s.settings.accentColor);

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Manual linking state
  const [linkMode, setLinkMode] = useState(false);
  const [linkSourceId, setLinkSourceId] = useState<string | null>(null);
  const [manualLinks, setManualLinks] = useState<Array<{ source: string; target: string }>>([]);

  // Collapsible control panel
  const [panelOpen, setPanelOpen] = useState(false);

  // Display & force settings
  const [display, setDisplay] = useState<DisplaySettings>({ ...DEFAULT_DISPLAY });
  const [forces, setForces] = useState<ForceSettings>({ ...DEFAULT_FORCES });

  // Groups
  const [groups, setGroups] = useState<GraphGroup[]>([]);
  const [editingGroupName, setEditingGroupName] = useState<string | null>(null);

  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const simRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const draggingRef = useRef<GraphNode | null>(null);
  const isPanningRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);
  const dragMovedRef = useRef(false);
  const editingGroupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingGroupName) {
      editingGroupInputRef.current?.focus();
    }
  }, [editingGroupName]);

  // Gather all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tabs.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [tabs]);

  // Build graph data
  const { nodes, links } = useMemo(() => {
    const nodeMap = new Map<string, GraphNode>();

    tabs.forEach((tab) => {
      const group = groups.find((g) => g.nodeIds.has(tab.id));
      nodeMap.set(tab.id, {
        id: tab.id,
        title: tab.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/, ""),
        tags: tab.tags,
        hasContent: tab.content.trim().length > 0,
        groupId: group?.id,
      });
    });

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

    // Add manual links
    manualLinks.forEach((ml) => {
      const exists = graphLinks.some(
        (l) =>
          (l.source === ml.source && l.target === ml.target) ||
          (l.source === ml.target && l.target === ml.source)
      );
      if (!exists) {
        graphLinks.push({ source: ml.source, target: ml.target, manual: true });
      }
    });

    return { nodes: Array.from(nodeMap.values()), links: graphLinks };
  }, [tabs, manualLinks, groups]);

  // Filter nodes
  const filteredNodeIds = useMemo(() => {
    let filtered = nodes;

    if (selectedTags.size > 0) {
      filtered = filtered.filter((n) => n.tags.some((t) => selectedTags.has(t)));
    }

    if (!display.showOrphans) {
      const connectedIds = new Set<string>();
      links.forEach((l) => {
        const sId = typeof l.source === "string" ? l.source : l.source.id;
        const tId = typeof l.target === "string" ? l.target : l.target.id;
        connectedIds.add(sId);
        connectedIds.add(tId);
      });
      filtered = filtered.filter((n) => connectedIds.has(n.id));
    }

    return new Set(filtered.map((n) => n.id));
  }, [nodes, selectedTags, display.showOrphans, links]);

  // Initialize / update simulation
  useEffect(() => {
    const width = containerRef.current?.clientWidth ?? 800;
    const height = containerRef.current?.clientHeight ?? 600;

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
          .distance(forces.linkDistance)
          .strength(forces.linkStrength)
      )
      .force("charge", forceManyBody().strength(forces.chargeStrength))
      .force("center", forceCenter(width / 2, height / 2).strength(forces.centerStrength))
      .force("collide", forceCollide(forces.collideRadius))
      .force("x", forceX(width / 2).strength(0.02))
      .force("y", forceY(height / 2).strength(0.02))
      .alphaDecay(0.02);

    simRef.current = sim;

    return () => { sim.stop(); };
  }, [nodes, links, forces]);

  const getNodeColor = useCallback(
    (node: GraphNode): string => {
      if (node.groupId) {
        const group = groups.find((g) => g.id === node.groupId);
        if (group) return group.color;
      }
      if (node.tags.length === 0) return accentColor;
      const relevantTag = node.tags.find((t) => selectedTags.has(t)) || node.tags[0];
      return getTagColor(relevantTag, allTags);
    },
    [allTags, selectedTags, accentColor, groups]
  );

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isDark = theme === "dark";

    const getLinkNodeIds = (link: GraphLink) => ({
      sourceId: typeof link.source === "object" ? link.source.id : link.source,
      targetId: typeof link.target === "object" ? link.target.id : link.target,
    });

    const drawGroupBackgrounds = (simNodes: GraphNode[]) => {
      groups.forEach((group) => {
        const groupNodes = simNodes.filter((n) => group.nodeIds.has(n.id) && n.x != null && n.y != null);
        if (groupNodes.length < 2) return;

        let gMinX = Infinity;
        let gMinY = Infinity;
        let gMaxX = -Infinity;
        let gMaxY = -Infinity;
        groupNodes.forEach((n) => {
          gMinX = Math.min(gMinX, n.x ?? 0);
          gMinY = Math.min(gMinY, n.y ?? 0);
          gMaxX = Math.max(gMaxX, n.x ?? 0);
          gMaxY = Math.max(gMaxY, n.y ?? 0);
        });

        const pad = 40;
        const rx = gMinX - pad;
        const ry = gMinY - pad;
        const rw = gMaxX - gMinX + pad * 2;
        const rh = gMaxY - gMinY + pad * 2;

        ctx.beginPath();
        ctx.roundRect(rx, ry, rw, rh, 12);
        ctx.fillStyle = `${group.color}15`;
        ctx.fill();
        ctx.strokeStyle = `${group.color}40`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = "bold 10px system-ui, sans-serif";
        ctx.fillStyle = `${group.color}80`;
        ctx.textAlign = "left";
        ctx.fillText(group.name, rx + 8, ry + 14);
      });
    };

    const drawLinks = (simNodes: GraphNode[], simLinks: GraphLink[]) => {
      simLinks.forEach((link) => {
        const source = typeof link.source === "object" ? link.source : simNodes.find((n) => n.id === link.source);
        const target = typeof link.target === "object" ? link.target : simNodes.find((n) => n.id === link.target);
        if (!source || !target || source.x == null || source.y == null || target.x == null || target.y == null) return;

        const sourceVisible = filteredNodeIds.has(source.id);
        const targetVisible = filteredNodeIds.has(target.id);
        if (!sourceVisible && !targetVisible) return;

        const isHighlighted = hoveredNode === source.id || hoveredNode === target.id;
        const isManual = link.manual;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (isManual) {
          ctx.setLineDash([4, 4]);
        }

        ctx.strokeStyle = isHighlighted
          ? (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)")
          : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)");
        ctx.lineWidth = (isHighlighted ? 2 : 1) * display.lineThickness;
        ctx.stroke();
        ctx.setLineDash([]);

        if (!display.showArrows) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len <= 0) return;

        const baseNodeSize = target.hasContent ? 7 : 5;
        const targetRadius = baseNodeSize * display.nodeSize;
        const nx = dx / len;
        const ny = dy / len;
        const ax = target.x - nx * (targetRadius + 3);
        const ay = target.y - ny * (targetRadius + 3);
        const arrowSize = 6 * display.lineThickness;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - arrowSize * nx + arrowSize * 0.4 * ny, ay - arrowSize * ny - arrowSize * 0.4 * nx);
        ctx.lineTo(ax - arrowSize * nx - arrowSize * 0.4 * ny, ay - arrowSize * ny + arrowSize * 0.4 * nx);
        ctx.closePath();
        ctx.fillStyle = isHighlighted
          ? (isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)")
          : (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)");
        ctx.fill();
      });
    };

    const isConnectedToHovered = (nodeId: string, simLinks: GraphLink[]): boolean => {
      if (!hoveredNode) return false;
      return simLinks.some((link) => {
        const { sourceId, targetId } = getLinkNodeIds(link);
        return (sourceId === hoveredNode && targetId === nodeId) || (targetId === hoveredNode && sourceId === nodeId);
      });
    };

    const drawNode = (node: GraphNode, simLinks: GraphLink[]) => {
      if (node.x == null || node.y == null) return;

      const visible = filteredNodeIds.has(node.id);
      const isHovered = hoveredNode === node.id;
      const isLinkSource = linkMode && linkSourceId === node.id;
      const connectedToHover = isConnectedToHovered(node.id, simLinks);

      const opacity = !visible
        ? 0.15
        : isHovered || connectedToHover || isLinkSource
          ? 1
          : hoveredNode
            ? 0.4
            : 1;
      const baseRadius = node.hasContent ? 7 : 5;
      const radius = (isHovered ? baseRadius + 3 : baseRadius) * display.nodeSize;
      const color = getNodeColor(node);

      if (isHovered) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = `${color}30`;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.fill();

      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const textOpacity = zoom < display.textFadeThreshold
        ? 0
        : Math.min(1, (zoom - display.textFadeThreshold) / 0.3);
      const shouldDrawText = visible && textOpacity > 0 && (isHovered || connectedToHover || !hoveredNode);
      if (!shouldDrawText) {
        ctx.globalAlpha = 1;
        return;
      }

      const fontSize = Math.min(14, 11 / zoom) * display.nodeSize;
      ctx.font = `${isHovered ? "bold " : ""}${fontSize}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.85)";
      ctx.globalAlpha = opacity * textOpacity;
      ctx.fillText(node.title, node.x, node.y + radius + 14);

      if (display.showTags && node.tags.length > 0 && (isHovered || zoom > 1.2)) {
        ctx.font = `${Math.max(8, fontSize * 0.7)}px system-ui, sans-serif`;
        ctx.globalAlpha = opacity * textOpacity * 0.6;
        const tagStr = node.tags.map((t) => `#${t}`).join(" ");
        ctx.fillText(tagStr, node.x, node.y + radius + 14 + fontSize + 2);
      }

      ctx.globalAlpha = 1;
    };

    const drawNodes = (simNodes: GraphNode[], simLinks: GraphLink[]) => {
      simNodes.forEach((node) => {
        drawNode(node, simLinks);
      });
    };

    const drawLinkModeIndicator = (simNodes: GraphNode[]) => {
      if (!linkMode || !linkSourceId) return;
      const sourceNode = simNodes.find((n) => n.id === linkSourceId);
      if (!sourceNode || sourceNode.x == null || sourceNode.y == null) return;

      ctx.beginPath();
      ctx.arc(sourceNode.x, sourceNode.y, 14 * display.nodeSize, 0, Math.PI * 2);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    /** Draw one animation frame of the graph canvas. */
    function render(): void {
      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = isDark ? "#0a0a0a" : "#fafafa";
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const simNodes = nodesRef.current;
      const simLinks = linksRef.current;

      drawGroupBackgrounds(simNodes);
      drawLinks(simNodes, simLinks);
      drawLinkModeIndicator(simNodes);
      drawNodes(simNodes, simLinks);

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(render);
    }

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [theme, zoom, pan, filteredNodeIds, hoveredNode, getNodeColor, display, linkMode, linkSourceId, accentColor, groups]);

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
      const simNodes = nodesRef.current;
      for (let i = simNodes.length - 1; i >= 0; i--) {
        const n = simNodes[i];
        if (n.x == null || n.y == null) continue;
        const dx = gx - n.x;
        const dy = gy - n.y;
        const hitRadius = Math.max(15, 7 * display.nodeSize + 5);
        if (dx * dx + dy * dy < hitRadius * hitRadius) return n;
      }
      return null;
    },
    [display.nodeSize]
  );

  const zoomAtClientPoint = useCallback(
    (clientX: number, clientY: number, nextZoomInput: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const cursorX = clientX - rect.left;
      const cursorY = clientY - rect.top;
      const nextZoom = clampZoom(nextZoomInput);
      if (Math.abs(nextZoom - zoom) < 0.0001) return;

      const graphX = (cursorX - pan.x) / zoom;
      const graphY = (cursorY - pan.y) / zoom;
      setPan({
        x: cursorX - graphX * nextZoom,
        y: cursorY - graphY * nextZoom,
      });
      setZoom(nextZoom);
    },
    [pan.x, pan.y, zoom]
  );

  // Mouse handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);

      dragMovedRef.current = false;

      if (linkMode) return;

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
    [canvasToGraph, findNodeAt, linkMode]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMovedRef.current = true;

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

      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);
      setHoveredNode(node?.id ?? null);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.style.cursor = linkMode
          ? (node ? "crosshair" : "default")
          : (node ? "pointer" : "grab");
      }
    },
    [canvasToGraph, findNodeAt, linkMode]
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
      if (dragMovedRef.current) return;

      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);

      if (linkMode) {
        if (!node) return;
        if (!linkSourceId) {
          setLinkSourceId(node.id);
        } else if (node.id !== linkSourceId) {
          const sourceTab = tabs.find((t) => t.id === linkSourceId);
          const targetTab = tabs.find((t) => t.id === node.id);
          if (sourceTab && targetTab) {
            const targetName = targetTab.title.replace(/\.md$/, "");
            if (!sourceTab.content.includes(`[[${targetName}]]`)) {
              const newContent = sourceTab.content.trim()
                ? sourceTab.content + `\n\n[[${targetName}]]`
                : `[[${targetName}]]`;
              updateContent(sourceTab.id, newContent);
            }
            setManualLinks((prev) => [...prev, { source: linkSourceId, target: node.id }]);
          }
          setLinkSourceId(null);
        }
        return;
      }

      if (node) {
        switchTab(node.id);
      }
    },
    [canvasToGraph, findNodeAt, switchTab, linkMode, linkSourceId, tabs, updateContent]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const { x, y } = canvasToGraph(e.clientX, e.clientY);
      const node = findNodeAt(x, y);
      if (node) switchTab(node.id);
    },
    [canvasToGraph, findNodeAt, switchTab]
  );

  // Wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const deltaScale = Math.exp(-e.deltaY * 0.0015);
      zoomAtClientPoint(e.clientX, e.clientY, zoom * deltaScale);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoom, zoomAtClientPoint]);

  // Touch handlers
  const touchStartRef = useRef<{ x: number; y: number; dist: number } | null>(null);
  const touchMovedRef = useRef(false);
  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchMovedRef.current = false;
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0 };
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      touchStartRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        dist: Math.sqrt(dx * dx + dy * dy),
      };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartRef.current) return;

    touchMovedRef.current = true;

    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: 0 };
    } else if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const panDx = cx - touchStartRef.current.x;
      const panDy = cy - touchStartRef.current.y;
      setPan((p) => ({ x: p.x + panDx, y: p.y + panDy }));

      if (touchStartRef.current.dist > 0) {
        const scale = dist / touchStartRef.current.dist;
        zoomAtClientPoint(cx, cy, zoom * scale);
      }

      touchStartRef.current = { x: cx, y: cy, dist };
    }
  }, [zoom, zoomAtClientPoint]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;

    // Detect tap (no significant move) and double-tap
    if (!touchMovedRef.current && start && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const now = Date.now();
      const last = lastTapRef.current;
      const dx = touch.clientX - last.x;
      const dy = touch.clientY - last.y;
      const timeDiff = now - last.time;

      if (timeDiff < 400 && Math.abs(dx) < 30 && Math.abs(dy) < 30) {
        // Double tap — open note
        const { x, y } = canvasToGraph(touch.clientX, touch.clientY);
        const node = findNodeAt(x, y);
        if (node) switchTab(node.id);
        lastTapRef.current = { time: 0, x: 0, y: 0 };
      } else {
        lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY };
      }
    }
  }, [canvasToGraph, findNodeAt, switchTab]);

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

  const animateGraph = useCallback(() => {
    simRef.current?.alpha(1).restart();
  }, []);

  const addGroup = useCallback(() => {
    const id = crypto.randomUUID();
    setGroups((prev) => [
      ...prev,
      {
        id,
        name: `Group ${prev.length + 1}`,
        color: GROUP_COLORS[prev.length % GROUP_COLORS.length],
        nodeIds: new Set<string>(),
      },
    ]);
  }, []);

  const removeGroup = useCallback((id: string) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  const toggleNodeInGroup = useCallback((groupId: string, nodeId: string) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g.id !== groupId) {
          const next = new Set(g.nodeIds);
          next.delete(nodeId);
          return { ...g, nodeIds: next };
        }
        const next = new Set(g.nodeIds);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return { ...g, nodeIds: next };
      })
    );
  }, []);

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden relative select-none">
      {/* Top-left: zoom + link controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-card/90 backdrop-blur-sm p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) {
                setZoom((z) => clampZoom(z * 1.2));
                return;
              }
              zoomAtClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom * 1.2);
            }}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              const rect = canvasRef.current?.getBoundingClientRect();
              if (!rect) {
                setZoom((z) => clampZoom(z * 0.8));
                return;
              }
              zoomAtClientPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, zoom * 0.8);
            }}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={resetView}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button
          variant={linkMode ? "default" : "ghost"}
          size="sm"
          className={cn("h-6 gap-1 px-2 text-[10px]", linkMode && "bg-primary text-primary-foreground")}
          onClick={() => {
            setLinkMode(!linkMode);
            setLinkSourceId(null);
          }}
        >
          <Link2 className="h-3 w-3" />
          {linkMode ? (linkSourceId ? "Click target…" : "Click source…") : "Link"}
        </Button>

        {linkMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => { setLinkMode(false); setLinkSourceId(null); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Right panel: collapsible settings */}
      <div className="absolute top-3 right-3 z-10 w-[220px] max-w-[calc(100vw-24px)]">
        <div className="rounded-md border border-border bg-card/90 backdrop-blur-sm overflow-hidden">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {panelOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Settings2 className="h-3 w-3" />
            <span>Graph Settings</span>
          </button>

          {panelOpen && (
            <div className="border-t border-border/50 max-h-[calc(100dvh-120px)] overflow-y-auto">
              {/* Filters */}
              <PanelSection title="Filters" icon={Filter} defaultOpen>
                <ToggleRow
                  label="Show tags"
                  checked={display.showTags}
                  onChange={(v) => setDisplay((d) => ({ ...d, showTags: v }))}
                />
                <ToggleRow
                  label="Show orphans"
                  checked={display.showOrphans}
                  onChange={(v) => setDisplay((d) => ({ ...d, showOrphans: v }))}
                />
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
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
                          style={isSelected ? { background: color } : { background: `${color}15` }}
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
                )}
              </PanelSection>

              {/* Groups */}
              <PanelSection title="Groups" icon={Layers}>
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div key={group.id} className="rounded border border-border/50 p-1.5 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: group.color }}
                        />
                        {editingGroupName === group.id ? (
                          <input
                            ref={editingGroupInputRef}
                            defaultValue={group.name}
                            className="flex-1 bg-transparent text-[10px] outline-none border-b border-primary/50"
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v) setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, name: v } : g));
                              setEditingGroupName(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") setEditingGroupName(null);
                            }}
                          />
                        ) : (
                          <span
                            className="flex-1 text-[10px] text-foreground cursor-pointer hover:underline"
                            onClick={() => setEditingGroupName(group.id)}
                          >
                            {group.name}
                          </span>
                        )}
                        <button
                          onClick={() => removeGroup(group.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-0.5 max-h-20 overflow-y-auto">
                        {nodes.slice(0, 30).map((n) => (
                          <button
                            key={n.id}
                            onClick={() => toggleNodeInGroup(group.id, n.id)}
                            className={cn(
                              "rounded px-1 py-0 text-[9px] border transition-colors",
                              group.nodeIds.has(n.id)
                                ? "border-transparent text-white"
                                : "border-border/50 text-muted-foreground hover:text-foreground"
                            )}
                            style={
                              group.nodeIds.has(n.id)
                                ? { background: group.color }
                                : undefined
                            }
                          >
                            {n.title.slice(0, 12)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addGroup}
                    className="w-full rounded border border-dashed border-border py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    + New Group
                  </button>
                </div>
              </PanelSection>

              {/* Display */}
              <PanelSection title="Display" icon={Eye}>
                <ToggleRow
                  label="Arrows"
                  checked={display.showArrows}
                  onChange={(v) => setDisplay((d) => ({ ...d, showArrows: v }))}
                />
                <SliderRow
                  label="Text fade"
                  value={display.textFadeThreshold}
                  min={0}
                  max={1.5}
                  step={0.1}
                  onChange={(v) => setDisplay((d) => ({ ...d, textFadeThreshold: v }))}
                />
                <SliderRow
                  label="Node size"
                  value={display.nodeSize}
                  min={0.3}
                  max={3}
                  step={0.1}
                  onChange={(v) => setDisplay((d) => ({ ...d, nodeSize: v }))}
                />
                <SliderRow
                  label="Line thickness"
                  value={display.lineThickness}
                  min={0.3}
                  max={4}
                  step={0.1}
                  onChange={(v) => setDisplay((d) => ({ ...d, lineThickness: v }))}
                />
              </PanelSection>

              {/* Forces */}
              <PanelSection title="Forces" icon={Move}>
                <SliderRow
                  label="Repulsion"
                  value={Math.abs(forces.chargeStrength)}
                  min={50}
                  max={800}
                  step={25}
                  onChange={(v) => setForces((f) => ({ ...f, chargeStrength: -v }))}
                />
                <SliderRow
                  label="Link dist"
                  value={forces.linkDistance}
                  min={30}
                  max={300}
                  step={10}
                  onChange={(v) => setForces((f) => ({ ...f, linkDistance: v }))}
                />
                <SliderRow
                  label="Link strength"
                  value={forces.linkStrength}
                  min={0.1}
                  max={2}
                  step={0.1}
                  onChange={(v) => setForces((f) => ({ ...f, linkStrength: v }))}
                />
                <SliderRow
                  label="Center pull"
                  value={forces.centerStrength}
                  min={0}
                  max={0.5}
                  step={0.02}
                  onChange={(v) => setForces((f) => ({ ...f, centerStrength: v }))}
                />
                <SliderRow
                  label="Collision"
                  value={forces.collideRadius}
                  min={10}
                  max={80}
                  step={5}
                  onChange={(v) => setForces((f) => ({ ...f, collideRadius: v }))}
                />
              </PanelSection>

              {/* Animate */}
              <div className="px-2.5 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-6 gap-1.5 text-[10px]"
                  onClick={animateGraph}
                >
                  <Play className="h-3 w-3" />
                  Animate
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{nodes.length} notes</span>
        <span>·</span>
        <span>{links.length} connections</span>
        {manualLinks.length > 0 && (
          <>
            <span>·</span>
            <span>{manualLinks.length} manual</span>
          </>
        )}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="flex-1 w-full h-full touch-none"
        style={{ cursor: linkMode ? "crosshair" : "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}
