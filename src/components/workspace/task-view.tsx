"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, ChevronDown, Circle, Columns3, Copy, Ellipsis, Link2, List, Plus, Search, Settings2, Trash2 } from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { isTaskVisible, TASK_PRIORITY_ORDER, TASK_STATUSES, titleWithoutExtension, type BoardColumn, type ProjectBoard, type ProjectTask, type TaskStatus } from "@/lib/projects";
import { type TaskDraft } from "@/lib/project-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const PRIORITIES = ["high", "medium", "low"] as const;
const PRIORITY_LABELS = { high: "High", medium: "Medium", low: "Low" };
const STATUS_COLUMNS: BoardColumn[] = TASK_STATUSES.map(({ id, label }) => ({
  id, title: label, status: id, wipLimit: null,
  color: { todo: "#71819a", "in-progress": "#6366f1", done: "#16976f" }[id],
}));
const EMPTY_FILTERS = { query: "", priority: "all", sort: "manual", showCompleted: true };

function PrioritySelect({ value, onChange, label = "Priority" }: {
  value: ProjectTask["priority"];
  onChange: (value: ProjectTask["priority"]) => void;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label + ": " + PRIORITY_LABELS[value]} className="task-priority-select" data-priority={value}>
          <span className="task-priority-dot" aria-hidden />{PRIORITY_LABELS[value]}<ChevronDown size={12} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as ProjectTask["priority"])}>
          {PRIORITIES.map((priority) => (
            <DropdownMenuRadioItem key={priority} value={priority} data-priority={priority} className="task-priority-option">
              <span className="task-priority-dot" aria-hidden />{PRIORITY_LABELS[priority]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TaskView({ projectId, boardId, compact = false, initialView = "list" }: {
  projectId?: string | null;
  boardId?: string;
  compact?: boolean;
  initialView?: "list" | "board";
}) {
  const data = useEditorStore((state) => state.projectData);
  const workspaceId = useEditorStore((state) => state.activeProfileId);
  const addTask = useEditorStore((state) => state.addTask);
  const beginTask = useEditorStore((state) => state.beginTask);
  const updateTask = useEditorStore((state) => state.updateTask);
  const moveTask = useEditorStore((state) => state.moveTask);
  const updateBoard = useEditorStore((state) => state.updateBoard);
  const selectTask = useEditorStore((state) => state.selectTask);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [title, setTitle] = useState("");
  const [feedback, setFeedback] = useState("");
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const viewKey = `markup-task-view:${workspaceId}:${boardId ?? projectId ?? "all"}`;
  const [view, setView] = useState(() => {
    if (compact || typeof window === "undefined") return initialView;
    try {
      const saved = localStorage.getItem(viewKey);
      return saved === "list" || saved === "board" ? saved : initialView;
    } catch {
      return initialView;
    }
  });
  const chooseView = (next: "board" | "list") => {
    setView(next);
    try { localStorage.setItem(viewKey, next); } catch { /* View preference is optional. */ }
  };
  const board = boardId ? data.boards[boardId] : undefined;
  const columns = board?.columns ?? STATUS_COLUMNS;
  const showCompleted = board?.showCompleted ?? filters.showCompleted;
  const query = filters.query.trim().toLowerCase();
  const tasks = Object.values(data.tasks).filter((task) =>
    task.workspaceId === workspaceId && isTaskVisible(task, data) &&
    (projectId === undefined || task.projectId === projectId) && (!boardId || task.boardId === boardId),
  );
  const filtered = tasks.filter((task) =>
    (showCompleted || task.status !== "done") &&
    (filters.priority === "all" || task.priority === filters.priority) &&
    `${task.title} ${task.description} ${task.labels.join(" ")}`.toLowerCase().includes(query),
  ).sort((a, b) =>
    (filters.sort === "priority" ? TASK_PRIORITY_ORDER[a.priority] - TASK_PRIORITY_ORDER[b.priority] : 0) ||
    a.order - b.order || b.createdAt - a.createdAt,
  );
  const hasFilters = Boolean(filters.query || !showCompleted || filters.priority !== "all" || filters.sort !== "manual");
  const openNew = (column?: BoardColumn) => beginTask({
    projectId: board?.projectId ?? projectId ?? null,
    ...(boardId ? { boardId, columnId: column?.id } : { status: column?.status }),
  });
  const toggleCompleted = (checked: boolean) => {
    if (board) updateBoard(board.id, { showCompleted: checked });
    else setFilters({ ...filters, showCompleted: checked });
  };
  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      openNew();
      return;
    }
    const id = addTask(title, { projectId: projectId ?? null });
    if (!id) return;
    setFeedback(`Added “${title.trim()}”`);
    setTitle("");
    event.currentTarget.querySelector("input")?.focus();
  };
  const move = (taskId: string, column: BoardColumn, beforeId?: string) => {
    const task = tasks.find((entry) => entry.id === taskId);
    if (!task || taskId === beforeId) return;
    const sameColumn = board ? task.columnId === column.id : task.status === column.status;
    if (filters.sort === "priority" && sameColumn) return;
    const lane = tasks.filter((task) => task.id !== taskId &&
      (board ? task.columnId === column.id : task.status === column.status),
    ).sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
    moveTask(taskId, lane.map((entry) => entry.id), { columnId: board ? column.id : task.columnId, status: column.status },
      filters.sort === "manual" ? beforeId : undefined);
    setDraggedTask(null);
    setDropTarget(null);
  };

  if (boardId && !board) {
    return <p className="workspace-muted-note">This board could not be read.</p>;
  }
  return (
    <div className={cn("task-workspace", compact && "task-workspace-compact")}>
      {!compact && (
        <div className="task-view-tools">
          <div className="view-switch" role="group" aria-label="Task view">
            <button aria-pressed={view === "list"} onClick={() => chooseView("list")}><List size={15} /> List</button>
            <button aria-pressed={view === "board"} onClick={() => chooseView("board")}><Columns3 size={15} /> Board</button>
          </div>
          <label className="workspace-search-field task-filter-search">
            <Search size={15} />
            <input aria-label="Search tasks" placeholder={board ? "Search cards" : "Search tasks"} value={filters.query}
              onChange={(event) => setFilters({ ...filters, query: event.target.value })} />
          </label>
          <select aria-label="Filter by priority" className="workspace-select" value={filters.priority}
            onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
          <select aria-label="Sort tasks" className="workspace-select" value={filters.sort}
            onChange={(event) => setFilters({ ...filters, sort: event.target.value })}>
            <option value="manual">Manual order</option>
            <option value="priority">Priority first</option>
          </select>
          <label className="completed-filter">
            <input type="checkbox" checked={showCompleted} onChange={(event) => toggleCompleted(event.target.checked)} />
            Show completed
          </label>
          <button type="button" className="workspace-text-button task-reset-filters" disabled={!hasFilters}
            onClick={() => { setFilters(EMPTY_FILTERS); if (board && !showCompleted) updateBoard(board.id, { showCompleted: true }); }}>
            Reset filters
          </button>
          {board && <div className="task-board-actions">
            <Button size="sm" onClick={() => openNew()}><Plus size={15} /> Add card</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="workspace-icon-button" title="Board settings" aria-label="Board settings"><Settings2 size={16} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => updateBoard(board.id, { columns: [
                  ...columns,
                  { id: crypto.randomUUID(), title: "New column", color: "#64748b", status: "in-progress", wipLimit: null },
                ] })}><Plus size={15} /> Add column</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>}
        </div>
      )}
      {!board && (
        <form className="task-quick-add" onSubmit={add}>
          <label className="task-quick-field">
            <span className="sr-only">New task title</span>
            <input placeholder="Add a task" value={title} onChange={(event) => { setTitle(event.target.value); setFeedback(""); }} maxLength={500} />
          </label>
          <Button type="submit" size="sm"><Plus size={15} /> Add task</Button>
        </form>
      )}
      <span className="task-quick-feedback" role="status">{feedback}</span>
      {!filtered.length && (view === "list" || compact) && (
        <div className="workspace-empty-inline">
          <Circle size={22} aria-hidden />
          <h3>{tasks.length ? "No tasks match these filters" : board ? "No cards yet" : "No tasks yet"}</h3>
        </div>
      )}
      {view === "list" || compact ? (
        <div className="task-list">
          {compact ? filtered.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} />) :
            columns.map((column) => {
              const items = filtered.filter((task) => board ? task.columnId === column.id : task.status === column.status);
              if (!items.length) return null;
              return (
                <section key={column.id} className="task-list-group" aria-label={column.title}>
                  <h3 className="task-column-label"><ColumnDot colour={column.color} />{column.title}<span className="workspace-count">{items.length}</span></h3>
                  {items.map((task) => <TaskRow key={task.id} task={task} showProject={!board && projectId === undefined} />)}
                </section>
              );
            })}
        </div>
      ) : (
        <div className="task-board" aria-label="Task columns">
          {columns.map((column, columnIndex) => {
            const items = filtered.filter((task) => board ? task.columnId === column.id : task.status === column.status);
            const activeCount = tasks.filter((task) => task.columnId === column.id && task.status !== "done").length;
            const dragging = tasks.find((task) => task.id === draggedTask);
            const canDropTask = dragging && (filters.sort === "manual" ||
              (board ? dragging.columnId !== column.id : dragging.status !== column.status));
            return (
              <section key={column.id} className={cn("task-column", dropTarget === column.id && "task-column-drop")} aria-label={column.title}
                style={{ "--column-colour": column.color } as React.CSSProperties}
                onDragOver={(event) => { if (canDropTask || draggedColumn) { event.preventDefault(); setDropTarget(column.id); } }}
                onDragLeave={(event) => {
                  if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDropTarget(null);
                }}
                onDrop={(event) => {
                  if (board && draggedColumn) {
                    event.preventDefault();
                    if (draggedColumn !== column.id) {
                      const next = [...columns];
                      const index = next.findIndex((entry) => entry.id === draggedColumn);
                      if (index >= 0) {
                        const [moved] = next.splice(index, 1);
                        next.splice(columnIndex, 0, moved);
                        updateBoard(board.id, { columns: next });
                      }
                    }
                    setDraggedColumn(null);
                    setDropTarget(null);
                    return;
                  }
                  if (!canDropTask || !draggedTask) return;
                  event.preventDefault();
                  move(draggedTask, column);
                }}>
                <header>
                  <ColumnDot colour={column.color} />
                  <h3 draggable={Boolean(board)} title={board ? "Drag to reorder column" : undefined}
                    onDragStart={(event) => {
                      if (!board) return;
                      event.dataTransfer.setData("text/markup-column", column.id);
                      event.dataTransfer.effectAllowed = "move";
                      setDraggedColumn(column.id);
                    }}
                    onDragEnd={() => { setDraggedColumn(null); setDropTarget(null); }}>{column.title}</h3>
                  <span className="task-column-count" aria-label={items.length + " visible cards"}>{items.length}</span>
                  <button className="workspace-icon-button" title={board ? "Add card to " + column.title : "Add task to " + column.title}
                    aria-label={(board ? "Add card to " : "Add task to ") + column.title} onClick={() => openNew(column)}><Plus size={16} /></button>
                  {board && <ColumnSettings board={board} column={column} />}
                </header>
                {column.wipLimit !== null && activeCount > column.wipLimit &&
                  <p className="task-column-limit">Active-card limit exceeded ({activeCount}/{column.wipLimit})</p>}
                <div className="task-column-items">
                  {items.map((task) => (
                    <article className={cn("task-card", task.status === "done" && "task-card-done")} key={task.id}
                      draggable onDragStart={(event) => { event.dataTransfer.setData("text/markup-task", task.id); event.dataTransfer.effectAllowed = "move"; setDraggedTask(task.id); }}
                      onDragEnd={() => { setDraggedTask(null); setDropTarget(null); }}
                      onDrop={(event) => {
                        if (filters.sort !== "manual" || !draggedTask) return;
                        event.stopPropagation();
                        event.preventDefault();
                        move(draggedTask, column, task.id);
                      }}>
                      <div className="task-card-heading">
                        <TaskCheck task={task} />
                        <button className="task-card-title" onClick={() => selectTask(task.id)}>{task.title}</button>
                        <TaskCardMenu task={task} />
                      </div>
                      <div className="task-card-meta">
                        <PrioritySelect value={task.priority} label={`Priority for ${task.title}`} onChange={(priority) => updateTask(task.id, { priority })} />
                        {task.dueDate && <DueDate value={task.dueDate} done={task.status === "done"} />}
                      </div>
                      {!!task.labels.length && <div className="task-card-labels">{task.labels.map((label) => <span key={label}>{label}</span>)}</div>}
                    </article>
                  ))}
                  {!items.length && <p className="task-column-empty">{hasFilters ? "No matching cards" : "No cards yet"}</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ColumnDot({ colour }: { colour: string }) {
  return <span className="task-column-dot" style={{ backgroundColor: colour }} aria-hidden />;
}

function ColumnSettings({ board, column }: { board: ProjectBoard; column: BoardColumn }) {
  const [open, setOpen] = useState(false);
  const update = useEditorStore((state) => state.updateBoard);
  const index = board.columns.findIndex((entry) => entry.id === column.id);
  const moveColumn = (offset: number) => {
    const columns = [...board.columns];
    [columns[index], columns[index + offset]] = [columns[index + offset], columns[index]];
    update(board.id, { columns });
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button className="workspace-icon-button" title="Column settings" aria-label={`Settings for ${column.title}`}><Ellipsis size={16} /></button></PopoverTrigger>
      <PopoverContent align="end" className="task-column-settings">
        <form key={column.id + open} onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name")).trim();
          const limit = Number(form.get("limit"));
          if (!name) return;
          update(board.id, { columns: board.columns.map((entry) => entry.id === column.id ? {
            ...entry, title: name, color: String(form.get("colour")),
            status: form.get("status") as TaskStatus, wipLimit: limit > 0 ? limit : null,
          } : entry) });
          setOpen(false);
        }}>
          <h3>Column settings</h3>
          <label className="workspace-field">Name<input name="name" defaultValue={column.title} maxLength={100} required /></label>
          <label className="workspace-field">Colour<input name="colour" type="color" defaultValue={/^#[0-9a-f]{6}$/i.test(column.color) ? column.color : "#64748b"} /></label>
          <label className="workspace-field">Status
            <select name="status" defaultValue={column.status}>{TASK_STATUSES.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}</select>
          </label>
          <label className="workspace-field">Active-card limit<input name="limit" min={1} type="number" placeholder="No limit" defaultValue={column.wipLimit ?? undefined} /></label>
          <div className="task-column-setting-actions">
            <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => moveColumn(-1)}>Move left</Button>
            <Button type="button" size="sm" variant="ghost" disabled={index === board.columns.length - 1} onClick={() => moveColumn(1)}>Move right</Button>
            <Button type="submit" size="sm">Save</Button>
          </div>
          {board.columns.length > 1 && <button className="workspace-danger-button" type="button" onClick={() => {
            update(board.id, { columns: board.columns.filter((entry) => entry.id !== column.id) });
            setOpen(false);
          }}>Remove column and move its cards</button>}
        </form>
      </PopoverContent>
    </Popover>
  );
}

function TaskCheck({ task }: { task: ProjectTask }) {
  const update = useEditorStore((state) => state.updateTask);
  const completed = task.status === "done";
  return <button className="task-check" aria-label={`${completed ? "Reopen" : "Complete"} ${task.title}`}
    aria-pressed={completed} onClick={() => update(task.id, { status: completed ? "todo" : "done" })}>
    {completed ? <Check size={14} /> : <Circle size={16} />}
  </button>;
}

function TaskCardMenu({ task }: { task: ProjectTask }) {
  const store = useEditorStore.getState;
  const board = useEditorStore((state) => task.boardId ? state.projectData.boards[task.boardId] : undefined);
  const columns = board?.columns ?? STATUS_COLUMNS;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button className="workspace-icon-button" aria-label={`Actions for ${task.title}`}><Ellipsis size={15} /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => store().selectTask(task.id)}>Edit details</DropdownMenuItem>
        {columns.filter((column) => column.id !== (board ? task.columnId : task.status)).map((column) => (
          <DropdownMenuItem key={column.id} onSelect={() => store().updateTask(task.id, board ? { columnId: column.id } : { status: column.status })}>
            <ColumnDot colour={column.color} /> Move to {column.title}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onSelect={() => store().addTask(`${task.title} (copy)`, task)}><Copy size={15} /> Duplicate</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => store().updateTask(task.id, { deletedAt: Date.now() })}><Trash2 size={15} /> Move to trash</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TaskRow({ task, onOpen, showProject = false }: { task: ProjectTask; onOpen?: () => void; showProject?: boolean }) {
  const update = useEditorStore((state) => state.updateTask);
  const select = useEditorStore((state) => state.selectTask);
  const project = useEditorStore((state) => task.projectId ? state.projectData.projects[task.projectId] : undefined);
  const board = useEditorStore((state) => task.boardId ? state.projectData.boards[task.boardId] : undefined);
  const statuses = board?.columns ?? STATUS_COLUMNS;
  const current = statuses.find((entry) => entry.id === (board ? task.columnId : task.status));
  return (
    <div className={cn("task-row", task.status === "done" && "task-row-done")}>
      <TaskCheck task={task} />
      <button className="task-row-title" onClick={onOpen ?? (() => select(task.id))}>{task.title}</button>
      {showProject && project && <span className="task-project-name">{project.name}</span>}
      {task.relatedDocumentIds.length > 0 && <span className="task-link-count" title="Linked documents"><Link2 size={13} />{task.relatedDocumentIds.length}</span>}
      {task.dueDate && <DueDate value={task.dueDate} done={task.status === "done"} />}
      <PrioritySelect label={`Priority for ${task.title}`} value={task.priority} onChange={(priority) => update(task.id, { priority })} />
      <label className="task-status-control">
        {current && <ColumnDot colour={current.color} />}
        <select className="task-status-select" aria-label={`Status for ${task.title}`} value={current?.id ?? ""}
          onChange={(event) => update(task.id, board ? { columnId: event.target.value } : { status: event.target.value as TaskStatus })}>
          {statuses.map((status) => <option key={status.id} value={status.id}>{status.title}</option>)}
        </select>
      </label>
    </div>
  );
}

function DueDate({ value, done }: { value: string; done: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value}T00:00:00`);
  return (
    <span className={cn("task-due", !done && date < today && "task-overdue")}>
      {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
    </span>
  );
}

export function TaskDrawer() {
  const id = useEditorStore((s) => s.selectedTaskId);
  const task = useEditorStore((s) => (id ? s.projectData.tasks[id] : null));
  const select = useEditorStore((s) => s.selectTask);
  const draft = useEditorStore((s) => s.taskDraft);
  const cancel = useEditorStore((s) => s.cancelTaskDraft);
  const [feedback, setFeedback] = useState<{ label: string } | null>(null);
  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4200);
    return () => window.clearTimeout(timer);
  }, [feedback]);
  const close = () => draft ? cancel() : select(null);
  return (
    <>
    <Dialog
      open={Boolean(draft || (task && !task.deletedAt))}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="workspace-task-drawer translate-x-0 translate-y-0" showCloseButton>
        {draft ? <TaskCreation draft={draft} onCreated={(label) => setFeedback({ label })} /> :
          task && <TaskDetails key={task.id} task={task} />}
      </DialogContent>
    </Dialog>
    <div className={cn("task-creation-feedback", !feedback && "sr-only")} role="status">
      {feedback && <><Check size={16} />{feedback.label}</>}
    </div>
    </>
  );
}

function TaskCreation({ draft, onCreated }: { draft: TaskDraft; onCreated: (label: string) => void }) {
  const board = useEditorStore((state) => draft.boardId ? state.projectData.boards[draft.boardId] : undefined);
  const submit = useEditorStore((state) => state.submitTaskDraft);
  const cancel = useEditorStore((state) => state.cancelTaskDraft);
  const [title, setTitle] = useState(draft.title);
  const [priority, setPriority] = useState<ProjectTask["priority"]>(draft.priority ?? "medium");
  const [columnId, setColumnId] = useState(draft.columnId ?? board?.columns.find((column) => column.status === "todo")?.id ?? board?.columns[0]?.id ?? "");
  const [error, setError] = useState(false);
  return (
    <form className="task-create-form" onSubmit={(event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      const id = submit(title, {
        priority,
        columnId: columnId || null,
        description: String(fields.get("description") ?? ""),
        dueDate: String(fields.get("dueDate") ?? "") || null,
      });
      if (id) onCreated(board ? "Card added" : "Task created");
      else setError(true);
    }}>
      <DialogHeader>
        <DialogTitle>{board ? "Add card" : "Create task"}</DialogTitle>
        <DialogDescription className="sr-only">Set a title and optional details before adding it.</DialogDescription>
      </DialogHeader>
      <label className="workspace-field">Title
        <input autoFocus required maxLength={500} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={board ? "Card title" : "Task title"} />
      </label>
      <div className="task-detail-grid">
        {board && <label className="workspace-field">Column
          <select value={columnId} onChange={(event) => setColumnId(event.target.value)}>
            {board.columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
          </select>
        </label>}
        <label className="workspace-field">Priority<PrioritySelect value={priority} onChange={setPriority} /></label>
        <label className="workspace-field">Due date<input type="date" name="dueDate" defaultValue={draft.dueDate ?? ""} /></label>
      </div>
      <label className="workspace-field">Description
        <textarea name="description" rows={4} defaultValue={draft.description} />
      </label>
      {!!draft.relatedDocumentIds?.length && <p className="task-source-note"><Link2 size={14} /> Linked to the source note</p>}
      {error && <p role="alert" className="text-destructive text-sm">This task could not be created. Check that the destination is still available.</p>}
      <div className="task-create-actions">
        <Button type="button" variant="outline" onClick={cancel}>Cancel</Button>
        <Button type="submit" disabled={!title.trim()}>{board ? "Add card" : "Create task"}</Button>
      </div>
    </form>
  );
}

function TaskDetails({ task }: { task: ProjectTask }) {
  const update = useEditorStore((s) => s.updateTask);
  const select = useEditorStore((s) => s.selectTask);
  const data = useEditorStore((s) => s.projectData);
  const tabs = useEditorStore((s) => s.tabs);
  const openTab = useEditorStore((s) => s.openTab);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const board = task.boardId ? data.boards[task.boardId] : null;
  const statuses =
    board?.columns.map((column) => ({
      id: column.id,
      label: column.title,
    })) ?? TASK_STATUSES;
  const projects = Object.values(data.projects).filter(
    (project) =>
      project.workspaceId === task.workspaceId && !project.archivedAt,
  );
  const documents = tabs.filter(
    (tab) => (tab.workspaceId ?? "default") === task.workspaceId,
  );
  return (
    <>
      <DialogHeader>
        <DialogTitle>Task details</DialogTitle>
        <DialogDescription className="sr-only">
          Edit the task, its schedule, and linked documents.
        </DialogDescription>
      </DialogHeader>
      <label className="workspace-field">
        Title
        <input
          autoFocus
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (e.target.value.trim())
              update(task.id, { title: e.target.value });
          }}
          onBlur={() => {
            if (!title.trim()) setTitle(task.title);
          }}
          maxLength={500}
        />
      </label>
      {task.boardId && (
        <button
          className="workspace-text-button"
          onClick={() => {
            openTab(task.boardId!);
            select(null);
          }}
        >
          Open task board
        </button>
      )}
      <div className="task-detail-grid">
        <label className="workspace-field">
          Status
          <select
            value={board ? (task.columnId ?? "") : task.status}
            onChange={(e) =>
              update(
                task.id,
                board
                  ? { columnId: e.target.value }
                  : { status: e.target.value as TaskStatus },
              )
            }
          >
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className="workspace-field">
          Priority
          <PrioritySelect value={task.priority} onChange={(priority) => update(task.id, { priority })} />
        </label>
        <label className="workspace-field">
          Project
          <select
            value={task.projectId ?? ""}
            onChange={(e) =>
              update(task.id, { projectId: e.target.value || null })
            }
          >
            <option value="">Unfiled</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="workspace-field">
          Due date
          <input
            type="date"
            value={task.dueDate ?? ""}
            onChange={(e) =>
              update(task.id, { dueDate: e.target.value || null })
            }
          />
        </label>
      </div>
      <label className="workspace-field">
        Description
        <textarea
          rows={6}
          placeholder="What needs to happen?"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            update(task.id, { description: e.target.value });
          }}
        />
      </label>
      <label className="workspace-field">
        Labels
        <input
          value={task.labels.join(", ")}
          placeholder="design, copy"
          onChange={(e) =>
            update(task.id, {
              labels: e.target.value
                .split(",")
                .map((label) => label.trimStart()),
            })
          }
          onBlur={(e) =>
            update(task.id, {
              labels: [
                ...new Set(
                  e.target.value
                    .split(",")
                    .map((label) => label.trim())
                    .filter(Boolean),
                ),
              ],
            })
          }
        />
      </label>
      <section className="linked-work">
        <h3>
          <Link2 size={15} />
          Linked documents
        </h3>
        {task.relatedDocumentIds.map((id) => {
          const tab = documents.find((tab) => tab.id === id);
          return (
            <div key={id} className="linked-work-row">
              <button
                disabled={!tab}
                onClick={() => {
                  openTab(id);
                  select(null);
                }}
              >
                <ArrowUpRight size={14} />
                {tab
                  ? titleWithoutExtension(tab.title)
                  : "Document unavailable"}
              </button>
              <button
                aria-label="Remove document link"
                onClick={() =>
                  update(task.id, {
                    relatedDocumentIds: task.relatedDocumentIds.filter(
                      (target) => target !== id,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          );
        })}
        <select
          aria-label="Link a document"
          value=""
          onChange={(e) => {
            if (e.target.value)
              update(task.id, {
                relatedDocumentIds: [
                  ...task.relatedDocumentIds,
                  e.target.value,
                ],
              });
          }}
        >
          <option value="">Link a note or reference…</option>
          {documents
            .filter((tab) => !task.relatedDocumentIds.includes(tab.id))
            .map((tab) => (
              <option key={tab.id} value={tab.id}>
                {titleWithoutExtension(tab.title)}
              </option>
            ))}
        </select>
      </section>
      <div className="task-detail-footer">
        <span>
          {task.createdAt
            ? `Created ${new Date(task.createdAt).toLocaleDateString()}`
            : "Imported task"}
        </span>
        <button
          className="workspace-danger-button"
          onClick={() => {
            update(task.id, { deletedAt: Date.now() });
            select(null);
          }}
        >
          <Trash2 size={14} />
          Move to trash
        </button>
        <Button size="sm" variant="outline" onClick={() => select(null)}>Done</Button>
      </div>
    </>
  );
}
