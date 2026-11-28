"use client";

import { useCallback, useRef, useState } from "react";
import { selectionBounds, type CanvasBounds, type CanvasPoint } from "./canvas-selection";

export function useCanvasSelection(pan: CanvasPoint, zoom: number) {
  const gesture = useRef<{ from: CanvasPoint; additive: boolean } | null>(null);
  const [rect, setRect] = useState<CanvasBounds | null>(null);
  const start = useCallback((from: CanvasPoint, additive: boolean) => {
    gesture.current = { from, additive };
  }, []);
  const move = useCallback((to: CanvasPoint) => {
    const active = gesture.current;
    if (!active) return false;
    const bounds = selectionBounds(active.from, to);
    setRect(Math.max(bounds.w, bounds.h) * zoom > 3 ? bounds : null);
    return true;
  }, [zoom]);
  const finish = useCallback((to: CanvasPoint | null) => {
    const active = gesture.current;
    if (!active) return null;
    gesture.current = null;
    setRect(null);
    if (!to) return null;
    const bounds = selectionBounds(active.from, to);
    return { additive: active.additive, bounds: Math.max(bounds.w, bounds.h) * zoom > 3 ? bounds : null };
  }, [zoom]);
  return {
    start, move, finish,
    rectangle: rect && { left: rect.x * zoom + pan.x, top: rect.y * zoom + pan.y, width: rect.w * zoom, height: rect.h * zoom },
  };
}
