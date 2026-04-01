"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/lib/store";
import { isTauri } from "@/lib/tauri";
import type { CustomThemeColors, ThemeMode } from "@/lib/store";

// CSS variable sets for each built-in theme
export const THEME_VARS: Record<string, Record<string, string>> = {
  light: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(0.145 0 0)",
    "--card": "oklch(1 0 0)",
    "--card-foreground": "oklch(0.145 0 0)",
    "--popover": "oklch(1 0 0)",
    "--popover-foreground": "oklch(0.145 0 0)",
    "--primary": "oklch(0.205 0 0)",
    "--primary-foreground": "oklch(0.985 0 0)",
    "--secondary": "oklch(0.97 0 0)",
    "--secondary-foreground": "oklch(0.205 0 0)",
    "--muted": "oklch(0.97 0 0)",
    "--muted-foreground": "oklch(0.556 0 0)",
    "--accent": "oklch(0.97 0 0)",
    "--accent-foreground": "oklch(0.205 0 0)",
    "--border": "oklch(0.922 0 0)",
    "--input": "oklch(0.922 0 0)",
    "--ring": "oklch(0.708 0 0)",
    "--sidebar": "oklch(0.985 0 0)",
    "--sidebar-foreground": "oklch(0.145 0 0)",
    "--sidebar-border": "oklch(0.922 0 0)",
  },
  dark: {
    "--background": "oklch(0.145 0 0)",
    "--foreground": "oklch(0.985 0 0)",
    "--card": "oklch(0.205 0 0)",
    "--card-foreground": "oklch(0.985 0 0)",
    "--popover": "oklch(0.205 0 0)",
    "--popover-foreground": "oklch(0.985 0 0)",
    "--primary": "oklch(0.922 0 0)",
    "--primary-foreground": "oklch(0.205 0 0)",
    "--secondary": "oklch(0.269 0 0)",
    "--secondary-foreground": "oklch(0.985 0 0)",
    "--muted": "oklch(0.269 0 0)",
    "--muted-foreground": "oklch(0.708 0 0)",
    "--accent": "oklch(0.269 0 0)",
    "--accent-foreground": "oklch(0.985 0 0)",
    "--border": "oklch(1 0 0 / 10%)",
    "--input": "oklch(1 0 0 / 15%)",
    "--ring": "oklch(0.556 0 0)",
    "--sidebar": "oklch(0.205 0 0)",
    "--sidebar-foreground": "oklch(0.985 0 0)",
    "--sidebar-border": "oklch(1 0 0 / 10%)",
  },
  "solarized-light": {
    "--background": "#fdf6e3",
    "--foreground": "#657b83",
    "--card": "#eee8d5",
    "--card-foreground": "#586e75",
    "--popover": "#eee8d5",
    "--popover-foreground": "#586e75",
    "--primary": "#268bd2",
    "--primary-foreground": "#fdf6e3",
    "--secondary": "#eee8d5",
    "--secondary-foreground": "#657b83",
    "--muted": "#eee8d5",
    "--muted-foreground": "#93a1a1",
    "--accent": "#eee8d5",
    "--accent-foreground": "#586e75",
    "--border": "#d3cbb8",
    "--input": "#d3cbb8",
    "--ring": "#268bd2",
    "--sidebar": "#eee8d5",
    "--sidebar-foreground": "#657b83",
    "--sidebar-border": "#d3cbb8",
  },
  "nord-dark": {
    "--background": "#2e3440",
    "--foreground": "#eceff4",
    "--card": "#3b4252",
    "--card-foreground": "#eceff4",
    "--popover": "#3b4252",
    "--popover-foreground": "#eceff4",
    "--primary": "#88c0d0",
    "--primary-foreground": "#2e3440",
    "--secondary": "#434c5e",
    "--secondary-foreground": "#eceff4",
    "--muted": "#434c5e",
    "--muted-foreground": "#d8dee9",
    "--accent": "#434c5e",
    "--accent-foreground": "#eceff4",
    "--border": "rgba(236,239,244,0.1)",
    "--input": "rgba(236,239,244,0.12)",
    "--ring": "#88c0d0",
    "--sidebar": "#3b4252",
    "--sidebar-foreground": "#eceff4",
    "--sidebar-border": "rgba(236,239,244,0.1)",
  },
  // Catppuccin Mocha (dark)
  "catppuccin-mocha": {
    "--background": "#1e1e2e",
    "--foreground": "#cdd6f4",
    "--card": "#181825",
    "--card-foreground": "#cdd6f4",
    "--popover": "#181825",
    "--popover-foreground": "#cdd6f4",
    "--primary": "#cba6f7",
    "--primary-foreground": "#1e1e2e",
    "--secondary": "#313244",
    "--secondary-foreground": "#cdd6f4",
    "--muted": "#313244",
    "--muted-foreground": "#a6adc8",
    "--accent": "#313244",
    "--accent-foreground": "#cdd6f4",
    "--border": "rgba(205,214,244,0.1)",
    "--input": "rgba(205,214,244,0.12)",
    "--ring": "#cba6f7",
    "--sidebar": "#181825",
    "--sidebar-foreground": "#cdd6f4",
    "--sidebar-border": "rgba(205,214,244,0.1)",
  },
  // Catppuccin Latte (light)
  "catppuccin-latte": {
    "--background": "#eff1f5",
    "--foreground": "#4c4f69",
    "--card": "#e6e9ef",
    "--card-foreground": "#4c4f69",
    "--popover": "#e6e9ef",
    "--popover-foreground": "#4c4f69",
    "--primary": "#8839ef",
    "--primary-foreground": "#eff1f5",
    "--secondary": "#dce0e8",
    "--secondary-foreground": "#4c4f69",
    "--muted": "#dce0e8",
    "--muted-foreground": "#6c6f85",
    "--accent": "#dce0e8",
    "--accent-foreground": "#4c4f69",
    "--border": "rgba(76,79,105,0.15)",
    "--input": "rgba(76,79,105,0.12)",
    "--ring": "#8839ef",
    "--sidebar": "#e6e9ef",
    "--sidebar-foreground": "#4c4f69",
    "--sidebar-border": "rgba(76,79,105,0.15)",
  },
  // Gruvbox Dark
  "gruvbox-dark": {
    "--background": "#282828",
    "--foreground": "#ebdbb2",
    "--card": "#3c3836",
    "--card-foreground": "#ebdbb2",
    "--popover": "#3c3836",
    "--popover-foreground": "#ebdbb2",
    "--primary": "#d79921",
    "--primary-foreground": "#282828",
    "--secondary": "#504945",
    "--secondary-foreground": "#ebdbb2",
    "--muted": "#504945",
    "--muted-foreground": "#bdae93",
    "--accent": "#504945",
    "--accent-foreground": "#ebdbb2",
    "--border": "rgba(235,219,178,0.12)",
    "--input": "rgba(235,219,178,0.1)",
    "--ring": "#d79921",
    "--sidebar": "#3c3836",
    "--sidebar-foreground": "#ebdbb2",
    "--sidebar-border": "rgba(235,219,178,0.12)",
  },
  // Gruvbox Light
  "gruvbox-light": {
    "--background": "#fbf1c7",
    "--foreground": "#3c3836",
    "--card": "#f2e5bc",
    "--card-foreground": "#3c3836",
    "--popover": "#f2e5bc",
    "--popover-foreground": "#3c3836",
    "--primary": "#b57614",
    "--primary-foreground": "#fbf1c7",
    "--secondary": "#ebdbb2",
    "--secondary-foreground": "#3c3836",
    "--muted": "#ebdbb2",
    "--muted-foreground": "#7c6f64",
    "--accent": "#ebdbb2",
    "--accent-foreground": "#3c3836",
    "--border": "rgba(60,56,54,0.15)",
    "--input": "rgba(60,56,54,0.12)",
    "--ring": "#b57614",
    "--sidebar": "#f2e5bc",
    "--sidebar-foreground": "#3c3836",
    "--sidebar-border": "rgba(60,56,54,0.15)",
  },
  // Tokyo Night
  "tokyo-night": {
    "--background": "#1a1b26",
    "--foreground": "#c0caf5",
    "--card": "#16161e",
    "--card-foreground": "#c0caf5",
    "--popover": "#16161e",
    "--popover-foreground": "#c0caf5",
    "--primary": "#7aa2f7",
    "--primary-foreground": "#1a1b26",
    "--secondary": "#24283b",
    "--secondary-foreground": "#c0caf5",
    "--muted": "#24283b",
    "--muted-foreground": "#565f89",
    "--accent": "#24283b",
    "--accent-foreground": "#c0caf5",
    "--border": "rgba(192,202,245,0.1)",
    "--input": "rgba(192,202,245,0.12)",
    "--ring": "#7aa2f7",
    "--sidebar": "#16161e",
    "--sidebar-foreground": "#c0caf5",
    "--sidebar-border": "rgba(192,202,245,0.1)",
  },
  // Everforest Light
  "everforest-light": {
    "--background": "#fdf6e3",
    "--foreground": "#5c6a72",
    "--card": "#f4f0d9",
    "--card-foreground": "#5c6a72",
    "--popover": "#f4f0d9",
    "--popover-foreground": "#5c6a72",
    "--primary": "#8da101",
    "--primary-foreground": "#fdf6e3",
    "--secondary": "#edeada",
    "--secondary-foreground": "#5c6a72",
    "--muted": "#edeada",
    "--muted-foreground": "#829181",
    "--accent": "#edeada",
    "--accent-foreground": "#5c6a72",
    "--border": "rgba(92,106,114,0.15)",
    "--input": "rgba(92,106,114,0.12)",
    "--ring": "#8da101",
    "--sidebar": "#f4f0d9",
    "--sidebar-foreground": "#5c6a72",
    "--sidebar-border": "rgba(92,106,114,0.15)",
  },
  uwu: {
    "--background": "#fff1f8",
    "--foreground": "#3b0a2a",
    "--card": "#ffe4f2",
    "--card-foreground": "#3b0a2a",
    "--popover": "#ffe4f2",
    "--popover-foreground": "#3b0a2a",
    "--primary": "#ff4fa3",
    "--primary-foreground": "#ffffff",
    "--secondary": "#ffd1e8",
    "--secondary-foreground": "#3b0a2a",
    "--muted": "#ffd1e8",
    "--muted-foreground": "rgba(59,10,42,0.6)",
    "--accent": "#ffd1e8",
    "--accent-foreground": "#3b0a2a",
    "--border": "rgba(59,10,42,0.15)",
    "--input": "rgba(59,10,42,0.12)",
    "--ring": "#ff4fa3",
    "--sidebar": "#ffe4f2",
    "--sidebar-foreground": "#3b0a2a",
    "--sidebar-border": "rgba(59,10,42,0.15)",
  },
};

