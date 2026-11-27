"use client";
import { useMemo, useState } from "react";
import {
  FileText,
  PenTool,
  GitBranch,
  KanbanSquare,
  FileType,
  Plus,
  FolderOpen,
  MoreHorizontal,
  Archive,
  Search,
} from "lucide-react";
import { getTabWorkspaceId, useEditorStore, type NoteType } from "@/lib/store";
import {
  isTaskVisible,
  titleWithoutExtension,
  PROJECT_COLORS,
} from "@/lib/projects";
import { DocumentRows, CreateMenu } from "./project-pages";
import { TaskRow, TaskView } from "./task-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
const TYPES: { type: NoteType; title: string; Icon: typeof FileText }[] = [
  { type: "note", title: "Note", Icon: FileText },
  { type: "whiteboard", title: "Whiteboard", Icon: PenTool },
  { type: "mindmap", title: "Mind map", Icon: GitBranch },
  { type: "kanban", title: "Task board", Icon: KanbanSquare },
  { type: "pdf", title: "PDF", Icon: FileType },
];
function folderPath(
  id: string,
  folders: { id: string; name: string; parentId: string | null }[],
) {
  const names: string[] = [],
    visited = new Set<string>();
  let folder = folders.find((entry) => entry.id === id);
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id);
    names.unshift(folder.name);
    folder = folders.find((entry) => entry.id === folder?.parentId);
  }
  return names.join(" / ") || "Loose files";
}
function CaptureTypes() {
  const create = useEditorStore((s) => s.createProjectDocument);
  return (
    <div className="home-capture">
      {TYPES.map(({ type, title, Icon }) => (
        <button key={type} onClick={() => create(type)}>
          <Icon size={18} />
          <span>{title}</span>
          <Plus size={13} />
        </button>
      ))}
    </div>
  );
}

