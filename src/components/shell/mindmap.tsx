"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Plus,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Settings,
  MousePointer2,
  Hand,
  Link2,
  Type,
  Circle,
  Hexagon,
  GitBranch,
  Copy,
  Clipboard,
  Layers,
  ArrowUp,
  ArrowDown,
  Square,
  Diamond,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";

// ── Types ─────────────────────────────────────────────────────────────────

type NodeType = "header" | "main" | "sub" | "rect" | "ellipse" | "diamond" | "text";

type MindmapTool = "select" | "pan" | "addHeader" | "addMain" | "addSub" | "connect" | "addRect" | "addEllipse" | "addDiamond" | "addText";

interface Point {
  x: number;
  y: number;
}

interface MindmapNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  text: string;
  color: string;
  textColor: string;
  width: number;
  height: number;
  selected?: boolean;
}

interface MindmapConnection {
  id: string;
  fromId: string;
  toId: string;
  color: string;
  selected?: boolean;
}

interface MindmapSettings {
  backgroundColor: string;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  defaultHeaderColor: string;
  defaultMainColor: string;
  defaultSubColor: string;
  defaultTextColor: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: MindmapSettings = {
  backgroundColor: "transparent",
  showGrid: true,
  gridSize: 20,
  snapToGrid: true,
  defaultHeaderColor: "#7c3aed",
  defaultMainColor: "#3b82f6",
  defaultSubColor: "#22c55e",
  defaultTextColor: "#ffffff",
};

const NODE_DEFAULTS: Record<NodeType, { width: number; height: number; fontSize: number; fontWeight: string }> = {
  header: { width: 180, height: 52, fontSize: 18, fontWeight: "700" },
  main: { width: 150, height: 42, fontSize: 14, fontWeight: "600" },
  sub: { width: 130, height: 34, fontSize: 12, fontWeight: "400" },
  rect: { width: 120, height: 80, fontSize: 12, fontWeight: "400" },
  ellipse: { width: 120, height: 80, fontSize: 12, fontWeight: "400" },
  diamond: { width: 120, height: 80, fontSize: 12, fontWeight: "400" },
  text: { width: 120, height: 30, fontSize: 14, fontWeight: "400" },
};

// ── Helpers ───────────────────────────────────────────────────────────────

function screenToCanvas(sx: number, sy: number, pan: Point, zoom: number): Point {
  return { x: (sx - pan.x) / zoom, y: (sy - pan.y) / zoom };
}

function hitTestNode(node: MindmapNode, cx: number, cy: number): boolean {
  return (
    cx >= node.x &&
    cx <= node.x + node.width &&
    cy >= node.y &&
    cy <= node.y + node.height
  );
}

const HANDLE_SIZE = 8;

function getResizeHandles(node: MindmapNode): { id: string; x: number; y: number }[] {
  const w = node.width;
  const h = node.height;
  return [
    { id: "nw", x: node.x, y: node.y },
    { id: "ne", x: node.x + w, y: node.y },
    { id: "sw", x: node.x, y: node.y + h },
    { id: "se", x: node.x + w, y: node.y + h },
    { id: "n", x: node.x + w / 2, y: node.y },
    { id: "s", x: node.x + w / 2, y: node.y + h },
    { id: "w", x: node.x, y: node.y + h / 2 },
    { id: "e", x: node.x + w, y: node.y + h / 2 },
  ];
}

function hitTestResizeHandle(node: MindmapNode, cx: number, cy: number): string | null {
  const handles = getResizeHandles(node);
  const hs = HANDLE_SIZE / 2 + 2; // tolerance
  for (const h of handles) {
    if (cx >= h.x - hs && cx <= h.x + hs && cy >= h.y - hs && cy <= h.y + hs) {
      return h.id;
    }
  }
  return null;
}

function drawResizeHandles(ctx: CanvasRenderingContext2D, node: MindmapNode) {
  const handles = getResizeHandles(node);
  const hs = HANDLE_SIZE / 2;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1.5;
  for (const h of handles) {
    ctx.beginPath();
    ctx.rect(h.x - hs, h.y - hs, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fill();
    ctx.stroke();
  }
}

function getNodeCenter(node: MindmapNode): Point {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function getConnectionEndpoints(
  from: MindmapNode,
  to: MindmapNode
): { x1: number; y1: number; x2: number; y2: number } {
  const fc = getNodeCenter(from);
  const tc = getNodeCenter(to);

  // Find the edge intersection points
  const angle = Math.atan2(tc.y - fc.y, tc.x - fc.x);

  const x1 = fc.x + (from.width / 2) * Math.cos(angle);
  const y1 = fc.y + (from.height / 2) * Math.sin(angle);
  const x2 = tc.x - (to.width / 2) * Math.cos(angle);
  const y2 = tc.y - (to.height / 2) * Math.sin(angle);

  return { x1, y1, x2, y2 };
}

function hitTestConnection(
  conn: MindmapConnection,
  nodes: MindmapNode[],
  cx: number,
  cy: number,
  tolerance = 8
): boolean {
  const from = nodes.find((n) => n.id === conn.fromId);
  const to = nodes.find((n) => n.id === conn.toId);
  if (!from || !to) return false;

  const { x1, y1, x2, y2 } = getConnectionEndpoints(from, to);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(cx - x1, cy - y1) <= tolerance;
  let t = ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx;
  const py = y1 + t * dy;
  return Math.hypot(cx - px, cy - py) <= tolerance;
}

// ── Render helpers ────────────────────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  pan: Point,
  zoom: number,
  width: number,
  height: number,
  gridSize: number,
  isDark: boolean
) {
  ctx.save();
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;

  const step = gridSize * zoom;
  const offsetX = pan.x % step;
  const offsetY = pan.y % step;

  ctx.beginPath();
  for (let x = offsetX; x < width; x += step) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }
  for (let y = offsetY; y < height; y += step) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx: CanvasRenderingContext2D, node: MindmapNode) {
  const defaults = NODE_DEFAULTS[node.type];
  const radius = node.type === "header" ? 12 : node.type === "main" ? 8 : 6;

  // Shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.15)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  // Draw shape based on type
  if (node.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      node.x + node.width / 2,
      node.y + node.height / 2,
      node.width / 2,
      node.height / 2,
      0, 0, Math.PI * 2
    );
    ctx.fillStyle = node.color;
    ctx.fill();
  } else if (node.type === "diamond") {
    ctx.beginPath();
    ctx.moveTo(node.x + node.width / 2, node.y);
    ctx.lineTo(node.x + node.width, node.y + node.height / 2);
    ctx.lineTo(node.x + node.width / 2, node.y + node.height);
    ctx.lineTo(node.x, node.y + node.height / 2);
    ctx.closePath();
    ctx.fillStyle = node.color;
    ctx.fill();
  } else if (node.type === "text") {
    // Text-only node: no background
    ctx.restore();
    ctx.save();
  } else {
    // Rounded rect (header, main, sub, rect)
    ctx.beginPath();
    ctx.roundRect(node.x, node.y, node.width, node.height, node.type === "rect" ? 4 : radius);
    ctx.fillStyle = node.color;
    ctx.fill();
  }
  ctx.restore();

