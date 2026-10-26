"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  Circle,
  Columns3,
  Flag,
  Link2,
  List,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useEditorStore } from "@/lib/store";
import {
  isTaskVisible,
  TASK_STATUSES,
  titleWithoutExtension,
  type ProjectTask,
  type TaskStatus,
} from "@/lib/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function TaskView({
  projectId,
  boardId,
  compact = false,
  listOnly = false,
}: {
  projectId?: string | null;
  boardId?: string;
  compact?: boolean;
  listOnly?: boolean;
}) {
  const data = useEditorStore((s) => s.projectData);
  const workspaceId = useEditorStore((s) => s.activeProfileId);
  const addTask = useEditorStore((s) => s.addTask);
  const updateTask = useEditorStore((s) => s.updateTask);
  const selectTask = useEditorStore((s) => s.selectTask);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const viewKey = `markup-task-view:${workspaceId}:${boardId ?? projectId ?? "all"}`;
  const [view, setView] = useState<"list" | "board">(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(max-width: 800px)").matches
    )
      return "list";
    try {
      return localStorage.getItem(viewKey) === "board" ? "board" : "list";
    } catch {
      return "list";
    }
  });
  const chooseView = (next: "list" | "board") => {
    setView(next);
    try {
      localStorage.setItem(viewKey, next);
    } catch {
      /* View preferences are optional. */
    }
  };
  const [showDone, setShowDone] = useState(true);
  const [priority, setPriority] = useState("all");
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const board = boardId ? data.boards[boardId] : null;
  const tasks = useMemo(
    () =>
      Object.values(data.tasks)
        .filter(
          (task) =>
            task.workspaceId === workspaceId &&
            isTaskVisible(task, data) &&
            (projectId === undefined || task.projectId === projectId) &&
            (!boardId || task.boardId === boardId),
        )
        .sort((a, b) => a.order - b.order || b.createdAt - a.createdAt),
    [data, workspaceId, projectId, boardId],
  );
  const filtered = tasks.filter(
    (task) =>
      (showDone || task.status !== "done") &&
      (priority === "all" || task.priority === priority) &&
      `${task.title} ${task.description} ${task.labels.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const columns =
    board?.columns ??
    TASK_STATUSES.map((status) => ({
      ...status,
      title: status.label,
      status: status.id,
    }));
  const add = (event: FormEvent) => {
    event.preventDefault();
    const id = addTask(title, {
      ...(projectId !== undefined ? { projectId } : {}),
      ...(boardId ? { boardId } : {}),
    });
    if (id) setTitle("");
  };
  const move = (taskId: string, columnId: string, status: TaskStatus) => {
    updateTask(taskId, {
      ...(board ? { columnId } : { status }),
      order: Math.max(0, ...tasks.map((task) => task.order)) + 1,
    });
    setDraggedTask(null);
    setDropTarget(null);
  };
  return (
    <div className={cn("task-workspace", compact && "task-workspace-compact")}>
      {!compact && (
        <div className="task-view-tools">
          {!listOnly && (
            <div className="view-switch" aria-label="Task view">
              <button
                aria-pressed={view === "list"}
                onClick={() => chooseView("list")}
              >
                <List size={15} />
                List
              </button>
              <button
                aria-pressed={view === "board"}
                onClick={() => chooseView("board")}
              >
                <Columns3 size={15} />
                Board
              </button>
            </div>
          )}
          <label className="workspace-search-field">
            <Search size={15} />
            <input
              aria-label="Filter tasks"
              placeholder="Filter tasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by priority"
            className="workspace-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
          <label className="completed-filter">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
            />
            Show completed
          </label>
          {(query || priority !== "all" || !showDone) && (
            <button
              className="workspace-text-button"
              onClick={() => {
                setQuery("");
                setPriority("all");
                setShowDone(true);
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}
      <form className="task-quick-add" onSubmit={add}>
        <Plus size={17} />
        <input
          aria-label="New task title"
          placeholder="Add a task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={500}
        />
        <Button type="submit" size="sm" disabled={!title.trim()}>
          Add task
        </Button>
      </form>
      {filtered.length === 0 && (view === "list" || listOnly) && (
        <div className="workspace-empty-inline">
          <Circle size={22} />
          <h3>
            {tasks.length ? "No tasks match these filters" : "No tasks yet"}
          </h3>
          <p>
            {tasks.length
              ? "Try a different search or reset your filters."
              : "Add a task above, or select text in a note to turn it into a task."}
          </p>
        </div>
      )}
      {view === "list" || compact || listOnly ? (
        <div className="task-list">
          {filtered.slice(0, compact ? 5 : undefined).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onOpen={() => selectTask(task.id)}
              showProject={projectId === undefined}
            />
          ))}
        </div>
      ) : (
        <div className="task-board">
          {columns.map((column) => {
            const items = filtered.filter((task) =>
              board
                ? task.columnId === column.id
                : task.status === column.status,
            );
            return (
              <section
                key={column.id}
                className={cn(
                  "task-column",
                  dropTarget === column.id && "task-column-drop",
                )}
                aria-label={column.title}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropTarget(column.id);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(event.relatedTarget as Node)
                  )
                    setDropTarget(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const id =
                    event.dataTransfer.getData("text/markup-task") ||
                    draggedTask;
                  if (id && tasks.some((task) => task.id === id))
                    move(id, column.id, column.status);
                }}
              >
                <header>
                  <span
                    className={cn("status-dot", `status-${column.status}`)}
                  />
                  <h3>{column.title}</h3>
                  <span className="workspace-count">{items.length}</span>
                </header>
                <div className="task-column-items">
                  {items.map((task) => (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedTask(task.id);
                        event.dataTransfer.setData("text/markup-task", task.id);
                      }}
                      onDragEnd={() => {
                        setDraggedTask(null);
                        setDropTarget(null);
                      }}
                      className={cn(
                        "task-card",
                        draggedTask === task.id && "task-card-dragging",
                      )}
                    >
                      <button
                        className="task-card-title"
                        onClick={() => selectTask(task.id)}
                      >
                        {task.title}
                      </button>
                      {task.description && (
                        <p className="task-card-excerpt">{task.description}</p>
                      )}
                      <div className="task-card-meta">
                        {task.relatedDocumentIds.length > 0 && (
                          <span>
                            <Link2 size={12} />
                            {task.relatedDocumentIds.length}
                          </span>
                        )}
                        {task.dueDate && (
                          <DueDate
                            value={task.dueDate}
                            done={task.status === "done"}
                          />
                        )}
                        {task.priority === "high" && (
                          <span className="priority-high">
                            <Flag size={12} />
                            High
                          </span>
                        )}
                      </div>
                      <select
                        aria-label={`Move ${task.title}`}
                        value={board ? (task.columnId ?? "") : task.status}
                        onChange={(e) => {
                          const target = columns.find(
                            (column) => column.id === e.target.value,
                          );
                          if (target) move(task.id, target.id, target.status);
                        }}
                        className="task-move-select"
                      >
                        {columns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.title}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
                <button
                  className="task-column-add"
                  onClick={() => {
                    const id = addTask("Untitled task", {
                      projectId: projectId ?? board?.projectId ?? null,
                      ...(boardId
                        ? { boardId, columnId: column.id }
                        : { status: column.status }),
                    });
                    if (id) selectTask(id);
                  }}
                >
                  <Plus size={14} />
                  Add task
                </button>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TaskRow({
  task,
  onOpen,
  showProject = false,
}: {
  task: ProjectTask;
  onOpen?: () => void;
  showProject?: boolean;
}) {
  const update = useEditorStore((s) => s.updateTask);
  const selectTask = useEditorStore((s) => s.selectTask);
  const project = useEditorStore((s) =>
    task.projectId ? s.projectData.projects[task.projectId] : null,
  );
  const board = useEditorStore((s) =>
    task.boardId ? s.projectData.boards[task.boardId] : null,
  );
  const statuses =
    board?.columns.map((column) => ({
      id: column.id,
      label: column.title,
    })) ?? TASK_STATUSES;
  return (
    <div className={cn("task-row", task.status === "done" && "task-row-done")}>
      <button
        className="task-check"
        aria-label={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`}
        aria-pressed={task.status === "done"}
        onClick={() =>
          update(task.id, { status: task.status === "done" ? "todo" : "done" })
        }
      >
        {task.status === "done" ? <Check size={14} /> : <Circle size={16} />}
      </button>
      <button
        className="task-row-title"
        onClick={onOpen ?? (() => selectTask(task.id))}
      >
        {task.title}
      </button>
      {showProject && project && (
        <span className="task-project-name">{project.name}</span>
      )}
      {task.relatedDocumentIds.length > 0 && (
        <span className="task-link-count" title="Linked documents">
          <Link2 size={13} />
          {task.relatedDocumentIds.length}
        </span>
      )}
      {task.dueDate && (
        <DueDate value={task.dueDate} done={task.status === "done"} />
      )}
      <select
        className="task-status-select"
        aria-label={`Status for ${task.title}`}
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
  return (
    <Dialog
      open={!!task && !task.deletedAt}
      onOpenChange={(open) => {
        if (!open) select(null);
      }}
    >
      <DialogContent className="workspace-task-drawer" showCloseButton>
        {task && <TaskDetails key={task.id} task={task} />}
      </DialogContent>
    </Dialog>
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
          <select
            value={task.priority}
            onChange={(e) =>
              update(task.id, {
                priority: e.target.value as ProjectTask["priority"],
              })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
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
      </div>
    </>
  );
}