export function WorkbenchHome({
  onCreateProject,
}: {
  onCreateProject: () => void;
}) {
  const data = useEditorStore((s) => s.projectData),
    tabs = useEditorStore((s) => s.tabs),
    workspaceId = useEditorStore((s) => s.activeProfileId),
    navigate = useEditorStore((s) => s.navigate);
  const [archive, setArchive] = useState(false);
  const docs = tabs.filter((tab) => getTabWorkspaceId(tab) === workspaceId);
  const recent = docs.filter((tab) => data.documents[tab.id]?.lastOpenedAt)
    .sort(
      (a, b) =>
        (data.documents[b.id]?.lastOpenedAt ?? 0) -
        (data.documents[a.id]?.lastOpenedAt ?? 0),
    )
    .slice(0, 8);
  const pinned = docs.filter((tab) => tab.pinned).slice(0, 5);
  const projects = Object.values(data.projects).filter(
    (project) =>
      project.workspaceId === workspaceId && !!project.archivedAt === archive,
  );
  const due = Object.values(data.tasks)
    .filter(
      (task) =>
        task.workspaceId === workspaceId &&
        isTaskVisible(task, data) &&
        task.status !== "done" &&
        task.dueDate,
    )
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 5);
  return (
    <div className="workspace-page workbench-home">
      <div className="workbench-page-title">
        <h1>Home</h1>
      </div>
      <CaptureTypes />
      <div className="home-content-grid">
        <div>
          {pinned.length > 0 && (
            <section>
              <h2>Favourites</h2>
              <DocumentRows documents={pinned} showProject />
            </section>
          )}
          <section>
            <div className="workspace-section-heading">
              <h2>Recent files</h2>
              <button
                className="workspace-text-button"
                onClick={() => navigate("recent")}
              >
                View all recent
              </button>
            </div>
            {recent.length ? (
              <DocumentRows documents={recent} showProject />
            ) : (
              <div className="home-empty">
                <FileText size={24} />
                <p>Files you open appear here.</p>
              </div>
            )}
          </section>
        </div>
        <div>
          <section>
            <div className="workspace-section-heading">
              <h2>Projects</h2>
              <button
                className="workspace-icon-button"
                aria-label="New project"
                onClick={onCreateProject}
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="home-projects">
              {projects.map((project) => (
                <div key={project.id}>
                  <FolderOpen size={18} style={{ color: project.color }} />
                  <button onClick={() => navigate("overview", project.id)}>
                    {project.name}
                  </button>
                  {archive && (
                    <button
                      className="workspace-text-button"
                      onClick={() =>
                        useEditorStore
                          .getState()
                          .updateProject(project.id, { archivedAt: null })
                      }
                    >
                      Restore
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!projects.length && (
              <button className="home-add-project" onClick={onCreateProject}>
                <Plus size={15} />
                New project
              </button>
            )}
            <button
              className="workspace-text-button mt-4"
              onClick={() => setArchive(!archive)}
            >
              {archive ? "Active projects" : "Archived projects"}
            </button>
          </section>
          {due.length > 0 && (
            <section>
              <h2>Due next</h2>
              {due.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectOverviewV2() {
  const id = useEditorStore((s) => s.navigation.projectId),
    data = useEditorStore((s) => s.projectData),
    tabs = useEditorStore((s) => s.tabs),
    update = useEditorStore((s) => s.updateProject),
    navigate = useEditorStore((s) => s.navigate);
  const [settings, setSettings] = useState(false),
    [editingGoal, setEditingGoal] = useState(false);
  const project = id ? data.projects[id] : null;
  if (!project)
    return (
      <div className="workspace-page">
        <h1>Project unavailable</h1>
        <Button onClick={() => navigate("home")}>Home</Button>
      </div>
    );
  const docs = tabs.filter((tab) => data.documents[tab.id]?.projectId === id),
    boards = docs.filter((tab) => tab.noteType === "kanban");
  const tasks = Object.values(data.tasks).filter(
    (task) => task.projectId === id && isTaskVisible(task, data),
  );
  const progress = tasks.filter((task) => task.status === "in-progress");
  const overdue = tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.dueDate &&
      task.dueDate < new Date().toLocaleDateString("en-CA"),
  );
  const attention = [
    ...new Map(
      [...overdue, ...progress].map((task) => [task.id, task]),
    ).values(),
  ].slice(0, 6);
  const recent = [...docs]
    .sort(
      (a, b) =>
        (data.documents[b.id]?.updatedAt ?? 0) -
        (data.documents[a.id]?.updatedAt ?? 0),
    )
    .slice(0, 8);
  return (
    <div className="workspace-page project-overview">
      <div className="workbench-page-title">
        <h1>{project.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="workspace-icon-button"
              aria-label="Project options"
            >
              <MoreHorizontal size={18} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSettings(true)}>
              Project settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditingGoal(true)}>
              Edit project goal
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                update(project.id, { archivedAt: Date.now() });
                navigate("home");
              }}
            >
              <Archive size={14} />
              Archive project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {editingGoal ? (
        <label className="workspace-field project-goal">
          Project goal
          <textarea
            autoFocus
            defaultValue={project.description}
            rows={2}
            onBlur={(event) => {
              update(project.id, { description: event.target.value });
              setEditingGoal(false);
            }}
          />
        </label>
      ) : project.description ? (
        <button
          className="project-goal-text"
          onClick={() => setEditingGoal(true)}
        >
          {project.description}
        </button>
      ) : (
        <button
          className="workspace-text-button project-goal-empty"
          onClick={() => setEditingGoal(true)}
        >
          Add a project goal
        </button>
      )}
      <CaptureTypes />
      <div className="project-board-shortcuts">
        {boards.map((board) => (
          <button
            key={board.id}
            onClick={() => useEditorStore.getState().openTab(board.id)}
          >
            <KanbanSquare size={16} />
            {titleWithoutExtension(board.title)}
          </button>
        ))}
        {boards.length === 0 && (
          <button
            onClick={() =>
              useEditorStore.getState().createProjectDocument("kanban")
            }
          >
            <Plus size={15} />
            Create task board
          </button>
        )}
      </div>
      {attention.length > 0 && (
        <section>
          <h2>Needs attention</h2>
          {attention.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </section>
      )}
      <div className="home-content-grid">
        <section>
          <div className="workspace-section-heading">
            <h2>Files</h2>
            <CreateMenu />
          </div>
          {recent.length ? (
            <DocumentRows documents={recent} />
          ) : (
            <p className="workspace-muted-note">No files in this project</p>
          )}
        </section>
        <section>
          <div className="workspace-section-heading">
            <h2>Tasks</h2>
            <button
              className="workspace-text-button"
              onClick={() => navigate("tasks", project.id)}
            >
              All tasks ({tasks.length})
            </button>
          </div>
          <TaskView projectId={project.id} compact />
        </section>
      </div>
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription className="sr-only">
              Edit the project name and colour.
            </DialogDescription>
          </DialogHeader>
          <label className="workspace-field">
            Name
            <input
              defaultValue={project.name}
              onBlur={(event) =>
                update(project.id, { name: event.target.value })
              }
            />
          </label>
          <div className="project-colors">
            {PROJECT_COLORS.map((color) => (
              <button
                key={color}
                style={{ background: color }}
                aria-label={`Colour ${color}`}
                aria-pressed={project.color === color}
                onClick={() => update(project.id, { color })}
              />
            ))}
          </div>
          <Button onClick={() => setSettings(false)}>Done</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WorkspaceLibrary({ inbox = false }: { inbox?: boolean }) {
  const tabs = useEditorStore((s) => s.tabs),
    data = useEditorStore((s) => s.projectData),
    folders = useEditorStore((s) => s.folders),
    workspaceId = useEditorStore((s) => s.activeProfileId);
  const requestedFolderId = useEditorStore((s) => s.navigation.folderId);
  const folderId = inbox ? undefined : folders.find((folder) => folder.id === requestedFolderId)?.id;
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [type, setType] = useState("all"),
    [newFolder, setNewFolder] = useState("");
  const search = query.trim().toLowerCase();
  const folderOptions = useMemo(() => folders.map((folder) => ({
    ...folder, path: folderPath(folder.id, folders),
  })).sort((a, b) => a.path.localeCompare(b.path)), [folders]);
  const docs = useMemo(() => {
    const projectFolderIds = new Set(Object.values(data.projects).map((project) => project.folderId));
    const inboxFolders = new Set(folders.filter((folder) =>
      !folder.parentId && folder.name === "Inbox" && !projectFolderIds.has(folder.id),
    ).map((folder) => folder.id));
    return tabs.filter((tab) =>
      getTabWorkspaceId(tab) === workspaceId &&
      (!folderId || tab.folderId === folderId) &&
      (!inbox || (!data.documents[tab.id]?.projectId &&
        (!tab.folderId || inboxFolders.has(tab.folderId)))) &&
      (type === "all" || tab.noteType === type) &&
      `${tab.title} ${tab.tags.join(" ")}`.toLowerCase().includes(search),
    );
  }, [tabs, workspaceId, inbox, data.documents, data.projects, folders, type, search, folderId]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof docs>();
    for (const tab of docs) {
      const key = tab.folderId ?? "root";
      const group = map.get(key);
      if (group) group.push(tab);
      else map.set(key, [tab]);
    }
    return [...map].sort(([a], [b]) =>
      folderPath(a, folders).localeCompare(folderPath(b, folders)),
    );
  }, [docs, folders]);
  const selectedIds = docs.filter((tab) => selected.includes(tab.id)).map((tab) => tab.id);
  const allSelected = docs.length > 0 && selectedIds.length === docs.length;
  const hasFilters = Boolean(folderId || search || type !== "all");
  const move = (folderId: string) => {
    for (const id of selectedIds)
      useEditorStore.getState().moveTabToFolder(id, folderId);
    setSelected([]);
  };
  return (
    <div className="workspace-page">
      <div className="workbench-page-title">
        <h1>{inbox ? "Inbox" : "Files"}</h1>
        <CreateMenu />
      </div>
      <div className="document-library-tools">
        {!inbox && (
          <select
            className="workspace-select"
            aria-label="Filter by folder"
            value={folderId ?? ""}
            onChange={(event) => {
              useEditorStore.getState().navigate("files", null, event.target.value || undefined);
              setSelected([]);
            }}
          >
            <option value="">All folders</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.path}
              </option>
            ))}
          </select>
        )}
        <label className="workspace-search-field">
          <Search size={15} />
          <input
            placeholder="Filter by name or tag"
            aria-label="Filter files"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelected([]); }}
          />
        </label>
        <select
          className="workspace-select"
          aria-label="File type"
          value={type}
          onChange={(event) => { setType(event.target.value); setSelected([]); }}
        >
          <option value="all">All types</option>
          {TYPES.map((entry) => (
            <option key={entry.type} value={entry.type}>
              {entry.title}
            </option>
          ))}
        </select>
        <button
          className="workspace-text-button"
          disabled={!docs.length}
          onClick={() =>
            setSelected(allSelected ? [] : docs.map((tab) => tab.id))
          }
        >
          {allSelected ? "Clear selection" : "Select all"}
        </button>
      </div>
      {selectedIds.length > 0 && (
        <div className="file-bulk-actions">
          <strong aria-live="polite">{selectedIds.length} selected</strong>
          {!allSelected && <button onClick={() => setSelected([])}>Clear selection</button>}
          <select
            aria-label="Move selected files to folder"
            value=""
            onChange={(event) => {
              if (event.target.value) move(event.target.value);
            }}
          >
            <option value="">Move to folder…</option>
            {folderOptions.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.path}
              </option>
            ))}
          </select>
          <input
            aria-label="New folder name"
            placeholder="New folder name"
            value={newFolder}
            onChange={(event) => setNewFolder(event.target.value)}
          />
          <button
            disabled={!newFolder.trim()}
            onClick={() => {
              const name = newFolder.trim();
              if (!name) return;
              const folder =
                folders.find(
                  (folder) => folder.name === name && !folder.parentId,
                )?.id ?? useEditorStore.getState().createFolder(name);
              move(folder);
              setNewFolder("");
            }}
          >
            Move to new folder
          </button>
          <select
            aria-label="Assign selected files to a project"
            value=""
            onChange={(event) => {
              if (!event.target.value) return;
              for (const id of selectedIds)
                useEditorStore
                  .getState()
                  .assignDocument(id, event.target.value);
              setSelected([]);
            }}
          >
            <option value="">Assign to project…</option>
            {Object.values(data.projects)
              .filter(
                (project) =>
                  project.workspaceId === workspaceId && !project.archivedAt,
              )
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </select>
        </div>
      )}
      {groups.map(([folderId, items]) => (
        <section className="library-folder-group" key={folderId}>
          <h2>
            <FolderOpen size={16} />
            {folderPath(folderId, folders)}
            <span>{items.length}</span>
          </h2>
          {items.map((tab) => (
            <div className="selectable-document" key={tab.id}>
              <input
                type="checkbox"
                aria-label={`Select ${tab.title}`}
                checked={selected.includes(tab.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, tab.id]
                      : selected.filter((id) => id !== tab.id),
                  )
                }
              />
              <DocumentRows documents={[tab]} showProject />
            </div>
          ))}
        </section>
      ))}
      {!docs.length && (
        <div className="workspace-empty-inline">
          <FolderOpen size={24} aria-hidden />
          <h3>{hasFilters ? "No matching files" : inbox ? "Inbox is clear" : "No files yet"}</h3>
          {hasFilters && (
            <button className="workspace-text-button" onClick={() => {
              setQuery("");
              setType("all");
              setSelected([]);
              useEditorStore.getState().navigate(inbox ? "unfiled" : "files");
            }}>Clear filters</button>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskBoardsBar({ projectId }: { projectId: string | null }) {
  const tabs = useEditorStore((s) => s.tabs),
    data = useEditorStore((s) => s.projectData),
    workspaceId = useEditorStore((s) => s.activeProfileId);
  const boards = tabs.filter(
    (tab) =>
      tab.noteType === "kanban" &&
      getTabWorkspaceId(tab) === workspaceId &&
      (!projectId || data.documents[tab.id]?.projectId === projectId),
  );
  return (
    <div className="project-board-shortcuts task-board-links">
      {boards.map((board) => (
        <button
          key={board.id}
          onClick={() => useEditorStore.getState().openTab(board.id)}
        >
          <KanbanSquare size={15} />
          {titleWithoutExtension(board.title)}
        </button>
      ))}
      <button
        onClick={() =>
          useEditorStore.getState().createProjectDocument("kanban")
        }
      >
        <Plus size={15} />
        New board
      </button>
    </div>
  );
}
