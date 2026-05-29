"use client";

import { useMemo, useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Clock,
  Pin,
  Search,
  PenTool,
  GitBranch,
  KanbanSquare,
  FileType,
  ChevronRight,
  Star,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getTabWorkspaceId, useEditorStore, type Tab, type NoteType } from "@/lib/store";
import { useAuthState } from "@/components/convex-client-provider";

// ---------------------------------------------------------------------------
// Greeting helpers
// ---------------------------------------------------------------------------

const MORNING_MESSAGES = [
  "Good morning! Ready to write something great?",
  "Morning! Your notes are waiting.",
  "Rise and write — let's make today count.",
  "Good morning. What's on your mind?",
  "A fresh day, a fresh page.",
];

const AFTERNOON_MESSAGES = [
  "Good afternoon! Keep the momentum going.",
  "Afternoon check-in — what needs your attention?",
  "Halfway through the day. How's it going?",
  "Good afternoon. Pick up where you left off.",
  "Afternoon! Your notes are right here.",
];

const EVENING_MESSAGES = [
  "Good evening! Time to wind down and reflect.",
  "Evening — a great time to capture today's thoughts.",
  "Good evening. What did you accomplish today?",
  "Evening check-in. Anything to jot down?",
  "Good evening! Your notes are always here.",
];

