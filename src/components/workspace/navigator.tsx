"use client";
import { useState } from "react";
import {
  Home,
  FileText,
  CheckCheck,
  Search,
  Settings,
  Plus,
  FolderOpen,
  Inbox,
  Trash2,
  LogIn,
  LogOut,
  PanelLeftClose,
} from "lucide-react";
import { FileTree } from "@/components/shell/file-tree";
import { useEditorStore } from "@/lib/store";
import { useAuthState } from "@/components/convex-client-provider";
import { signIn, signOut } from "@/lib/tauri";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateMenu } from "./project-pages";
import { SaveStatus } from "./save-status";

export function Navigator({
  onCreateProject,
  onNavigate,
}: {
  onCreateProject: () => void;
  onNavigate?: () => void;
}) {
  const data = useEditorStore((s) => s.projectData),
    workspaceId = useEditorStore((s) => s.activeProfileId),
    navigation = useEditorStore((s) => s.navigation),
    navigate = useEditorStore((s) => s.navigate);
  const [scope, setScope] = useState("all");
  const showIcons = useEditorStore((s) => s.settings.showIconsInSidebar);
  const { isAuthenticated, user } = useAuthState();
  const projects = Object.values(data.projects).filter(
    (project) => project.workspaceId === workspaceId && !project.archivedAt,
  );
  const go = (
    page: typeof navigation.page,
    projectId: string | null = null,
  ) => {
    navigate(page, projectId);
    onNavigate?.();
  };
  return (
    <aside
      className="markup-navigator"
      data-hide-navigation-icons={!showIcons || undefined}
      aria-label="Workspace navigation"
    >
      <div className="navigator-brand">
        <button className="markup-wordmark" onClick={() => go("home")}>
          markup<span aria-hidden="true">|</span>
        </button>
        <button
          className="workspace-icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={onNavigate}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>
      <div className="navigator-actions">
        <CreateMenu label="New" onCreated={onNavigate} />
        <button
          className="workspace-icon-button"
          title="Search files and commands (Ctrl+K)"
          aria-label="Search files and commands"
          onClick={() => {
            document.dispatchEvent(new CustomEvent("open-spotlight"));
            onNavigate?.();
          }}
        >
          <Search size={17} />
        </button>
      </div>
      <nav className="navigator-destinations">
        <button
          aria-current={navigation.page === "home" ? "page" : undefined}
          onClick={() => go("home")}
        >
          <Home size={16} />
          Home
        </button>
        <button
          aria-current={navigation.page === "files" ? "page" : undefined}
          onClick={() => go("files")}
        >
          <FileText size={15} />
          Files
        </button>
        <button
          aria-current={navigation.page === "tasks" ? "page" : undefined}
          onClick={() => go("tasks")}
        >
          <CheckCheck size={16} />
          Tasks
        </button>
        <button onClick={() => go("unfiled")} aria-label="Organise inbox">
          <Inbox size={16} />
          Inbox
        </button>
      </nav>
      <div className="navigator-scope">
        <select
          aria-label="File browser scope"
          value={scope}
          onChange={(event) => {
            const value = event.target.value;
            setScope(value);
            if (value !== "all") go("overview", value);
            else go("files");
          }}
        >
          <option value="all">All files</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <button
          className="workspace-icon-button"
          title="New project"
          aria-label="New project"
          onClick={onCreateProject}
        >
          <Plus size={15} />
        </button>
      </div>
      {scope !== "all" && (
        <button
          className="navigator-project-link"
          onClick={() => go("overview", scope)}
        >
          <FolderOpen size={14} />
          Project overview
        </button>
      )}
      <div className="navigator-files">
        <FileTree
          embedded
          mobile={!!onNavigate}
          onMobileClose={onNavigate}
          projectScope={scope === "all" ? undefined : scope}
        />
      </div>
      <div className="navigator-footer">
        <SaveStatus />
        <button
          className="workspace-icon-button"
          aria-label="Trash"
          title="Trash"
          onClick={() => go("trash")}
        >
          <Trash2 size={15} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="workspace-icon-button"
              aria-label="Account and settings"
              title={user?.email ?? "Account and settings"}
            >
              <Settings size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            <DropdownMenuItem
              onClick={() => {
                onNavigate?.();
                document.dispatchEvent(new CustomEvent("open-settings"));
              }}
            >
              Settings
            </DropdownMenuItem>
            {isAuthenticated ? (
              <DropdownMenuItem
                onClick={() => signOut(() => window.location.reload())}
              >
                <LogOut size={14} />
                Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => signIn(() => window.location.reload())}
              >
                <LogIn size={14} />
                Sign in
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