  // Border
  if (node.selected) {
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.roundRect(node.x - 3, node.y - 3, node.width + 6, node.height + 6, radius + 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Text
  ctx.fillStyle = node.textColor;
  ctx.font = `${defaults.fontWeight} ${defaults.fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const maxWidth = node.width - 16;
  let displayText = node.text;
  const measured = ctx.measureText(displayText);
  if (measured.width > maxWidth) {
    while (ctx.measureText(displayText + "…").width > maxWidth && displayText.length > 0) {
      displayText = displayText.slice(0, -1);
    }
    displayText += "…";
  }

  ctx.fillText(displayText, node.x + node.width / 2, node.y + node.height / 2);
}

function drawConnection(
  ctx: CanvasRenderingContext2D,
  conn: MindmapConnection,
  nodes: MindmapNode[]
) {
  const from = nodes.find((n) => n.id === conn.fromId);
  const to = nodes.find((n) => n.id === conn.toId);
  if (!from || !to) return;

  const { x1, y1, x2, y2 } = getConnectionEndpoints(from, to);

  ctx.save();
  ctx.strokeStyle = conn.selected ? "#3b82f6" : conn.color;
  ctx.lineWidth = conn.selected ? 3 : 2;
  if (conn.selected) ctx.setLineDash([6, 4]);

  // Draw curved line
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const curveStrength = Math.min(dist * 0.15, 30);
  const cpX = midX - (dy / dist) * curveStrength;
  const cpY = midY + (dx / dist) * curveStrength;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpX, cpY, x2, y2);
  ctx.stroke();

  // Arrow head
  const angle = Math.atan2(y2 - cpY, x2 - cpX);
  const headLen = 10;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle - Math.PI / 7),
    y2 - headLen * Math.sin(angle - Math.PI / 7)
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headLen * Math.cos(angle + Math.PI / 7),
    y2 - headLen * Math.sin(angle + Math.PI / 7)
  );
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.restore();
}

// ── Settings Panel ────────────────────────────────────────────────────────

function MindmapSettingsPanel({
  settings,
  onChange,
  open,
  onClose,
}: {
  settings: MindmapSettings;
  onChange: (s: Partial<MindmapSettings>) => void;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  const colorPresets = [
    "#7c3aed", "#8b5cf6", "#3b82f6", "#06b6d4",
    "#14b8a6", "#22c55e", "#eab308", "#f97316",
    "#ef4444", "#ec4899", "#6366f1", "#94a3b8",
  ];

  const textColorPresets = [
    "#ffffff", "#000000", "#e2e8f0", "#1e293b",
  ];

  const bgOptions = [
    { label: "Transparent", value: "transparent" },
    { label: "White", value: "#ffffff" },
    { label: "Dark", value: "#1e1e2e" },
    { label: "Warm", value: "#fdf6e3" },
  ];

  return (
    <div className="absolute right-2 top-14 z-20 w-56 rounded-lg border border-border bg-popover p-3 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Mindmap Settings</span>
        <button
          onClick={onClose}
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>

      {/* Default Header Color */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Header Node Color</label>
        <div className="flex flex-wrap gap-1.5">
          {colorPresets.map((c) => (
            <button
              key={`header-${c}`}
              onClick={() => onChange({ defaultHeaderColor: c })}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                settings.defaultHeaderColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Default Main Color */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Main Node Color</label>
        <div className="flex flex-wrap gap-1.5">
          {colorPresets.map((c) => (
            <button
              key={`main-${c}`}
              onClick={() => onChange({ defaultMainColor: c })}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                settings.defaultMainColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Default Sub Color */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Sub Node Color</label>
        <div className="flex flex-wrap gap-1.5">
          {colorPresets.map((c) => (
            <button
              key={`sub-${c}`}
              onClick={() => onChange({ defaultSubColor: c })}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                settings.defaultSubColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Default Text Color */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Text Color</label>
        <div className="flex flex-wrap gap-1.5">
          {textColorPresets.map((c) => (
            <button
              key={`text-${c}`}
              onClick={() => onChange({ defaultTextColor: c })}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                settings.defaultTextColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Background */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Background</label>
        <div className="flex flex-wrap gap-1.5">
          {bgOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ backgroundColor: opt.value })}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                settings.backgroundColor === opt.value
                  ? "border-blue-500 scale-110"
                  : "border-muted-foreground/30"
              )}
              style={{
                background:
                  opt.value === "transparent"
                    ? "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50%/8px 8px"
                    : opt.value,
              }}
              title={opt.label}
            />
          ))}
        </div>
      </div>

      {/* Grid toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Show Grid</span>
        <button
          onClick={() => onChange({ showGrid: !settings.showGrid })}
          className={cn(
            "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
            settings.showGrid ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-2.5 w-2.5 rounded-full bg-background shadow-sm transition-transform",
              settings.showGrid ? "translate-x-3" : "translate-x-0.5"
            )}
          />
        </button>
      </div>

      {/* Snap to grid */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Snap to Grid</span>
        <button
          onClick={() => onChange({ snapToGrid: !settings.snapToGrid })}
          className={cn(
            "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
            settings.snapToGrid ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "pointer-events-none block h-2.5 w-2.5 rounded-full bg-background shadow-sm transition-transform",
              settings.snapToGrid ? "translate-x-3" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

// ── Node Edit Overlay ─────────────────────────────────────────────────────

function NodeEditPopover({
  node,
  onUpdate,
  onClose,
  screenPos,
}: {
  node: MindmapNode;
  onUpdate: (updates: Partial<MindmapNode>) => void;
  onClose: () => void;
  screenPos: Point;
}) {
  const [text, setText] = useState(node.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const colorPresets = [
    "#7c3aed", "#8b5cf6", "#3b82f6", "#06b6d4",
    "#14b8a6", "#22c55e", "#eab308", "#f97316",
    "#ef4444", "#ec4899", "#6366f1", "#94a3b8",
    "#1e293b", "#334155", "#64748b", "#e2e8f0",
  ];

  return (
    <div
      className="absolute z-30 w-52 rounded-lg border border-border bg-popover p-3 shadow-xl space-y-2.5 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: screenPos.x, top: screenPos.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground capitalize">{node.type} Node</span>
        <button onClick={onClose} className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted">✕</button>
      </div>
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onUpdate({ text: e.target.value });
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") onClose();
        }}
        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
        placeholder="Node text…"
      />
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Node Color</label>
        <div className="flex flex-wrap gap-1">
          {colorPresets.map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ color: c })}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-transform hover:scale-110",
                node.color === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <label className="text-[10px] text-muted-foreground">Text Color</label>
        <div className="flex flex-wrap gap-1">
          {["#ffffff", "#000000", "#e2e8f0", "#1e293b", "#f97316", "#ef4444", "#22c55e", "#3b82f6"].map((c) => (
            <button
              key={c}
              onClick={() => onUpdate({ textColor: c })}
              className={cn(
                "h-4 w-4 rounded-full border-2 transition-transform hover:scale-110",
                node.textColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Context Menu ──────────────────────────────────────────────────────────

function MindmapContextMenu({
  position,
  onClose,
  hasSelection,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onSelectAll,
}: {
  position: Point;
  onClose: () => void;
  hasSelection: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onSelectAll: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [onClose]);

  const MenuItem = ({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); onClose(); }}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-foreground hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div
      className="absolute z-50 w-48 rounded-lg border border-border bg-popover p-1 shadow-xl animate-in fade-in zoom-in-95 duration-100"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <MenuItem onClick={onDuplicate} disabled={!hasSelection}>
        <Layers className="h-3.5 w-3.5" /> Duplicate
      </MenuItem>
      <div className="my-1 h-px bg-border" />
      <MenuItem onClick={onBringToFront} disabled={!hasSelection}>
        <ArrowUp className="h-3.5 w-3.5" /> Bring to Front
      </MenuItem>
      <MenuItem onClick={onSendToBack} disabled={!hasSelection}>
        <ArrowDown className="h-3.5 w-3.5" /> Send to Back
      </MenuItem>
      <div className="my-1 h-px bg-border" />
      <MenuItem onClick={onSelectAll}>
        <MousePointer2 className="h-3.5 w-3.5" /> Select All
      </MenuItem>
      <MenuItem onClick={onDelete} disabled={!hasSelection}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" /> <span className="text-destructive">Delete</span>
      </MenuItem>
    </div>
  );
}

// ── Mindmap Component ─────────────────────────────────────────────────────

export function MindmapView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tab-based persistence
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateContent = useEditorStore((s) => s.updateContent);

  // Canvas transform
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Tool state
  const [activeTool, setActiveTool] = useState<MindmapTool>("select");
  const [nodes, setNodes] = useState<MindmapNode[]>([]);
  const [connections, setConnections] = useState<MindmapConnection[]>([]);

  // Undo
  const [undoStack, setUndoStack] = useState<{ nodes: MindmapNode[]; connections: MindmapConnection[] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ nodes: MindmapNode[]; connections: MindmapConnection[] }[]>([]);

  // Interaction state
  const drawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const dragNodeRef = useRef<MindmapNode | null>(null);
  const connectFromRef = useRef<string | null>(null);
  const [connectPreview, setConnectPreview] = useState<{ fromId: string; toX: number; toY: number } | null>(null);

  // Resize state
  const resizingRef = useRef<{ nodeId: string; handle: string; startX: number; startY: number; startW: number; startH: number; startNodeX: number; startNodeY: number } | null>(null);

  // Edit overlay
  const [editNode, setEditNode] = useState<{ node: MindmapNode; screenPos: Point } | null>(null);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<MindmapSettings>(DEFAULT_SETTINGS);

  // Dark mode
  const [isDark, setIsDark] = useState(true);

  // Context menu
  const [contextMenu, setContextMenu] = useState<Point | null>(null);
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // ── Tab-based persistence ──────────────────────────────────────────────
  const hydratedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from tab content
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!activeTab) return;
    hydratedRef.current = true;
    try {
      const data = JSON.parse(activeTab.content);
      if (data.nodes && Array.isArray(data.nodes)) setNodes(data.nodes);
      if (data.connections && Array.isArray(data.connections)) setConnections(data.connections);
      if (data.settings && typeof data.settings === "object") {
        setSettings((prev) => ({ ...prev, ...data.settings }));
      }
    } catch { /* ignore parse errors */ }
  }, [activeTab]);

  // Debounced save to tab content
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (!activeTabId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const data = JSON.stringify({ nodes, connections, settings });
      updateContent(activeTabId, data);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, connections, settings, activeTabId, updateContent]);

  // ── Undo/Redo ───────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-49), { nodes, connections }]);
    setRedoStack([]);
  }, [nodes, connections]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, { nodes, connections }]);
      setNodes(last.nodes);
      setConnections(last.connections);
      return prev.slice(0, -1);
    });
  }, [nodes, connections]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [...u, { nodes, connections }]);
      setNodes(last.nodes);
      setConnections(last.connections);
      return prev.slice(0, -1);
    });
  }, [nodes, connections]);

  // ── Context menu actions ──────────────────────────────────────────────

  const handleDuplicate = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) return;
    pushUndo();
    const offset = 30;
    const idMap = new Map<string, string>();
    const duped = selectedNodes.map((n) => {
      const newId = crypto.randomUUID();
      idMap.set(n.id, newId);
      return { ...n, id: newId, x: n.x + offset, y: n.y + offset, selected: true };
    });
    // Also duplicate connections between selected nodes
    const dupedConns = connections
      .filter((c) => idMap.has(c.fromId) && idMap.has(c.toId))
      .map((c) => ({ ...c, id: crypto.randomUUID(), fromId: idMap.get(c.fromId) as string, toId: idMap.get(c.toId) as string }));
    setNodes((prev) => [...prev.map((n) => ({ ...n, selected: false })), ...duped]);
    setConnections((prev) => [...prev, ...dupedConns]);
  }, [nodes, connections, pushUndo]);

  const handleDeleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((n) => n.selected);
    const selectedConns = connections.filter((c) => c.selected);
    if (selectedNodes.length === 0 && selectedConns.length === 0) return;
    pushUndo();
    const removedIds = new Set(selectedNodes.map((n) => n.id));
    setNodes((prev) => prev.filter((n) => !n.selected));
    setConnections((prev) => prev.filter((c) => !c.selected && !removedIds.has(c.fromId) && !removedIds.has(c.toId)));
  }, [nodes, connections, pushUndo]);

  const handleBringToFront = useCallback(() => {
    pushUndo();
    setNodes((prev) => {
      const sel = prev.filter((n) => n.selected);
      const rest = prev.filter((n) => !n.selected);
      return [...rest, ...sel];
    });
  }, [pushUndo]);

  const handleSendToBack = useCallback(() => {
    pushUndo();
    setNodes((prev) => {
      const sel = prev.filter((n) => n.selected);
      const rest = prev.filter((n) => !n.selected);
      return [...sel, ...rest];
    });
  }, [pushUndo]);

  const handleSelectAll = useCallback(() => {
    setNodes((prev) => prev.map((n) => ({ ...n, selected: true })));
  }, []);

  // ── Snap ────────────────────────────────────────────────────────────

  const snap = useCallback(
    (val: number) => {
      if (!settings.snapToGrid) return val;
      return Math.round(val / settings.gridSize) * settings.gridSize;
    },
    [settings.snapToGrid, settings.gridSize]
  );

  // ── Add node ────────────────────────────────────────────────────────

  const addNode = useCallback(
    (type: NodeType, x: number, y: number) => {
      pushUndo();
      const defaults = NODE_DEFAULTS[type];
      const color =
        type === "header"
          ? settings.defaultHeaderColor
          : type === "main"
            ? settings.defaultMainColor
            : type === "sub"
              ? settings.defaultSubColor
              : type === "text"
                ? "transparent"
                : isDark ? "#334155" : "#e2e8f0";

      const textColor = type === "text"
        ? (isDark ? "#e2e8f0" : "#1e293b")
        : settings.defaultTextColor;

      const defaultText = type === "header" ? "Header"
        : type === "main" ? "Topic"
        : type === "sub" ? "Detail"
        : type === "text" ? "Text"
        : "";

      const node: MindmapNode = {
        id: crypto.randomUUID(),
        type,
        x: snap(x - defaults.width / 2),
        y: snap(y - defaults.height / 2),
        text: defaultText,
        color,
        textColor,
        width: defaults.width,
        height: defaults.height,
      };
      setNodes((prev) => [...prev, node]);
    },
    [pushUndo, snap, settings, isDark]
  );

  // ── Keyboard shortcuts ──────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const selectedNodes = nodes.filter((n) => n.selected);
        const selectedConns = connections.filter((c) => c.selected);
        if (selectedNodes.length > 0 || selectedConns.length > 0) {
          e.preventDefault();
          pushUndo();
          const removedIds = new Set(selectedNodes.map((n) => n.id));
          setNodes((prev) => prev.filter((n) => !n.selected));
          setConnections((prev) =>
            prev.filter(
              (c) => !c.selected && !removedIds.has(c.fromId) && !removedIds.has(c.toId)
            )
          );
        }
      }
      if (e.key === "v" || e.key === "1") setActiveTool("select");
      if (e.key === "h" || e.key === "2") setActiveTool("pan");
      if (e.key === "3") setActiveTool("addHeader");
      if (e.key === "4") setActiveTool("addMain");
      if (e.key === "5") setActiveTool("addSub");
      if (e.key === "c" || e.key === "6") setActiveTool("connect");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, nodes, connections, pushUndo]);

  // ── Zoom ────────────────────────────────────────────────────────────

  const handleZoom = useCallback(
    (delta: number, cx?: number, cy?: number) => {
      setZoom((prev) => {
        const newZoom = Math.min(5, Math.max(0.1, prev + delta));
        if (cx !== undefined && cy !== undefined) {
          const scale = newZoom / prev;
          setPan((p) => ({ x: cx - (cx - p.x) * scale, y: cy - (cy - p.y) * scale }));
        }
        return newZoom;
      });
    },
    []
  );

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // ── Wheel ───────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        handleZoom(-e.deltaY * 0.002, e.offsetX, e.offsetY);
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [handleZoom]);

  // ── Pointer handlers ────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Close overlays
      setEditNode(null);
      setContextMenu(null);

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy, pan, zoom);

      if (activeTool === "pan" || e.button === 1) {
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      if (activeTool === "addHeader" || activeTool === "addMain" || activeTool === "addSub" ||
          activeTool === "addRect" || activeTool === "addEllipse" || activeTool === "addDiamond" || activeTool === "addText") {
        const typeMap: Record<string, NodeType> = {
          addHeader: "header", addMain: "main", addSub: "sub",
          addRect: "rect", addEllipse: "ellipse", addDiamond: "diamond", addText: "text",
        };
        addNode(typeMap[activeTool], cp.x, cp.y);
        setActiveTool("select");
        return;
      }

      if (activeTool === "connect") {
        // Find node under cursor to start connection
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (hitTestNode(nodes[i], cp.x, cp.y)) {
            connectFromRef.current = nodes[i].id;
            canvas.setPointerCapture(e.pointerId);
            drawingRef.current = true;
            return;
          }
        }
        return;
      }

      // Select tool
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;

      // Check for resize handles on selected nodes first
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].selected) {
          const handle = hitTestResizeHandle(nodes[i], cp.x, cp.y);
          if (handle) {
            pushUndo();
            resizingRef.current = {
              nodeId: nodes[i].id,
              handle,
              startX: cp.x,
              startY: cp.y,
              startW: nodes[i].width,
              startH: nodes[i].height,
              startNodeX: nodes[i].x,
              startNodeY: nodes[i].y,
            };
            return;
          }
        }
      }

      // Hit test nodes (top-most first)
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (hitTestNode(nodes[i], cp.x, cp.y)) {
          const node = nodes[i];
          if (!node.selected) {
            pushUndo();
            setNodes((prev) => prev.map((n) => ({ ...n, selected: n.id === node.id })));
            setConnections((prev) => prev.map((c) => ({ ...c, selected: false })));
          }
          dragNodeRef.current = node;
          dragOffsetRef.current = { x: cp.x - node.x, y: cp.y - node.y };
          return;
        }
      }

      // Hit test connections
      for (let i = connections.length - 1; i >= 0; i--) {
        if (hitTestConnection(connections[i], nodes, cp.x, cp.y)) {
          pushUndo();
          setConnections((prev) => prev.map((c) => ({ ...c, selected: c.id === connections[i].id })));
          setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
          drawingRef.current = false;
          return;
        }
      }

      // Deselect all
      setNodes((prev) => prev.map((n) => ({ ...n, selected: false })));
      setConnections((prev) => prev.map((c) => ({ ...c, selected: false })));
      dragNodeRef.current = null;
      drawingRef.current = false;
    },
    [activeTool, pan, zoom, nodes, connections, addNode, pushUndo]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (isPanningRef.current) {
        setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y });
        return;
      }

      if (!drawingRef.current) {
        // Update cursor for resize handles on hover
        if (activeTool === "select") {
          const canvas = canvasRef.current;
          if (canvas) {
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const cp = screenToCanvas(sx, sy, pan, zoom);
            let cursor = "";
            for (let i = nodes.length - 1; i >= 0; i--) {
              if (nodes[i].selected) {
                const handle = hitTestResizeHandle(nodes[i], cp.x, cp.y);
                if (handle) {
                  const cursors: Record<string, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
                  cursor = cursors[handle] || "";
                  break;
                }
              }
            }
            canvas.style.cursor = cursor;
          }
        }
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy, pan, zoom);

      // Connection preview
      if (activeTool === "connect" && connectFromRef.current) {
        setConnectPreview({ fromId: connectFromRef.current, toX: cp.x, toY: cp.y });
        return;
      }

      // Resize node
      if (resizingRef.current) {
        const r = resizingRef.current;
        const dx = cp.x - r.startX;
        const dy = cp.y - r.startY;
        const cursors: Record<string, string> = { nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize" };
        if (canvas) canvas.style.cursor = cursors[r.handle] || "";
        setNodes((prev) =>
          prev.map((n) => {
            if (n.id !== r.nodeId) return n;
            let newX = r.startNodeX;
            let newY = r.startNodeY;
            let newW = r.startW;
            let newH = r.startH;
            const h = r.handle;
            if (h.includes("e")) newW = Math.max(40, r.startW + dx);
            if (h.includes("w")) { newW = Math.max(40, r.startW - dx); newX = r.startNodeX + (r.startW - newW); }
            if (h.includes("s")) newH = Math.max(20, r.startH + dy);
            if (h.includes("n")) { newH = Math.max(20, r.startH - dy); newY = r.startNodeY + (r.startH - newH); }
            return { ...n, x: snap(newX), y: snap(newY), width: snap(newW), height: snap(newH) };
          })
        );
        return;
      }

      // Drag node
      const dragging = dragNodeRef.current;
      if (dragging) {
        const nx = snap(cp.x - dragOffsetRef.current.x);
        const ny = snap(cp.y - dragOffsetRef.current.y);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === dragging.id ? { ...n, x: nx, y: ny } : n
          )
        );
      }
    },
    [activeTool, pan, zoom, snap]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }

      if (resizingRef.current) {
        resizingRef.current = null;
        drawingRef.current = false;
        return;
      }

      // Complete connection
      const fromId = connectFromRef.current;
      if (activeTool === "connect" && fromId) {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const cp = screenToCanvas(sx, sy, pan, zoom);

          // Use latest nodes via functional update to avoid stale closure
          setNodes((currentNodes) => {
            for (let i = currentNodes.length - 1; i >= 0; i--) {
              if (
                hitTestNode(currentNodes[i], cp.x, cp.y) &&
                currentNodes[i].id !== fromId
              ) {
                const targetId = currentNodes[i].id;
                // Add connection via functional update
                setConnections((currentConns) => {
                  const exists = currentConns.some(
                    (c) =>
                      (c.fromId === fromId && c.toId === targetId) ||
                      (c.fromId === targetId && c.toId === fromId)
                  );
                  if (exists) return currentConns;
                  return [
                    ...currentConns,
                    {
                      id: crypto.randomUUID(),
                      fromId,
                      toId: targetId,
                      color: isDark ? "#94a3b8" : "#64748b",
                    },
                  ];
                });
                break;
              }
            }
            return currentNodes; // don't modify nodes
          });
        }
        connectFromRef.current = null;
        setConnectPreview(null);
      }

      drawingRef.current = false;
      dragNodeRef.current = null;
    },
    [activeTool, pan, zoom, pushUndo, isDark]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: Math.min(e.clientX - rect.left, rect.width - 200),
        y: Math.min(e.clientY - rect.top, rect.height - 250),
      });
    },
    []
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy, pan, zoom);

      for (let i = nodes.length - 1; i >= 0; i--) {
        if (hitTestNode(nodes[i], cp.x, cp.y)) {
          setEditNode({
            node: nodes[i],
            screenPos: {
              x: Math.min(e.clientX - rect.left, rect.width - 220),
              y: Math.min(e.clientY - rect.top + 10, rect.height - 280),
            },
          });
          return;
        }
      }

      // Double click on empty space: add main node
      if (activeTool === "select") {
        addNode("main", cp.x, cp.y);
      }
    },
    [pan, zoom, nodes, activeTool, addNode]
  );

  // ── Export ──────────────────────────────────────────────────────────

  const exportAsImage = useCallback(() => {
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      if (node.x < minX) minX = node.x;
      if (node.y < minY) minY = node.y;
      if (node.x + node.width > maxX) maxX = node.x + node.width;
      if (node.y + node.height > maxY) maxY = node.y + node.height;
    }

    const padding = 60;
    const w = maxX - minX + padding * 2;
    const h = maxY - minY + padding * 2;

    const offscreen = document.createElement("canvas");
    offscreen.width = w * 2;
    offscreen.height = h * 2;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.scale(2, 2);

    if (settings.backgroundColor !== "transparent") {
      ctx.fillStyle = settings.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.translate(-minX + padding, -minY + padding);

    // Draw connections first
    for (const conn of connections) {
      drawConnection(ctx, { ...conn, selected: false }, nodes.map((n) => ({ ...n, selected: false })));
    }
    // Draw nodes
    for (const node of nodes) {
      drawNode(ctx, { ...node, selected: false });
    }

    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mindmap.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [nodes, connections, settings.backgroundColor]);

  // ── Clear ───────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    if (nodes.length === 0 && connections.length === 0) return;
    pushUndo();
    setNodes([]);
    setConnections([]);
  }, [nodes, connections, pushUndo]);

  // ── Render loop ─────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;
    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (settings.backgroundColor !== "transparent") {
        ctx.fillStyle = settings.backgroundColor;
        ctx.fillRect(0, 0, w, h);
      }

      if (settings.showGrid) {
        drawGrid(ctx, pan, zoom, w, h, settings.gridSize, isDark);
      }

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Draw connections
      for (const conn of connections) {
        drawConnection(ctx, conn, nodes);
      }

      // Draw connection preview
      if (connectPreview) {
        const from = nodes.find((n) => n.id === connectPreview.fromId);
        if (from) {
          const fc = getNodeCenter(from);
          ctx.save();
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.moveTo(fc.x, fc.y);
          ctx.lineTo(connectPreview.toX, connectPreview.toY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      // Draw nodes
      for (const node of nodes) {
        drawNode(ctx, node);
      }

      // Draw resize handles on selected nodes
      for (const node of nodes) {
        if (node.selected) {
          drawResizeHandles(ctx, node);
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [nodes, connections, connectPreview, pan, zoom, settings, isDark]);

  // ── Tool config ─────────────────────────────────────────────────────

  const tools: { tool: MindmapTool; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
    { tool: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
    { tool: "pan", icon: Hand, label: "Pan", shortcut: "H" },
    { tool: "addHeader", icon: Hexagon, label: "Header Node", shortcut: "3" },
    { tool: "addMain", icon: Circle, label: "Main Node", shortcut: "4" },
    { tool: "addSub", icon: GitBranch, label: "Sub Node", shortcut: "5" },
    { tool: "connect", icon: Link2, label: "Connect", shortcut: "C" },
    { tool: "addRect", icon: Square, label: "Rectangle Shape", shortcut: "" },
    { tool: "addEllipse", icon: Circle, label: "Ellipse Shape", shortcut: "" },
    { tool: "addDiamond", icon: Diamond, label: "Diamond Shape", shortcut: "" },
    { tool: "addText", icon: Type, label: "Text Label", shortcut: "" },
  ];

  const cursorClass = (() => {
    switch (activeTool) {
      case "pan": return "cursor-grab active:cursor-grabbing";
      case "select": return "cursor-default";
      case "connect": return "cursor-crosshair";
      default: return "cursor-crosshair";
    }
  })();

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-background">
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0", cursorClass)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        style={{ touchAction: "none" }}
      />

      {/* Edit node overlay */}
      {editNode && (
        <NodeEditPopover
          node={editNode.node}
          screenPos={editNode.screenPos}
          onUpdate={(updates) => {
            setNodes((prev) =>
              prev.map((n) => (n.id === editNode.node.id ? { ...n, ...updates } : n))
            );
            setEditNode((prev) =>
              prev ? { ...prev, node: { ...prev.node, ...updates } } : null
            );
          }}
          onClose={() => setEditNode(null)}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <MindmapContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          hasSelection={nodes.some((n) => n.selected)}
          onDuplicate={handleDuplicate}
          onDelete={handleDeleteSelected}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onSelectAll={handleSelectAll}
        />
      )}

      {/* Top-left: Toolbar */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg mobile-canvas-toolbar">
        {tools.map(({ tool, icon: Icon, label, shortcut }) => (
          <Tooltip key={tool}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveTool(tool)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  activeTool === tool
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {label} {shortcut && <kbd className="ml-1 text-[10px] font-mono opacity-60">{shortcut}</kbd>}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* Top-right: Actions */}
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg mobile-canvas-actions">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <Undo2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Undo <kbd className="ml-1 text-[10px] font-mono opacity-60">Ctrl+Z</kbd></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={redo}
              disabled={redoStack.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <Redo2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Redo <kbd className="ml-1 text-[10px] font-mono opacity-60">Ctrl+Y</kbd></TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleZoom(0.1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom In</TooltipContent>
        </Tooltip>

        <span className="text-[11px] text-muted-foreground w-10 text-center tabular-nums">
          {Math.round(zoom * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleZoom(-0.1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Zoom Out</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={resetView}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Reset View</TooltipContent>
        </Tooltip>

        <div className="mx-0.5 h-5 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={exportAsImage}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Export as PNG</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={clearCanvas}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Clear All</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                settingsOpen
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Mindmap Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Hint text when empty */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center text-muted-foreground/50 space-y-1">
            <p className="text-sm">Double-click to add a node</p>
            <p className="text-xs">or select a node tool from the toolbar</p>
          </div>
        </div>
      )}

      {/* Settings panel */}
      <MindmapSettingsPanel
        settings={settings}
        onChange={(partial) => setSettings((prev) => ({ ...prev, ...partial }))}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