function getGreeting(firstName?: string | null): string {
  const hour = new Date().getHours();
  const pool =
    hour < 12 ? MORNING_MESSAGES : hour < 17 ? AFTERNOON_MESSAGES : EVENING_MESSAGES;
  const base = pool[Math.floor(Math.random() * pool.length)];
  if (firstName) {
    // Insert name after the greeting word
    return base.replace(/^(Good \w+|Morning|Afternoon|Evening)/, (m) => `${m}, ${firstName}`);
  }
  return base;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Note type icon + label
// ---------------------------------------------------------------------------

const NOTE_TYPE_META: Record<NoteType, { icon: React.ElementType; label: string; color: string }> = {
  note: { icon: FileText, label: "Note", color: "text-blue-400" },
  whiteboard: { icon: PenTool, label: "Whiteboard", color: "text-purple-400" },
  mindmap: { icon: GitBranch, label: "Mindmap", color: "text-green-400" },
  kanban: { icon: KanbanSquare, label: "Kanban", color: "text-orange-400" },
  pdf: { icon: FileType, label: "PDF", color: "text-red-400" },
};

// ---------------------------------------------------------------------------
// NoteCard
// ---------------------------------------------------------------------------

function NoteCard({
  tab,
  onClick,
  compact = false,
}: {
  tab: Tab;
  onClick: () => void;
  compact?: boolean;
}) {
  const meta = NOTE_TYPE_META[tab.noteType] ?? NOTE_TYPE_META.note;
  const Icon = meta.icon;

  const displayTitle = tab.title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");

  // Derive a short preview from content (markdown notes only)
  const preview = useMemo(() => {
    if (tab.noteType !== "note") return null;
    const lines = tab.content
      .split("\n")
      .map((l) => l.replace(/^#{1,6}\s+/, "").trim())
      .filter((l) => l.length > 0);
    return lines.slice(0, 2).join(" · ") || null;
  }, [tab.content, tab.noteType]);

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60 group"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
        <span className="flex-1 truncate text-sm text-foreground">{displayTitle}</span>
        {tab.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground/60" />}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-border/80 hover:bg-card/80 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-7 w-7 items-center justify-center rounded-md bg-muted", meta.color)}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs text-muted-foreground">{meta.label}</span>
        </div>
        {tab.pinned && <Pin className="h-3.5 w-3.5 text-muted-foreground/60" />}
      </div>
      <p className="line-clamp-2 text-sm font-medium text-foreground leading-snug">{displayTitle}</p>
      {preview && (
        <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">{preview}</p>
      )}
      {tab.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-auto pt-1">
          {tab.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
            >
              <Hash className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Quick action button
// ---------------------------------------------------------------------------

function QuickAction({
  icon: Icon,
  label,
  description,
  onClick,
  color,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-border/80 hover:bg-card/80 hover:shadow-sm"
    >
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function Dashboard() {
  const { user } = useAuthState();
  const tabs = useEditorStore((s) => s.tabs);
  const activeProfileId = useEditorStore((s) => s.activeProfileId);
  const switchTab = useEditorStore((s) => s.switchTab);
  const openTab = useEditorStore((s) => s.openTab);
  const requestCreateTab = useEditorStore((s) => s.requestCreateTab);
  const createWhiteboard = useEditorStore((s) => s.createWhiteboard);
  const createMindmap = useEditorStore((s) => s.createMindmap);
  const createKanban = useEditorStore((s) => s.createKanban);
  const openTabIds = useEditorStore((s) => s.openTabIds);

  const [now, setNow] = useState(() => new Date());
  const [greeting] = useState(() => getGreeting(user?.firstName));
  const [search, setSearch] = useState("");

  // Tick the clock every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  // All notes in the current workspace
  const workspaceTabs = useMemo(
    () => tabs.filter((t) => getTabWorkspaceId(t) === activeProfileId),
    [tabs, activeProfileId]
  );

  // Pinned notes
  const pinnedTabs = useMemo(
    () => workspaceTabs.filter((t) => t.pinned),
    [workspaceTabs]
  );

  // Recently opened (preserve openTabIds order, most recent first)
  const recentTabs = useMemo(() => {
    return [...openTabIds]
      .reverse()
      .map((id) => workspaceTabs.find((t) => t.id === id))
      .filter((t): t is Tab => t !== undefined)
      .slice(0, 6);
  }, [openTabIds, workspaceTabs]);

  // All notes filtered by search
  const filteredTabs = useMemo(() => {
    if (!search.trim()) return workspaceTabs;
    const q = search.toLowerCase();
    return workspaceTabs.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        (t.noteType === "note" && t.content.toLowerCase().includes(q))
    );
  }, [workspaceTabs, search]);

  const handleOpen = (tab: Tab) => {
    openTab(tab.id);
    switchTab(tab.id);
  };

  const firstName = user?.firstName ?? null;
  const avatarUrl = user?.profilePictureUrl ?? null;
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Guest";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-4xl px-8 py-10 space-y-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted ring-2 ring-border text-lg font-semibold text-muted-foreground select-none">
                  {(firstName?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}
                </div>
              )}
            </div>

            {/* Greeting + name */}
            <div>
              <p className="text-xl font-semibold text-foreground leading-tight">{greeting}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{displayName}</p>
            </div>
          </div>

          {/* Clock + date */}
          <div className="text-right shrink-0">
            <p className="text-3xl font-semibold tabular-nums text-foreground leading-none">
              {formatTime(now)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{formatDate(now)}</p>
          </div>
        </div>

        {/* ── Quick actions ── */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickAction
              icon={Plus}
              label="New Note"
              description="Blank markdown note"
              onClick={() => requestCreateTab()}
              color="text-blue-400"
            />
            <QuickAction
              icon={PenTool}
              label="Whiteboard"
              description="Freeform canvas"
              onClick={() => createWhiteboard()}
              color="text-purple-400"
            />
            <QuickAction
              icon={GitBranch}
              label="Mindmap"
              description="Visual idea map"
              onClick={() => createMindmap()}
              color="text-green-400"
            />
            <QuickAction
              icon={KanbanSquare}
              label="Kanban"
              description="Task board"
              onClick={() => createKanban()}
              color="text-orange-400"
            />
          </div>
        </section>

        {/* ── Pinned ── */}
        {pinnedTabs.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Star className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pinned
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pinnedTabs.map((tab) => (
                <NoteCard key={tab.id} tab={tab} onClick={() => handleOpen(tab)} />
              ))}
            </div>
          </section>
        )}

        {/* ── Recently opened ── */}
        {recentTabs.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recently Opened
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentTabs.map((tab) => (
                <NoteCard key={tab.id} tab={tab} onClick={() => handleOpen(tab)} />
              ))}
            </div>
          </section>
        )}

        {/* ── All notes ── */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                All Notes
                {workspaceTabs.length > 0 && (
                  <span className="ml-1.5 text-muted-foreground/60">({workspaceTabs.length})</span>
                )}
              </h2>
            </div>
            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notes…"
                className="h-7 pl-8 text-xs bg-muted/50 border-border/60 focus-visible:ring-1"
              />
            </div>
          </div>

          {filteredTabs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              {search ? (
                <>
                  <Search className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No notes match &ldquo;{search}&rdquo;</p>
                </>
              ) : (
                <>
                  <FileText className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No notes yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => requestCreateTab()}
                    className="mt-1 gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create your first note
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {filteredTabs.map((tab) => (
                <NoteCard key={tab.id} tab={tab} onClick={() => handleOpen(tab)} compact />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
