"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  FileText,
  Bold,
  Italic,
  Strikethrough,
  Heading,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code2,
  Link,
  Image as ImageIcon,
  Eye,
  PenLine,
  Columns2,
  Layers,
  Network,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings,
  Plus,
  X,
  PenTool,
  GitBranch,
  KanbanSquare,
  FileType,
  FolderPlus,
  FolderOpen,
  PanelLeft,
  Share2,
  FileOutput,
  Globe,
  User,
  Lock,
  Database,
  Info,
  Timer,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTabWorkspaceId, useEditorStore, type ThemeMode } from "@/lib/store";
import { REPLAY_TUTORIAL_EVENT } from "@/components/shell/first-run-dialog";

// Feature definitions for non-? queries
interface Feature {
  label: string;
  keywords: string[];
  icon: React.ReactNode;
  action: () => void;
}

type SpotlightSectionId = "general" | "user" | "appearance" | "typography" | "markdown" | "editing" | "guide" | "privacy" | "data" | "about" | "updates";

function useFeatures(): Feature[] {
  const wrapSelection = useEditorStore((s) => s.wrapSelection);
  const insertLinePrefix = useEditorStore((s) => s.insertLinePrefix);
  const insertSnippet = useEditorStore((s) => s.insertSnippet);
  const toggleView = useEditorStore((s) => s.toggleView);
  const toggleTheme = useEditorStore((s) => s.toggleTheme);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const createKanban = useEditorStore((s) => s.createKanban);
  const createPdf = useEditorStore((s) => s.createPdf);
  const createFolder = useEditorStore((s) => s.createFolder);
  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const zoomLevel = useEditorStore((s) => s.zoomLevel);
  const setZoomLevel = useEditorStore((s) => s.setZoomLevel);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const theme = useEditorStore((s) => s.theme);
  const settings = useEditorStore((s) => s.settings);
  const updateSettings = useEditorStore((s) => s.updateSettings);

  return useMemo<Feature[]>(
    () => {
      const openSettingsSection = (section: SpotlightSectionId) => {
        document.dispatchEvent(new CustomEvent("open-settings", { detail: { open: true, section } }));
      };

      const openSettingsUserTab = (userTab: "profile" | "sessions" | "security") => {
        document.dispatchEvent(
          new CustomEvent("open-settings", {
            detail: { open: true, section: "user", userTab },
          })
        );
      };

      const applyThemeMode = (mode: ThemeMode) => {
        updateSettings({ themeMode: mode });
        const lightModes: ThemeMode[] = ["light", "solarized-light", "catppuccin-latte", "gruvbox-light", "everforest-light", "uwu"];
        const darkModes: ThemeMode[] = ["dark", "nord-dark", "catppuccin-mocha", "gruvbox-dark", "tokyo-night"];
        if (lightModes.includes(mode) && theme === "dark") toggleTheme();
        if (darkModes.includes(mode) && theme === "light") toggleTheme();
        if (mode === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          if (prefersDark && theme === "light") toggleTheme();
          if (!prefersDark && theme === "dark") toggleTheme();
        }
      };

      return [
      {
        label: "Bold",
        keywords: ["bold", "strong", "**"],
        icon: <Bold className="h-4 w-4" />,
        action: () => wrapSelection("**", "**"),
      },
      {
        label: "Italic",
        keywords: ["italic", "emphasis", "*"],
        icon: <Italic className="h-4 w-4" />,
        action: () => wrapSelection("*", "*"),
      },
      {
        label: "Strikethrough",
        keywords: ["strikethrough", "strike", "~~"],
        icon: <Strikethrough className="h-4 w-4" />,
        action: () => wrapSelection("~~", "~~"),
      },
      {
        label: "Insert Heading",
        keywords: ["heading", "title", "h1", "h2", "markdown"],
        icon: <Heading className="h-4 w-4" />,
        action: () => insertLinePrefix("## "),
      },
      {
        label: "Insert Bullet List",
        keywords: ["list", "bullet", "unordered", "markdown"],
        icon: <List className="h-4 w-4" />,
        action: () => insertLinePrefix("- "),
      },
      {
        label: "Insert Numbered List",
        keywords: ["ordered", "numbered", "list", "markdown"],
        icon: <ListOrdered className="h-4 w-4" />,
        action: () => insertLinePrefix("1. "),
      },
      {
        label: "Insert Task List",
        keywords: ["task", "todo", "checkbox", "list", "markdown"],
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => insertLinePrefix("- [ ] "),
      },
      {
        label: "Insert Blockquote",
        keywords: ["blockquote", "quote", "markdown"],
        icon: <Quote className="h-4 w-4" />,
        action: () => insertLinePrefix("> "),
      },
      {
        label: "Insert Code Block",
        keywords: ["code", "fence", "snippet", "markdown"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => insertSnippet("```\n$SEL\n```"),
      },
      {
        label: "Insert Link",
        keywords: ["link", "url", "markdown"],
        icon: <Link className="h-4 w-4" />,
        action: () => insertSnippet("[$SEL](url)"),
      },
      {
        label: "Insert Image",
        keywords: ["image", "img", "markdown"],
        icon: <ImageIcon className="h-4 w-4" />,
        action: () => insertSnippet("![alt]($SEL)"),
      },
      {
        label: "Editor View",
        keywords: ["editor", "write", "edit"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => setViewMode("editor"),
      },
      {
        label: "Inline View",
        keywords: ["inline", "mixed", "live preview"],
        icon: <Layers className="h-4 w-4" />,
        action: () => setViewMode("inline"),
      },
      {
        label: "Split View",
        keywords: ["split", "both", "dual", "side"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => setViewMode("split"),
      },
      {
        label: "Preview",
        keywords: ["preview", "view", "read"],
        icon: <Eye className="h-4 w-4" />,
        action: () => setViewMode("preview"),
      },
      {
        label: "Graph View",
        keywords: ["graph", "network", "links"],
        icon: <Network className="h-4 w-4" />,
        action: () => setViewMode("graph"),
      },
      {
        label: "Whiteboard View",
        keywords: ["whiteboard", "canvas", "draw"],
        icon: <PenTool className="h-4 w-4" />,
        action: () => setViewMode("whiteboard"),
      },
      {
        label: "Mindmap View",
        keywords: ["mindmap", "map", "nodes"],
        icon: <GitBranch className="h-4 w-4" />,
        action: () => setViewMode("mindmap"),
      },
      {
        label: "Kanban View",
        keywords: ["kanban", "board", "cards"],
        icon: <KanbanSquare className="h-4 w-4" />,
        action: () => setViewMode("kanban"),
      },
      {
        label: "PDF View",
        keywords: ["pdf", "document", "viewer"],
        icon: <FileType className="h-4 w-4" />,
        action: () => setViewMode("pdf"),
      },
      {
        label: "Cycle View Mode",
        keywords: ["cycle", "toggle view", "next view"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => toggleView(),
      },
      {
        label: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
        keywords: ["theme", "dark", "light", "mode", "toggle"],
        icon: theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />,
        action: toggleTheme,
      },
      {
        label: "New File",
        keywords: ["new", "file", "tab", "create"],
        icon: <Plus className="h-4 w-4" />,
        action: () => requestCreateTab(),
      },
      {
        label: "Close Current File",
        keywords: ["close", "tab", "file"],
        icon: <X className="h-4 w-4" />,
        action: () => {
          if (activeTabId) closeTab(activeTabId);
        },
      },
      {
        label: "New Whiteboard",
        keywords: ["whiteboard", "canvas", "draw"],
        icon: <PenTool className="h-4 w-4" />,
        action: () => createWhiteboard(),
      },
      {
        label: "New Mindmap",
        keywords: ["mindmap", "map", "nodes"],
        icon: <GitBranch className="h-4 w-4" />,
        action: () => createMindmap(),
      },
      {
        label: "New Kanban",
        keywords: ["kanban", "board", "tasks"],
        icon: <KanbanSquare className="h-4 w-4" />,
        action: () => createKanban(),
      },
      {
        label: "New PDF",
        keywords: ["pdf", "document"],
        icon: <FileType className="h-4 w-4" />,
        action: () => createPdf(),
      },
      {
        label: "New Folder",
        keywords: ["folder", "new folder", "create folder"],
        icon: <FolderPlus className="h-4 w-4" />,
        action: () => createFolder("New Folder"),
      },
      {
        label: "Toggle File Tree",
        keywords: ["sidebar", "file tree", "panel", "tree", "toggle sidebar"],
        icon: <PanelLeft className="h-4 w-4" />,
        action: toggleFileTree,
      },
      {
        label: "Zoom In",
        keywords: ["zoom", "increase", "bigger"],
        icon: <ZoomIn className="h-4 w-4" />,
        action: () => setZoomLevel(zoomLevel + 10),
      },
      {
        label: "Zoom Out",
        keywords: ["zoom", "decrease", "smaller"],
        icon: <ZoomOut className="h-4 w-4" />,
        action: () => setZoomLevel(zoomLevel - 10),
      },
      {
        label: "Reset Zoom",
        keywords: ["zoom", "reset", "100%"],
        icon: <RotateCcw className="h-4 w-4" />,
        action: () => setZoomLevel(100),
      },
      {
        label: "Settings",
        keywords: ["settings", "preferences", "config", "font", "size"],
        icon: <Settings className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-settings")),
      },
      {
        label: "Settings: General",
        keywords: ["settings", "general", "preferences", "defaults", "accent"],
        icon: <Settings className="h-4 w-4" />,
        action: () => openSettingsSection("general"),
      },
      {
        label: "Settings: Appearance",
        keywords: ["settings", "appearance", "theme", "sidebar", "icon theme"],
        icon: <Eye className="h-4 w-4" />,
        action: () => openSettingsSection("appearance"),
      },
      {
        label: "Settings: Typography",
        keywords: ["settings", "typography", "font", "line height", "spacing"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => openSettingsSection("typography"),
      },
      {
        label: "Settings: Markdown",
        keywords: ["settings", "markdown", "lists", "autoclose", "punctuation"],
        icon: <FileText className="h-4 w-4" />,
        action: () => openSettingsSection("markdown"),
      },
      {
        label: "Settings: Editing",
        keywords: ["settings", "editing", "word wrap", "cursor", "line"],
        icon: <PenTool className="h-4 w-4" />,
        action: () => openSettingsSection("editing"),
      },
      {
        label: "Settings: Guide & Keybinds",
        keywords: ["settings", "guide", "help", "keybinds", "tutorial"],
        icon: <Layers className="h-4 w-4" />,
        action: () => openSettingsSection("guide"),
      },
      {
        label: "Settings: Privacy & Security",
        keywords: ["settings", "privacy", "security", "permissions", "account"],
        icon: <Lock className="h-4 w-4" />,
        action: () => openSettingsSection("privacy"),
      },
      {
        label: "Settings: Data",
        keywords: ["settings", "data", "backup", "import", "export", "sync"],
        icon: <Database className="h-4 w-4" />,
        action: () => openSettingsSection("data"),
      },
      {
        label: "Settings: Updates",
        keywords: ["settings", "updates", "version", "upgrade"],
        icon: <Timer className="h-4 w-4" />,
        action: () => openSettingsSection("updates"),
      },
      {
        label: "Settings: About & Contact",
        keywords: ["settings", "about", "contact", "support", "version"],
        icon: <Info className="h-4 w-4" />,
        action: () => openSettingsSection("about"),
      },
      {
        label: settings.autoCloseBrackets ? "Disable Auto-Close Brackets" : "Enable Auto-Close Brackets",
        keywords: ["markdown", "auto close", "brackets", "quotes", "settings"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ autoCloseBrackets: !settings.autoCloseBrackets }),
      },
      {
        label: settings.autoCloseMarkdownFormatting
          ? "Disable Auto-Close Markdown Formatting"
          : "Enable Auto-Close Markdown Formatting",
        keywords: ["markdown", "auto close", "formatting", "bold", "italic"],
        icon: <Bold className="h-4 w-4" />,
        action: () => updateSettings({ autoCloseMarkdownFormatting: !settings.autoCloseMarkdownFormatting }),
      },
      {
        label: settings.autoFormatLists ? "Disable Auto-Format Lists" : "Enable Auto-Format Lists",
        keywords: ["markdown", "lists", "auto format", "settings"],
        icon: <ListOrdered className="h-4 w-4" />,
        action: () => updateSettings({ autoFormatLists: !settings.autoFormatLists }),
      },
      {
        label: settings.continueListOnEnter ? "Disable Continue List on Enter" : "Enable Continue List on Enter",
        keywords: ["markdown", "list", "enter", "settings"],
        icon: <List className="h-4 w-4" />,
        action: () => updateSettings({ continueListOnEnter: !settings.continueListOnEnter }),
      },
      {
        label: settings.autoPunctuation ? "Disable Auto Punctuation" : "Enable Auto Punctuation",
        keywords: ["markdown", "punctuation", "double space", "settings"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ autoPunctuation: !settings.autoPunctuation }),
      },
      {
        label: settings.suggestCorrectionsOnDoubleTap
          ? "Disable Double-Tap Corrections"
          : "Enable Double-Tap Corrections",
        keywords: ["markdown", "corrections", "double tap", "keyboard"],
        icon: <FileText className="h-4 w-4" />,
        action: () =>
          updateSettings({
            suggestCorrectionsOnDoubleTap: !settings.suggestCorrectionsOnDoubleTap,
          }),
      },
      {
        label: settings.smartQuotes ? "Disable Smart Quotes" : "Enable Smart Quotes",
        keywords: ["markdown", "quotes", "curly", "typography"],
        icon: <Quote className="h-4 w-4" />,
        action: () => updateSettings({ smartQuotes: !settings.smartQuotes }),
      },
      {
        label: settings.smartDashes ? "Disable Smart Dashes" : "Enable Smart Dashes",
        keywords: ["markdown", "dashes", "em dash", "typography"],
        icon: <Strikethrough className="h-4 w-4" />,
        action: () => updateSettings({ smartDashes: !settings.smartDashes }),
      },
      {
        label: settings.convertTabsToSpaces ? "Disable Convert Tabs to Spaces" : "Enable Convert Tabs to Spaces",
        keywords: ["tabs", "spaces", "indent", "markdown", "settings"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ convertTabsToSpaces: !settings.convertTabsToSpaces }),
      },
      {
        label: settings.showInvisibleCharacters
          ? "Hide Invisible Characters"
          : "Show Invisible Characters",
        keywords: ["invisible", "whitespace", "tabs", "spaces", "typography"],
        icon: <Eye className="h-4 w-4" />,
        action: () => updateSettings({ showInvisibleCharacters: !settings.showInvisibleCharacters }),
      },
      {
        label: settings.highlightMatchingBrackets
          ? "Disable Matching Bracket Highlight"
          : "Enable Matching Bracket Highlight",
        keywords: ["editing", "brackets", "highlight", "settings"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ highlightMatchingBrackets: !settings.highlightMatchingBrackets }),
      },
      {
        label: settings.multiCursorSupport ? "Disable Multi-Cursor" : "Enable Multi-Cursor",
        keywords: ["editing", "multi cursor", "alt click", "settings"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => updateSettings({ multiCursorSupport: !settings.multiCursorSupport }),
      },
      {
        label: settings.showIconsInSidebar ? "Hide Sidebar Icons" : "Show Sidebar Icons",
        keywords: ["appearance", "sidebar", "icons", "settings"],
        icon: <PanelLeft className="h-4 w-4" />,
        action: () => updateSettings({ showIconsInSidebar: !settings.showIconsInSidebar }),
      },
      {
        label: "Sidebar Position: Left",
        keywords: ["appearance", "sidebar", "left", "position", "settings"],
        icon: <PanelLeft className="h-4 w-4" />,
        action: () => updateSettings({ sidebarPosition: "left" }),
      },
      {
        label: "Sidebar Position: Right",
        keywords: ["appearance", "sidebar", "right", "position", "settings"],
        icon: <PanelLeft className="h-4 w-4" />,
        action: () => updateSettings({ sidebarPosition: "right" }),
      },
      {
        label: "Icon Theme: Default",
        keywords: ["appearance", "icon theme", "default", "sidebar"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ iconTheme: "default" }),
      },
      {
        label: "Icon Theme: Minimal",
        keywords: ["appearance", "icon theme", "minimal", "sidebar"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ iconTheme: "minimal" }),
      },
      {
        label: "Icon Theme: Colorful",
        keywords: ["appearance", "icon theme", "colorful", "sidebar"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ iconTheme: "colorful" }),
      },
      {
        label: "Code Block Theme: GitHub",
        keywords: ["appearance", "code block", "theme", "github"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ codeBlockTheme: "github" }),
      },
      {
        label: "Code Block Theme: Monokai",
        keywords: ["appearance", "code block", "theme", "monokai"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ codeBlockTheme: "monokai" }),
      },
      {
        label: "Code Block Theme: Dracula",
        keywords: ["appearance", "code block", "theme", "dracula"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ codeBlockTheme: "dracula" }),
      },
      {
        label: "Code Block Theme: Nord",
        keywords: ["appearance", "code block", "theme", "nord"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ codeBlockTheme: "nord" }),
      },
      {
        label: "Code Block Theme: One Dark",
        keywords: ["appearance", "code block", "theme", "one dark"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ codeBlockTheme: "one-dark" }),
      },
      {
        label: "Code Block Theme: Solarized",
        keywords: ["appearance", "code block", "theme", "solarized"],
        icon: <Code2 className="h-4 w-4" />,
        action: () => updateSettings({ codeBlockTheme: "solarized" }),
      },
      {
        label: "Heading Style: Default",
        keywords: ["appearance", "heading", "style", "default"],
        icon: <Heading className="h-4 w-4" />,
        action: () => updateSettings({ headingStyle: "default" }),
      },
      {
        label: "Heading Style: Underlined",
        keywords: ["appearance", "heading", "style", "underlined"],
        icon: <Heading className="h-4 w-4" />,
        action: () => updateSettings({ headingStyle: "underlined" }),
      },
      {
        label: "Heading Style: Bordered",
        keywords: ["appearance", "heading", "style", "bordered"],
        icon: <Heading className="h-4 w-4" />,
        action: () => updateSettings({ headingStyle: "bordered" }),
      },
      {
        label: "Heading Style: Highlighted",
        keywords: ["appearance", "heading", "style", "highlighted"],
        icon: <Heading className="h-4 w-4" />,
        action: () => updateSettings({ headingStyle: "highlighted" }),
      },
      {
        label: "Link Style: Default",
        keywords: ["appearance", "link", "style", "default"],
        icon: <Link className="h-4 w-4" />,
        action: () => updateSettings({ linkStyle: "default" }),
      },
      {
        label: "Link Style: Underlined",
        keywords: ["appearance", "link", "style", "underlined"],
        icon: <Link className="h-4 w-4" />,
        action: () => updateSettings({ linkStyle: "underlined" }),
      },
      {
        label: "Link Style: Colored",
        keywords: ["appearance", "link", "style", "colored"],
        icon: <Link className="h-4 w-4" />,
        action: () => updateSettings({ linkStyle: "colored" }),
      },
      {
        label: "Link Style: Button",
        keywords: ["appearance", "link", "style", "button"],
        icon: <Link className="h-4 w-4" />,
        action: () => updateSettings({ linkStyle: "button" }),
      },
      {
        label: "Checkbox Style: Default",
        keywords: ["appearance", "checkbox", "style", "default"],
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => updateSettings({ checkboxStyle: "default" }),
      },
      {
        label: "Checkbox Style: Rounded",
        keywords: ["appearance", "checkbox", "style", "rounded"],
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => updateSettings({ checkboxStyle: "rounded" }),
      },
      {
        label: "Checkbox Style: Filled",
        keywords: ["appearance", "checkbox", "style", "filled"],
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => updateSettings({ checkboxStyle: "filled" }),
      },
      {
        label: "Checkbox Style: Minimal",
        keywords: ["appearance", "checkbox", "style", "minimal"],
        icon: <CheckSquare className="h-4 w-4" />,
        action: () => updateSettings({ checkboxStyle: "minimal" }),
      },
      {
        label: "Cursor Animation: Smooth",
        keywords: ["editing", "cursor", "animation", "smooth"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => updateSettings({ cursorAnimation: "smooth" }),
      },
      {
        label: "Cursor Animation: Blink",
        keywords: ["editing", "cursor", "animation", "blink"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => updateSettings({ cursorAnimation: "blink" }),
      },
      {
        label: "Cursor Animation: None",
        keywords: ["editing", "cursor", "animation", "none"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => updateSettings({ cursorAnimation: "none" }),
      },
      {
        label: "Increase Font Size",
        keywords: ["typography", "font size", "increase", "larger"],
        icon: <ZoomIn className="h-4 w-4" />,
        action: () => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) }),
      },
      {
        label: "Decrease Font Size",
        keywords: ["typography", "font size", "decrease", "smaller"],
        icon: <ZoomOut className="h-4 w-4" />,
        action: () => updateSettings({ fontSize: Math.max(10, settings.fontSize - 1) }),
      },
      {
        label: "Increase Line Height",
        keywords: ["typography", "line height", "increase", "spacing"],
        icon: <ZoomIn className="h-4 w-4" />,
        action: () => updateSettings({ lineHeight: Math.min(2.4, Number((settings.lineHeight + 0.1).toFixed(1))) }),
      },
      {
        label: "Decrease Line Height",
        keywords: ["typography", "line height", "decrease", "spacing"],
        icon: <ZoomOut className="h-4 w-4" />,
        action: () => updateSettings({ lineHeight: Math.max(1.2, Number((settings.lineHeight - 0.1).toFixed(1))) }),
      },
      {
        label: "Set Tab Size: 2",
        keywords: ["typography", "tab size", "indent", "2"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ tabSize: 2 }),
      },
      {
        label: "Set Tab Size: 4",
        keywords: ["typography", "tab size", "indent", "4"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ tabSize: 4 }),
      },
      {
        label: "Set Max Line Width: Unlimited",
        keywords: ["typography", "line width", "max", "unlimited", "0"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => updateSettings({ maxLineWidth: 0 }),
      },
      {
        label: "Set Max Line Width: 80ch",
        keywords: ["typography", "line width", "max", "80"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => updateSettings({ maxLineWidth: 80 }),
      },
      {
        label: "Set Max Line Width: 100ch",
        keywords: ["typography", "line width", "max", "100"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => updateSettings({ maxLineWidth: 100 }),
      },
      {
        label: "Set Max Line Width: 120ch",
        keywords: ["typography", "line width", "max", "120"],
        icon: <Columns2 className="h-4 w-4" />,
        action: () => updateSettings({ maxLineWidth: 120 }),
      },
      {
        label: "Font Family: System Mono",
        keywords: ["typography", "font", "system mono"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          customFontFamily: null,
        }),
      },
      {
        label: "Font Family: JetBrains Mono",
        keywords: ["typography", "font", "jetbrains mono"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          customFontFamily: null,
        }),
      },
      {
        label: "Font Family: Fira Code",
        keywords: ["typography", "font", "fira code"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({
          fontFamily: "'Fira Code', ui-monospace, monospace",
          customFontFamily: null,
        }),
      },
      {
        label: "Font Family: Source Code Pro",
        keywords: ["typography", "font", "source code pro"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({
          fontFamily: "'Source Code Pro', ui-monospace, monospace",
          customFontFamily: null,
        }),
      },
      {
        label: "Font Family: IBM Plex Mono",
        keywords: ["typography", "font", "ibm plex mono"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({
          fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
          customFontFamily: null,
        }),
      },
      {
        label: "Font Family: Sans-serif",
        keywords: ["typography", "font", "sans", "ui sans"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({
          fontFamily: "var(--font-geist-sans), ui-sans-serif, sans-serif",
          customFontFamily: null,
        }),
      },
      {
        label: "Account: Profile",
        keywords: ["account", "profile", "user", "settings"],
        icon: <User className="h-4 w-4" />,
        action: () => openSettingsUserTab("profile"),
      },
      {
        label: "Account: Sessions",
        keywords: ["account", "sessions", "devices", "login", "security"],
        icon: <User className="h-4 w-4" />,
        action: () => openSettingsUserTab("sessions"),
      },
      {
        label: "Account: Security",
        keywords: ["account", "security", "password", "mfa"],
        icon: <Lock className="h-4 w-4" />,
        action: () => openSettingsUserTab("security"),
      },
      {
        label: settings.wordWrap ? "Disable Word Wrap" : "Enable Word Wrap",
        keywords: ["word wrap", "line wrap", "settings", "editing"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ wordWrap: !settings.wordWrap }),
      },
      {
        label: settings.spellCheck ? "Disable Spell Check" : "Enable Spell Check",
        keywords: ["spell check", "spelling", "settings", "markdown"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ spellCheck: !settings.spellCheck }),
      },
      {
        label: settings.compactMode ? "Disable Compact Mode" : "Enable Compact Mode",
        keywords: ["compact", "density", "ui", "settings", "appearance"],
        icon: <PanelLeft className="h-4 w-4" />,
        action: () => updateSettings({ compactMode: !settings.compactMode }),
      },
      {
        label: settings.highlightCurrentLine ? "Disable Current Line Highlight" : "Enable Current Line Highlight",
        keywords: ["highlight line", "cursor line", "settings", "editing"],
        icon: <PenLine className="h-4 w-4" />,
        action: () => updateSettings({ highlightCurrentLine: !settings.highlightCurrentLine }),
      },
      {
        label: settings.hideMdExtensions ? "Show .md Extensions" : "Hide .md Extensions",
        keywords: ["extensions", "filename", "sidebar", "settings"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ hideMdExtensions: !settings.hideMdExtensions }),
      },
      {
        label: settings.promptForTemplateOnNewFile
          ? "Disable New File Template Prompt"
          : "Enable New File Template Prompt",
        keywords: ["template", "new file", "new note", "settings"],
        icon: <Plus className="h-4 w-4" />,
        action: () => updateSettings({ promptForTemplateOnNewFile: !settings.promptForTemplateOnNewFile }),
      },
      {
        label: settings.showFileExtensions ? "Hide File Extensions" : "Show File Extensions",
        keywords: ["file extensions", "sidebar", "filenames", "settings"],
        icon: <FileText className="h-4 w-4" />,
        action: () => updateSettings({ showFileExtensions: !settings.showFileExtensions }),
      },
      {
        label: "Theme Mode: Dark",
        keywords: ["theme", "dark", "appearance", "settings"],
        icon: <Moon className="h-4 w-4" />,
        action: () => applyThemeMode("dark"),
      },
      {
        label: "Theme Mode: Light",
        keywords: ["theme", "light", "appearance", "settings"],
        icon: <Sun className="h-4 w-4" />,
        action: () => applyThemeMode("light"),
      },
      {
        label: "Theme Mode: System",
        keywords: ["theme", "system", "appearance", "settings"],
        icon: <Settings className="h-4 w-4" />,
        action: () => applyThemeMode("system"),
      },
      {
        label: "Theme Mode: Solarized Light",
        keywords: ["theme", "solarized", "light", "appearance", "settings"],
        icon: <Sun className="h-4 w-4" />,
        action: () => applyThemeMode("solarized-light"),
      },
      {
        label: "Theme Mode: Nord Dark",
        keywords: ["theme", "nord", "dark", "appearance", "settings"],
        icon: <Moon className="h-4 w-4" />,
        action: () => applyThemeMode("nord-dark"),
      },
      {
        label: "Theme Mode: Catppuccin Mocha",
        keywords: ["theme", "catppuccin", "mocha", "dark", "appearance"],
        icon: <Moon className="h-4 w-4" />,
        action: () => applyThemeMode("catppuccin-mocha"),
      },
      {
        label: "Theme Mode: Catppuccin Latte",
        keywords: ["theme", "catppuccin", "latte", "light", "appearance"],
        icon: <Sun className="h-4 w-4" />,
        action: () => applyThemeMode("catppuccin-latte"),
      },
      {
        label: "Theme Mode: Gruvbox Dark",
        keywords: ["theme", "gruvbox", "dark", "appearance", "settings"],
        icon: <Moon className="h-4 w-4" />,
        action: () => applyThemeMode("gruvbox-dark"),
      },
      {
        label: "Theme Mode: Gruvbox Light",
        keywords: ["theme", "gruvbox", "light", "appearance", "settings"],
        icon: <Sun className="h-4 w-4" />,
        action: () => applyThemeMode("gruvbox-light"),
      },
      {
        label: "Theme Mode: Tokyo Night",
        keywords: ["theme", "tokyo", "night", "dark", "appearance"],
        icon: <Moon className="h-4 w-4" />,
        action: () => applyThemeMode("tokyo-night"),
      },
      {
        label: "Theme Mode: Everforest Light",
        keywords: ["theme", "everforest", "light", "appearance", "settings"],
        icon: <Sun className="h-4 w-4" />,
        action: () => applyThemeMode("everforest-light"),
      },
      {
        label: "Theme Mode: uwu",
        keywords: ["theme", "uwu", "pink", "appearance", "settings"],
        icon: <Sun className="h-4 w-4" />,
        action: () => applyThemeMode("uwu"),
      },
      {
        label: "Replay Tutorial",
        keywords: ["tutorial", "guide", "first run", "help"],
        icon: <RotateCcw className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent(REPLAY_TUTORIAL_EVENT)),
      },
      {
        label: "Rebuild Search Index",
        keywords: ["search", "index", "rebuild", "settings", "data"],
        icon: <Search className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("rebuild-search-index")),
      },
      {
        label: "Import Files",
        keywords: ["data", "import", "files", "markdown", "pdf"],
        icon: <Upload className="h-4 w-4" />,
        action: () => {
          openSettingsSection("data");
          document.dispatchEvent(new CustomEvent("settings-import-files"));
        },
      },
      {
        label: "Export Notes",
        keywords: ["data", "export", "notes", "json", "backup"],
        icon: <FileOutput className="h-4 w-4" />,
        action: () => {
          openSettingsSection("data");
          document.dispatchEvent(new CustomEvent("settings-export-notes"));
        },
      },
      {
        label: "Export Workspace",
        keywords: ["data", "export", "workspace", "backup", "json"],
        icon: <FileOutput className="h-4 w-4" />,
        action: () => {
          openSettingsSection("data");
          document.dispatchEvent(new CustomEvent("settings-export-workspace"));
        },
      },
      {
        label: "Backup Workspace",
        keywords: ["data", "backup", "workspace", "timestamp"],
        icon: <FileOutput className="h-4 w-4" />,
        action: () => {
          openSettingsSection("data");
          document.dispatchEvent(new CustomEvent("settings-backup-workspace"));
        },
      },
      {
        label: "Reset Settings to Defaults",
        keywords: ["settings", "reset", "defaults", "general", "data"],
        icon: <RotateCcw className="h-4 w-4" />,
        action: () => {
          openSettingsSection("data");
          document.dispatchEvent(new CustomEvent("settings-reset-settings"));
        },
      },
      {
        label: "Choose Local Sync Folder",
        keywords: ["data", "sync", "folder", "local", "tauri"],
        icon: <FolderOpen className="h-4 w-4" />,
        action: () => {
          openSettingsSection("data");
          document.dispatchEvent(new CustomEvent("settings-choose-sync-folder"));
        },
      },
      {
        label: "Check for Updates",
        keywords: ["updates", "version", "upgrade", "download"],
        icon: <Timer className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("check-for-updates")),
      },
      {
        label: "Open Organisation Panel",
        keywords: ["organisation", "organization", "team", "admin", "users"],
        icon: <User className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-org-panel")),
      },
      {
        label: "Open Account Panel",
        keywords: ["account", "profile", "sessions", "security", "user"],
        icon: <User className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-user-account")),
      },
      {
        label: "Share Note",
        keywords: ["share", "collaborate", "link"],
        icon: <Share2 className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-share")),
      },
      {
        label: "Publish Site",
        keywords: ["publish", "site", "website", "public page"],
        icon: <Globe className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-publish")),
      },
      {
        label: "Export",
        keywords: ["export", "download", "pdf", "html", "json", "markdown"],
        icon: <FileOutput className="h-4 w-4" />,
        action: () => document.dispatchEvent(new CustomEvent("open-export")),
      },
    ];
    },
    [
      wrapSelection,
      toggleTheme,
      setViewMode,
      requestCreateTab,
      createWhiteboard,
      createMindmap,
      createKanban,
      createPdf,
      createFolder,
      closeTab,
      toggleFileTree,
      toggleView,
      theme,
      zoomLevel,
      setZoomLevel,
      activeTabId,
      insertLinePrefix,
      insertSnippet,
      settings,
      updateSettings,
    ]
  );
}

