/** Versioned project records shared by the desktop, web and storage adapters. */
export type TaskStatus = "todo" | "in-progress" | "done";
export type ProjectPage =
  | "home"
  | "tasks"
  | "overview"
  | "notes"
  | "resources"
  | "unfiled"
  | "trash"
  | "files";
export type Navigation = {
  page: ProjectPage;
  projectId: string | null;
  folderId?: string;
};
export interface Project {
  folderId?: string;
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  archivedAt: number | null;
}
export interface ProjectTask {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  labels: string[];
  relatedDocumentIds: string[];
  boardId: string | null;
  columnId: string | null;
  order: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}
export interface DocumentMeta {
  id: string;
  projectId: string | null;
  createdAt: number | null;
  updatedAt: number;
  lastOpenedAt: number | null;
  relatedDocumentIds: string[];
}
export interface BoardColumn {
  id: string;
  title: string;
  color: string;
  wipLimit: number | null;
  status: TaskStatus;
}
export interface ProjectBoard {
  id: string;
  projectId: string | null;
  workspaceId: string;
  title: string;
  columns: BoardColumn[];
  showCompleted: boolean;
  updatedAt: number;
}
export interface StoredDocument {
  id: string;
  title: string;
  content: string;
  workspaceId?: string;
  folderId: string | null;
  tags: string[];
  pinned: boolean;
  noteType: "note" | "whiteboard" | "mindmap" | "kanban" | "pdf";
  customIcon?: string;
  iconColor?: string;
  origin?: "online" | "local";
}
export interface TrashEntry {
  id: string;
  document: StoredDocument;
  deletedAt: number;
  updatedAt: number;
}
export interface ProjectData {
  version: 1;
  projects: Record<string, Project>;
  tasks: Record<string, ProjectTask>;
  documents: Record<string, DocumentMeta>;
  boards: Record<string, ProjectBoard>;
  trash: Record<string, TrashEntry>;
  purged: Record<string, number>;
}
export interface DocumentSnapshot {
  id: string;
  title: string;
  content: string;
  savedAt: number;
  reason: "edit" | "restore" | "conflict";
}
export const PROJECT_COLORS = [
  "#3559c7",
  "#167d76",
  "#9b4e89",
  "#a56617",
  "#7061ab",
  "#b14e58",
];
export const TASK_STATUSES: { id: TaskStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in-progress", label: "In progress" },
  { id: "done", label: "Done" },
];
export function emptyProjectData(): ProjectData {
  return {
    version: 1,
    projects: {},
    tasks: {},
    documents: {},
    boards: {},
    trash: {},
    purged: {},
  };
}

