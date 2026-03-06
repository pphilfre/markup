"use client";

import { useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  FileOutput,
  FileText,
  FileJson,
  FileCode,
  FileDown,
  Download,
} from "lucide-react";

type ExportFormat = "md" | "json" | "html" | "pdf";
type ExportScope = "current" | "all";

interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  fontSize: number;
  scale: number;
  includeMetadata: boolean;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateHtml(
  title: string,
  content: string,
  fontSize: number,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em; font-weight: 600; }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin: 0.8em 0; }
    code {
      background: #f5f5f5;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f5f5f5;
      padding: 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid #ddd;
      padding: 0.5em 1em;
      margin: 1em 0;
      color: #555;
    }
    ul, ol { padding-left: 2em; margin: 0.8em 0; }
    li { margin: 0.3em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 0.5em 0.8em; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { max-width: 100%; }
    .task-list-item { list-style: none; margin-left: -1.5em; }
    .task-list-item input { margin-right: 0.5em; }
  </style>
</head>
<body>
  <article>${markdownToBasicHtml(content)}</article>
</body>
</html>`;
}

/** Simple markdown-to-HTML conversion for export (no deps needed) */
function markdownToBasicHtml(md: string): string {
  let html = md
    // Escape HTML entities in the source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Task lists
  html = html.replace(
    /^- \[x\]\s+(.+)$/gm,
    '<li class="task-list-item"><input type="checkbox" checked disabled /> $1</li>'
  );
  html = html.replace(
    /^- \[ \]\s+(.+)$/gm,
    '<li class="task-list-item"><input type="checkbox" disabled /> $1</li>'
  );

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Paragraphs: wrap remaining lines
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<li") ||
        trimmed.startsWith("<hr") ||
        trimmed.startsWith("<img")
      )
        return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  // Wrap consecutive <li> items
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/g, "<ul>$1</ul>");

  return html;
}

function generateJson(
  title: string,
  content: string,
  includeMetadata: boolean,
  tags?: string[],
  folderId?: string | null,
): string {
  const data: Record<string, unknown> = {
    title,
    content,
  };
  if (includeMetadata) {
    data.tags = tags ?? [];
    data.folderId = folderId ?? null;
    data.exportedAt = new Date().toISOString();
  }
  return JSON.stringify(data, null, 2);
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const [options, setOptions] = useState<ExportOptions>({
    format: "md",
    scope: "current",
    fontSize: 14,
    scale: 1,
    includeMetadata: false,
  });

  const update = useCallback(
    (partial: Partial<ExportOptions>) =>
      setOptions((prev) => ({ ...prev, ...partial })),
    []
  );

  const targetTabs = useMemo(
    () => (options.scope === "current" && activeTab ? [activeTab] : tabs),
    [options.scope, activeTab, tabs]
  );

  const handleExport = useCallback(async () => {
    if (targetTabs.length === 0) return;

    if (targetTabs.length === 1) {
      const tab = targetTabs[0];
      let blob: Blob;
      let filename: string;

      switch (options.format) {
        case "md":
          blob = new Blob([tab.content], { type: "text/markdown" });
          filename = tab.title;
          break;
        case "json":
          blob = new Blob(
            [generateJson(tab.title, tab.content, options.includeMetadata, tab.tags, tab.folderId)],
            { type: "application/json" }
          );
          filename = tab.title.replace(/\.md$/, ".json");
          break;
        case "html": {
          const html = generateHtml(tab.title, tab.content, options.fontSize);
          blob = new Blob([html], { type: "text/html" });
          filename = tab.title.replace(/\.md$/, ".html");
          break;
        }
        case "pdf": {
          const html = generateHtml(tab.title, tab.content, options.fontSize);
          const printWindow = window.open("", "_blank");
          if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            // Apply scale via CSS
            if (options.scale !== 1) {
              const style = printWindow.document.createElement("style");
              style.textContent = `@page { size: A4; margin: 1cm; } body { transform: scale(${options.scale}); transform-origin: top left; }`;
              printWindow.document.head.appendChild(style);
            }
            setTimeout(() => {
              printWindow.print();
            }, 500);
          }
          onOpenChange(false);
          return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // Multiple files — zip them
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const tab of targetTabs) {
        switch (options.format) {
          case "md":
            zip.file(tab.title, tab.content);
            break;
          case "json":
            zip.file(
              tab.title.replace(/\.md$/, ".json"),
              generateJson(tab.title, tab.content, options.includeMetadata, tab.tags, tab.folderId)
            );
            break;
          case "html":
            zip.file(
              tab.title.replace(/\.md$/, ".html"),
              generateHtml(tab.title, tab.content, options.fontSize)
            );
            break;
          case "pdf":
            // PDF export for multiple files opens print dialogs sequentially
            zip.file(
              tab.title.replace(/\.md$/, ".html"),
              generateHtml(tab.title, tab.content, options.fontSize)
            );
            break;
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `markup-export-${options.format}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    }

    onOpenChange(false);
  }, [targetTabs, options, onOpenChange]);

  const formatIcon = {
    md: <FileText className="h-3.5 w-3.5" />,
    json: <FileJson className="h-3.5 w-3.5" />,
    html: <FileCode className="h-3.5 w-3.5" />,
    pdf: <FileDown className="h-3.5 w-3.5" />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            Export Notes
          </DialogTitle>
          <DialogDescription>
            Export your notes in various formats
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Scope
            </Label>
            <Select
              value={options.scope}
              onValueChange={(v: string) => update({ scope: v as ExportScope })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">
                  Current note{activeTab ? ` — ${activeTab.title.replace(/\.md$/, "")}` : ""}
                </SelectItem>
                <SelectItem value="all">
                  All notes ({tabs.length} files)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Format
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {(["md", "json", "html", "pdf"] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => update({ format: fmt })}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors ${
                    options.format === fmt
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {formatIcon[fmt]}
                  <span className="font-medium uppercase">{fmt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format-specific options */}
          {(options.format === "html" || options.format === "pdf") && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Font Size (px)</Label>
                <Input
                  type="number"
                  value={options.fontSize}
                  onChange={(e) =>
                    update({ fontSize: Math.max(8, Math.min(32, Number(e.target.value))) })
                  }
                  className="h-7 w-20 text-xs"
                  min={8}
                  max={32}
                />
              </div>
              {options.format === "pdf" && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Scale</Label>
                  <Input
                    type="number"
                    value={options.scale}
                    onChange={(e) =>
                      update({
                        scale: Math.max(0.5, Math.min(2, Number(e.target.value))),
                      })
                    }
                    className="h-7 w-20 text-xs"
                    min={0.5}
                    max={2}
                    step={0.1}
                  />
                </div>
              )}
            </div>
          )}

          {options.format === "json" && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs">Include metadata (tags, folder)</Label>
              <Switch
                checked={options.includeMetadata}
                onCheckedChange={(v) => update({ includeMetadata: v })}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleExport}
            disabled={targetTabs.length === 0}
            className="gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export {targetTabs.length} {targetTabs.length === 1 ? "file" : "files"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
