"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Settings,
  X,
  Palette,
  User,
  Type,
  FileText,
  PenTool,
  Shield,
  Monitor,
  Eye,
  Database,
  Lock,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  HardDrive,
  Timer,
  Info,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { apiBase, getClientAuthToken, openExternal, signOut, isTauri } from "@/lib/tauri";
import { useEditorStore, DEFAULT_SETTINGS, type Settings as SettingsType } from "@/lib/store";
import { useIsMobile } from "@/lib/use-mobile";
import { WorkOsWidgets, UserProfile, UserSessions, UserSecurity } from "@workos-inc/widgets";

// ---------------------------------------------------------------------------
// Sidebar sections
// ---------------------------------------------------------------------------

type SectionId = "general" | "user" | "appearance" | "typography" | "markdown" | "editing" | "privacy" | "data" | "about";

const SECTIONS: { id: SectionId; label: string; icon: typeof Settings; group?: string }[] = [
  { id: "general", label: "General", icon: Palette },
  { id: "user", label: "User", icon: User },
  { id: "appearance", label: "Appearance", icon: Eye },
  { id: "typography", label: "Typography", icon: Type, group: "Editor" },
  { id: "markdown", label: "Markdown", icon: FileText, group: "Editor" },
  { id: "editing", label: "Editing", icon: PenTool, group: "Editor" },
  { id: "privacy", label: "Privacy & Security", icon: Lock, group: "Account" },
  { id: "data", label: "Data", icon: Database, group: "Account" },
  { id: "about", label: "About & Contact", icon: Info },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FONT_OPTIONS = [
  { label: "System Mono", value: "var(--font-geist-mono), ui-monospace, monospace" },
  { label: "JetBrains Mono", value: "'JetBrains Mono', ui-monospace, monospace" },
  { label: "Fira Code", value: "'Fira Code', ui-monospace, monospace" },
  { label: "Source Code Pro", value: "'Source Code Pro', ui-monospace, monospace" },
  { label: "IBM Plex Mono", value: "'IBM Plex Mono', ui-monospace, monospace" },
  { label: "Sans-serif", value: "var(--font-geist-sans), ui-sans-serif, sans-serif" },
  { label: "Custom…", value: "__custom__" },
];

const ACCENT_PRESETS = [
  "#7c3aed", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6",
  "#22c55e", "#eab308", "#f97316", "#f43f5e", "#ec4899",
];

// ---------------------------------------------------------------------------
// Small reusable controls
// ---------------------------------------------------------------------------

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
      <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
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

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-col">
        <span className="text-xs text-foreground">{label}</span>
        {description && (
          <span className="text-[11px] text-muted-foreground">{description}</span>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-3.5 w-3.5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  );
}

function SelectRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section contents
// ---------------------------------------------------------------------------

function GeneralSection({
  settings,
  update,
  reset,
}: {
  settings: SettingsType;
  update: (p: Partial<SettingsType>) => void;
  reset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Accent Color</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customize the accent color used across the UI
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => update({ accentColor: c })}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                settings.accentColor === c
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
          <label
            className={cn(
              "relative h-7 w-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 overflow-hidden",
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
              onChange={(e) => update({ accentColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <Separator />

      <ToggleRow
        label="Hide .md extensions"
        description="Hide markdown file extensions in the sidebar"
        checked={settings.hideMdExtensions}
        onChange={(v) => update({ hideMdExtensions: v })}
      />

      <Separator />

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={reset}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset all settings to defaults
        </Button>
      </div>
    </div>
  );
}

function UserSection() {
  const [widgetTab, setWidgetTab] = useState<"profile" | "sessions" | "security">("profile");
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [widgetTimedOut, setWidgetTimedOut] = useState(false);
  const fetchedRef = useRef(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Timeout: if auth token isn't fetched within 8 seconds, show failure
    const timeout = setTimeout(() => {
      setFetchFailed(true);
    }, 8000);

    (async () => {
      try {
        const data = await getClientAuthToken();
        clearTimeout(timeout);
        if (data.accessToken) {
          setAuthToken(data.accessToken);
          // Use sessionId if available, fall back to a placeholder to unblock widgets
          setSessionId(data.sessionId ?? "current");
        } else {
          setFetchFailed(true);
        }
      } catch (err) {
        clearTimeout(timeout);
        console.error("[WorkOS] Failed to fetch auth token", err);
        setFetchFailed(true);
      }
    })();

    return () => clearTimeout(timeout);
  }, [retryKey]);

  // Timeout for widget loading: if widgets don't render within 10s, show fallback
  useEffect(() => {
    if (!authToken || !sessionId) return;
    const timeout = setTimeout(() => {
      setWidgetTimedOut(true);
    }, 10000);
    return () => clearTimeout(timeout);
  }, [authToken, sessionId]);

  const tabs: { id: "profile" | "sessions" | "security"; label: string; icon: typeof User }[] = [
    { id: "profile", label: "Profile", icon: User },
    { id: "sessions", label: "Sessions", icon: Monitor },
    { id: "security", label: "Security", icon: Shield },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">Account</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Manage your profile, sessions, and security settings
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setWidgetTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              widgetTab === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Widget */}
      <div className="min-h-[200px] max-h-[320px] overflow-y-auto [&_*]:!bg-transparent [&_*]:!font-inherit [&_iframe]:max-h-[280px]">
        {authToken && sessionId && !widgetTimedOut ? (
          <WorkOsWidgets
            apiHostname={apiBase() ? new URL(apiBase()).hostname : window.location.hostname}
            port={apiBase() ? null : window.location.port ? Number(window.location.port) : null}
            https={apiBase() ? apiBase().startsWith("https://") : window.location.protocol === "https:"}
          >
            <div style={{ display: widgetTab === "profile" ? "contents" : "none" }}>
              <UserProfile authToken={authToken} />
            </div>
            <div style={{ display: widgetTab === "sessions" ? "contents" : "none" }}>
              <UserSessions authToken={authToken} currentSessionId={sessionId} />
            </div>
            <div style={{ display: widgetTab === "security" ? "contents" : "none" }}>
              <UserSecurity authToken={authToken} />
            </div>
          </WorkOsWidgets>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            {fetchFailed || widgetTimedOut
              ? (
                <>
                  <p>Unable to load account widgets</p>
                  <p className="text-xs">
                    {isTauri()
                      ? "Check your internet connection. You can also manage your account in the browser."
                      : "Check your connection and try refreshing."}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFetchFailed(false);
                        setWidgetTimedOut(false);
                        setAuthToken(null);
                        setSessionId(null);
                        fetchedRef.current = false;
                        setRetryKey((k) => k + 1);
                      }}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                    {isTauri() && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const base = apiBase();
                          if (base) {
                            openExternal(`${base}/settings/account`);
                          }
                        }}
                      >
                        Open in browser
                      </Button>
                    )}
                  </div>
                </>
              )
              : "Loading authentication…"
            }
          </div>
        )}
      </div>
    </div>
  );
}

