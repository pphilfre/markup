export type CanvasPoint = { x: number; y: number };
export type CanvasBounds = CanvasPoint & { w: number; h: number };

export function selectionBounds(start: CanvasPoint, end: CanvasPoint): CanvasBounds {
  return { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), w: Math.abs(start.x - end.x), h: Math.abs(start.y - end.y) };
}

export function boundsOverlap(a: CanvasBounds, b: CanvasBounds): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function canvasPointer(event: { clientX: number; clientY: number }, canvas: HTMLCanvasElement, pan: CanvasPoint, zoom: number): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * (canvas.clientWidth / (rect.width || 1)) - pan.x) / zoom,
    y: ((event.clientY - rect.top) * (canvas.clientHeight / (rect.height || 1)) - pan.y) / zoom,
  };
}
