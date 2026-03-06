"use client";

import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Square,
  Circle,
  Minus,
  ArrowRight,
  Pencil,
  Type,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Download,
  Trash2,
  Settings,
  Hand,
  Diamond,
  Triangle,
  Star,
  Hexagon,
  Copy,
  Clipboard,
  Layers,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthState } from "@/components/convex-client-provider";

// ── Types ─────────────────────────────────────────────────────────────────

type Tool =
  | "select"
  | "pan"
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "triangle"
  | "star"
  | "hexagon"
  | "line"
  | "arrow"
  | "pen"
  | "text";

interface Point {
  x: number;
  y: number;
}

interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  selected?: boolean;
}

interface RectElement extends BaseElement {
  type: "rectangle";
  width: number;
  height: number;
}

interface EllipseElement extends BaseElement {
  type: "ellipse";
  width: number;
  height: number;
}

interface DiamondElement extends BaseElement {
  type: "diamond";
  width: number;
  height: number;
}

interface TriangleElement extends BaseElement {
  type: "triangle";
  width: number;
  height: number;
}

interface StarElement extends BaseElement {
  type: "star";
  width: number;
  height: number;
}

interface HexagonElement extends BaseElement {
  type: "hexagon";
  width: number;
  height: number;
}

interface LineElement extends BaseElement {
  type: "line";
  x2: number;
  y2: number;
}

interface ArrowElement extends BaseElement {
  type: "arrow";
  x2: number;
  y2: number;
}

interface PenElement extends BaseElement {
  type: "pen";
  points: Point[];
}

interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
}

type WhiteboardElement =
  | RectElement
  | EllipseElement
  | DiamondElement
  | TriangleElement
  | StarElement
  | HexagonElement
  | LineElement
  | ArrowElement
  | PenElement
  | TextElement;

interface CanvasSettings {
  backgroundColor: string;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
}

// ── Default values ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: CanvasSettings = {
  backgroundColor: "transparent",
  showGrid: true,
  gridSize: 20,
  snapToGrid: false,
};

const DEFAULT_FILL_COLOR = "transparent";
const DEFAULT_STROKE_WIDTH = 2;

// Shapes that use width/height
type SizedShape = "rectangle" | "ellipse" | "diamond" | "triangle" | "star" | "hexagon";
const SIZED_SHAPES: SizedShape[] = ["rectangle", "ellipse", "diamond", "triangle", "star", "hexagon"];

function isSizedShape(type: string): type is SizedShape {
  return SIZED_SHAPES.includes(type as SizedShape);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function screenToCanvas(
  sx: number,
  sy: number,
  pan: Point,
  zoom: number
): Point {
  return {
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  };
}

function pointInPolygon(px: number, py: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function getDiamondPoints(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x: x + w / 2, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w / 2, y: y + h },
    { x, y: y + h / 2 },
  ];
}