function TypographySection({
  settings,
  update,
}: {
  settings: SettingsType;
  update: (p: Partial<SettingsType>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Typography</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customize fonts, sizes, and spacing for the editor
        </p>
      </div>

      <SelectRow
        label="Font Family"
        value={FONT_OPTIONS.some((o) => o.value === settings.fontFamily) ? settings.fontFamily : "__custom__"}
        options={FONT_OPTIONS}
        onChange={(v) => {
          if (v === "__custom__") {
            update({
              fontFamily: settings.customFontFamily || settings.fontFamily,
            });
          } else {
            update({
              fontFamily: v,
              customFontFamily: null,
            });
          }
        }}
      />

      {(!FONT_OPTIONS.some((o) => o.value === settings.fontFamily) || settings.customFontFamily) && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Custom Font Family</label>
          <input
            type="text"
            value={settings.customFontFamily ?? settings.fontFamily}
            onChange={(e) =>
              update({
                customFontFamily: e.target.value || null,
                fontFamily: e.target.value || DEFAULT_SETTINGS.fontFamily,
              })
            }
            placeholder={`e.g. "Fira Code", ui-monospace, monospace`}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-[11px] text-muted-foreground">
            Uses a CSS <code>font-family</code> stack. Fonts must be installed on this device to render correctly.
          </p>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <RangeRow
          label="Font Size"
          value={settings.fontSize}
          min={10}
          max={24}
          step={1}
          unit="px"
          onChange={(v) => update({ fontSize: v })}
        />
        <RangeRow
          label="Line Height"
          value={settings.lineHeight}
          min={1.2}
          max={2.4}
          step={0.1}
          unit=""
          onChange={(v) => update({ lineHeight: v })}
        />
        <RangeRow
          label="Letter Spacing"
          value={settings.letterSpacing}
          min={-0.05}
          max={0.2}
          step={0.01}
          unit="em"
          onChange={(v) => update({ letterSpacing: v })}
        />
        <RangeRow
          label="Tab Size"
          value={settings.tabSize}
          min={1}
          max={8}
          step={1}
          unit=""
          onChange={(v) => update({ tabSize: v })}
        />
        <RangeRow
          label="Editor Margin"
          value={settings.editorMargin}
          min={0}
          max={80}
          step={4}
          unit="px"
          onChange={(v) => update({ editorMargin: v })}
        />
        <RangeRow
          label="Max Line Width"
          value={settings.maxLineWidth}
          min={0}
          max={200}
          step={10}
          unit="ch"
          onChange={(v) => update({ maxLineWidth: v })}
        />
      </div>

      <Separator />

      <ToggleRow
        label="Show invisible characters"
        description="Display spaces, tabs, and line breaks"
        checked={settings.showInvisibleCharacters}
        onChange={(v) => update({ showInvisibleCharacters: v })}
      />
    </div>
  );
}

function MarkdownSection({
  settings,
  update,
}: {
  settings: SettingsType;
  update: (p: Partial<SettingsType>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Markdown</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customize markdown editing behaviour
        </p>
      </div>

      <div className="space-y-4">
        <ToggleRow
          label="Auto-close brackets"
          description="Automatically insert closing brackets and quotes"
          checked={settings.autoCloseBrackets}
          onChange={(v) => update({ autoCloseBrackets: v })}
        />
        <ToggleRow
          label="Auto-close markdown formatting"
          description="Close **, *, ~~ etc. automatically"
          checked={settings.autoCloseMarkdownFormatting}
          onChange={(v) => update({ autoCloseMarkdownFormatting: v })}
        />
        <ToggleRow
          label="Auto-format lists"
          description="Automatically format and re-number lists"
          checked={settings.autoFormatLists}
          onChange={(v) => update({ autoFormatLists: v })}
        />
        <ToggleRow
          label="Continue list on Enter"
          description="Pressing Enter in a list continues the list marker"
          checked={settings.continueListOnEnter}
          onChange={(v) => update({ continueListOnEnter: v })}
        />
        <ToggleRow
          label="Smart quotes"
          description='Convert straight quotes to "curly" quotes'
          checked={settings.smartQuotes}
          onChange={(v) => update({ smartQuotes: v })}
        />
        <ToggleRow
          label="Smart dashes"
          description="Convert -- to em dash and --- to en dash"
          checked={settings.smartDashes}
          onChange={(v) => update({ smartDashes: v })}
        />
        <ToggleRow
          label="Convert tabs to spaces"
          description="Insert spaces instead of tab characters"
          checked={settings.convertTabsToSpaces}
          onChange={(v) => update({ convertTabsToSpaces: v })}
        />
      </div>
    </div>
  );
}

function EditingSection({
  settings,
  update,
}: {
  settings: SettingsType;
  update: (p: Partial<SettingsType>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Editing</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Configure editor behavior and visual feedback
        </p>
      </div>

      <div className="space-y-4">
        <ToggleRow
          label="Word wrap"
          description="Wrap long lines to fit the editor width"
          checked={settings.wordWrap}
          onChange={(v) => update({ wordWrap: v })}
        />
        <ToggleRow
          label="Highlight current line"
          description="Highlight the line the cursor is on"
          checked={settings.highlightCurrentLine}
          onChange={(v) => update({ highlightCurrentLine: v })}
        />
        <ToggleRow
          label="Highlight matching brackets"
          description="Show matching bracket pairs"
          checked={settings.highlightMatchingBrackets}
          onChange={(v) => update({ highlightMatchingBrackets: v })}
        />
        <ToggleRow
          label="Multi-cursor support"
          description="Allow multiple cursors with Alt+Click"
          checked={settings.multiCursorSupport}
          onChange={(v) => update({ multiCursorSupport: v })}
        />
      </div>

      <Separator />

      <SelectRow
        label="Cursor Animation"
        value={settings.cursorAnimation}
        options={[
          { label: "Blink", value: "blink" },
          { label: "Smooth", value: "smooth" },
          { label: "None", value: "none" },
        ]}
        onChange={(v) => update({ cursorAnimation: v as SettingsType["cursorAnimation"] })}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Privacy & Security section
// ---------------------------------------------------------------------------

function PrivacySecuritySection() {
  const [autoLockTimeout, setAutoLockTimeout] = useState(0); // 0 = disabled

  const handleDeleteAccount = useCallback(async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
    if (!window.confirm("This will permanently delete all your data. Type 'DELETE' below to confirm.")) return;
    const input = window.prompt("Type DELETE to confirm account deletion:");
    if (input !== "DELETE") return;
    try {
      signOut(() => window.location.reload());
    } catch {
      console.error("Failed to delete account");
    }
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Privacy & Security</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Manage your security preferences and account
        </p>
      </div>

      {/* Auto-lock timeout */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Auto-lock Timeout</label>
        <p className="text-[11px] text-muted-foreground mb-2">
          Automatically lock the app after a period of inactivity
        </p>
        <select
          value={autoLockTimeout}
          onChange={(e) => setAutoLockTimeout(Number(e.target.value))}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
        >
          <option value={0}>Disabled</option>
          <option value={5}>5 minutes</option>
          <option value={15}>15 minutes</option>
          <option value={30}>30 minutes</option>
          <option value={60}>1 hour</option>
        </select>
      </div>

      <Separator />

      {/* Data export */}
      <div>
        <h4 className="text-xs font-medium mb-1">Data Export</h4>
        <p className="text-[11px] text-muted-foreground mb-2">
          Download a copy of all your personal data
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            const { get } = await import("idb-keyval");
            const state = await get("markup-state");
            if (!state) return;
            const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "markup-personal-data.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="gap-1.5 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          Export Personal Data
        </Button>
      </div>

      <Separator />

      {/* Delete account */}
      <div>
        <h4 className="text-xs font-medium text-destructive mb-1">Danger Zone</h4>
        <p className="text-[11px] text-muted-foreground mb-2">
          Permanently delete your account and all associated data
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteAccount}
          className="gap-1.5 text-xs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Account
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data section
// ---------------------------------------------------------------------------

function DataSection({
  settings,
  update,
  reset,
}: {
  settings: SettingsType;
  update: (p: Partial<SettingsType>) => void;
  reset: () => void;
}) {
  const tabs = useEditorStore((s) => s.tabs);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportNotes = useCallback(async () => {
    if (tabs.length === 0) return;
    const dataStr = JSON.stringify(
      tabs.map((t) => ({ title: t.title, content: t.content, tags: t.tags })),
      null,
      2
    );
    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: "markup-notes.json", filters: [{ name: "JSON", extensions: ["json"] }] });
        if (filePath) { await writeTextFile(filePath, dataStr); }
        return;
      } catch { /* fall through */ }
    }
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markup-notes.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [tabs]);

  const handleExportWorkspace = useCallback(async () => {
    const { get } = await import("idb-keyval");
    const state = await get("markup-state");
    if (!state) return;
    const dataStr = JSON.stringify(state, null, 2);
    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: "markup-workspace-backup.json", filters: [{ name: "JSON", extensions: ["json"] }] });
        if (filePath) { await writeTextFile(filePath, dataStr); }
        return;
      } catch { /* fall through */ }
    }
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markup-workspace-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportMarkdown = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setImporting(true);
      const createTab = useEditorStore.getState().createTab;

      const readPromises = Array.from(files).map(
        (file) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const content = reader.result as string;
              const title = file.name.endsWith(".md") ? file.name : file.name + ".md";
              createTab();
              const state = useEditorStore.getState();
              const newTab = state.tabs[state.tabs.length - 1];
              if (newTab) {
                useEditorStore.setState({
                  tabs: state.tabs.map((t) =>
                    t.id === newTab.id ? { ...t, title, content } : t
                  ),
                });
              }
              resolve();
            };
            reader.readAsText(file);
          })
      );

      Promise.all(readPromises).then(() => {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
    },
    []
  );

  const handleRebuildSearchIndex = useCallback(() => {
    // Dispatch event for any search index rebuild logic
    document.dispatchEvent(new CustomEvent("rebuild-search-index"));
    alert("Search index has been rebuilt.");
  }, []);

  const handleResetSettings = useCallback(() => {
    if (!window.confirm("Reset all settings to defaults? This cannot be undone.")) return;
    reset();
  }, [reset]);

  const handleBackupWorkspace = useCallback(async () => {
    const { get } = await import("idb-keyval");
    const state = await get("markup-state");
    if (!state) return;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `markup-backup-${timestamp}.json`;
    const dataStr = JSON.stringify(state, null, 2);
    if (isTauri()) {
      try {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: filename, filters: [{ name: "JSON", extensions: ["json"] }] });
        if (filePath) { await writeTextFile(filePath, dataStr); }
        return;
      } catch { /* fall through */ }
    }
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const localSyncFolder = useEditorStore((s) => s.localSyncFolder);
  const setLocalSyncFolder = useEditorStore((s) => s.setLocalSyncFolder);

  const handleChooseSyncFolder = useCallback(async () => {
    if (!isTauri()) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({
        directory: true,
        title: "Choose local sync folder",
      });
      if (folder) {
        setLocalSyncFolder(folder as string);
      }
    } catch {
      // Dialog cancelled or not available
    }
  }, [setLocalSyncFolder]);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-1">Data Management</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Export, import, and manage your workspace data
        </p>
      </div>

      {/* Local File Sync (Tauri only) */}
      {isTauri() && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-foreground">Local File Sync</span>
              <p className="text-[11px] text-muted-foreground">
                {localSyncFolder
                  ? `Syncing to: ${localSyncFolder}`
                  : "Sync files to a local folder"}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleChooseSyncFolder}
                className="gap-1.5 text-xs"
              >
                <HardDrive className="h-3.5 w-3.5" />
                {localSyncFolder ? "Change" : "Choose Folder"}
              </Button>
              {localSyncFolder && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalSyncFolder(null)}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Export notes */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground">Export Notes</span>
          <p className="text-[11px] text-muted-foreground">Download all notes as JSON</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportNotes} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      <Separator />

      {/* Import markdown */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground">Import Markdown</span>
          <p className="text-[11px] text-muted-foreground">Import .md files into your workspace</p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            multiple
            onChange={handleImportMarkdown}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="gap-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? "Importing…" : "Import"}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Export workspace */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground">Export Workspace</span>
          <p className="text-[11px] text-muted-foreground">Download full workspace state</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportWorkspace} className="gap-1.5 text-xs">
          <HardDrive className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      <Separator />

      {/* Rebuild search index */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground">Rebuild Search Index</span>
          <p className="text-[11px] text-muted-foreground">Rebuild the full-text search index</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRebuildSearchIndex} className="gap-1.5 text-xs">
          <RotateCcw className="h-3.5 w-3.5" />
          Rebuild
        </Button>
      </div>

      <Separator />

      {/* Reset settings */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground">Reset Settings</span>
          <p className="text-[11px] text-muted-foreground">Reset all settings to defaults</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleResetSettings} className="gap-1.5 text-xs text-destructive hover:text-destructive">
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      <Separator />

      {/* Backup workspace */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-foreground">Backup Workspace</span>
          <p className="text-[11px] text-muted-foreground">Create a timestamped backup of everything</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleBackupWorkspace} className="gap-1.5 text-xs">
          <Download className="h-3.5 w-3.5" />
          Backup
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Appearance section
// ---------------------------------------------------------------------------

