"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CustomThemeColors, ThemeMode } from "@/lib/store";
import { applyThemeModeToDocument } from "@/components/theme-provider";

const PUBLIC_THEME_STORAGE_KEY = "markup-public-theme-mode";

const THEME_OPTIONS: Array<{
  id: ThemeMode;
  label: string;
  description: string;
  preview: { bg: string; sidebar: string; text: string; accent: string };
}> = [
  { id: "light", label: "Light", description: "Clean white background", preview: { bg: "#ffffff", sidebar: "#f5f5f5", text: "#1a1a1a", accent: "#7c3aed" } },
  { id: "dark", label: "Dark", description: "Classic dark theme", preview: { bg: "#1a1a1a", sidebar: "#242424", text: "#e5e5e5", accent: "#7c3aed" } },
  { id: "system", label: "System", description: "Follow OS preference", preview: { bg: "#e8e8e8", sidebar: "#d0d0d0", text: "#333333", accent: "#7c3aed" } },
  { id: "solarized-light", label: "Solarized Light", description: "Warm low-contrast", preview: { bg: "#fdf6e3", sidebar: "#eee8d5", text: "#657b83", accent: "#268bd2" } },
  { id: "nord-dark", label: "Nord Dark", description: "Arctic blue dark", preview: { bg: "#2e3440", sidebar: "#3b4252", text: "#eceff4", accent: "#88c0d0" } },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", description: "Pastel dark", preview: { bg: "#1e1e2e", sidebar: "#181825", text: "#cdd6f4", accent: "#cba6f7" } },
  { id: "catppuccin-latte", label: "Catppuccin Latte", description: "Pastel light", preview: { bg: "#eff1f5", sidebar: "#e6e9ef", text: "#4c4f69", accent: "#8839ef" } },
  { id: "gruvbox-dark", label: "Gruvbox Dark", description: "Retro groove dark", preview: { bg: "#282828", sidebar: "#3c3836", text: "#ebdbb2", accent: "#d79921" } },
  { id: "gruvbox-light", label: "Gruvbox Light", description: "Retro groove light", preview: { bg: "#fbf1c7", sidebar: "#f2e5bc", text: "#3c3836", accent: "#b57614" } },
  { id: "tokyo-night", label: "Tokyo Night", description: "Vibrant city-lights dark", preview: { bg: "#1a1b26", sidebar: "#16161e", text: "#c0caf5", accent: "#7aa2f7" } },
  { id: "everforest-light", label: "Everforest Light", description: "Natural earthy light", preview: { bg: "#fdf6e3", sidebar: "#f4f0d9", text: "#5c6a72", accent: "#8da101" } },
  { id: "uwu", label: "uwu", description: "Cute pastel pink", preview: { bg: "#fff1f8", sidebar: "#ffe4f2", text: "#3b0a2a", accent: "#ff4fa3" } },
];

function isThemeMode(value: string): value is ThemeMode {
  return THEME_OPTIONS.some((option) => option.id === value);
}

interface PublicThemeMenuProps {
  loggedIn: boolean;
  workspaceThemeMode?: ThemeMode | null;
  workspaceCustomThemeColors?: CustomThemeColors | null;
}

export function PublicThemeMenu({
  loggedIn,
  workspaceThemeMode,
  workspaceCustomThemeColors,
}: PublicThemeMenuProps) {
  const [guestTheme, setGuestTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = window.localStorage.getItem(PUBLIC_THEME_STORAGE_KEY);
    return saved && isThemeMode(saved) ? saved : "system";
  });
  const [loggedInOverrideTheme, setLoggedInOverrideTheme] = useState<ThemeMode | null>(null);

  const effectiveTheme = loggedIn
    ? (loggedInOverrideTheme ?? workspaceThemeMode ?? "system")
    : guestTheme;

  const activeCustomColors = useMemo(() => {
    if (!loggedIn) return undefined;
    if (!workspaceThemeMode || effectiveTheme !== workspaceThemeMode) return undefined;
    return workspaceCustomThemeColors ?? undefined;
  }, [effectiveTheme, loggedIn, workspaceCustomThemeColors, workspaceThemeMode]);

  useEffect(() => {
    applyThemeModeToDocument(effectiveTheme, activeCustomColors);
    if (!loggedIn) {
      window.localStorage.setItem(PUBLIC_THEME_STORAGE_KEY, guestTheme);
    }
  }, [activeCustomColors, effectiveTheme, guestTheme, loggedIn]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs">
          <Palette className="h-3.5 w-3.5" />
          Theme
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => {
              if (loggedIn) {
                setLoggedInOverrideTheme(option.id);
                return;
              }
              setGuestTheme(option.id);
            }}
            className="flex items-start gap-2 py-2"
          >
            <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${effectiveTheme === option.id ? "opacity-100" : "opacity-0"}`} />
            <span className="flex-1">
              <span className="block text-xs font-medium leading-tight">{option.label}</span>
              <span className="block text-[10px] text-muted-foreground leading-tight">{option.description}</span>
              <span className="mt-1.5 flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.bg }} />
                <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.sidebar }} />
                <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.text }} />
                <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.accent }} />
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        {loggedIn && loggedInOverrideTheme && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLoggedInOverrideTheme(null)} className="text-xs text-muted-foreground">
              Use account default theme
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
