import type { EditorState, NoteType, Tab } from "./store";
import {
  defaultDocumentMeta,
  emptyProjectData,
  migrateProjectData,
  PROJECT_COLORS,
  serializeBoard,
  type Navigation,
  type Project,
  type ProjectBoard,
  type ProjectData,
  type ProjectTask,
  type TaskStatus,
} from "./projects";

export type NewTaskOptions = Partial<Pick<ProjectTask,
  "projectId" | "boardId" | "columnId" | "status" | "relatedDocumentIds" |
  "description" | "priority" | "dueDate" | "labels"
>>;
export type TaskDraft = NewTaskOptions & { title: string; workspaceId: string };

export interface ProjectSlice {
  projectData: ProjectData;
  navigation: Navigation;
  selectedTaskId: string | null;
  taskDraft: TaskDraft | null;
  createProject: (name: string, withBrief?: boolean) => string;
  updateProject: (
    id: string,
    changes: Partial<
      Pick<Project, "name" | "description" | "color" | "archivedAt" | "folderId">
    >,
  ) => void;
  navigate: (page: Navigation["page"], projectId?: string | null, folderId?: string) => void;
  createProjectDocument: (type?: NoteType, template?: string, folderId?: string) => void;
  assignDocument: (id: string, projectId: string | null) => void;
  addTask: (title: string, options?: NewTaskOptions) => string | null;
  beginTask: (options?: NewTaskOptions & { title?: string }) => void;
  cancelTaskDraft: () => void;
  submitTaskDraft: (title: string, options: NewTaskOptions) => string | null;
  updateBoard: (id: string, changes: Partial<Pick<ProjectBoard, "columns" | "showCompleted">>) => void;
  updateTask: (
    id: string,
    changes: Partial<
      Pick<
        ProjectTask,
        | "title"
        | "description"
        | "status"
        | "priority"
        | "dueDate"
        | "labels"
        | "projectId"
        | "relatedDocumentIds"
        | "columnId"
        | "order"
        | "deletedAt"
      >
    >,
  ) => void;
  selectTask: (id: string | null) => void;
  restoreDocument: (id: string) => void;
  purgeDocument: (id: string) => void;
  createTaskFromSelection: () => void;
}
type SetState = (
  partial:
    | Partial<EditorState>
    | ((state: EditorState) => Partial<EditorState>),
) => void;

export type CaptureContext = { folderId?: string; projectId: string | null };

export function getCaptureContext(state: EditorState, folderId?: string): CaptureContext {
  const projects = Object.values(state.projectData.projects).filter(
    (project) => project.workspaceId === state.activeProfileId,
  );
  const active = state.viewMode === "graph" ? undefined : state.tabs.find(
    (tab) => tab.id === state.activeTabId && (tab.workspaceId ?? "default") === state.activeProfileId,
  );
  const targetFolderId = folderId ?? (!active ? state.navigation.folderId : undefined);
  if (targetFolderId) {
    const folder = state.folders.find((entry) => entry.id === targetFolderId);
    if (folder) {
      const visited = new Set<string>();
      let ancestor = folder;
      while (!visited.has(ancestor.id)) {
        visited.add(ancestor.id);
        const project = projects.find((entry) => entry.folderId === ancestor.id);
        if (project) return { folderId: folder.id, projectId: project.id };
        const parent = state.folders.find((entry) => entry.id === ancestor.parentId);
        if (!parent) break;
        ancestor = parent;
      }
      return { folderId: folder.id, projectId: null };
    }
  }

  const project = projects.find((entry) => entry.id === (
    active ? state.projectData.documents[active.id]?.projectId : state.navigation.projectId
  ));
  const destination = active?.folderId ?? project?.folderId;
  return {
    folderId: state.folders.find((folder) => folder.id === destination)?.id,
    projectId: project?.id ?? null,
  };
}