// Which base class (dark/light) each theme uses
export const THEME_BASE: Record<string, "dark" | "light"> = {
  light: "light",
  dark: "dark",
  system: "dark", // resolved dynamically
  "solarized-light": "light",
  "nord-dark": "dark",
  "catppuccin-mocha": "dark",
  "catppuccin-latte": "light",
  "gruvbox-dark": "dark",
  "gruvbox-light": "light",
  "tokyo-night": "dark",
  "everforest-light": "light",
  uwu: "light",
};

export function applyThemeModeToDocument(
  themeMode: ThemeMode,
  customThemeColors?: CustomThemeColors
) {
  const root = document.documentElement;
  const base = themeMode === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : THEME_BASE[themeMode] ?? "dark";

  root.classList.toggle("dark", base === "dark");
  root.classList.toggle("light", base === "light");

  const vars = THEME_VARS[themeMode === "system" ? base : themeMode] ?? THEME_VARS[base];
  if (vars) {
    const allVarKeys = new Set(Object.values(THEME_VARS).flatMap(Object.keys));
    allVarKeys.forEach((k) => root.style.removeProperty(k));
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  }

  const colorKeyMap: Record<string, string> = {
    background: "--background",
    foreground: "--foreground",
    sidebar: "--sidebar",
    sidebarForeground: "--sidebar-foreground",
    popover: "--popover",
    popoverForeground: "--popover-foreground",
    border: "--border",
    muted: "--muted",
    mutedForeground: "--muted-foreground",
    accent: "--accent",
    accentForeground: "--accent-foreground",
    primary: "--primary",
    primaryForeground: "--primary-foreground",
  };
  Object.entries(customThemeColors ?? {}).forEach(([key, val]) => {
    if (val && colorKeyMap[key]) root.style.setProperty(colorKeyMap[key], val);
  });
}

/**
 * Syncs the zustand theme state to the <html> element's class list and CSS vars.
 */
export function ThemeSync() {
  const theme = useEditorStore((s) => s.theme);
  const themeMode = useEditorStore((s) => s.settings.themeMode);
  const customThemeColors = useEditorStore((s) => s.settings.customThemeColors);
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
    const systemWantsDark = mq.matches;
    if (systemWantsDark && theme === "light") toggleTheme();
    if (!systemWantsDark && theme === "dark") toggleTheme();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [hydrated, themeMode, toggleTheme, theme]);

  // Apply theme class + CSS vars
  useEffect(() => {
    if (!hydrated) return;

    const base = themeMode === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : THEME_BASE[themeMode] ?? (theme === "dark" ? "dark" : "light");

    if (isTauri()) {
      (async () => {
        try {
          const { getCurrentWindow } = await import("@tauri-apps/api/window");
          await getCurrentWindow().setTheme(base);
        } catch {
          // ignore
        }
      })();
    }

    applyThemeModeToDocument(themeMode, customThemeColors);
  }, [hydrated, theme, themeMode, customThemeColors]);

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
