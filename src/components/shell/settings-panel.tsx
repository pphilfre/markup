"use client";

import { useState, useEffect, useRef } from "react";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useEditorStore, DEFAULT_SETTINGS } from "@/lib/store";

const FONT_OPTIONS = [
  { label: "System Mono", value: "var(--font-geist-mono), ui-monospace, monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Fira Code", value: "'Fira Code', ui-monospace, monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', ui-monospace, monospace" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', ui-monospace, monospace" },
  { label: "Sans-serif", value: "var(--font-geist-sans), ui-sans-serif, sans-serif" },
];

const ACCENT_PRESETS = [
  "#7c3aed", // violet
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#14b8a6", // teal
  "#22c55e", // green
  "#eab308", // yellow
  "#f97316", // orange
  "#f43f5e", // rose
  "#ec4899", // pink
];

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-24 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-primary cursor-pointer"
      />
      <span className="text-xs text-muted-foreground w-14 text-right tabular-nums">
        {value}{unit}
      </span>
    </div>
  );
}

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const settings = useEditorStore((s) => s.settings);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const panelRef = useRef<HTMLDivElement>(null);

  // Listen for custom event
  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    document.addEventListener("open-settings", handler);
    return () => document.removeEventListener("open-settings", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const id = setTimeout(() => {
      document.addEventListener("mousedown", onClick);
    }, 100);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const reset = () => updateSettings({ ...DEFAULT_SETTINGS });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-sm rounded-lg border border-border bg-popover shadow-2xl animate-in slide-in-from-top-2 fade-in duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Settings</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              className="h-6 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Font family */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Font Family</label>
            <select
              value={settings.fontFamily}
              onChange={(e) => updateSettings({ fontFamily: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <Separator />

          {/* Range sliders */}
          <div className="space-y-3">
            <RangeRow
              label="Font Size"
              value={settings.fontSize}
              min={10}
              max={24}
              step={1}
              unit="px"
              onChange={(v) => updateSettings({ fontSize: v })}
            />
            <RangeRow
              label="Line Height"
              value={settings.lineHeight}
              min={1.2}
              max={2.4}
              step={0.1}
              unit=""
              onChange={(v) => updateSettings({ lineHeight: v })}
            />
            <RangeRow
              label="Tab Size"
              value={settings.tabSize}
              min={1}
              max={8}
              step={1}
              unit=""
              onChange={(v) => updateSettings({ tabSize: v })}
            />
            <RangeRow
              label="Editor Margin"
              value={settings.editorMargin}
              min={0}
              max={80}
              step={4}
              unit="px"
              onChange={(v) => updateSettings({ editorMargin: v })}
            />
          </div>

          <Separator />

          {/* Hide .md extensions toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Hide .md extensions</span>
            <button
              onClick={() => updateSettings({ hideMdExtensions: !settings.hideMdExtensions })}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                settings.hideMdExtensions ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform",
                  settings.hideMdExtensions ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          <Separator />

          {/* Accent colour */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Accent Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateSettings({ accentColor: c })}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                    settings.accentColor === c
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  )}
                  style={{ background: c }}
                />
              ))}
              {/* Custom colour picker */}
              <label
                className={cn(
                  "relative h-6 w-6 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 overflow-hidden",
                  !ACCENT_PRESETS.includes(settings.accentColor)
                    ? "border-foreground scale-110"
                    : "border-muted-foreground/30"
                )}
                style={{ background: settings.accentColor }}
                title="Custom color"
              >
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => updateSettings({ accentColor: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <span className="text-[10px] text-muted-foreground">
            Settings auto-save to cache
          </span>
          <kbd className="text-[10px] text-muted-foreground font-mono">
            Alt+S
          </kbd>
        </div>
      </div>
    </div>
  );
}
