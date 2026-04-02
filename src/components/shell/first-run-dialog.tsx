"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useEditorStore, type Settings } from "@/lib/store";
import { isTauri, signIn } from "@/lib/tauri";
import { useAuthState } from "@/components/convex-client-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FolderOpen, LogIn, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { EditorGuideContent } from "@/components/shell/editor-guide-content";

const FIRST_RUN_STORAGE_KEY = "markup-first-run-tutorial-complete";
export const REPLAY_TUTORIAL_EVENT = "markup-replay-first-run-tutorial";

const TUTORIAL_THEMES: {
  label: string;
  value: Settings["themeMode"];
  preview: { bg: string; sidebar: string; text: string; accent: string };
}[] = [
  { label: "Dark", value: "dark", preview: { bg: "#1a1a1a", sidebar: "#242424", text: "#e5e5e5", accent: "#7c3aed" } },
  { label: "Light", value: "light", preview: { bg: "#ffffff", sidebar: "#f5f5f5", text: "#1a1a1a", accent: "#7c3aed" } },
  { label: "System", value: "system", preview: { bg: "#e8e8e8", sidebar: "#d0d0d0", text: "#333333", accent: "#7c3aed" } },
  { label: "Solarized Light", value: "solarized-light", preview: { bg: "#fdf6e3", sidebar: "#eee8d5", text: "#657b83", accent: "#268bd2" } },
  { label: "Nord Dark", value: "nord-dark", preview: { bg: "#2e3440", sidebar: "#3b4252", text: "#eceff4", accent: "#88c0d0" } },
  { label: "Catppuccin Mocha", value: "catppuccin-mocha", preview: { bg: "#1e1e2e", sidebar: "#181825", text: "#cdd6f4", accent: "#cba6f7" } },
  { label: "Catppuccin Latte", value: "catppuccin-latte", preview: { bg: "#eff1f5", sidebar: "#e6e9ef", text: "#4c4f69", accent: "#8839ef" } },
  { label: "Gruvbox Dark", value: "gruvbox-dark", preview: { bg: "#282828", sidebar: "#3c3836", text: "#ebdbb2", accent: "#d79921" } },
  { label: "Gruvbox Light", value: "gruvbox-light", preview: { bg: "#fbf1c7", sidebar: "#f2e5bc", text: "#3c3836", accent: "#b57614" } },
  { label: "Tokyo Night", value: "tokyo-night", preview: { bg: "#1a1b26", sidebar: "#16161e", text: "#c0caf5", accent: "#7aa2f7" } },
  { label: "Everforest Light", value: "everforest-light", preview: { bg: "#fdf6e3", sidebar: "#f4f0d9", text: "#5c6a72", accent: "#8da101" } },
  { label: "uwu", value: "uwu", preview: { bg: "#fff1f8", sidebar: "#ffe4f2", text: "#3b0a2a", accent: "#ff4fa3" } },
];

const QUICK_FONTS: { label: string; value: string }[] = [
  { label: "System Mono", value: "var(--font-geist-mono), ui-monospace, monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Sans", value: "var(--font-geist-sans), ui-sans-serif, sans-serif" },
];

