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

const THEME_OPTIONS: Array<{ id: ThemeMode; label: string; description: string }> = [
  { id: "light", label: "Light", description: "Clean white background" },
  { id: "dark", label: "Dark", description: "Classic dark theme" },
  { id: "system", label: "System", description: "Follow OS preference" },
  { id: "solarized-light", label: "Solarized Light", description: "Warm low-contrast" },
  { id: "nord-dark", label: "Nord Dark", description: "Arctic blue dark" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", description: "Pastel dark" },
  { id: "catppuccin-latte", label: "Catppuccin Latte", description: "Pastel light" },
  { id: "gruvbox-dark", label: "Gruvbox Dark", description: "Retro groove dark" },
  { id: "gruvbox-light", label: "Gruvbox Light", description: "Retro groove light" },
  { id: "tokyo-night", label: "Tokyo Night", description: "Vibrant city-lights dark" },
  { id: "everforest-light", label: "Everforest Light", description: "Natural earthy light" },
  { id: "uwu", label: "uwu", description: "Cute pastel pink" },
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
