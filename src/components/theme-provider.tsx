"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";

/**
 * Syncs the zustand theme state to the <html> element's class list.
 * Must be rendered inside the <body> tag as a client component.
 */
export function ThemeSync() {
  const theme = useEditorStore((s) => s.theme);
  const accentColor = useEditorStore((s) => s.settings.accentColor);
  const hydrated = useEditorStore((s) => s._hydrated);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  }, [theme, hydrated]);

  // Sync accent colour to CSS custom property
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.style.setProperty("--accent-color", accentColor);
  }, [accentColor, hydrated]);

  return null;
}
