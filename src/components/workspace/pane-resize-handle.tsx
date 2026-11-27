"use client";

import { useRef, type PointerEvent } from "react";

export function PaneResizeHandle({
  label, axis, value, min, max, step, unitsPerPixel, unit = "px",
  onPreview, onCommit, className,
}: {
  label: string;
  axis: "x" | "y";
  value: number;
  min: number;
  max: number;
  step: number;
  unitsPerPixel: number;
  unit?: "px" | "%";
  onPreview: (value: number | null) => void;
  onCommit: (value: number) => void;
  className: string;
}) {
  const drag = useRef<{ pointerId: number; axis: "x" | "y"; position: number; value: number } | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const position = (event: PointerEvent<HTMLDivElement>) => axis === "x" ? event.clientX : event.clientY;
  const dragValue = (event: PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    return start?.pointerId === event.pointerId && start.axis === axis
      ? clamp(start.value + (position(event) - start.position) * unitsPerPixel)
      : null;
  };

  return (
    <div
      className={className}
      role="separator"
      tabIndex={min === max ? -1 : 0}
      aria-label={label}
      aria-orientation={axis === "x" ? "vertical" : "horizontal"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={value + unit}
      aria-disabled={min === max || undefined}
      onKeyDown={(event) => {
        const decrease = axis === "x" ? "ArrowLeft" : "ArrowUp";
        const increase = axis === "x" ? "ArrowRight" : "ArrowDown";
        const delta = step * Math.sign(unitsPerPixel);
        const next = { [decrease]: value - delta, [increase]: value + delta, Home: min, End: max }[event.key];
        if (next === undefined || min === max) return;
        event.preventDefault();
        onCommit(clamp(next));
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || drag.current || min === max) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        drag.current = { pointerId: event.pointerId, axis, position: position(event), value };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const next = dragValue(event);
        if (next !== null) onPreview(next);
      }}
      onPointerUp={(event) => {
        const next = dragValue(event);
        if (next === null) return;
        drag.current = null;
        onCommit(next);
        onPreview(null);
      }}
      onLostPointerCapture={(event) => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current = null;
        onPreview(null);
      }}
    />
  );
}