/** Local file contents must not enter cloud sync through the trash envelope. */
export function serializeCloudProjectData(
  data: ProjectData,
  documents: StoredDocument[] = [],
): string {
  const localIds = new Set(
    documents
      .filter((document) => document.origin === "local")
      .map((document) => document.id),
  );
  for (const entry of Object.values(data.trash))
    if (entry.document.origin === "local") localIds.add(entry.id);
  return JSON.stringify({
    ...data,
    documents: Object.fromEntries(
      Object.entries(data.documents).filter(([id]) => !localIds.has(id)),
    ),
    boards: Object.fromEntries(
      Object.entries(data.boards).filter(([id]) => !localIds.has(id)),
    ),
    tasks: Object.fromEntries(
      Object.entries(data.tasks).filter(
        ([, task]) =>
          !(task.boardId && localIds.has(task.boardId)) &&
          !task.relatedDocumentIds.some((id) => localIds.has(id)),
      ),
    ),
    trash: Object.fromEntries(
      Object.entries(data.trash).filter(
        ([, entry]) => entry.document.origin !== "local",
      ),
    ),
  });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
/** Reject malformed envelopes instead of silently converting them to an empty workspace. */
export function parseProjectData(value: unknown): ProjectData {
  if (value == null || value === "") return emptyProjectData();
  const data: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!isRecord(data) || data.version !== 1)
    throw new Error(
      "This project data format is not supported. Update Markup before syncing.",
    );
  for (const key of [
    "projects",
    "tasks",
    "documents",
    "boards",
    "trash",
    "purged",
  ]) {
    if (!isRecord(data[key])) throw new Error(`Invalid project data: ${key}.`);
  }
  for (const key of ["projects", "tasks", "documents", "boards", "trash"]) {
    for (const [id, entry] of Object.entries(
      data[key] as Record<string, unknown>,
    )) {
      if (
        !isRecord(entry) ||
        entry.id !== id ||
        typeof entry.updatedAt !== "number" ||
        !Number.isFinite(entry.updatedAt)
      ) {
        throw new Error(
          `Invalid ${key} record. The original data has been preserved.`,
        );
      }
    }
  }
  return data as unknown as ProjectData;
}
/** Last modification wins per record, not per workspace; deletions retain tombstones. */
export function mergeProjectData(
  local: ProjectData,
  incoming: unknown,
): ProjectData {
  const remote = parseProjectData(incoming);
  const next = emptyProjectData();
  for (const key of [
    "projects",
    "tasks",
    "documents",
    "boards",
    "trash",
  ] as const) {
    const merged = { ...remote[key] } as Record<string, { updatedAt: number }>;
    for (const [id, record] of Object.entries(local[key])) {
      if (!merged[id] || record.updatedAt >= merged[id].updatedAt)
        merged[id] = record;
    }
    Object.assign(next[key], merged);
  }
  for (const source of [remote.purged, local.purged]) {
    for (const [id, timestamp] of Object.entries(source))
      next.purged[id] = Math.max(next.purged[id] ?? 0, timestamp);
  }
  for (const [id, entry] of Object.entries(next.trash)) {
    const meta = next.documents[id];
    if (
      (meta && meta.updatedAt > entry.deletedAt) ||
      (next.purged[id] ?? 0) >= entry.deletedAt
    )
      delete next.trash[id];
  }
  for (const [id, meta] of Object.entries(next.documents)) {
    next.documents[id] = {
      ...meta,
      lastOpenedAt:
        Math.max(
          local.documents[id]?.lastOpenedAt ?? 0,
          remote.documents[id]?.lastOpenedAt ?? 0,
        ) || null,
    };
  }
  return next;
}
export function titleWithoutExtension(title: string) {
  return title.replace(/\.(md|canvas|mindmap|kanban|pdf)$/i, "");
}
export function isTaskVisible(task: ProjectTask, data: ProjectData): boolean {
  return (
    !task.deletedAt &&
    (!task.boardId || (!data.trash[task.boardId] && !data.purged[task.boardId]))
  );
}
export function defaultDocumentMeta(id: string): DocumentMeta {
  // Legacy files have no reliable dates. Keep their history unknown until an actual action occurs.
  return {
    id,
    projectId: null,
    createdAt: null,
    updatedAt: 0,
    lastOpenedAt: null,
    relatedDocumentIds: [],
  };
}
export function migrateProjectData(
  data: ProjectData,
  tabs: StoredDocument[],
): ProjectData {
  let next = data;
  for (const tab of tabs) {
    if (!next.documents[tab.id])
      next = {
        ...next,
        documents: { ...next.documents, [tab.id]: defaultDocumentMeta(tab.id) },
      };
    if (tab.noteType !== "kanban" || next.boards[tab.id]) continue;
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(tab.content);
    } catch {
      continue;
    }
    if (!raw || !Array.isArray(raw.columns)) continue;
    const columns: BoardColumn[] = [];
    const tasks: Record<string, ProjectTask> = {};
    for (const [index, column] of raw.columns.entries()) {
      if (!isRecord(column) || typeof column.id !== "string") continue;
      const title =
        typeof column.title === "string" ? column.title : "Untitled column";
      const status: TaskStatus =
        column.status === "todo" ||
        column.status === "in-progress" ||
        column.status === "done"
          ? column.status
          : /done|complete/i.test(title) || column.id === "done"
            ? "done"
            : index === 0
              ? "todo"
              : "in-progress";
      columns.push({
        id: column.id,
        title,
        status,
        color: typeof column.color === "string" ? column.color : "#3559c7",
        wipLimit: typeof column.wipLimit === "number" ? column.wipLimit : null,
      });
      for (const [order, card] of (Array.isArray(column.cards)
        ? column.cards
        : []
      ).entries()) {
        if (!isRecord(card) || typeof card.id !== "string") continue;
        // Scope legacy IDs to their document: copied/imported boards can reuse card IDs.
        const id = `${tab.id}:${card.id}`;
        tasks[id] = {
          id,
          workspaceId: tab.workspaceId ?? "default",
          projectId: next.documents[tab.id].projectId,
          title: typeof card.title === "string" ? card.title : "Untitled task",
          description:
            typeof card.description === "string" ? card.description : "",
          priority:
            card.priority === "high" || card.priority === "low"
              ? card.priority
              : "medium",
          dueDate: typeof card.dueDate === "string" ? card.dueDate : null,
          labels: Array.isArray(card.labels)
            ? card.labels.filter((x): x is string => typeof x === "string")
            : [],
          status: card.completed ? "done" : status,
          relatedDocumentIds: [],
          boardId: tab.id,
          columnId: column.id,
          order,
          createdAt: typeof card.createdAt === "number" ? card.createdAt : 0,
          updatedAt: 0,
          deletedAt: null,
        };
      }
    }
    next = {
      ...next,
      tasks: { ...next.tasks, ...tasks },
      boards: {
        ...next.boards,
        [tab.id]: {
          id: tab.id,
          projectId: next.documents[tab.id].projectId,
          workspaceId: tab.workspaceId ?? "default",
          title:
            typeof raw.boardTitle === "string"
              ? raw.boardTitle
              : titleWithoutExtension(tab.title),
          columns,
          showCompleted: raw.showCompleted !== false,
          updatedAt: 0,
        },
      },
    };
  }
  return next;
}
/** .kanban is an export projection of task records, never another editable task store. */
export function serializeBoard(
  board: ProjectBoard,
  tasks: ProjectTask[],
): string {
  return JSON.stringify({
    version: 2,
    boardTitle: board.title,
    showCompleted: board.showCompleted,
    columns: board.columns.map((column) => ({
      ...column,
      cards: tasks
        .filter((task) => !task.deletedAt && task.columnId === column.id)
        .sort((a, b) => a.order - b.order)
        .map((task) => ({
          id: task.id.startsWith(`${board.id}:`)
            ? task.id.slice(board.id.length + 1)
            : task.id,
          title: task.title,
          description: task.description,
          labels: task.labels,
          dueDate: task.dueDate,
          priority: task.priority,
          completed: task.status === "done",
          createdAt: task.createdAt,
        })),
    })),
  });
}