// Text search result
interface TextMatch {
  tabId: string;
  tabTitle: string;
  lineNumber: number;
  lineContent: string;
  matchIndex: number;
}

function searchText(tabs: { id: string; title: string; content: string }[], query: string): TextMatch[] {
  const lower = query.toLowerCase();
  const results: TextMatch[] = [];

  for (const tab of tabs) {
    const lines = tab.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const idx = lines[i].toLowerCase().indexOf(lower);
      if (idx !== -1) {
        results.push({
          tabId: tab.id,
          tabTitle: tab.title,
          lineNumber: i + 1,
          lineContent: lines[i],
          matchIndex: idx,
        });
        if (results.length >= 50) return results;
      }
    }
  }

  return results;
}

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const tabs = useEditorStore((s) => s.tabs);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const folders = useEditorStore((s) => s.folders);
  const switchTab = useEditorStore((s) => s.switchTab);
  const features = useFeatures();

  // Listen for custom event
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setQuery("");
      setSelectedIndex(0);
    };
    document.addEventListener("open-spotlight", handler);
    return () => document.removeEventListener("open-spotlight", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on escape
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

  const isTextSearch = query.startsWith("?");
  const textQuery = query.slice(1).trim();

  const workspaceTabs = useMemo(
    () => tabs.filter((tab) => getTabWorkspaceId(tab) === activeProfileId),
    [tabs, activeProfileId]
  );
  const workspaceFolderIds = useMemo(
    () => new Set(workspaceTabs.map((tab) => tab.folderId).filter((folderId): folderId is string => Boolean(folderId))),
    [workspaceTabs]
  );

  const textResults = useMemo(() => {
    if (!isTextSearch || !textQuery) return [];
    return searchText(workspaceTabs, textQuery);
  }, [isTextSearch, textQuery, workspaceTabs]);

  // File matches: search by filename (shown in default mode when query is non-empty)
  const fileMatches = useMemo(() => {
    if (isTextSearch) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return workspaceTabs.filter((t) =>
      t.title.toLowerCase().includes(q)
    );
  }, [query, isTextSearch, workspaceTabs]);

  // Folder matches: search by folder name
  const folderMatches = useMemo(() => {
    if (isTextSearch) return [];
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return folders.filter((f) =>
      workspaceFolderIds.has(f.id) && f.name.toLowerCase().includes(q)
    );
  }, [query, isTextSearch, folders, workspaceFolderIds]);

  const filteredFeatures = useMemo(() => {
    if (isTextSearch) return [];
    const q = query.toLowerCase().trim();
    if (!q) return features;
    return features.filter(
      (f) =>
        f.label.toLowerCase().includes(q) ||
        f.keywords.some((k) => k.includes(q))
    );
  }, [query, isTextSearch, features]);

  // Combined items: files first, then folders, then features
  type ResultItem =
    | { kind: "file"; tab: typeof tabs[0] }
    | { kind: "folder"; folder: typeof folders[0] }
    | { kind: "feature"; feature: Feature }
    | { kind: "text"; match: TextMatch };

  const allItems = useMemo<ResultItem[]>(() => {
    if (isTextSearch) {
      return textResults.map((m) => ({ kind: "text" as const, match: m }));
    }
    return [
      ...fileMatches.map((tab) => ({ kind: "file" as const, tab })),
      ...folderMatches.map((folder) => ({ kind: "folder" as const, folder })),
      ...filteredFeatures.map((feature) => ({ kind: "feature" as const, feature })),
    ];
  }, [isTextSearch, textResults, fileMatches, folderMatches, filteredFeatures]);

  const totalItems = allItems.length;

  // Reset selection on filter change
  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0));
  }, [query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const toggleFileTree = useEditorStore((s) => s.toggleFileTree);
  const expandFolderById = useCallback(
    () => {
      // Focus the sidebar and open the folder — open the file tree if closed
      const s = useEditorStore.getState();
      if (!s.fileTreeOpen) toggleFileTree();
    },
    [toggleFileTree]
  );

  const execute = useCallback(
    (index: number) => {
      const item = allItems[index];
      if (!item) { setOpen(false); return; }

      switch (item.kind) {
        case "text": {
          switchTab(item.match.tabId);
          const match = item.match;
          const tryScroll = (attempts: number) => {
            const view = useEditorStore.getState().editorView;
            if (view && view.state.doc.lines >= match.lineNumber) {
              const line = view.state.doc.line(
                Math.min(match.lineNumber, view.state.doc.lines)
              );
              view.dispatch({
                selection: { anchor: line.from + Math.max(0, match.matchIndex) },
                scrollIntoView: true,
              });
              requestAnimationFrame(() => view.focus());
            } else if (attempts > 0) {
              setTimeout(() => tryScroll(attempts - 1), 50);
            }
          };
          tryScroll(10);
          break;
        }
        case "file":
          switchTab(item.tab.id);
          break;
        case "folder":
          expandFolderById();
          break;
        case "feature":
          item.feature.action();
          break;
      }
      setOpen(false);
    },
    [allItems, switchTab, expandFolderById]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % Math.max(1, totalItems));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + Math.max(1, totalItems)) % Math.max(1, totalItems));
    } else if (e.key === "Enter") {
      e.preventDefault();
      execute(selectedIndex);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[20vh] px-3 sm:px-0"
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" />

      {/* Dialog */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-lg border border-border bg-popover shadow-2xl animate-in slide-in-from-top-2 fade-in duration-150"
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search files, features… or ?text"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button
            onClick={() => setOpen(false)}
            className="sm:hidden flex h-6 items-center rounded border border-border bg-muted px-2 text-[11px] text-muted-foreground active:bg-muted/80"
          >
            Cancel
          </button>
          <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[50vh] sm:max-h-64 overflow-y-auto p-1">
          {allItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {isTextSearch && !textQuery
                ? "Type after ? to search text in all files"
                : "No results found"}
            </p>
          ) : (
            allItems.map((item, i) => {
              const isActive = i === selectedIndex;
              const cls = cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground hover:bg-muted"
              );

              switch (item.kind) {
                case "file": {
                  const folder = folders.find((f) => f.id === item.tab.folderId);
                  return (
                    <button
                      key={`file-${item.tab.id}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cls}
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.tab.title}</span>
                      {folder && (
                        <span className="ml-auto text-[10px] text-muted-foreground/60 truncate max-w-[80px]">
                          {folder.name}
                        </span>
                      )}
                    </button>
                  );
                }
                case "folder":
                  return (
                    <button
                      key={`folder-${item.folder.id}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cls}
                    >
                      <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: item.folder.color }} />
                      <span className="truncate">{item.folder.name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/60">folder</span>
                    </button>
                  );
                case "feature":
                  return (
                    <button
                      key={`feat-${item.feature.label}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cls}
                    >
                      <span className="text-muted-foreground">{item.feature.icon}</span>
                      <span>{item.feature.label}</span>
                    </button>
                  );
                case "text":
                  return (
                    <button
                      key={`text-${item.match.tabId}-${item.match.lineNumber}-${i}`}
                      data-active={isActive}
                      onClick={() => execute(i)}
                      className={cn(cls, "items-start")}
                    >
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate">
                            {item.match.tabTitle}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            :{item.match.lineNumber}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.match.lineContent.trim()}
                        </p>
                      </div>
                    </button>
                  );
              }
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
          <span className="text-[10px] text-muted-foreground">
            {isTextSearch ? "Text search across all files" : "Files, folders & features"}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
            <span>navigate</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">↵</kbd>
            <span>select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