export function FirstRunDialog() {
  const hydrated = useEditorStore((s) => s._hydrated);
  const settings = useEditorStore((s) => s.settings);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const localSyncFolder = useEditorStore((s) => s.localSyncFolder);
  const setLocalSyncFolder = useEditorStore((s) => s.setLocalSyncFolder);
  const { isAuthenticated, isLoading: authLoading } = useAuthState();

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(FIRST_RUN_STORAGE_KEY) === "true";
  });
  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

  useEffect(() => {
    const onReplayTutorial = () => {
      localStorage.removeItem(FIRST_RUN_STORAGE_KEY);
      setStep(0);
      setDismissed(false);
    };

    document.addEventListener(REPLAY_TUTORIAL_EVENT, onReplayTutorial);
    return () => document.removeEventListener(REPLAY_TUTORIAL_EVENT, onReplayTutorial);
  }, []);

  const stepCount = 4;
  const shouldShow = hydrated && !dismissed;

  const markComplete = useCallback(() => {
    localStorage.setItem(FIRST_RUN_STORAGE_KEY, "true");
    setDismissed(true);
  }, []);

  const handleThemeModeChange = useCallback(
    (mode: Settings["themeMode"]) => {
      updateSettings({ themeMode: mode });
      const lightModes: Settings["themeMode"][] = ["light", "solarized-light", "catppuccin-latte", "gruvbox-light", "everforest-light", "uwu"];
      const darkModes: Settings["themeMode"][] = ["dark", "nord-dark", "catppuccin-mocha", "gruvbox-dark", "tokyo-night"];
      if (lightModes.includes(mode) && theme === "dark") {
        toggleTheme();
      }
      if (darkModes.includes(mode) && theme === "light") {
        toggleTheme();
      }
      if (mode === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark && theme === "light") toggleTheme();
        if (!prefersDark && theme === "dark") toggleTheme();
      }
    },
    [theme, toggleTheme, updateSettings]
  );

  const chooseSyncFolder = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, title: "Choose where to save your files" });
      if (folder) setLocalSyncFolder(folder as string);
    } catch {
      // user cancelled
    }
  }, [setLocalSyncFolder]);

  const stepTitle = useMemo(() => {
    if (step === 0) return "Welcome to Markup";
    if (step === 1) return "Configure your writing setup";
    if (step === 2) return "Markdown quick tour";
    return "Keybind quick tour";
  }, [step]);

  if (!shouldShow) return null;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) markComplete(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{stepTitle}</DialogTitle>
          <DialogDescription>
            {step === 0 && "Set up essentials in under a minute. You can change anything later in Settings."}
            {step === 1 && "Choose your theme and typography baseline so the editor feels right immediately."}
            {step === 2 && "Review markdown syntax patterns used throughout the app."}
            {step === 3 && "Review keyboard shortcuts for faster editing and navigation."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[52vh] min-h-[320px] max-h-[460px] overflow-hidden py-2">
          <div
            key={step}
            className={cn(
              "h-full overflow-y-auto pr-1 animate-in fade-in-0 duration-200",
              stepDirection > 0 ? "slide-in-from-right-4" : "slide-in-from-left-4"
            )}
          >
          {step === 0 && (
            <div className="space-y-4 h-full">
              <div className="rounded-md border border-border bg-card/50 p-4 space-y-3">
                <h4 className="text-sm font-semibold">Optional sign-in</h4>
                <p className="text-xs text-muted-foreground">
                  Sign in to sync your notes across devices. You can skip now and sign in later.
                </p>
                {!authLoading && (
                  isAuthenticated ? (
                    <div className="inline-flex items-center gap-2 rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
                      <Check className="h-3.5 w-3.5" />
                      Signed in
                    </div>
                  ) : (
                    <Button size="sm" onClick={() => signIn(() => window.location.reload())} className="gap-2">
                      <LogIn className="h-4 w-4" />
                      Sign in
                    </Button>
                  )
                )}
              </div>

              {isTauri() && (
                <div className="rounded-md border border-border bg-card/50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold">Local file sync folder</h4>
                  <p className="text-xs text-muted-foreground">
                    Keep a local mirror of your files for backup and desktop access.
                  </p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={chooseSyncFolder} className="gap-2">
                      <FolderOpen className="h-4 w-4" />
                      {localSyncFolder ? "Change folder" : "Choose folder"}
                    </Button>
                    {localSyncFolder && (
                      <span className="text-[11px] text-muted-foreground truncate">{localSyncFolder}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 h-full">
              <div>
                <h4 className="text-sm font-semibold mb-2">Theme</h4>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TUTORIAL_THEMES.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleThemeModeChange(option.value)}
                      className={cn(
                        "rounded-md border p-2 text-left transition-all hover:scale-[1.01]",
                        settings.themeMode === option.value
                          ? "border-primary bg-primary/10"
                          : "border-input bg-background hover:border-muted-foreground/40"
                      )}
                    >
                      <div
                        className="mb-2 h-8 rounded overflow-hidden flex"
                        style={{ background: option.preview.bg }}
                      >
                        <div className="w-1/4 h-full" style={{ background: option.preview.sidebar }} />
                        <div className="flex-1 p-1 space-y-1">
                          <div className="h-1 rounded-full w-3/4" style={{ background: option.preview.text, opacity: 0.75 }} />
                          <div className="h-1 rounded-full w-1/2" style={{ background: option.preview.accent }} />
                        </div>
                      </div>
                      <div className="text-[11px] font-medium leading-tight text-foreground">{option.label}</div>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.bg }} />
                        <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.sidebar }} />
                        <span className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ background: option.preview.accent }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Code editor font</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {QUICK_FONTS.map((option) => (
                    <button
                      key={option.label}
                      onClick={() => updateSettings({ fontFamily: option.value })}
                      className={cn(
                        "rounded-md border px-3 py-2 text-left text-xs transition-colors",
                        settings.fontFamily === option.value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-input bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Font size</h4>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={12}
                    max={22}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                    className="flex-1 h-1.5 accent-primary cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground w-12 text-right tabular-nums">
                    {settings.fontSize}px
                  </span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <EditorGuideContent compact className="pr-1" showMarkdownSection showKeybindsSection={false} />
          )}

          {step === 3 && (
            <EditorGuideContent compact className="pr-1" showMarkdownSection={false} showKeybindsSection />
          )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3 mt-2">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: stepCount }).map((_, idx) => (
              <span
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === step ? "w-6 bg-primary" : "w-2 bg-muted"
                )}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStepDirection(-1);
                  setStep((s) => Math.max(0, s - 1));
                }}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={markComplete}>Skip</Button>
            )}

            {step < stepCount - 1 ? (
              <Button
                size="sm"
                onClick={() => {
                  setStepDirection(1);
                  setStep((s) => Math.min(stepCount - 1, s + 1));
                }}
                className="gap-1.5"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" onClick={markComplete} className="gap-1.5">
                Finish
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
