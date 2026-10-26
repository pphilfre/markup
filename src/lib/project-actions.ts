import type { EditorState, NoteType, Tab } from "./store";
import {
  defaultDocumentMeta,
  emptyProjectData,
  migrateProjectData,
  PROJECT_COLORS,
  serializeBoard,
  type Navigation,
  type Project,
  type ProjectData,
  type ProjectTask,
  type TaskStatus,
} from "./projects";

export interface ProjectSlice {
  projectData: ProjectData;
  navigation: Navigation;
  selectedTaskId: string | null;
  createProject: (name: string, withBrief?: boolean) => string;
  updateProject: (
    id: string,
    changes: Partial<
      Pick<Project, "name" | "description" | "color" | "archivedAt">
    >,
  ) => void;
  navigate: (page: Navigation["page"], projectId?: string | null) => void;
  createProjectDocument: (type?: NoteType, template?: string) => void;
  assignDocument: (id: string, projectId: string | null) => void;
  addTask: (
    title: string,
    options?: Partial<
      Pick<
        ProjectTask,
        | "projectId"
        | "boardId"
        | "columnId"
        | "status"
        | "relatedDocumentIds"
        | "description"
      >
    >,
  ) => string | null;
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
    navigate: (page, projectId = null) =>
      set({
        navigation: { page, projectId },
        activeTabId: null,
        selectedTaskId: null,
        viewMode: "editor",
      }),
    createProjectDocument: (type = "note", template) => {
      const s = get();
      const create = {
        note: s.createTab,
        whiteboard: s.createWhiteboard,
        mindmap: s.createMindmap,
        kanban: s.createKanban,
        pdf: s.createPdf,
      }[type];
      const current = s.tabs.find((tab) => tab.id === s.activeTabId);
      const project = s.navigation.projectId
        ? s.projectData.projects[s.navigation.projectId]
        : null;
      const folderId =
        current?.folderId ??
        project?.folderId ??
        s.folders.find(
          (folder) =>
            folder.name === (project?.name ?? "Inbox") && !folder.parentId,
        )?.id ??
        s.createFolder(project?.name ?? "Inbox");
      create(folderId);
      const id = get().activeTabId;
      if (!id) return;
      get().assignDocument(id, s.navigation.projectId);
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
      requestAnimationFrame(() => get().editorView?.focus());
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
        priority: "medium",
        dueDate: null,
        labels: [],
        relatedDocumentIds: options.relatedDocumentIds ?? [],
        boardId: board?.id ?? null,
        columnId: column?.id ?? null,
        order: Object.keys(s.projectData.tasks).length,
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
    selectTask: (id) => set({ selectedTaskId: id }),
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
      const id = s.addTask(
        (text?.trim() || "Untitled task")
          .replace(/^\s*[-*]\s*(\[[ x]\]\s*)?/i, "")
          .split("\n")[0],
        {
          projectId: s.projectData.documents[tab.id]?.projectId ?? null,
          relatedDocumentIds: [tab.id],
          description: text?.trim() ?? "",
        },
      );
      if (id) set({ selectedTaskId: id });
    },
  };
}

/** Reconcile metadata after importing/restoring documents; does not overwrite existing task records. */
export { migrateProjectData };
