"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  GripVertical,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/lib/store";

type Priority = "low" | "medium" | "high";

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  labels: string[];
  dueDate: string | null;
  priority: Priority;
  completed: boolean;
  createdAt: number;
}

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  wipLimit: number | null;
  cards: KanbanCard[];
}

interface KanbanBoardData {
  version: number;
  boardTitle: string;
  showCompleted: boolean;
  columns: KanbanColumn[];
}

interface DragCardState {
  cardId: string;
  sourceColumnId: string;
}

const COLUMN_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#16a34a",
  "#ea580c",
  "#e11d48",
  "#0f766e",
  "#a16207",
  "#334155",
];

const DEFAULT_BOARD: KanbanBoardData = {
  version: 2,
  boardTitle: "Project Board",
  showCompleted: true,
  columns: [
    {
      id: "todo",
      title: "To Do",
      color: "#2563eb",
      wipLimit: null,
      cards: [
        {
          id: crypto.randomUUID(),
          title: "Set board goal",
          description: "Define what this board tracks.",
          labels: ["planning"],
          dueDate: null,
          priority: "medium",
          completed: false,
          createdAt: Date.now(),
        },
      ],
    },
    {
      id: "in-progress",
      title: "In Progress",
      color: "#7c3aed",
      wipLimit: 5,
      cards: [],
    },
    {
      id: "done",
      title: "Done",
      color: "#16a34a",
      wipLimit: null,
      cards: [],
    },
  ],
};

function createCard(title = "New Task"): KanbanCard {
  return {
    id: crypto.randomUUID(),
    title,
    description: "",
    labels: [],
    dueDate: null,
    priority: "medium",
    completed: false,
    createdAt: Date.now(),
  };
}

function normalizeLabels(rawLabels: unknown): string[] {
  if (!Array.isArray(rawLabels)) return [];
  return rawLabels
    .map((label) => (typeof label === "string" ? label.trim() : ""))
    .filter((label) => label.length > 0);
}

function normalizeCard(card: unknown): KanbanCard | null {
  if (!card || typeof card !== "object") return null;
  const source = card as Partial<KanbanCard>;
  return {
    id: typeof source.id === "string" ? source.id : crypto.randomUUID(),
    title: typeof source.title === "string" && source.title.trim() ? source.title : "Untitled task",
    description: typeof source.description === "string" ? source.description : "",
    labels: normalizeLabels(source.labels),
    dueDate: typeof source.dueDate === "string" ? source.dueDate : null,
    priority:
      source.priority === "low" || source.priority === "high" || source.priority === "medium"
        ? source.priority
        : "medium",
    completed: Boolean(source.completed),
    createdAt: typeof source.createdAt === "number" ? source.createdAt : Date.now(),
  };
}

function normalizeColumn(column: unknown, index: number): KanbanColumn | null {
  if (!column || typeof column !== "object") return null;
  const source = column as Partial<KanbanColumn>;
  const cards = Array.isArray(source.cards)
    ? source.cards.map(normalizeCard).filter(Boolean) as KanbanCard[]
    : [];

  return {
    id: typeof source.id === "string" ? source.id : crypto.randomUUID(),
    title: typeof source.title === "string" && source.title.trim() ? source.title : `Column ${index + 1}`,
    color:
      typeof source.color === "string" && source.color.trim()
        ? source.color
        : COLUMN_COLORS[index % COLUMN_COLORS.length],
    wipLimit: typeof source.wipLimit === "number" && source.wipLimit > 0 ? Math.floor(source.wipLimit) : null,
    cards,
  };
}

function ensureAtLeastOneColumn(columns: KanbanColumn[]): KanbanColumn[] {
  if (columns.length > 0) return columns;
  return [
    {
      id: crypto.randomUUID(),
      title: "To Do",
      color: COLUMN_COLORS[0],
      wipLimit: null,
      cards: [],
    },
  ];
}