function getTrianglePoints(x: number, y: number, w: number, h: number): Point[] {
  return [
    { x: x + w / 2, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

function getHexagonPoints(x: number, y: number, w: number, h: number): Point[] {
  const qw = w / 4;
  return [
    { x: x + qw, y },
    { x: x + w - qw, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w - qw, y: y + h },
    { x: x + qw, y: y + h },
    { x, y: y + h / 2 },
  ];
}

function getStarPoints(x: number, y: number, w: number, h: number): Point[] {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = outerRx * 0.38;
  const innerRy = outerRy * 0.38;
  const points: Point[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = (Math.PI / 2) * -1 + (i * 2 * Math.PI) / 5;
    points.push({ x: cx + outerRx * Math.cos(outerAngle), y: cy + outerRy * Math.sin(outerAngle) });
    const innerAngle = outerAngle + Math.PI / 5;
    points.push({ x: cx + innerRx * Math.cos(innerAngle), y: cy + innerRy * Math.sin(innerAngle) });
  }
  return points;
}

function hitTest(
  el: WhiteboardElement,
  cx: number,
  cy: number,
  tolerance: number = 6
): boolean {
  switch (el.type) {
    case "rectangle":
      return (
        cx >= el.x - tolerance &&
        cx <= el.x + el.width + tolerance &&
        cy >= el.y - tolerance &&
        cy <= el.y + el.height + tolerance
      );
    case "ellipse": {
      const rx = el.width / 2;
      const ry = el.height / 2;
      const dx = cx - (el.x + rx);
      const dy = cy - (el.y + ry);
      return (dx * dx) / ((rx + tolerance) * (rx + tolerance)) +
        (dy * dy) / ((ry + tolerance) * (ry + tolerance)) <= 1;
    }
    case "diamond":
      return pointInPolygon(cx, cy, getDiamondPoints(el.x - tolerance, el.y - tolerance, el.width + tolerance * 2, el.height + tolerance * 2));
    case "triangle":
      return pointInPolygon(cx, cy, getTrianglePoints(el.x - tolerance, el.y - tolerance, el.width + tolerance * 2, el.height + tolerance * 2));
    case "star":
      return cx >= el.x - tolerance && cx <= el.x + el.width + tolerance &&
        cy >= el.y - tolerance && cy <= el.y + el.height + tolerance;
    case "hexagon":
      return pointInPolygon(cx, cy, getHexagonPoints(el.x - tolerance, el.y - tolerance, el.width + tolerance * 2, el.height + tolerance * 2));
    case "line":
    case "arrow": {
      const el2 = el as LineElement | ArrowElement;
      const dx = el2.x2 - el.x;
      const dy = el2.y2 - el.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(cx - el.x, cy - el.y) <= tolerance;
      let t = ((cx - el.x) * dx + (cy - el.y) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = el.x + t * dx;
      const py = el.y + t * dy;
      return Math.hypot(cx - px, cy - py) <= tolerance;
    }
    case "pen": {
      for (const pt of el.points) {
        if (Math.hypot(cx - pt.x, cy - pt.y) <= tolerance) return true;
      }
      return false;
    }
    case "text": {
      const width = el.text.length * el.fontSize * 0.6;
      const height = el.fontSize * 1.2;
      return (
        cx >= el.x - tolerance &&
        cx <= el.x + width + tolerance &&
        cy >= el.y - height - tolerance &&
        cy <= el.y + tolerance
      );
    }
    default:
      return false;
  }
}

// ── Render helpers ────────────────────────────────────────────────────────

function drawPolygon(ctx: CanvasRenderingContext2D, points: Point[], fill: string, stroke: string) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  if (fill !== "transparent") {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawElement(ctx: CanvasRenderingContext2D, el: WhiteboardElement) {
  ctx.strokeStyle = el.strokeColor;
  ctx.fillStyle = el.fillColor;
  ctx.lineWidth = el.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (el.type) {
    case "rectangle":
      if (el.fillColor !== "transparent") {
        ctx.fillRect(el.x, el.y, el.width, el.height);
      }
      ctx.strokeRect(el.x, el.y, el.width, el.height);
      break;

    case "ellipse": {
      const rx = el.width / 2;
      const ry = el.height / 2;
      ctx.beginPath();
      ctx.ellipse(el.x + rx, el.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      if (el.fillColor !== "transparent") ctx.fill();
      ctx.stroke();
      break;
    }

    case "diamond":
      drawPolygon(ctx, getDiamondPoints(el.x, el.y, el.width, el.height), el.fillColor, el.strokeColor);
      break;

    case "triangle":
      drawPolygon(ctx, getTrianglePoints(el.x, el.y, el.width, el.height), el.fillColor, el.strokeColor);
      break;

    case "star":
      drawPolygon(ctx, getStarPoints(el.x, el.y, el.width, el.height), el.fillColor, el.strokeColor);
      break;

    case "hexagon":
      drawPolygon(ctx, getHexagonPoints(el.x, el.y, el.width, el.height), el.fillColor, el.strokeColor);
      break;

    case "line":
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      break;

    case "arrow": {
      ctx.beginPath();
      ctx.moveTo(el.x, el.y);
      ctx.lineTo(el.x2, el.y2);
      ctx.stroke();
      // Arrowhead
      const angle = Math.atan2(el.y2 - el.y, el.x2 - el.x);
      const headLen = 12;
      ctx.beginPath();
      ctx.moveTo(el.x2, el.y2);
      ctx.lineTo(
        el.x2 - headLen * Math.cos(angle - Math.PI / 6),
        el.y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(el.x2, el.y2);
      ctx.lineTo(
        el.x2 - headLen * Math.cos(angle + Math.PI / 6),
        el.y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
      break;
    }

    case "pen":
      if (el.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
      break;

    case "text":
      ctx.font = `${el.fontSize}px sans-serif`;
      ctx.fillStyle = el.strokeColor;
      ctx.fillText(el.text, el.x, el.y);
      break;
  }

  // Selection highlight
  if (el.selected) {
    ctx.save();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const bounds = getElementBounds(el);
    ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8);
    ctx.setLineDash([]);
    ctx.restore();
  }
}

function getElementBounds(el: WhiteboardElement): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  switch (el.type) {
    case "rectangle":
    case "ellipse":
    case "diamond":
    case "triangle":
    case "star":
    case "hexagon":
      return { x: el.x, y: el.y, w: (el as RectElement).width, h: (el as RectElement).height };
    case "line":
    case "arrow": {
      const el2 = el as LineElement | ArrowElement;
      const minX = Math.min(el.x, el2.x2);
      const minY = Math.min(el.y, el2.y2);
      return {
        x: minX,
        y: minY,
        w: Math.abs(el2.x2 - el.x),
        h: Math.abs(el2.y2 - el.y),
      };
    }
    case "pen": {
      if (el.points.length === 0) return { x: el.x, y: el.y, w: 0, h: 0 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of el.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    case "text": {
      const width = el.text.length * el.fontSize * 0.6;
      const height = el.fontSize * 1.2;
      return { x: el.x, y: el.y - height, w: width, h: height };
    }
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

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

// ── Settings Panel ────────────────────────────────────────────────────────

function WhiteboardSettingsPanel({
  settings,
  onChange,
  open,
  onClose,
  strokeColor,
  fillColor,
  strokeWidth,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
}: {
  settings: CanvasSettings;
  onChange: (s: Partial<CanvasSettings>) => void;
  open: boolean;
  onClose: () => void;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  onStrokeColorChange: (c: string) => void;
  onFillColorChange: (c: string) => void;
  onStrokeWidthChange: (w: number) => void;
}) {
  if (!open) return null;

  const bgOptions = [
    { label: "Transparent", value: "transparent" },
    { label: "White", value: "#ffffff" },
    { label: "Dark", value: "#1e1e2e" },
    { label: "Warm", value: "#fdf6e3" },
  ];

  const colorPresets = [
    "#e2e8f0", "#94a3b8", "#ffffff", "#000000",
    "#ef4444", "#f97316", "#eab308", "#22c55e",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
  ];

  return (
    <div className="absolute right-2 top-14 z-20 w-56 rounded-lg border border-border bg-popover p-3 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Canvas Settings</span>
        <button
          onClick={onClose}
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          ✕
        </button>
      </div>

      {/* Stroke color */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Stroke Color</label>
        <div className="flex flex-wrap gap-1.5">
          {colorPresets.map((c) => (
            <button
              key={`stroke-${c}`}
              onClick={() => onStrokeColorChange(c)}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                strokeColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
          <label
            className="relative h-5 w-5 rounded-full border-2 border-muted-foreground/30 cursor-pointer overflow-hidden"
            style={{ background: strokeColor }}
          >
            <input
              type="color"
              value={strokeColor === "transparent" ? "#e2e8f0" : strokeColor}
              onChange={(e) => onStrokeColorChange(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      {/* Fill color */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Fill Color</label>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onFillColorChange("transparent")}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 bg-transparent",
              fillColor === "transparent" ? "border-blue-500 scale-110" : "border-muted-foreground/30"
            )}
            style={{
              background: "repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50%/8px 8px",
            }}
            title="Transparent"
          />
          {colorPresets.map((c) => (
            <button
              key={`fill-${c}`}
              onClick={() => onFillColorChange(c)}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                fillColor === c ? "border-blue-500 scale-110" : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      {/* Stroke width */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">Stroke Width</label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="flex-1 h-1.5 accent-primary cursor-pointer"
          />
          <span className="text-[11px] text-muted-foreground w-6 text-right">{strokeWidth}px</span>
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

// ── Context Menu ──────────────────────────────────────────────────────────

function WhiteboardContextMenu({
  position,
  onClose,
  hasSelection,
  onDuplicate,
  onDelete,
  onBringToFront,
  onSendToBack,
  onSelectAll,
  onPaste,
  clipboardHasItems,
  onCopy,
}: {
  position: Point;
  onClose: () => void;
  hasSelection: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onSelectAll: () => void;
  onPaste: () => void;
  clipboardHasItems: boolean;
  onCopy: () => void;
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
      <MenuItem onClick={onCopy} disabled={!hasSelection}>
        <Copy className="h-3.5 w-3.5" /> Copy
      </MenuItem>
      <MenuItem onClick={onPaste} disabled={!clipboardHasItems}>
        <Clipboard className="h-3.5 w-3.5" /> Paste
      </MenuItem>
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

// ── Whiteboard Component ──────────────────────────────────────────────────

export function WhiteboardView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Auth for Convex persistence
  const { isAuthenticated, user } = useAuthState();
  const userId = user?.id ?? null;

  // Canvas transform state
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Tool state
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [undoStack, setUndoStack] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);

  // ── Convex persistence ──────────────────────────────────────────────
  const remoteWhiteboard = useQuery(
    api.whiteboards.get,
    userId ? { userId } : "skip"
  );
  const saveWhiteboard = useMutation(api.whiteboards.save);
  const hydratedFromConvex = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from Convex on first load
  useEffect(() => {
    if (hydratedFromConvex.current) return;
    if (!remoteWhiteboard) return;
    hydratedFromConvex.current = true;
    try {
      const parsed = JSON.parse(remoteWhiteboard.elements);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setElements(parsed);
      }
    } catch { /* ignore parse errors */ }
    try {
      const parsed = JSON.parse(remoteWhiteboard.canvasSettings);
      if (parsed && typeof parsed === "object") {
        setCanvasSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore parse errors */ }
  }, [remoteWhiteboard]);

  // Detect dark mode
  const [isDark, setIsDark] = useState(true);
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);

  // Drawing state — theme-adaptive default stroke color
  const userChangedStroke = useRef(false);
  const [strokeColor, setStrokeColor] = useState("#e2e8f0");
  const [fillColor, setFillColor] = useState(DEFAULT_FILL_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);

  // Adapt default stroke color to theme unless user manually changed it
  useEffect(() => {
    if (!userChangedStroke.current) {
      setStrokeColor(isDark ? "#e2e8f0" : "#1e293b");
    }
  }, [isDark]);

  const handleStrokeColorChange = useCallback((c: string) => {
    userChangedStroke.current = true;
    setStrokeColor(c);
  }, []);

  // Interaction state
  const drawingRef = useRef(false);
  const startRef = useRef<Point>({ x: 0, y: 0 });
  const panStartRef = useRef<Point>({ x: 0, y: 0 });
  const currentElementRef = useRef<WhiteboardElement | null>(null);
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const isPanningRef = useRef(false);

  // Text input
  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    visible: boolean;
    screenX: number;
    screenY: number;
  } | null>(null);
  const [textValue, setTextValue] = useState("");

  // Settings panel
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [canvasSettings, setCanvasSettings] =
    useState<CanvasSettings>(DEFAULT_SETTINGS);

  // Context menu
  const [contextMenu, setContextMenu] = useState<Point | null>(null);
  const [clipboard, setClipboard] = useState<WhiteboardElement[]>([]);

  // ── Debounced save to Convex ──────────────────────────────────────
  useEffect(() => {
    if (!userId || !isAuthenticated) return;
    if (!hydratedFromConvex.current && remoteWhiteboard === undefined) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveWhiteboard({
        userId,
        elements: JSON.stringify(elements),
        canvasSettings: JSON.stringify(canvasSettings),
      }).catch(console.error);
    }, 800);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [elements, canvasSettings, userId, isAuthenticated, saveWhiteboard, remoteWhiteboard]);

  // ── Undo/Redo ─────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-49), elements]);
    setRedoStack([]);
  }, [elements]);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => [...r, elements]);
      setElements(last);
      return prev.slice(0, -1);
    });
  }, [elements]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setUndoStack((u) => [...u, elements]);
      setElements(last);
      return prev.slice(0, -1);
    });
  }, [elements]);

  // ── Context menu actions ──────────────────────────────────────────────

  const handleCopy = useCallback(() => {
    const selected = elements.filter((el) => el.selected);
    if (selected.length > 0) setClipboard(selected.map((el) => ({ ...el, selected: false })));
  }, [elements]);

  const handlePaste = useCallback(() => {
    if (clipboard.length === 0) return;
    pushUndo();
    const offset = 20;
    const pasted = clipboard.map((el) => ({
      ...el,
      id: crypto.randomUUID(),
      x: el.x + offset,
      y: el.y + offset,
      selected: true,
      ...(el.type === "line" || el.type === "arrow"
        ? { x2: (el as LineElement | ArrowElement).x2 + offset, y2: (el as LineElement | ArrowElement).y2 + offset }
        : {}),
      ...(el.type === "pen"
        ? { points: (el as PenElement).points.map((p) => ({ x: p.x + offset, y: p.y + offset })) }
        : {}),
    }));
    setElements((prev) => [...prev.map((el) => ({ ...el, selected: false })), ...pasted as WhiteboardElement[]]);
  }, [clipboard, pushUndo]);

  const handleDuplicate = useCallback(() => {
    const selected = elements.filter((el) => el.selected);
    if (selected.length === 0) return;
    pushUndo();
    const offset = 20;
    const duped = selected.map((el) => ({
      ...el,
      id: crypto.randomUUID(),
      x: el.x + offset,
      y: el.y + offset,
      selected: true,
      ...(el.type === "line" || el.type === "arrow"
        ? { x2: (el as LineElement | ArrowElement).x2 + offset, y2: (el as LineElement | ArrowElement).y2 + offset }
        : {}),
      ...(el.type === "pen"
        ? { points: (el as PenElement).points.map((p) => ({ x: p.x + offset, y: p.y + offset })) }
        : {}),
    }));
    setElements((prev) => [...prev.map((el) => ({ ...el, selected: false })), ...duped as WhiteboardElement[]]);
  }, [elements, pushUndo]);

  const handleDelete = useCallback(() => {
    const selected = elements.filter((el) => el.selected);
    if (selected.length === 0) return;
    pushUndo();
    setElements((prev) => prev.filter((el) => !el.selected));
  }, [elements, pushUndo]);

  const handleBringToFront = useCallback(() => {
    pushUndo();
    setElements((prev) => {
      const sel = prev.filter((el) => el.selected);
      const rest = prev.filter((el) => !el.selected);
      return [...rest, ...sel];
    });
  }, [pushUndo]);

  const handleSendToBack = useCallback(() => {
    pushUndo();
    setElements((prev) => {
      const sel = prev.filter((el) => el.selected);
      const rest = prev.filter((el) => !el.selected);
      return [...sel, ...rest];
    });
  }, [pushUndo]);

  const handleSelectAll = useCallback(() => {
    setElements((prev) => prev.map((el) => ({ ...el, selected: true })));
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        handleCopy();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        handlePaste();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleDuplicate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const selected = elements.filter((el) => el.selected);
        if (selected.length > 0) {
          e.preventDefault();
          pushUndo();
          setElements((prev) => prev.filter((el) => !el.selected));
        }
      }
      // Tool shortcuts
      if (e.key === "v" || e.key === "1") setActiveTool("select");
      if (e.key === "h" || e.key === "2") setActiveTool("pan");
      if (e.key === "r") setActiveTool("rectangle");
      if (e.key === "o") setActiveTool("ellipse");
      if (e.key === "d" && !e.ctrlKey && !e.metaKey) setActiveTool("diamond");
      if (e.key === "l") setActiveTool("line");
      if (e.key === "a" && !e.ctrlKey && !e.metaKey) setActiveTool("arrow");
      if (e.key === "p") setActiveTool("pen");
      if (e.key === "t") setActiveTool("text");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, elements, pushUndo, handleCopy, handlePaste, handleDuplicate, handleSelectAll]);

  // ── Zoom ──────────────────────────────────────────────────────────────

  const handleZoom = useCallback(
    (delta: number, centerX?: number, centerY?: number) => {
      setZoom((prev) => {
        const newZoom = Math.min(5, Math.max(0.1, prev + delta));
        if (centerX !== undefined && centerY !== undefined) {
          const scale = newZoom / prev;
          setPan((p) => ({
            x: centerX - (centerX - p.x) * scale,
            y: centerY - (centerY - p.y) * scale,
          }));
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

  // ── Wheel ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // Pinch-zoom
        handleZoom(-e.deltaY * 0.002, e.offsetX, e.offsetY);
      } else {
        // Pan
        setPan((p) => ({
          x: p.x - e.deltaX,
          y: p.y - e.deltaY,
        }));
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [handleZoom]);

  // ── Snap helper ───────────────────────────────────────────────────────

  const snap = useCallback(
    (val: number) => {
      if (!canvasSettings.snapToGrid) return val;
      return Math.round(val / canvasSettings.gridSize) * canvasSettings.gridSize;
    },
    [canvasSettings.snapToGrid, canvasSettings.gridSize]
  );

  // ── Pointer handlers ──────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      // Close context menu on any click
      setContextMenu(null);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy, pan, zoom);

      if (activeTool === "pan" || (e.button === 1)) {
        // Middle click or pan tool
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Space+drag for pan (handled by panning ref when space is held)
      drawingRef.current = true;
      startRef.current = { x: snap(cp.x), y: snap(cp.y) };
      canvas.setPointerCapture(e.pointerId);

      if (activeTool === "select") {
        // Hit test
        let hit: WhiteboardElement | null = null;
        for (let i = elements.length - 1; i >= 0; i--) {
          if (hitTest(elements[i], cp.x, cp.y)) {
            hit = elements[i];
            break;
          }
        }
        if (hit) {
          if (!hit.selected) {
            pushUndo();
            setElements((prev) =>
              prev.map((el) => ({ ...el, selected: el.id === hit!.id }))
            );
          }
          dragOffsetRef.current = { x: cp.x - hit.x, y: cp.y - hit.y };
          currentElementRef.current = hit;
        } else {
          setElements((prev) => prev.map((el) => ({ ...el, selected: false })));
          currentElementRef.current = null;
        }
        return;
      }

      if (activeTool === "text") {
        setTextInput({
          x: snap(cp.x),
          y: snap(cp.y),
          visible: true,
          screenX: e.clientX,
          screenY: e.clientY,
        });
        setTextValue("");
        setTimeout(() => textInputRef.current?.focus(), 50);
        drawingRef.current = false;
        return;
      }

      pushUndo();

      const baseEl = {
        id: crypto.randomUUID(),
        strokeColor,
        fillColor,
        strokeWidth,
        selected: false,
      };

      let newEl: WhiteboardElement;
      const toolType = activeTool as string;

      if (isSizedShape(toolType)) {
        newEl = {
          ...baseEl,
          type: toolType,
          x: snap(cp.x),
          y: snap(cp.y),
          width: 0,
          height: 0,
        } as WhiteboardElement;
      } else {
        switch (activeTool) {
          case "line":
            newEl = { ...baseEl, type: "line", x: snap(cp.x), y: snap(cp.y), x2: snap(cp.x), y2: snap(cp.y) };
            break;
          case "arrow":
            newEl = { ...baseEl, type: "arrow", x: snap(cp.x), y: snap(cp.y), x2: snap(cp.x), y2: snap(cp.y) };
            break;
          case "pen":
            newEl = { ...baseEl, type: "pen", x: snap(cp.x), y: snap(cp.y), points: [{ x: snap(cp.x), y: snap(cp.y) }] };
            break;
          default:
            return;
        }
      }

      currentElementRef.current = newEl;
      setElements((prev) => [...prev, newEl]);
    },
    [activeTool, pan, zoom, elements, strokeColor, fillColor, strokeWidth, snap, pushUndo]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (isPanningRef.current) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        });
        return;
      }

      if (!drawingRef.current || !currentElementRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cp = screenToCanvas(sx, sy, pan, zoom);
      const cur = currentElementRef.current;

      if (activeTool === "select" && cur) {
        // Drag selected element
        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== cur.id) return el;
            const nx = snap(cp.x - dragOffsetRef.current.x);
            const ny = snap(cp.y - dragOffsetRef.current.y);
            const dx = nx - el.x;
            const dy = ny - el.y;
            if (el.type === "line" || el.type === "arrow") {
              const el2 = el as LineElement | ArrowElement;
              return { ...el2, x: nx, y: ny, x2: el2.x2 + dx, y2: el2.y2 + dy };
            }
            if (el.type === "pen") {
              return {
                ...el,
                x: nx,
                y: ny,
                points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
              };
            }
            return { ...el, x: nx, y: ny };
          })
        );
        return;
      }

      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== cur.id) return el;

          if (isSizedShape(el.type)) {
            return {
              ...el,
              width: snap(cp.x) - startRef.current.x,
              height: snap(cp.y) - startRef.current.y,
            };
          }

          switch (el.type) {
            case "line":
            case "arrow":
              return { ...el, x2: snap(cp.x), y2: snap(cp.y) };
            case "pen":
              return {
                ...el,
                points: [...el.points, { x: cp.x, y: cp.y }],
              };
            default:
              return el;
          }
        })
      );
    },
    [activeTool, pan, zoom, snap]
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        return;
      }

      // Normalize negative-sized shapes
      if (currentElementRef.current) {
        const cur = currentElementRef.current;
        if (isSizedShape(cur.type)) {
          setElements((prev) =>
            prev.map((el) => {
              if (el.id !== cur.id) return el;
              const r = el as RectElement;
              let { x, y, width, height } = r;
              if (width < 0) {
                x += width;
                width = -width;
              }
              if (height < 0) {
                y += height;
                height = -height;
              }
              return { ...r, x, y, width, height };
            })
          );
        }
      }

      drawingRef.current = false;
      currentElementRef.current = null;
    },
    []
  );

  // ── Context menu handler ──────────────────────────────────────────────

  const handleContextMenu = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setContextMenu({
        x: Math.min(e.clientX - rect.left, rect.width - 200),
        y: Math.min(e.clientY - rect.top, rect.height - 280),
      });
    },
    []
  );

  // ── Text input commit ─────────────────────────────────────────────────

  const commitText = useCallback(() => {
    if (!textInput || !textValue.trim()) {
      setTextInput(null);
      setTextValue("");
      return;
    }
    pushUndo();
    const newEl: TextElement = {
      id: crypto.randomUUID(),
      type: "text",
      x: textInput.x,
      y: textInput.y,
      strokeColor,
      fillColor: "transparent",
      strokeWidth: 1,
      text: textValue.trim(),
      fontSize: 16,
    };
    setElements((prev) => [...prev, newEl]);
    setTextInput(null);
    setTextValue("");
  }, [textInput, textValue, strokeColor, pushUndo]);

  // ── Export ────────────────────────────────────────────────────────────

  const exportAsImage = useCallback(() => {
    if (elements.length === 0) return;

    // Find bounding box of all elements
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const el of elements) {
      const bounds = getElementBounds(el);
      if (bounds.x < minX) minX = bounds.x;
      if (bounds.y < minY) minY = bounds.y;
      if (bounds.x + bounds.w > maxX) maxX = bounds.x + bounds.w;
      if (bounds.y + bounds.h > maxY) maxY = bounds.y + bounds.h;
    }

    const padding = 40;
    const w = maxX - minX + padding * 2;
    const h = maxY - minY + padding * 2;

    const offscreen = document.createElement("canvas");
    offscreen.width = w * 2;
    offscreen.height = h * 2;
    const ctx = offscreen.getContext("2d")!;
    ctx.scale(2, 2);

    // Background
    if (canvasSettings.backgroundColor !== "transparent") {
      ctx.fillStyle = canvasSettings.backgroundColor;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.translate(-minX + padding, -minY + padding);
    for (const el of elements) {
      drawElement(ctx, { ...el, selected: false });
    }

    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "whiteboard.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [elements, canvasSettings.backgroundColor]);

  // ── Clear ─────────────────────────────────────────────────────────────

  const clearCanvas = useCallback(() => {
    if (elements.length === 0) return;
    pushUndo();
    setElements([]);
  }, [elements, pushUndo]);

  // ── Render loop ───────────────────────────────────────────────────────

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

      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // Background
      if (canvasSettings.backgroundColor !== "transparent") {
        ctx.fillStyle = canvasSettings.backgroundColor;
        ctx.fillRect(0, 0, w, h);
      }

      // Grid
      if (canvasSettings.showGrid) {
        drawGrid(ctx, pan, zoom, w, h, canvasSettings.gridSize, isDark);
      }

      // Transform
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      // Elements
      for (const el of elements) {
        drawElement(ctx, el);
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [elements, pan, zoom, canvasSettings, isDark]);

  // ── Tool buttons config ───────────────────────────────────────────────

  const tools: { tool: Tool; icon: typeof MousePointer2; label: string; shortcut: string }[] = [
    { tool: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
    { tool: "pan", icon: Hand, label: "Pan", shortcut: "H" },
    { tool: "rectangle", icon: Square, label: "Rectangle", shortcut: "R" },
    { tool: "ellipse", icon: Circle, label: "Ellipse", shortcut: "O" },
    { tool: "diamond", icon: Diamond, label: "Diamond", shortcut: "D" },
    { tool: "triangle", icon: Triangle, label: "Triangle", shortcut: "" },
    { tool: "star", icon: Star, label: "Star", shortcut: "" },
    { tool: "hexagon", icon: Hexagon, label: "Hexagon", shortcut: "" },
    { tool: "line", icon: Minus, label: "Line", shortcut: "L" },
    { tool: "arrow", icon: ArrowRight, label: "Arrow", shortcut: "A" },
    { tool: "pen", icon: Pencil, label: "Pen", shortcut: "P" },
    { tool: "text", icon: Type, label: "Text", shortcut: "T" },
  ];

  // ── Cursor ────────────────────────────────────────────────────────────

  const cursorClass = (() => {
    switch (activeTool) {
      case "pan":
        return "cursor-grab active:cursor-grabbing";
      case "select":
        return "cursor-default";
      case "text":
        return "cursor-text";
      default:
        return "cursor-crosshair";
    }
  })();

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-background">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className={cn("absolute inset-0", cursorClass)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        style={{ touchAction: "none" }}
      />

      {/* Text input overlay */}
      {textInput?.visible && (
        <input
          ref={textInputRef}
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitText();
            if (e.key === "Escape") {
              setTextInput(null);
              setTextValue("");
            }
          }}
          onBlur={commitText}
          className="absolute z-10 bg-transparent border-b border-blue-500 outline-none text-foreground px-1 text-base"
          style={{
            left: textInput.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0),
            top: textInput.screenY - (containerRef.current?.getBoundingClientRect().top ?? 0) - 20,
            minWidth: 100,
          }}
          placeholder="Type text…"
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <WhiteboardContextMenu
          position={contextMenu}
          onClose={() => setContextMenu(null)}
          hasSelection={elements.some((el) => el.selected)}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onBringToFront={handleBringToFront}
          onSendToBack={handleSendToBack}
          onSelectAll={handleSelectAll}
          onPaste={handlePaste}
          clipboardHasItems={clipboard.length > 0}
          onCopy={handleCopy}
        />
      )}

      {/* Top-left: Toolbar */}
      <div className="absolute left-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg">
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
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover/95 backdrop-blur-sm p-1 shadow-lg">
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
          <TooltipContent side="bottom">Clear Canvas</TooltipContent>
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
          <TooltipContent side="bottom">Canvas Settings</TooltipContent>
        </Tooltip>
      </div>

      {/* Settings panel */}
      <WhiteboardSettingsPanel
        settings={canvasSettings}
        onChange={(partial) =>
          setCanvasSettings((prev) => ({ ...prev, ...partial }))
        }
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        strokeColor={strokeColor}
        fillColor={fillColor}
        strokeWidth={strokeWidth}
        onStrokeColorChange={handleStrokeColorChange}
        onFillColorChange={setFillColor}
        onStrokeWidthChange={setStrokeWidth}
      />
    </div>
  );
}
