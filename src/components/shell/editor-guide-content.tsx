"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

const MARKDOWN_EXAMPLES = [
  { label: "Heading", syntax: "# Heading 1", preview: "Heading 1" },
  { label: "Subheading", syntax: "## Heading 2", preview: "Heading 2" },
  { label: "Bold", syntax: "**bold text**", preview: "bold text" },
  { label: "Italic", syntax: "*italic text*", preview: "italic text" },
  { label: "Bold + Italic", syntax: "***important***", preview: "important" },
  { label: "Strikethrough", syntax: "~~done~~", preview: "done" },
  { label: "Inline code", syntax: "Use `npm run dev`", preview: "Inline code styling" },
  { label: "Horizontal rule", syntax: "---", preview: "Section divider" },
  { label: "Task list", syntax: "- [ ] Ship feature", preview: "Task checkbox" },
  { label: "Ordered list", syntax: "1. Plan\n2. Build\n3. Ship", preview: "Numbered list" },
  { label: "Nested list", syntax: "- Parent\n  - Child", preview: "Indented structure" },
  { label: "Link", syntax: "[Markup](https://example.com)", preview: "Clickable link" },
  { label: "Image", syntax: "![Alt text](https://example.com/image.png)", preview: "Embedded image" },
  { label: "Quote", syntax: "> Idea to revisit", preview: "Blockquote" },
  { label: "Nested quote", syntax: "> Top level\n>> Follow-up", preview: "Multi-level quote" },
  {
    label: "Code block",
    syntax: "```\nconst note = 'hello';\n```",
    preview: "Formatted code",
  },
  {
    label: "Code block with language",
    syntax: "```ts\nconst ready: boolean = true;\n```",
    preview: "Syntax-highlighted code",
  },
  {
    label: "Callout",
    syntax: "> [!NOTE]\n> Remember to update docs",
    preview: "Important side notes",
  },
  {
    label: "Footnote",
    syntax: "Sentence with detail[^1]\n\n[^1]: Extra context",
    preview: "Reference-style notes",
  },
  {
    label: "Definition list",
    syntax: "Term\n: Description",
    preview: "Term and definition",
  },
  {
    label: "Table",
    syntax: "| Name | Status |\\n| --- | --- |\\n| Docs | Ready |",
    preview: "Markdown table",
  },
  {
    label: "Table alignment",
    syntax: "| Left | Center | Right |\\n| :--- | :----: | ---: |",
    preview: "Aligned columns",
  },
  {
    label: "Escaping",
    syntax: "\\*Not italic\\*",
    preview: "Show markdown characters literally",
  },
];

const KEYBINDS = [
  { key: "Alt+T", action: "Create new note" },
  { key: "Alt+W", action: "Close current note" },
  { key: "Alt+E", action: "Cycle editor/split/preview" },
  { key: "Alt+L", action: "Toggle light/dark theme" },
  { key: "Alt+B", action: "Toggle file tree" },
  { key: "Alt+S", action: "Open settings" },
  { key: "Ctrl+K", action: "Open spotlight search" },
  { key: "Alt+K", action: "Open spotlight search" },
  { key: "Alt+`", action: "Insert fenced code block" },
  { key: "Alt+H", action: "Insert heading" },
  { key: "Alt+U", action: "Insert bullet list" },
  { key: "Alt+O", action: "Insert numbered list" },
  { key: "Alt+C", action: "Insert task list" },
  { key: "Alt+Q", action: "Insert blockquote" },
  { key: "Alt+N", action: "Insert markdown link" },
  { key: "Alt+I", action: "Insert markdown image" },
  { key: "Alt+X", action: "Toggle strikethrough" },
  { key: "Ctrl+B", action: "Bold selected text (CodeMirror)" },
  { key: "Ctrl+I", action: "Italic selected text (CodeMirror)" },
  { key: "Ctrl+= / Ctrl+-", action: "Zoom in desktop app (browser zoom on web)" },
  { key: "Tab bar +/-", action: "Zoom in or out from toolbar" },
  { key: "Alt+1..9", action: "Switch tabs by index" },
  { key: "Alt + Right Click", action: "Open editor context menu" },
  { key: "Right Click", action: "Native menu with spell suggestions" },
];

export function EditorGuideContent({
  compact = false,
  className,
  showMarkdownSection = true,
  showKeybindsSection = true,
}: {
  compact?: boolean;
  className?: string;
  showMarkdownSection?: boolean;
  showKeybindsSection?: boolean;
}) {
  const canToggle = showMarkdownSection && showKeybindsSection;
  const [activeSection, setActiveSection] = useState<"markdown" | "keybinds">("markdown");
  const shouldShowMarkdown = useMemo(
    () => showMarkdownSection && (!canToggle || activeSection === "markdown"),
    [activeSection, canToggle, showMarkdownSection]
  );
  const shouldShowKeybinds = useMemo(
    () => showKeybindsSection && (!canToggle || activeSection === "keybinds"),
    [activeSection, canToggle, showKeybindsSection]
  );

  return (
    <div className={cn("space-y-5", className)}>
      {canToggle && (
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveSection("markdown")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeSection === "markdown"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Markdown Tutorials
          </button>
          <button
            onClick={() => setActiveSection("keybinds")}
            className={cn(
              "px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors",
              activeSection === "keybinds"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Keybinds
          </button>
        </div>
      )}

      {shouldShowMarkdown && (
        <>
          <div>
            <h3 className="text-sm font-semibold mb-1">How to write markdown</h3>
            <p className="text-xs text-muted-foreground">
              Use these quick patterns in the editor. You can copy any syntax example directly.
            </p>
          </div>

          <div className={cn("grid gap-2", compact ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
            {MARKDOWN_EXAMPLES.map((example) => (
              <div key={example.label} className={cn("rounded-md border border-border bg-card/60", compact ? "p-2.5" : "p-3")}>
                <p className={cn("font-medium mb-1", compact ? "text-[11px]" : "text-xs")}>{example.label}</p>
                <p className={cn("font-mono rounded bg-muted break-all", compact ? "px-1.5 py-1 text-[10px]" : "px-2 py-1 text-[11px]")}>{example.syntax}</p>
                <p className={cn("text-muted-foreground mt-1", compact ? "text-[10px]" : "text-[11px]")}>Result: {example.preview}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {shouldShowKeybinds && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Keyboard shortcuts</h3>
          <p className="text-xs text-muted-foreground mb-2">
            These shortcuts work across the app unless a focused input blocks them.
          </p>

          {compact ? (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {KEYBINDS.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/40 px-2 py-1.5"
                >
                  <span className="text-[10px] text-muted-foreground">{shortcut.action}</span>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[9px] font-mono">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              {KEYBINDS.map((shortcut, idx) => (
                <div
                  key={shortcut.key}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2",
                    idx !== KEYBINDS.length - 1 && "border-b border-border",
                    idx % 2 === 0 ? "bg-card/50" : "bg-card/30"
                  )}
                >
                  <span className="text-[11px] text-muted-foreground">{shortcut.action}</span>
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
                    {shortcut.key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
