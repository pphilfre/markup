"use client";

import { useMemo } from "react";
import { Link2, Plus, FileText, PenTool, GitBranch, KanbanSquare, FileType } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";

const OPEN_LINK_PICKER_EVENT = "open-link-picker";

function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  const links: string[] = [];
  for (const match of matches) links.push(match[1]);
  return [...new Set(links)];
}

function normalizeTitle(title: string): string {
  return title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
}

function getTypeIcon(noteType: Tab["noteType"]) {
  if (noteType === "whiteboard") return PenTool;
  if (noteType === "mindmap") return GitBranch;
  if (noteType === "kanban") return KanbanSquare;
  if (noteType === "pdf") return FileType;
  return FileText;
}

export function RelatedNotesPanel() {
  const tabs = useEditorStore((s) => s.tabs);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const switchTab = useEditorStore((s) => s.switchTab);

  const activeTab = useMemo(() => {
    return tabs.find((tab) => tab.id === activeTabId && getTabWorkspaceId(tab) === activeProfileId) ?? null;
  }, [tabs, activeTabId, activeProfileId]);

  const noteIndex = useMemo(() => {
    const map = new Map<string, Tab>();
    for (const tab of tabs) {
      if (getTabWorkspaceId(tab) !== activeProfileId) continue;
      map.set(tab.title.toLowerCase(), tab);
      map.set(normalizeTitle(tab.title).toLowerCase(), tab);
    }
    return map;
  }, [tabs, activeProfileId]);

  const relatedLinks = useMemo(() => {
    if (!activeTab || activeTab.noteType !== "note") return [] as string[];
    return extractWikiLinks(activeTab.content);
  }, [activeTab]);

  const incomingLinks = useMemo(() => {
    if (!activeTab) return [] as { tab: Tab; via: string; label?: string }[];
    const destId = activeTab.id;
    const results: { tab: Tab; via: string; label?: string }[] = [];
    for (const tab of tabs) {
      if (getTabWorkspaceId(tab) !== activeProfileId) continue;
      if (tab.id === destId) continue;

      // Notes: check wiki-links
      if (tab.noteType === "note") {
        try {
          const links = extractWikiLinks(tab.content);
          for (const l of links) {
            if (normalizeTitle(l).toLowerCase() === normalizeTitle(activeTab.title).toLowerCase()) {
              results.push({ tab, via: "note" });
              break;
            }
          }
        } catch { /* ignore */ }
        continue;
      }

      // Canvas-like tabs: parse JSON and check board-level and element-level links
      try {
        const data = JSON.parse(tab.content || "{}");
        // Board-level linkedTabIds
        if (Array.isArray(data.linkedTabIds) && data.linkedTabIds.includes(destId)) {
          results.push({ tab, via: "board" });
        }

        // Note: we intentionally do not inspect per-element links
      } catch { /* ignore parse errors */ }
    }
    return results;
  }, [tabs, activeTab, activeProfileId]);

  if (!activeTab || activeTab.noteType !== "note") return null;

  return (
    <section className="border-t border-border bg-muted/20 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Link2 className="h-3 w-3" />
          Related Notes
        </div>
        <button
          type="button"
          onClick={() => document.dispatchEvent(new CustomEvent(OPEN_LINK_PICKER_EVENT))}
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Link note
        </button>
      </div>

      {relatedLinks.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No related notes yet. Click Link note or drag a file from the sidebar.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {relatedLinks.map((title) => {
            const match = noteIndex.get(title.toLowerCase());
            const Icon = match ? getTypeIcon(match.noteType) : FileText;
            return (
              <button
                key={title}
                type="button"
                onClick={() => match && switchTab(match.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                  match
                    ? "border-border text-foreground hover:bg-muted"
                    : "border-border/40 text-muted-foreground cursor-default"
                )}
              >
                <Icon className="h-3 w-3" />
                {title}
              </button>
            );
          })}
        </div>
      )}

      {incomingLinks.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 className="h-3 w-3" />
            Linked From
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {incomingLinks.map(({ tab, via, label }, i) => {
              const Icon = tab ? getTypeIcon(tab.noteType) : FileText;
              const text = via === "note" ? tab.title : via === "board" ? `${tab.title} (board)` : `${label} — ${tab.title}`;
              return (
                <button
                  key={`${tab.id}-${i}`}
                  type="button"
                  onClick={() => switchTab(tab.id)}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors border-border text-foreground hover:bg-muted"
                >
                  <Icon className="h-3 w-3" />
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
