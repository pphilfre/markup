"use client";

import { useState, useCallback, useMemo } from "react";
import { useEditorStore } from "@/lib/store";
import { isTauri } from "@/lib/tauri";
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
  Printer,
} from "lucide-react";

type ExportFormat = "md" | "json" | "html" | "pdf";
type ExportScope = "current" | "all";

interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  fontSize: number;
  scale: number;
  includeMetadata: boolean;
  customFilename: string;
}

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Extension map for each format
const FORMAT_EXT: Record<ExportFormat, string> = {
  md: ".md",
  json: ".json",
  html: ".html",
  pdf: ".pdf",
};

/** Strip known note extensions from a title */
function stripNoteExt(title: string): string {
  return title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/, "");
}

/** Ensure the filename has the correct extension for the chosen format */
function withFormatExt(name: string, format: ExportFormat): string {
  const base = name.replace(/\.(md|json|html|pdf|canvas|mindmap|kanban)$/, "");
  return base + FORMAT_EXT[format];
}

// ---------------------------------------------------------------------------
// Full-featured HTML generation with syntax highlighting, admonitions,
// footnotes, math, and multi-page PDF support
// ---------------------------------------------------------------------------

function generateHtml(title: string, content: string, fontSize: number): string {
  const escapedTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
    onload="renderMathInElement(document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]})"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: A4; margin: 2cm; }
    @media print {
      html, body { margin: 0; padding: 0; }
      pre { page-break-inside: avoid; }
      h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
      .admonition { page-break-inside: avoid; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: ${fontSize}px;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1, h2, h3, h4, h5, h6 { margin: 1.5em 0 0.5em; font-weight: 600; line-height: 1.3; }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; }
    p { margin: 0.8em 0; }
    code {
      background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 3px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace; font-size: 0.88em;
    }
    pre {
      background: #f6f8fa; padding: 1em 1.2em; border-radius: 8px;
      overflow-x: auto; margin: 1em 0; border: 1px solid #e1e4e8;
    }
    pre code { background: none; padding: 0; font-size: 0.9em; }
    blockquote {
      border-left: 4px solid #ddd; padding: 0.5em 1em; margin: 1em 0; color: #555;
      background: #fafafa; border-radius: 0 4px 4px 0;
    }
    ul, ol { padding-left: 2em; margin: 0.8em 0; }
    li { margin: 0.3em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid #ddd; padding: 0.5em 0.8em; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    tr:nth-child(even) { background: #fafafa; }
    hr { border: none; border-top: 2px solid #eee; margin: 2em 0; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { max-width: 100%; border-radius: 4px; }
    .task-list-item { list-style: none; margin-left: -1.5em; }
    .task-list-item input { margin-right: 0.5em; }
    del { color: #888; }
    mark { background: #fff3cd; padding: 0.1em 0.2em; border-radius: 2px; }
    sup { font-size: 0.75em; vertical-align: super; line-height: 0; }
    sub { font-size: 0.75em; vertical-align: sub; line-height: 0; }
    /* Admonitions */
    .admonition { border-left: 4px solid; border-radius: 0 6px 6px 0; padding: 0.8em 1em; margin: 1em 0; }
    .admonition-title { font-weight: 600; font-size: 0.9em; margin-bottom: 0.4em; display: flex; align-items: center; gap: 0.4em; }
    .admonition-note { border-color: #3b82f6; background: #eff6ff; }
    .admonition-note .admonition-title { color: #3b82f6; }
    .admonition-tip { border-color: #22c55e; background: #f0fdf4; }
    .admonition-tip .admonition-title { color: #22c55e; }
    .admonition-important { border-color: #8b5cf6; background: #f5f3ff; }
    .admonition-important .admonition-title { color: #8b5cf6; }
    .admonition-warning { border-color: #f97316; background: #fff7ed; }
    .admonition-warning .admonition-title { color: #f97316; }
    .admonition-caution { border-color: #ef4444; background: #fef2f2; }
    .admonition-caution .admonition-title { color: #ef4444; }
    /* Footnotes */
    .footnotes { margin-top: 2em; padding-top: 1em; border-top: 1px solid #eee; font-size: 0.88em; color: #555; }
    .footnotes ol { padding-left: 1.5em; }
    sup a { color: #0366d6; text-decoration: none; font-size: 0.8em; }
  </style>
</head>
<body>
  <article>${markdownToRichHtml(content)}</article>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      document.querySelectorAll('pre code').forEach(function(el) {
        hljs.highlightElement(el);
      });
    });
  </script>
</body>
</html>`;
}

const ADMONITION_META: Record<string, { icon: string; label: string }> = {
  NOTE: { icon: "ℹ️", label: "Note" },
  TIP: { icon: "💡", label: "Tip" },
  IMPORTANT: { icon: "📌", label: "Important" },
  WARNING: { icon: "⚠️", label: "Warning" },
  CAUTION: { icon: "🔴", label: "Caution" },
};

/** Convert markdown to rich HTML supporting admonitions, footnotes, tables, task lists */
function markdownToRichHtml(md: string): string {
  // Collect footnote definitions
  const footnotes: Record<string, string> = {};
  let fnCounter = 0;
  const fnOrder: string[] = [];

  // Extract footnote definitions [^id]: text
  const processed = md.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gm, (_m, id, text) => {
    footnotes[id] = text;
    return "";
  });

  let html = processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Fenced code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const cls = lang ? ` class="language-${lang}"` : "";
    return `<pre><code${cls}>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  for (let i = 6; i >= 1; i--) {
    const hashes = "#".repeat(i);
    html = html.replace(new RegExp(`^${hashes}\\s+(.+)$`, "gm"), `<h${i}>$1</h${i}>`);
  }

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  // Highlight ==text==
  html = html.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
  // Superscript X^2^
  html = html.replace(/\^([^^]+)\^/g, "<sup>$1</sup>");
  // Subscript H~2~O (single tilde, not double)
  html = html.replace(/(?<!~)~([^~\n]+)~(?!~)/g, "<sub>$1</sub>");
  html = html.replace(/\[\^([^\]]+)\]/g, (_m, id) => {
    if (!fnOrder.includes(id)) fnOrder.push(id);
    fnCounter++;
    const num = fnOrder.indexOf(id) + 1;
    return `<sup><a href="#fn-${id}" id="fnref-${id}">[${num}]</a></sup>`;
  });

  // Images and links
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, "<hr />");

  // Task lists
  html = html.replace(/^- \[x\]\s+(.+)$/gm, '<li class="task-list-item"><input type="checkbox" checked disabled /> $1</li>');
  html = html.replace(/^- \[ \]\s+(.+)$/gm, '<li class="task-list-item"><input type="checkbox" disabled /> $1</li>');

  // Tables (GFM)
  html = html.replace(/((?:^\|.+\|\n)+)/gm, (tableBlock) => {
    const rows = tableBlock.trim().split("\n");
    if (rows.length < 2) return tableBlock;
    const headerCells = rows[0].split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map((c) => `<th>${c.trim()}</th>`).join("");
    const bodyRows = rows.slice(2).map((row) => {
      const cells = row.split("|").filter((_, i, a) => i > 0 && i < a.length - 1).map((c) => `<td>${c.trim()}</td>`).join("");
      return `<tr>${cells}</tr>`;
    }).join("\n");
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Admonitions (GitHub-style blockquotes: > [!TYPE])
  html = html.replace(/^&gt;\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n((?:^&gt;.*\n?)*)/gim, (_m, type, body) => {
    const meta = ADMONITION_META[type.toUpperCase()];
    if (!meta) return _m;
    const content = body.replace(/^&gt;\s?/gm, "").trim();
    const cls = `admonition-${type.toLowerCase()}`;
    return `<div class="admonition ${cls}"><div class="admonition-title">${meta.icon} ${meta.label}</div><div>${content}</div></div>`;
  });

  // Regular blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, "<blockquote><p>$1</p></blockquote>");

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  // Paragraphs
  html = html
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h[1-6]|pre|blockquote|li|hr|img|table|div|ul|ol)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  // Wrap consecutive <li> items in <ul>
  html = html.replace(/((?:<li[^>]*>[\s\S]*?<\/li>\s*)+)/g, "<ul>$1</ul>");

  // Append footnotes section
  if (fnOrder.length > 0) {
    const fnItems = fnOrder.map((id, i) => {
      const text = footnotes[id] ?? "";
      return `<li id="fn-${id}">${text} <a href="#fnref-${id}">↩</a></li>`;
    }).join("\n");
    html += `\n<div class="footnotes"><h4>Footnotes</h4><ol>${fnItems}</ol></div>`;
  }

  return html;
}

function generateJson(
  title: string,
  content: string,
  includeMetadata: boolean,
  tags?: string[],
  folderId?: string | null,
): string {
  const data: Record<string, unknown> = { title, content };
  if (includeMetadata) {
    data.tags = tags ?? [];
    data.folderId = folderId ?? null;
    data.exportedAt = new Date().toISOString();
  }
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// Print helper — renders full markdown in a hidden iframe and calls print()
// ---------------------------------------------------------------------------

function printContent(title: string, content: string, fontSize: number, scale: number) {
  const html = generateHtml(title, content, fontSize);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  if (scale !== 1) {
    const s = doc.createElement("style");
    s.textContent = `body { transform: scale(${scale}); transform-origin: top left; width: ${100 / scale}%; }`;
    doc.head.appendChild(s);
  }
  doc.close();
  // Wait for external resources (highlight.js, katex) to load
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 800);
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
    customFilename: "",
  });

  const update = useCallback(
    (partial: Partial<ExportOptions>) => setOptions((prev) => ({ ...prev, ...partial })),
    []
  );

  const targetTabs = useMemo(
    () => (options.scope === "current" && activeTab ? [activeTab] : tabs),
    [options.scope, activeTab, tabs]
  );

  // Derive the effective filename for single-file exports
  const effectiveFilename = useMemo(() => {
    if (targetTabs.length !== 1) return "";
    const base = options.customFilename.trim()
      ? options.customFilename.trim().replace(/\.(md|json|html|pdf|canvas|mindmap)$/, "")
      : stripNoteExt(targetTabs[0].title);
    return base + FORMAT_EXT[options.format];
  }, [targetTabs, options.customFilename, options.format]);

  const handleExport = useCallback(async () => {
    if (targetTabs.length === 0) return;

    const saveFile = async (content: string, filename: string, mimeType: string) => {
      if (isTauri()) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeTextFile } = await import("@tauri-apps/plugin-fs");
          const filePath = await save({
            defaultPath: filename,
            filters: [{ name: "Files", extensions: [filename.split(".").pop() || "*"] }],
          });
          if (filePath) await writeTextFile(filePath, content);
          return;
        } catch { /* fall through */ }
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    };

    const saveBlobFile = async (blob: Blob, filename: string) => {
      if (isTauri()) {
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const { writeFile } = await import("@tauri-apps/plugin-fs");
          const filePath = await save({
            defaultPath: filename,
            filters: [{ name: "Files", extensions: [filename.split(".").pop() || "*"] }],
          });
          if (filePath) {
            const buffer = await blob.arrayBuffer();
            await writeFile(filePath, new Uint8Array(buffer));
          }
          return;
        } catch { /* fall through */ }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    };

    if (targetTabs.length === 1) {
      const tab = targetTabs[0];
      const filename = effectiveFilename;

      switch (options.format) {
        case "md":
          await saveFile(tab.content, filename, "text/markdown");
          break;
        case "json":
          await saveFile(
            generateJson(tab.title, tab.content, options.includeMetadata, tab.tags, tab.folderId),
            filename, "application/json"
          );
          break;
        case "html":
          await saveFile(generateHtml(tab.title, tab.content, options.fontSize), filename, "text/html");
          break;
        case "pdf": {
          printContent(tab.title, tab.content, options.fontSize, options.scale);
          onOpenChange(false);
          return;
        }
      }
    } else {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const tab of targetTabs) {
        const base = stripNoteExt(tab.title);
        switch (options.format) {
          case "md":
            zip.file(base + ".md", tab.content);
            break;
          case "json":
            zip.file(base + ".json", generateJson(tab.title, tab.content, options.includeMetadata, tab.tags, tab.folderId));
            break;
          case "html":
            zip.file(base + ".html", generateHtml(tab.title, tab.content, options.fontSize));
            break;
          case "pdf":
            zip.file(base + ".html", generateHtml(tab.title, tab.content, options.fontSize));
            break;
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      await saveBlobFile(blob, `markup-export-${options.format}.zip`);
    }

    onOpenChange(false);
  }, [targetTabs, options, effectiveFilename, onOpenChange]);

  const handlePrint = useCallback(() => {
    if (!activeTab || activeTab.noteType !== "note") return;
    printContent(activeTab.title, activeTab.content, options.fontSize, options.scale);
    onOpenChange(false);
  }, [activeTab, options.fontSize, options.scale, onOpenChange]);

  const formatIcon = {
    md: <FileText className="h-3.5 w-3.5" />,
    json: <FileJson className="h-3.5 w-3.5" />,
    html: <FileCode className="h-3.5 w-3.5" />,
    pdf: <FileDown className="h-3.5 w-3.5" />,
  };

  const canPrint = activeTab?.noteType === "note" && options.scope === "current";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileOutput className="h-5 w-5" />
            Export Notes
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Scope */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Scope</Label>
            <Select value={options.scope} onValueChange={(v: string) => update({ scope: v as ExportScope })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="current">
                  Current note{activeTab ? ` — ${stripNoteExt(activeTab.title)}` : ""}
                </SelectItem>
                <SelectItem value="all">All notes ({tabs.length} files)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Format</Label>
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

          {/* Custom filename (single file only) */}
          {options.scope === "current" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Filename</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={options.customFilename}
                  onChange={(e) => update({ customFilename: e.target.value })}
                  placeholder={activeTab ? stripNoteExt(activeTab.title) : "filename"}
                  className="h-8 text-xs flex-1"
                />
                <span className="text-xs text-muted-foreground shrink-0">{FORMAT_EXT[options.format]}</span>
              </div>
            </div>
          )}

          {/* Format-specific options */}
          {(options.format === "html" || options.format === "pdf") && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Font Size (px)</Label>
                <Input
                  type="number"
                  value={options.fontSize}
                  onChange={(e) => update({ fontSize: Math.max(8, Math.min(32, Number(e.target.value))) })}
                  className="h-7 w-20 text-xs"
                  min={8} max={32}
                />
              </div>
              {options.format === "pdf" && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Scale</Label>
                  <Input
                    type="number"
                    value={options.scale}
                    onChange={(e) => update({ scale: Math.max(0.5, Math.min(2, Number(e.target.value))) })}
                    className="h-7 w-20 text-xs"
                    min={0.5} max={2} step={0.1}
                  />
                </div>
              )}
            </div>
          )}

          {options.format === "json" && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
              <Label className="text-xs">Include metadata (tags, folder)</Label>
              <Switch checked={options.includeMetadata} onCheckedChange={(v) => update({ includeMetadata: v })} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          {canPrint && (
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
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