export function getCaptureFolder(state: EditorState, { folderId, projectId }: CaptureContext): string {
  if (folderId && state.folders.some((folder) => folder.id === folderId)) return folderId;
  const project = projectId ? state.projectData.projects[projectId] : undefined;
  if (project) {
    const destination = state.createFolder(project.name);
    state.updateProject(project.id, { folderId: destination });
    return destination;
  }

  const projectFolders = new Set(Object.values(state.projectData.projects).map((entry) => entry.folderId));
  return state.folders.find((folder) => (
    !folder.parentId && folder.name === "Inbox" && !projectFolders.has(folder.id)
  ))?.id ?? state.createFolder("Inbox");
}
export function projectSlice(
  set: SetState,
  get: () => EditorState,
): ProjectSlice {
  const withProjections = (
    data: ProjectData,
    tabs = get().tabs,
  ): Partial<EditorState> => ({
    projectData: data,
    tabs: tabs.map((tab) => {
      const board = data.boards[tab.id];
      if (!board) return tab;
      const content = serializeBoard(
        board,
        Object.values(data.tasks).filter((task) => task.boardId === tab.id),
      );
      return content === tab.content ? tab : { ...tab, content };
    }),
  });
  return {
    projectData: emptyProjectData(),
    navigation: { page: "home", projectId: null },
    selectedTaskId: null,
    taskDraft: null,
    createProject: (name, withBrief = false) => {
      const title = name.trim();
      if (!title) return "";
      const s = get(),
        id = crypto.randomUUID(),
        now = Date.now();
      const project: Project = {
        folderId: s.createFolder(title),
        id,
        name: title,
        workspaceId: s.activeProfileId,
        description: "",
        color:
          PROJECT_COLORS[
            Object.keys(s.projectData.projects).length % PROJECT_COLORS.length
          ],
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      };
      set({
        projectData: {
          ...s.projectData,
          projects: { ...s.projectData.projects, [id]: project },
        },
        navigation: { page: "overview", projectId: id },
        activeTabId: null,
        viewMode: "editor",
        selectedTaskId: null,
        taskDraft: null,
      });
      if (withBrief) get().createProjectDocument("note", "brief");
      return id;
    },
    updateProject: (id, changes) =>
      set((s) => {
        const project = s.projectData.projects[id];
        if (!project) return {};
        return {
          projectData: {
            ...s.projectData,
            projects: {
              ...s.projectData.projects,
              [id]: {
                ...project,
                ...changes,
                name: changes.name?.trim() || project.name,
                updatedAt: Date.now(),
              },
            },
          },
        };
      }),
    navigate: (page, projectId = null, folderId) =>
      set({
        navigation: folderId ? { page, projectId, folderId } : { page, projectId },
        activeTabId: null,
        selectedTaskId: null,
        taskDraft: null,
        viewMode: "editor",
      }),
    createProjectDocument: (type = "note", template, targetFolderId) => {
      const s = get();
      if (type === "note" && !template) {
        s.requestCreateTab(targetFolderId);
        return;
      }
      const create = {
        note: s.createTab,
        whiteboard: s.createWhiteboard,
        mindmap: s.createMindmap,
        kanban: s.createKanban,
        pdf: s.createPdf,
      }[type];
      const context = getCaptureContext(s, targetFolderId);
      create(getCaptureFolder(s, context));
      const id = get().activeTabId;
      if (!id) return;
      if (context.projectId) get().assignDocument(id, context.projectId);
      const templates: Record<string, { title: string; content: string }> = {
        brief: {
          title: "Project brief.md",
          content:
            "# Project brief\n\n## Goal\n\n\n## Scope\n\n\n## Success criteria\n\n\n## Next steps\n\n",
        },
        meeting: {
          title: "Meeting notes.md",
          content:
            "# Meeting notes\n\n## Discussion\n\n\n## Decisions\n\n\n## Actions\n\n",
        },
        decision: {
          title: "Decision log.md",
          content:
            "# Decision log\n\n## Decision\n\n\n## Context\n\n\n## Alternatives considered\n\n\n## Follow-up\n\n",
        },
      };
      if (template && templates[template]) {
        get().renameTab(id, templates[template].title);
        get().updateContent(id, templates[template].content);
      }
    },
    assignDocument: (id, projectId) =>
      set((s) => {
        const tab = s.tabs.find((tab) => tab.id === id);
        const project = projectId ? s.projectData.projects[projectId] : null;
        if (
          !tab ||
          (projectId &&
            (!project ||
              project.workspaceId !== (tab.workspaceId ?? "default")))
        )
          return {};
        const now = Date.now(),
          meta = s.projectData.documents[id] ?? defaultDocumentMeta(id);
        const boards = { ...s.projectData.boards },
          tasks = { ...s.projectData.tasks };
        if (boards[id])
          boards[id] = { ...boards[id], projectId, updatedAt: now };
        for (const task of Object.values(tasks))
          if (task.boardId === id)
            tasks[task.id] = { ...task, projectId, updatedAt: now };
        return withProjections(
          {
            ...s.projectData,
            boards,
            tasks,
            documents: {
              ...s.projectData.documents,
              [id]: { ...meta, projectId, updatedAt: now },
            },
          },
          s.tabs,
        );
      }),
    addTask: (title, options = {}) => {
      if (!title.trim()) return null;
      const s = get(),
        id = crypto.randomUUID(),
        now = Date.now();
      const board = options.boardId
        ? s.projectData.boards[options.boardId]
        : null;
      const projectId = board
        ? board.projectId
        : options.projectId === undefined
          ? s.navigation.projectId
          : options.projectId;
      if (
        (options.boardId && !board) ||
        (board && board.workspaceId !== s.activeProfileId) ||
        (projectId &&
          s.projectData.projects[projectId]?.workspaceId !== s.activeProfileId)
      )
        return null;
      const column =
        board?.columns.find((column) => column.id === options.columnId) ??
        board?.columns.find(
          (column) => column.status === (options.status ?? "todo"),
        ) ??
        board?.columns[0];
      const task: ProjectTask = {
        id,
        title: title.trim().slice(0, 500),
        description: options.description ?? "",
        workspaceId: s.activeProfileId,
        projectId,
        status: column?.status ?? options.status ?? "todo",
        priority: options.priority ?? "medium",
        dueDate: options.dueDate ?? null,
        labels: options.labels ?? [],
        relatedDocumentIds: options.relatedDocumentIds ?? [],
        boardId: board?.id ?? null,
        columnId: column?.id ?? null,
        order: Object.values(s.projectData.tasks).reduce((last, item) => Math.max(last, item.order), -1) + 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      set(
        withProjections({
          ...s.projectData,
          tasks: { ...s.projectData.tasks, [id]: task },
        }),
      );
      return id;
    },
    beginTask: (options = {}) => set({
      selectedTaskId: null,
      taskDraft: { projectId: get().navigation.projectId, ...options, title: options.title ?? "", workspaceId: get().activeProfileId },
    }),
    cancelTaskDraft: () => set({ taskDraft: null }),
    submitTaskDraft: (title, options) => {
      const state = get();
      const draft = state.taskDraft;
      if (!draft || draft.workspaceId !== state.activeProfileId) return null;
      const id = state.addTask(title, { ...draft, ...options });
      if (id) set({ taskDraft: null });
      return id;
    },
    updateBoard: (id, changes) => set((state) => {
      const previous = state.projectData.boards[id];
      if (!previous || previous.workspaceId !== state.activeProfileId || changes.columns?.length === 0) return state;
      const updatedAt = Math.max(Date.now(), previous.updatedAt + 1);
      const board = { ...previous, ...changes, updatedAt };
      const tasks = { ...state.projectData.tasks };
      const columns = new Map(board.columns.map((column) => [column.id, column]));
      for (const task of Object.values(tasks)) {
        if (task.boardId !== id) continue;
        const current = task.columnId ? columns.get(task.columnId) : undefined;
        const oldIndex = previous.columns.findIndex((column) => column.id === task.columnId);
        const target = current ?? board.columns[Math.min(board.columns.length - 1, Math.max(0, oldIndex - 1))];
        if (target && (task.columnId !== target.id || (previous.columns[oldIndex]?.status !== target.status))) {
          tasks[task.id] = { ...task, columnId: target.id, status: target.status, updatedAt: Math.max(updatedAt, task.updatedAt + 1) };
        }
      }
      return withProjections({ ...state.projectData, boards: { ...state.projectData.boards, [id]: board }, tasks });
    }),
    updateTask: (id, changes) => {
      const s = get(),
        task = s.projectData.tasks[id];
      let data = s.projectData;
      if (!task) return;
      const next = {
        ...task,
        ...changes,
        title: changes.title?.trim().slice(0, 500) || task.title,
        updatedAt: Math.max(Date.now(), task.updatedAt + 1),
      };
      const board = task.boardId ? s.projectData.boards[task.boardId] : null;
      if (board && changes.columnId)
        next.status =
          board.columns.find((column) => column.id === changes.columnId)
            ?.status ?? next.status;
      if (board && changes.status && !changes.columnId) {
        const column = board.columns.find(
          (column) => column.status === changes.status,
        );
        if (column) next.columnId = column.id;
        else {
          const newColumn = {
            id: `${board.id}-${changes.status}`,
            title:
              changes.status === "done"
                ? "Done"
                : changes.status === "todo"
                  ? "To do"
                  : "In progress",
            status: changes.status as TaskStatus,
            color: "#3559c7",
            wipLimit: null,
          };
          data = {
            ...data,
            boards: {
              ...data.boards,
              [board.id]: {
                ...board,
                columns: [...board.columns, newColumn],
                updatedAt: Date.now(),
              },
            },
          };
          next.columnId = newColumn.id;
        }
      }
      // Moving a task to another project detaches it from its previous board.
      if (
        changes.projectId !== undefined &&
        changes.projectId !== task.projectId
      ) {
        next.boardId = null;
        next.columnId = null;
      }
      set(withProjections({ ...data, tasks: { ...data.tasks, [id]: next } }));
    },
    selectTask: (id) => set({ selectedTaskId: id, taskDraft: null }),
    restoreDocument: (id) =>
      set((s) => {
        const entry = s.projectData.trash[id];
        if (
          !entry ||
          (entry.document.workspaceId ?? "default") !== s.activeProfileId
        )
          return {};
        const trash = { ...s.projectData.trash };
        delete trash[id];
        const meta = s.projectData.documents[id] ?? defaultDocumentMeta(id);
        return {
          tabs: [
            ...s.tabs.filter((tab) => tab.id !== id),
            entry.document as Tab,
          ],
          projectData: {
            ...s.projectData,
            trash,
            documents: {
              ...s.projectData.documents,
              [id]: {
                ...meta,
                updatedAt: Math.max(Date.now(), entry.deletedAt + 1),
              },
            },
          },
        };
      }),
    purgeDocument: (id) =>
      set((s) => {
        if (!s.projectData.trash[id]) return {};
        const trash = { ...s.projectData.trash };
        delete trash[id];
        return {
          projectData: {
            ...s.projectData,
            trash,
            purged: { ...s.projectData.purged, [id]: Date.now() },
          },
        };
      }),
    createTaskFromSelection: () => {
      const s = get(),
        tab = s.tabs.find((tab) => tab.id === s.activeTabId);
      if (!tab || tab.noteType !== "note") return;
      const selection = s.editorView?.state.selection.main;
      let text = selection
        ? s.editorView?.state.sliceDoc(selection.from, selection.to)
        : "";
      if (!text && s.inlineTextarea && s.inlineSelection)
        text = s.inlineTextarea.value.slice(
          s.inlineSelection.from,
          s.inlineSelection.to,
        );
      s.beginTask({
        title: (text?.trim() ?? "")
          .replace(/^\s*[-*]\s*(\[[ x]\]\s*)?/i, "")
          .split("\n")[0],
        projectId: s.projectData.documents[tab.id]?.projectId ?? null,
        relatedDocumentIds: [tab.id],
        description: text?.trim() ?? "",
      });
    },
  };
}

/** Reconcile metadata after importing/restoring documents; does not overwrite existing task records. */
export { migrateProjectData };