function sanitizeBoard(raw: Partial<KanbanBoardData>): KanbanBoardData {
  const normalizedColumns = Array.isArray(raw.columns)
    ? raw.columns
        .map((column, index) => normalizeColumn(column, index))
        .filter(Boolean) as KanbanColumn[]
    : [];

  return {
    version: 2,
    boardTitle:
      typeof raw.boardTitle === "string" && raw.boardTitle.trim().length > 0
        ? raw.boardTitle
        : "Project Board",
    showCompleted: raw.showCompleted !== false,
    columns: ensureAtLeastOneColumn(normalizedColumns),
  };
}

function findDoneColumn(columns: KanbanColumn[]): KanbanColumn | null {
  return (
    columns.find((column) =>
      column.id === "done" || /done|complete/i.test(column.title)
    ) ?? null
  );
}

function parseBoard(content: string): KanbanBoardData {
  try {
    const parsed = JSON.parse(content) as Partial<KanbanBoardData>;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_BOARD;
    }
    return sanitizeBoard(parsed);
  } catch {
    return DEFAULT_BOARD;
  }
}

function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return "No due date";
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function pastelFromHex(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "hsl(var(--card))";
  const mix = (channel: number) => Math.round(channel * 0.22 + 255 * 0.78);
  return `rgb(${mix(rgb.r)} ${mix(rgb.g)} ${mix(rgb.b)})`;
}

function displayTabName(title: string): string {
  return title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
}

