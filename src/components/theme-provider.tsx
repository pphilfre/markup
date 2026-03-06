"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";

/**
 * Syncs the zustand theme state to the <html> element's class list.
 * Must be rendered inside the <body> tag as a client component.
 */
export function ThemeSync() {
  const theme = useEditorStore((s) => s.theme);
  const themeMode = useEditorStore((s) => s.settings.themeMode);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const accentColor = useEditorStore((s) => s.settings.accentColor);
  const hydrated = useEditorStore((s) => s._hydrated);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (!hydrated || themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const systemWantsDark = e.matches;
      const currentTheme = useEditorStore.getState().theme;
      if (systemWantsDark && currentTheme === "light") toggleTheme();
      if (!systemWantsDark && currentTheme === "dark") toggleTheme();
    };
    // Sync immediately
    const systemWantsDark = mq.matches;
    if (systemWantsDark && theme === "light") toggleTheme();
    if (!systemWantsDark && theme === "dark") toggleTheme();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [hydrated, themeMode, toggleTheme, theme]);

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

  // Sync editor look data attributes
  const codeBlockTheme = useEditorStore((s) => s.settings.codeBlockTheme);
  const headingStyle = useEditorStore((s) => s.settings.headingStyle);
  const linkStyle = useEditorStore((s) => s.settings.linkStyle);
  const checkboxStyle = useEditorStore((s) => s.settings.checkboxStyle);

  useEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    root.setAttribute("data-code-theme", codeBlockTheme);
    root.setAttribute("data-heading-style", headingStyle);
    root.setAttribute("data-link-style", linkStyle);
    root.setAttribute("data-checkbox-style", checkboxStyle);
  }, [hydrated, codeBlockTheme, headingStyle, linkStyle, checkboxStyle]);

  return null;
}