const CODE_BLOCK_THEMES = [
  { label: "GitHub", value: "github" },
  { label: "Monokai", value: "monokai" },
  { label: "Dracula", value: "dracula" },
  { label: "Nord", value: "nord" },
  { label: "One Dark", value: "one-dark" },
  { label: "Solarized", value: "solarized" },
];

const HEADING_STYLES = [
  { label: "Default", value: "default" },
  { label: "Underlined", value: "underlined" },
  { label: "Bordered", value: "bordered" },
  { label: "Highlighted", value: "highlighted" },
];

const LINK_STYLES = [
  { label: "Default", value: "default" },
  { label: "Underlined", value: "underlined" },
  { label: "Colored", value: "colored" },
  { label: "Button", value: "button" },
];

const CHECKBOX_STYLES = [
  { label: "Default", value: "default" },
  { label: "Rounded", value: "rounded" },
  { label: "Filled", value: "filled" },
  { label: "Minimal", value: "minimal" },
];

const ICON_THEMES = [
  { label: "Default", value: "default" },
  { label: "Minimal", value: "minimal" },
  { label: "Colorful", value: "colorful" },
];

function AppearanceSection({
  settings,
  update,
  theme,
  toggleTheme,
}: {
  settings: SettingsType;
  update: (p: Partial<SettingsType>) => void;
  theme: string;
  toggleTheme: () => void;
}) {
  const handleThemeModeChange = (mode: string) => {
    update({ themeMode: mode as SettingsType["themeMode"] });
    // Also apply the actual theme immediately
    if (mode === "light") {
      if (theme === "dark") toggleTheme();
    } else if (mode === "dark") {
      if (theme === "light") toggleTheme();
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark && theme === "light") toggleTheme();
      if (!prefersDark && theme === "dark") toggleTheme();
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Theme ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Theme</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Choose your preferred color scheme
        </p>
      </div>

      {/* Theme mode buttons */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Mode</label>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => handleThemeModeChange(mode)}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-xs font-medium capitalize transition-colors",
                settings.themeMode === mode
                  ? "border-foreground bg-accent text-accent-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Accent colour */}
      <div>
        <label className="text-xs text-muted-foreground">Accent Color</label>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {ACCENT_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => update({ accentColor: c })}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                settings.accentColor === c
                  ? "border-foreground scale-110"
                  : "border-transparent"
              )}
              style={{ background: c }}
            />
          ))}
          <label
            className={cn(
              "relative h-7 w-7 rounded-full border-2 cursor-pointer transition-transform hover:scale-110 overflow-hidden",
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
              onChange={(e) => update({ accentColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
      </div>

      <Separator />

      {/* ── UI ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-1">UI</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customize the interface layout and behavior
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Sidebar Position</label>
        <div className="flex gap-2">
          {(["left", "right"] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => update({ sidebarPosition: pos })}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-xs font-medium capitalize transition-colors",
                settings.sidebarPosition === pos
                  ? "border-foreground bg-accent text-accent-foreground"
                  : "border-input bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <RangeRow
        label="Sidebar Width"
        value={settings.sidebarWidth}
        min={36}
        max={64}
        step={4}
        unit="px"
        onChange={(v) => update({ sidebarWidth: v })}
      />

      <div className="space-y-4">
        <ToggleRow
          label="Compact mode"
          description="Reduce padding and spacing across the UI"
          checked={settings.compactMode}
          onChange={(v) => update({ compactMode: v })}
        />
        <ToggleRow
          label="Show icons in sidebar"
          description="Display icons next to sidebar items"
          checked={settings.showIconsInSidebar}
          onChange={(v) => update({ showIconsInSidebar: v })}
        />
        <ToggleRow
          label="Show file extensions"
          description="Display .md extensions in the file tree"
          checked={settings.showFileExtensions}
          onChange={(v) => update({ showFileExtensions: v })}
        />
      </div>

      <SelectRow
        label="Icon Theme"
        value={settings.iconTheme}
        options={ICON_THEMES}
        onChange={(v) => update({ iconTheme: v as SettingsType["iconTheme"] })}
      />

      <Separator />

      {/* ── Editor Look ──────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold mb-1">Editor Look</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Customize how content appears in the preview
        </p>
      </div>

      <div className="space-y-4">
        <SelectRow
          label="Code Block Theme"
          value={settings.codeBlockTheme}
          options={CODE_BLOCK_THEMES}
          onChange={(v) => update({ codeBlockTheme: v as SettingsType["codeBlockTheme"] })}
        />
        <SelectRow
          label="Heading Style"
          value={settings.headingStyle}
          options={HEADING_STYLES}
          onChange={(v) => update({ headingStyle: v as SettingsType["headingStyle"] })}
        />
        <SelectRow
          label="Link Style"
          value={settings.linkStyle}
          options={LINK_STYLES}
          onChange={(v) => update({ linkStyle: v as SettingsType["linkStyle"] })}
        />
        <SelectRow
          label="Checkbox Style"
          value={settings.checkboxStyle}
          options={CHECKBOX_STYLES}
          onChange={(v) => update({ checkboxStyle: v as SettingsType["checkboxStyle"] })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// About & Contact
// ---------------------------------------------------------------------------

function AboutSection() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-1">About Markup</h3>
        <p className="text-xs text-muted-foreground mb-4">
          A minimal, powerful markdown editor with whiteboards, mindmaps, and more.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Made by Freddie Philpot</p>
            <p className="text-xs text-muted-foreground">Developer & Designer</p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <a
            href="https://github.com/pphilfre"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            <span>github.com/pphilfre</span>
          </a>
          <a
            href="https://freddiephilpot.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            <span>freddiephilpot.dev</span>
          </a>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-1">
        <p>Built with Next.js, React, and Convex</p>
        <p>© {new Date().getFullYear()} Freddie Philpot. All rights reserved.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main settings panel
// ---------------------------------------------------------------------------

export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>("general");
  const settings = useEditorStore((s) => s.settings);
  const updateSettings = useEditorStore((s) => s.updateSettings);
  const theme = useEditorStore((s) => s.theme);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const panelRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Listen for custom event
  useEffect(() => {
    const handler = () => setOpen((prev) => !prev);
    document.addEventListener("open-settings", handler);
    return () => document.removeEventListener("open-settings", handler);
  }, []);

  // Listen for navigation event (e.g., sidebar "About" button)
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent).detail as SectionId;
      if (section) setActiveSection(section);
    };
    document.addEventListener("settings-navigate", handler);
    return () => document.removeEventListener("settings-navigate", handler);
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

  // Group sections for sidebar rendering
  const ungrouped = SECTIONS.filter((s) => !s.group);
  const editorSections = SECTIONS.filter((s) => s.group === "Editor");
  const accountSections = SECTIONS.filter((s) => s.group === "Account");

  const settingsContent = (
    <>
      {activeSection === "general" && (
        <GeneralSection settings={settings} update={updateSettings} reset={reset} />
      )}
      {activeSection === "user" && <UserSection />}
      {activeSection === "appearance" && (
        <AppearanceSection
          settings={settings}
          update={updateSettings}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
      {activeSection === "typography" && (
        <TypographySection settings={settings} update={updateSettings} />
      )}
      {activeSection === "markdown" && (
        <MarkdownSection settings={settings} update={updateSettings} />
      )}
      {activeSection === "editing" && (
        <EditingSection settings={settings} update={updateSettings} />
      )}
      {activeSection === "privacy" && <PrivacySecuritySection />}
      {activeSection === "data" && (
        <DataSection settings={settings} update={updateSettings} reset={reset} />
      )}
      {activeSection === "about" && <AboutSection />}
    </>
  );

  const allSections = SECTIONS;

  // ── Mobile: full-screen settings with horizontal tabs at top ──────
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-popover animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex h-[44px] items-center justify-between px-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-[15px] font-semibold">Settings</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground active:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Horizontal section tabs */}
        <nav className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto scrollbar-none shrink-0 bg-card/50">
          {allSections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors shrink-0",
                activeSection === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </nav>

        {/* Content — scrollable, fills remaining space */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          {settingsContent}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center border-t border-border px-4 py-2 shrink-0">
          <span className="text-[11px] text-muted-foreground">Auto-saved</span>
        </div>
      </div>
    );
  }

  // ── Desktop: centered dialog with sidebar ─────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl h-[70vh] rounded-lg border border-border bg-popover shadow-2xl animate-in slide-in-from-top-2 fade-in duration-150 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Settings</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <nav className="w-44 shrink-0 border-r border-border py-3 px-2 space-y-1 overflow-y-auto">
            {ungrouped.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  activeSection === id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}

            {editorSections.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Editor
                  </span>
                </div>
                {editorSections.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                      activeSection === id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </>
            )}

            {accountSections.length > 0 && (
              <>
                <div className="pt-3 pb-1 px-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Account
                  </span>
                </div>
                {accountSections.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setActiveSection(id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                      activeSection === id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </>
            )}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {settingsContent}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            Settings auto-save to cache
          </span>
          <kbd className="text-[10px] text-muted-foreground font-mono">Alt+S</kbd>
        </div>
      </div>
    </div>
  );
}