export function KanbanView() {
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const activeTab = useEditorStore((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const updateContent = useEditorStore((s) => s.updateContent);

  const parsed = useMemo(() => parseBoard(activeTab?.content ?? ""), [activeTab?.content]);
  const boardDisplayTitle = useMemo(
    () => displayTabName(activeTab?.title ?? "Kanban"),
    [activeTab?.title]
  );
  const [board, setBoard] = useState<KanbanBoardData>(parsed);
  const [searchQuery, setSearchQuery] = useState("");
  const [newCardTextByColumn, setNewCardTextByColumn] = useState<Record<string, string>>({});
  const [openColorPickerForColumn, setOpenColorPickerForColumn] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [dragCard, setDragCard] = useState<DragCardState | null>(null);
  const [dragColumnId, setDragColumnId] = useState<string | null>(null);
  const [dropCardTarget, setDropCardTarget] = useState<{ columnId: string; index: number } | null>(null);
  const [dropColumnIndex, setDropColumnIndex] = useState<number | null>(null);
  const [pendingColumnFocusId, setPendingColumnFocusId] = useState<string | null>(null);
  const columnTitleRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setBoard(parsed);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [parsed, activeTabId]);

  useEffect(() => {
    if (!pendingColumnFocusId) return;
    const target = columnTitleRefs.current[pendingColumnFocusId];
    if (!target) return;

    const frameId = window.requestAnimationFrame(() => {
      target.focus();
      target.select();
      setPendingColumnFocusId(null);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [board.columns, pendingColumnFocusId]);

  const commit = useCallback(
    (next: KanbanBoardData) => {
      const sanitized = sanitizeBoard(next);
      setBoard(sanitized);
      if (!activeTabId) return;
      updateContent(activeTabId, JSON.stringify(sanitized));
    },
    [activeTabId, updateContent]
  );

  const filteredColumns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query && board.showCompleted) return board.columns;

    return board.columns.map((column) => ({
      ...column,
      cards: column.cards.filter((card) => {
        if (!board.showCompleted && card.completed) return false;
        if (!query) return true;
        return (
          card.title.toLowerCase().includes(query) ||
          card.description.toLowerCase().includes(query) ||
          card.labels.some((label) => label.toLowerCase().includes(query))
        );
      }),
    }));
  }, [board.columns, board.showCompleted, searchQuery]);

  const totalCards = board.columns.reduce((sum, column) => sum + column.cards.length, 0);
  const completedCards = board.columns.reduce(
    (sum, column) => sum + column.cards.filter((card) => card.completed).length,
    0
  );

  const addColumn = useCallback(() => {
    const id = crypto.randomUUID();
    commit({
      ...board,
      columns: [
        ...board.columns,
        {
          id,
          title: `Column ${board.columns.length + 1}`,
          color: COLUMN_COLORS[board.columns.length % COLUMN_COLORS.length],
          wipLimit: null,
          cards: [],
        },
      ],
    });
    setPendingColumnFocusId(id);
  }, [board, commit]);

  const updateColumnTitle = useCallback(
    (columnId: string, title: string) => {
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId ? { ...column, title } : column
        ),
      });
    },
    [board, commit]
  );

  const updateColumnColor = useCallback(
    (columnId: string, color: string) => {
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId ? { ...column, color } : column
        ),
      });
    },
    [board, commit]
  );

  const updateWipLimit = useCallback(
    (columnId: string, nextValue: string) => {
      const parsedLimit = Number.parseInt(nextValue, 10);
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                wipLimit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null,
              }
            : column
        ),
      });
    },
    [board, commit]
  );

  const deleteColumn = useCallback(
    (columnId: string) => {
      if (board.columns.length <= 1) return;
      const removed = board.columns.find((column) => column.id === columnId);
      const remaining = board.columns.filter((column) => column.id !== columnId);
      if (!removed) return;

      if (removed.cards.length === 0) {
        commit({ ...board, columns: remaining });
        return;
      }

      const targetIndex = Math.max(0, board.columns.findIndex((c) => c.id === columnId) - 1);
      const target = remaining[targetIndex] ?? remaining[0];
      const merged = remaining.map((column) =>
        column.id === target.id
          ? { ...column, cards: [...removed.cards, ...column.cards] }
          : column
      );
      commit({ ...board, columns: merged });
    },
    [board, commit]
  );

  const addCard = useCallback(
    (columnId: string, title?: string) => {
      const nextTitle = title?.trim() || "New Task";
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cards: [...column.cards, createCard(nextTitle)],
              }
            : column
        ),
      });
      setNewCardTextByColumn((prev) => ({ ...prev, [columnId]: "" }));
    },
    [board, commit]
  );

  const updateCard = useCallback(
    (columnId: string, cardId: string, partial: Partial<KanbanCard>) => {
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId
            ? {
                ...column,
                cards: column.cards.map((card) =>
                  card.id === cardId ? { ...card, ...partial } : card
                ),
              }
            : column
        ),
      });
    },
    [board, commit]
  );

  const deleteCard = useCallback(
    (columnId: string, cardId: string) => {
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId
            ? { ...column, cards: column.cards.filter((card) => card.id !== cardId) }
            : column
        ),
      });
    },
    [board, commit]
  );

  const duplicateCard = useCallback(
    (columnId: string, card: KanbanCard) => {
      const clone = { ...card, id: crypto.randomUUID(), title: `${card.title} (copy)`, createdAt: Date.now() };
      commit({
        ...board,
        columns: board.columns.map((column) =>
          column.id === columnId ? { ...column, cards: [clone, ...column.cards] } : column
        ),
      });
    },
    [board, commit]
  );

  const moveCardTo = useCallback(
    (sourceColumnId: string, cardId: string, targetColumnId: string, targetIndex: number) => {
      const sourceColumn = board.columns.find((column) => column.id === sourceColumnId);
      const targetColumn = board.columns.find((column) => column.id === targetColumnId);
      if (!sourceColumn || !targetColumn) return;

      const sourceCardIndex = sourceColumn.cards.findIndex((card) => card.id === cardId);
      if (sourceCardIndex < 0) return;

      const card = sourceColumn.cards[sourceCardIndex];
      const nextColumns = board.columns.map((column) => ({ ...column, cards: [...column.cards] }));

      const sourceIndex = nextColumns.findIndex((column) => column.id === sourceColumnId);
      const targetIndexCol = nextColumns.findIndex((column) => column.id === targetColumnId);
      const [removed] = nextColumns[sourceIndex].cards.splice(sourceCardIndex, 1);
      if (!removed) return;

      const adjustedTargetIndex =
        sourceIndex === targetIndexCol && sourceCardIndex < targetIndex ? targetIndex - 1 : targetIndex;

      const normalizedTargetIndex = Math.max(
        0,
        Math.min(
          targetIndexCol === sourceIndex
            ? nextColumns[targetIndexCol].cards.length
            : nextColumns[targetIndexCol].cards.length,
          adjustedTargetIndex
        )
      );
      nextColumns[targetIndexCol].cards.splice(normalizedTargetIndex, 0, card);

      commit({ ...board, columns: nextColumns });
    },
    [board, commit]
  );

  const toggleCardCompleted = useCallback(
    (columnId: string, cardId: string, nextCompleted: boolean) => {
      const sourceColumn = board.columns.find((column) => column.id === columnId);
      if (!sourceColumn) return;
      const card = sourceColumn.cards.find((item) => item.id === cardId);
      if (!card) return;

      if (!nextCompleted) {
        updateCard(columnId, cardId, { completed: false });
        return;
      }

      const nextColumns = board.columns.map((column) => ({ ...column, cards: [...column.cards] }));
      const sourceIndex = nextColumns.findIndex((column) => column.id === columnId);
      const cardIndex = nextColumns[sourceIndex].cards.findIndex((item) => item.id === cardId);
      if (cardIndex < 0) return;

      const [completedCard] = nextColumns[sourceIndex].cards.splice(cardIndex, 1);
      if (!completedCard) return;
      completedCard.completed = true;

      let doneColumn = findDoneColumn(nextColumns);
      if (!doneColumn) {
        doneColumn = {
          id: crypto.randomUUID(),
          title: "Done",
          color: "#16a34a",
          wipLimit: null,
          cards: [],
        };
        nextColumns.push(doneColumn);
      }

      const doneIndex = nextColumns.findIndex((column) => column.id === doneColumn!.id);
      nextColumns[doneIndex].cards.unshift(completedCard);

      commit({ ...board, columns: ensureAtLeastOneColumn(nextColumns) });
    },
    [board, commit, updateCard]
  );

  const moveColumnTo = useCallback(
    (columnId: string, targetIndex: number) => {
      const sourceIndex = board.columns.findIndex((column) => column.id === columnId);
      if (sourceIndex < 0) return;
      const nextIndex = Math.max(0, Math.min(board.columns.length - 1, targetIndex));
      if (sourceIndex === nextIndex) return;

      const nextColumns = [...board.columns];
      const [moved] = nextColumns.splice(sourceIndex, 1);
      if (!moved) return;
      nextColumns.splice(nextIndex, 0, moved);
      commit({ ...board, columns: nextColumns });
    },
    [board, commit]
  );

  const toggleCardExpanded = useCallback((cardId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  if (!activeTabId) return null;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-2 sm:px-4">
        <div className="mr-auto min-w-[220px]">
          <h2 className="w-full truncate text-sm font-semibold text-foreground">{boardDisplayTitle}</h2>
          <p className="text-xs text-muted-foreground">
            {completedCards}/{totalCards} complete
          </p>
        </div>
        <div className="relative w-full max-w-[280px]">
          <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background pl-7 pr-2 text-xs outline-none focus:border-primary"
            placeholder="Search cards"
          />
        </div>
        <Button
          variant={board.showCompleted ? "default" : "outline"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => commit({ ...board, showCompleted: !board.showCompleted })}
        >
          {board.showCompleted ? "Hide Completed" : "Show Completed"}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={addColumn}>
          <Plus className="h-3.5 w-3.5" />
          Add Column
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-3 sm:px-4 sm:py-4">
        <div className="flex min-h-full w-max min-w-full items-start gap-0">
          {filteredColumns.map((column, columnIndex) => {
            const exceededWip = column.wipLimit !== null && column.cards.length > column.wipLimit;
            const doneCount = column.cards.filter((card) => card.completed).length;
            const progress = column.cards.length > 0 ? (doneCount / column.cards.length) * 100 : 0;
            return (
              <Fragment key={column.id}>
                <section
                  className={cn(
                  "flex h-full w-[min(340px,calc(100vw-1rem))] sm:w-[340px] flex-col rounded-lg border border-border transition",
                    dropColumnIndex === columnIndex && dragColumnId && "ring-2 ring-primary/50"
                  )}
                  style={{ backgroundColor: pastelFromHex(column.color) }}
                  onDragOver={(e) => {
                    if (!dragColumnId) return;
                    e.preventDefault();
                    setDropColumnIndex(columnIndex);
                  }}
                  onDrop={(e) => {
                    if (!dragColumnId) return;
                    e.preventDefault();
                    moveColumnTo(dragColumnId, columnIndex);
                    setDragColumnId(null);
                    setDropColumnIndex(null);
                  }}
                >
                  <div className="space-y-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => setDragColumnId(column.id)}
                    onDragEnd={() => {
                      setDragColumnId(null);
                      setDropColumnIndex(null);
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Drag column"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                <input
                  ref={(el) => {
                    columnTitleRefs.current[column.id] = el;
                  }}
                  value={column.title}
                  onChange={(e) => updateColumnTitle(column.id, e.target.value)}
                  className="flex-1 bg-transparent text-sm font-semibold text-foreground outline-none"
                />
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {column.cards.length}
                </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenColorPickerForColumn((prev) => (prev === column.id ? null : column.id))
                    }
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Column color"
                  >
                    <div className="h-3.5 w-3.5 rounded-full border border-border" style={{ background: column.color }} />
                  </button>
                <button
                  type="button"
                  onClick={() => deleteColumn(column.id)}
                  disabled={board.columns.length <= 1}
                  className={cn(
                    "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground",
                    board.columns.length <= 1 && "cursor-not-allowed opacity-40"
                  )}
                  title="Delete column"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

                {openColorPickerForColumn === column.id && (
                  <div className="flex flex-wrap gap-1">
                    {COLUMN_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateColumnColor(column.id, color)}
                        className={cn(
                          "h-5 w-5 rounded-full border-2",
                          column.color === color ? "border-foreground" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{doneCount}/{column.cards.length} complete</span>
                    <label className="flex items-center gap-1">
                      WIP
                      <input
                        type="number"
                        min={1}
                        value={column.wipLimit ?? ""}
                        onChange={(e) => updateWipLimit(column.id, e.target.value)}
                        className="h-5 w-12 rounded border border-border bg-background px-1 text-[10px] outline-none"
                        placeholder="-"
                      />
                    </label>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {exceededWip && (
                    <p className="text-[10px] text-destructive">WIP limit exceeded</p>
                  )}
                </div>
              </div>

              <div
                className="flex-1 space-y-2 overflow-y-auto p-3"
                onDragOver={(e) => {
                  if (!dragCard) return;
                  e.preventDefault();
                  setDropCardTarget({ columnId: column.id, index: column.cards.length });
                }}
                onDrop={(e) => {
                  if (!dragCard) return;
                  e.preventDefault();
                  moveCardTo(dragCard.sourceColumnId, dragCard.cardId, column.id, column.cards.length);
                  setDragCard(null);
                  setDropCardTarget(null);
                }}
              >
                {column.cards.map((card, cardIndex) => {
                  const isExpanded = expandedCards.has(card.id);
                  const priorityClass =
                    card.priority === "high"
                      ? "text-rose-400"
                      : card.priority === "low"
                      ? "text-emerald-400"
                      : "text-amber-400";
                  return (
                  <article
                    key={card.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      setDragCard({ cardId: card.id, sourceColumnId: column.id });
                    }}
                    onDragEnd={() => {
                      setDragCard(null);
                      setDropCardTarget(null);
                    }}
                    onDragOver={(e) => {
                      if (!dragCard) return;
                      e.preventDefault();
                      setDropCardTarget({ columnId: column.id, index: cardIndex });
                    }}
                    onDrop={(e) => {
                      if (!dragCard) return;
                      e.preventDefault();
                      moveCardTo(dragCard.sourceColumnId, dragCard.cardId, column.id, cardIndex);
                      setDragCard(null);
                      setDropCardTarget(null);
                    }}
                    className={cn(
                      "space-y-2 rounded-md border bg-background p-2",
                      card.completed ? "border-emerald-500/50 bg-emerald-500/5" : "border-border",
                      dropCardTarget?.columnId === column.id && dropCardTarget.index === cardIndex && "ring-2 ring-primary/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                        <label className="mr-2 inline-flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={card.completed}
                            onChange={(e) => toggleCardCompleted(column.id, card.id, e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border"
                          />
                          <input
                            value={card.title}
                            onChange={(e) => updateCard(column.id, card.id, { title: e.target.value })}
                            className={cn(
                              "min-w-0 flex-1 bg-transparent text-sm font-medium text-foreground outline-none",
                              card.completed && "line-through text-muted-foreground"
                            )}
                          />
                        </label>
                      <div className="flex shrink-0 items-center gap-1">
                          <select
                            value={card.priority}
                            onChange={(e) =>
                              updateCard(column.id, card.id, { priority: e.target.value as Priority })
                            }
                            className={cn(
                              "h-6 rounded border border-border bg-background px-1 text-[10px] uppercase",
                              priorityClass
                            )}
                          >
                            <option value="low">low</option>
                            <option value="medium">med</option>
                            <option value="high">high</option>
                          </select>
                        <button
                          type="button"
                            onClick={() => duplicateCard(column.id, card)}
                          className={cn(
                              "rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                            title="Duplicate card"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                            onClick={() => toggleCardExpanded(card.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCard(column.id, card.id)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            title="Delete card"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <>
                        <textarea
                          value={card.description}
                          onChange={(e) => updateCard(column.id, card.id, { description: e.target.value })}
                          rows={3}
                          placeholder="Description"
                          className="w-full resize-none rounded border border-border bg-muted/20 px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] text-muted-foreground">
                            Due
                            <input
                              type="date"
                              value={card.dueDate ?? ""}
                              onChange={(e) =>
                                updateCard(column.id, card.id, {
                                  dueDate: e.target.value ? e.target.value : null,
                                })
                              }
                              className="mt-1 h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
                            />
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            Labels
                            <input
                              value={card.labels.join(", ")}
                              onChange={(e) =>
                                updateCard(column.id, card.id, {
                                  labels: e.target.value
                                    .split(",")
                                    .map((label) => label.trim())
                                    .filter((label) => label.length > 0),
                                })
                              }
                              placeholder="design, bug"
                              className="mt-1 h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none"
                            />
                          </label>
                        </div>

                        <div className="flex flex-wrap items-center gap-1">
                          {card.labels.map((label) => (
                            <span
                              key={`${card.id}-${label}`}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {label}
                            </span>
                          ))}
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {formatDueDate(card.dueDate)}
                          </span>
                        </div>
                      </>
                    )}
                  </article>
                );})}

                {dropCardTarget?.columnId === column.id && dropCardTarget.index === column.cards.length && (
                  <div className="rounded border border-dashed border-primary/60 p-2 text-center text-[10px] text-primary">
                    Drop here
                  </div>
                )}
              </div>

                  <div className="space-y-2 border-t border-border px-3 py-2">
                <input
                  value={newCardTextByColumn[column.id] ?? ""}
                  onChange={(e) =>
                    setNewCardTextByColumn((prev) => ({ ...prev, [column.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addCard(column.id, newCardTextByColumn[column.id]);
                    }
                  }}
                  placeholder="Add a task title"
                  className="h-8 w-full rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => addCard(column.id, newCardTextByColumn[column.id])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Card
                </Button>
                  </div>
                </section>

                {columnIndex < filteredColumns.length - 1 && (
                  <div
                    className="mx-1.5 h-full w-2.5 shrink-0 rounded-full border border-border/40"
                    style={{ backgroundColor: pastelFromHex(column.color) }}
                    aria-hidden="true"
                  />
                )}
              </Fragment>
            );
          })}

          <div
            className={cn(
              "flex h-full w-[12px] items-center justify-center rounded transition",
              dropColumnIndex === filteredColumns.length && dragColumnId ? "bg-primary/30" : "bg-transparent"
            )}
            onDragOver={(e) => {
              if (!dragColumnId) return;
              e.preventDefault();
              setDropColumnIndex(filteredColumns.length);
            }}
            onDrop={(e) => {
              if (!dragColumnId) return;
              e.preventDefault();
              moveColumnTo(dragColumnId, filteredColumns.length - 1);
              setDragColumnId(null);
              setDropColumnIndex(null);
            }}
          />

          <div
            className="ml-1.5 h-full w-2.5 shrink-0 rounded-full border border-border/40"
            style={{
              backgroundColor:
                filteredColumns.length > 0
                  ? pastelFromHex(filteredColumns[filteredColumns.length - 1].color)
                  : "transparent",
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
