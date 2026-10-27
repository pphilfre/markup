"use client";

import { useState, type FormEvent } from "react";
import {
  Pin,
  CheckCheck,
  FileText,
  FolderOpen,
  GitBranch,
  KanbanSquare,
  MoreHorizontal,
  PenTool,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  FileType,
} from "lucide-react";
import {
  getTabWorkspaceId,
  useEditorStore,
  type NoteType,
  type Tab,
} from "@/lib/store";
import { titleWithoutExtension } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  WorkbenchHome,
  ProjectOverviewV2,
  WorkspaceLibrary,
  TaskBoardsBar,
} from "./workbench-home";
import { TaskView } from "./task-view";

export const DOCUMENT_ICONS = {
  note: FileText,
  whiteboard: PenTool,
  mindmap: GitBranch,
  kanban: KanbanSquare,
  pdf: FileType,
};
export function CreateMenu({
  label = "New note",
  onCreated,
}: {
  label?: string;
  onCreated?: () => void;
}) {
  const createDocument = useEditorStore((s) => s.createProjectDocument);
  const create = (type?: NoteType, template?: string) => {
    createDocument(type, template);
    onCreated?.();
  };
  return (
    <div className="workspace-create-menu">
      <Button size="sm" onClick={() => create()}>
        <Plus size={15} />
        {label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            aria-label="More creation options"
            className="create-menu-more"
          >
            <MoreHorizontal size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => create("note", "brief")}>
            Project brief
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => create("note", "meeting")}>
            Meeting notes
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => create("note", "decision")}>
            Decision log
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {(["kanban", "whiteboard", "mindmap", "pdf"] as NoteType[]).map(
            (type) => {
              const Icon = DOCUMENT_ICONS[type];
              return (
                <DropdownMenuItem key={type} onClick={() => create(type)}>
                  <Icon size={15} />
                  {type === "kanban"
                    ? "Task board"
                    : type === "mindmap"
                      ? "Mind map"
                      : type === "pdf"
                        ? "PDF document"
                        : "Whiteboard"}
                </DropdownMenuItem>
              );
            },
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
export function NewProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState(true);
  const create = useEditorStore((s) => s.createProject);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (create(name, brief)) {
      setName("");
      onClose();
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="workspace-project-dialog">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Create a project to group related files and tasks.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="workspace-project-form">
          <label className="workspace-field">
            Project name
            <input
              autoFocus
              placeholder="e.g. Website refresh"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="workspace-checkbox">
            <input
              type="checkbox"
              checked={brief}
              onChange={(e) => setBrief(e.target.checked)}
            />
            Start with a project brief
          </label>
          <Button type="submit" disabled={!name.trim()}>
            Create project
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ProjectPages({
  onCreateProject,
}: {
  onCreateProject: () => void;
}) {
  const navigation = useEditorStore((s) => s.navigation);
  if (navigation.page === "tasks")
    return (
      <div className="workspace-page workspace-page-wide">
        <PageHeading
          title={navigation.projectId ? "Tasks" : "My tasks"}
          description={
            navigation.projectId
              ? "The next steps for this project."
              : "The next steps, across your workspace."
          }
        />
        <TaskBoardsBar projectId={navigation.projectId} />
        <TaskView
          key={navigation.projectId ?? "workspace"}
          projectId={navigation.projectId ?? undefined}
        />
      </div>
    );
  if (navigation.page === "trash") return <TrashPage />;
  if (navigation.page === "files" || navigation.page === "unfiled")
    return <WorkspaceLibrary inbox={navigation.page === "unfiled"} />;
  if (["notes", "resources"].includes(navigation.page))
    return <DocumentLibrary />;
  if (navigation.projectId)
    return <ProjectOverviewV2 key={navigation.projectId} />;
  return <WorkbenchHome onCreateProject={onCreateProject} />;
}
export function PageHeading({
  title,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="workspace-page-heading">
      <div>
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}
function DocumentLibrary() {
  const navigation = useEditorStore((s) => s.navigation);
  const data = useEditorStore((s) => s.projectData);
  const tabs = useEditorStore((s) => s.tabs);
  const workspaceId = useEditorStore((s) => s.activeProfileId);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated");
  const title =
    navigation.page === "unfiled"
      ? "Unfiled"
      : navigation.page === "resources"
        ? "Resources"
        : "Notes";
  const documents = tabs
    .filter(
      (tab) =>
        getTabWorkspaceId(tab) === workspaceId &&
        (data.documents[tab.id]?.projectId ?? null) === navigation.projectId &&
        (navigation.page === "unfiled" ||
          (navigation.page === "notes"
            ? tab.noteType === "note"
            : tab.noteType !== "note")) &&
        `${tab.title} ${tab.tags.join(" ")} ${tab.noteType === "note" ? tab.content : ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : (data.documents[b.id]?.updatedAt ?? 0) -
          (data.documents[a.id]?.updatedAt ?? 0),
    );
  return (
    <div className="workspace-page">
      <PageHeading
        title={title}
        description={
          navigation.page === "unfiled"
            ? "Capture first. Organise when you’re ready."
            : navigation.page === "notes"
              ? "The thinking behind the work."
              : "Boards, canvases, and references for this project."
        }
      >
        <CreateMenu />
      </PageHeading>
      <div className="document-library-tools">
        <label className="workspace-search-field">
          <Search size={16} />
          <input
            placeholder={`Search ${title.toLowerCase()}…`}
            aria-label={`Search ${title.toLowerCase()}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          className="workspace-select"
          aria-label="Sort documents"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="updated">Last modified</option>
          <option value="name">Name</option>
        </select>
      </div>
      {documents.length ? (
        <DocumentRows documents={documents} showProject />
      ) : (
        <div className="workspace-empty-inline">
          <FolderOpen size={25} />
          <h3>{query ? "No matching documents" : "Nothing here yet"}</h3>
          <p>
            {query
              ? "Try a different word or clear your search."
              : "Create a note or move an existing document here."}
          </p>
        </div>
      )}
    </div>
  );
}
export function DocumentRows({
  documents,
  showProject = false,
}: {
  documents: Tab[];
  showProject?: boolean;
}) {
  const open = useEditorStore((s) => s.openTab);
  const assign = useEditorStore((s) => s.assignDocument);
  const remove = useEditorStore((s) => s.deleteTab);
  const pin = useEditorStore((s) => s.togglePin);
  const data = useEditorStore((s) => s.projectData);
  return (
    <div className="document-list">
      {documents.map((tab) => {
        const Icon = DOCUMENT_ICONS[tab.noteType] ?? FileText;
        const meta = data.documents[tab.id];
        const project = meta?.projectId ? data.projects[meta.projectId] : null;
        return (
          <div key={tab.id} className="document-row">
            <Icon size={18} className="document-type-icon" />
            <button className="document-row-main" onClick={() => open(tab.id)}>
              <strong>{titleWithoutExtension(tab.title)}</strong>
              {showProject && (
                <span>
                  {project?.name ??
                    (tab.noteType === "note"
                      ? "Note"
                      : tab.noteType === "kanban"
                        ? "Task board"
                        : tab.noteType === "mindmap"
                          ? "Mind map"
                          : tab.noteType === "pdf"
                            ? "PDF"
                            : "Whiteboard")}
                </span>
              )}
            </button>
            {tab.pinned && <Pin size={13} className="text-muted-foreground" />}
            <span className="document-date">
              {meta?.updatedAt
                ? new Date(meta.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : ""}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={`Options for ${tab.title}`}
                  className="workspace-icon-button"
                >
                  <MoreHorizontal size={17} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => open(tab.id)}>
                  Open document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => pin(tab.id)}>
                  {tab.pinned ? "Unpin" : "Pin document"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Move to project
                </div>
                <DropdownMenuItem onClick={() => assign(tab.id, null)}>
                  No project
                </DropdownMenuItem>
                {Object.values(data.projects)
                  .filter(
                    (project) =>
                      project.workspaceId === getTabWorkspaceId(tab) &&
                      !project.archivedAt,
                  )
                  .map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => assign(tab.id, project.id)}
                    >
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => remove(tab.id)}
                >
                  <Trash2 size={14} />
                  Move to trash
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </div>
  );
}
function TrashPage() {
  const data = useEditorStore((s) => s.projectData);
  const workspaceId = useEditorStore((s) => s.activeProfileId);
  const restore = useEditorStore((s) => s.restoreDocument);
  const purge = useEditorStore((s) => s.purgeDocument);
  const update = useEditorStore((s) => s.updateTask);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const entries = Object.values(data.trash)
    .filter((entry) => getTabWorkspaceId(entry.document) === workspaceId)
    .sort((a, b) => b.deletedAt - a.deletedAt);
  const tasks = Object.values(data.tasks).filter(
    (task) => task.workspaceId === workspaceId && task.deletedAt,
  );
  return (
    <div className="workspace-page">
      <PageHeading
        title="Trash"
        description="Restore work you still need. Items stay here until you delete them permanently."
      />
      {!entries.length && !tasks.length && (
        <div className="workspace-empty-inline">
          <Trash2 size={25} />
          <h3>Nothing in the trash</h3>
          <p>Deleted documents and tasks will appear here.</p>
        </div>
      )}
      {entries.map((entry) => (
        <div key={entry.id} className="document-row">
          <FileText size={18} />
          <div className="document-row-main">
            <strong>{titleWithoutExtension(entry.document.title)}</strong>
            <span>
              Deleted {new Date(entry.deletedAt).toLocaleDateString()}
            </span>
          </div>
          <button
            className="workspace-text-button"
            onClick={() => restore(entry.id)}
          >
            <RotateCcw size={14} />
            Restore
          </button>
          <button
            className="workspace-icon-button"
            aria-label={`Delete ${entry.document.title} permanently`}
            onClick={() => setConfirmId(entry.id)}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {tasks.map((task) => (
        <div key={task.id} className="document-row">
          <CheckCheck size={18} />
          <div className="document-row-main">
            <strong>{task.title}</strong>
            <span>Task</span>
          </div>
          <button
            className="workspace-text-button"
            onClick={() => update(task.id, { deletedAt: null })}
          >
            <RotateCcw size={14} />
            Restore
          </button>
        </div>
      ))}
      <Dialog
        open={!!confirmId}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document permanently?</DialogTitle>
            <DialogDescription>
              This removes the document from the app’s trash. You won’t be able
              to restore it here.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmId) purge(confirmId);
                setConfirmId(null);
              }}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