/** Accept edits from the existing board UI while retaining task IDs and document links. */
export function applyBoardContent(
  data: ProjectData,
  document: StoredDocument,
): ProjectData {
  const boards = { ...data.boards };
  delete boards[document.id];
  const otherTasks = Object.fromEntries(
    Object.entries(data.tasks).filter(
      ([, task]) => task.boardId !== document.id,
    ),
  );
  const imported = migrateProjectData({ ...data, boards, tasks: otherTasks }, [
    document,
  ]);
  if (!imported.boards[document.id])
    throw new Error(
      "This board could not be read. Its previous data has been kept.",
    );
  const now = Date.now(),
    tasks = { ...data.tasks };
  const canonicalId = (id: string) => {
    const unscoped = id.slice(document.id.length + 1);
    return data.tasks[unscoped]?.boardId === document.id ? unscoped : id;
  };
  const importedIds = new Set(
    Object.values(imported.tasks)
      .filter((task) => task.boardId === document.id)
      .map((task) => canonicalId(task.id)),
  );
  for (const old of Object.values(data.tasks)) {
    if (old.boardId === document.id && !importedIds.has(old.id))
      tasks[old.id] = { ...old, deletedAt: now, updatedAt: now };
  }
  for (const task of Object.values(imported.tasks)) {
    if (task.boardId !== document.id) continue;
    const id = canonicalId(task.id),
      old = data.tasks[id];
    const candidate = {
      ...old,
      ...task,
      id,
      relatedDocumentIds: old?.relatedDocumentIds ?? [],
      projectId: old?.projectId ?? imported.boards[document.id].projectId,
      updatedAt: now,
    };
    tasks[id] =
      old &&
      JSON.stringify({ ...candidate, updatedAt: 0 }) ===
        JSON.stringify({ ...old, updatedAt: 0 })
        ? old
        : candidate;
  }
  return {
    ...imported,
    tasks,
    boards: {
      ...imported.boards,
      [document.id]: { ...imported.boards[document.id], updatedAt: now },
    },
  };
}
