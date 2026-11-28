"use client";

import { useState } from "react";
import {
  ChevronDown, ChevronRight, Clock3, FileText, Folder, FolderOpen, FolderPlus,
  Home, Inbox, LogIn, LogOut, MoreHorizontal, Network, PanelLeftClose,
  Plus, Settings, SquareCheck, Trash2,
} from "lucide-react";
import { FileItem, FileTree, ProfileSelector } from "@/components/shell/file-tree";
import { getTabWorkspaceId, useEditorStore } from "@/lib/store";
import { isTaskVisible } from "@/lib/projects";
import { useAuthState } from "@/components/convex-client-provider";
import { signIn, signOut } from "@/lib/tauri";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const mainDestinations = [
  { page: "home", label: "Home", Icon: Home, shortcut: "Alt+Shift+1" },
  { page: "files", label: "Files", Icon: FileText, shortcut: null },
  { page: "recent", label: "Recent", Icon: Clock3, shortcut: "Alt+Shift+2" },
  { page: "tasks", label: "Tasks", Icon: SquareCheck, shortcut: "Alt+Shift+3" },
  { page: "unfiled", label: "Inbox", Icon: Inbox, shortcut: null },
] as const;

export function Navigator({
  onCreateProject,
  onNavigate,
}: {
  onCreateProject: () => void;
  onNavigate?: () => void;
}) {
  const data = useEditorStore((s) => s.projectData);
  const tabs = useEditorStore((s) => s.tabs);
  const workspaceId = useEditorStore((s) => s.activeProfileId);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const mode = useEditorStore((s) => s.viewMode);
  const navigation = useEditorStore((s) => s.navigation);
  const navigate = useEditorStore((s) => s.navigate);
  const showIcons = useEditorStore((s) => s.settings.showIconsInSidebar);
  const hideExtensions = useEditorStore((s) => s.settings.hideMdExtensions || !s.settings.showFileExtensions);
  const { isAuthenticated, user } = useAuthState();
  const [scopes, setScopes] = useState<Record<string, string>>({});
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const projects = Object.values(data.projects).filter(
    (project) => project.workspaceId === workspaceId && !project.archivedAt,
  );
  const scope = projects.find((project) => project.id === scopes[workspaceId]);
  const favourites = tabs.filter((tab) => tab.pinned && getTabWorkspaceId(tab) === workspaceId);
  const openTasks = Object.values(data.tasks).filter((task) =>
    task.workspaceId === workspaceId && task.status !== "done" && isTaskVisible(task, data),
  ).length;
  const go = (page: typeof navigation.page, projectId: string | null = null) => {
    navigate(page, projectId);
    onNavigate?.();
  };
  const chooseScope = (id: string) => {
    setScopes((previous) => ({ ...previous, [workspaceId]: id }));
    go(id ? "overview" : "files", id || null);
  };
  return (
    <aside className="markup-navigator" data-hide-navigation-icons={!showIcons || undefined} aria-label="Workspace navigation">
      <div className="navigator-brand">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="markup-wordmark" aria-label="Markup account menu">
              <span className="markup-symbol" aria-hidden="true">M</span>
              <span>Markup</span>
              <ChevronDown size={13} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {isAuthenticated ? (
              <DropdownMenuItem title={user?.email} onSelect={() => signOut(() => window.location.reload())}><LogOut /> Sign out</DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => signIn(() => window.location.reload())}><LogIn /> Sign in</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {onNavigate && (
          <button className="workspace-icon-button sidebar-close" aria-label="Close navigation" onClick={onNavigate}>
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>
      <div className="navigator-space-switcher"><ProfileSelector onWorkspaceChanged={onNavigate} /></div>
      <div className="navigator-scroll">
      <nav className="navigator-destinations" aria-label="Main destinations">
        {mainDestinations.map(({ page, label, Icon, shortcut }) => (
          <button key={page} aria-keyshortcuts={shortcut ?? undefined} onClick={() => go(page)} aria-current={!activeTabId && mode !== "graph" && navigation.page === page ? "page" : undefined}>
            <Icon size={18} aria-hidden />
            <span>{label}</span>
            {page === "tasks" && openTasks > 0 && <span className="navigator-task-count" aria-label={openTasks + " open tasks"}>{openTasks}</span>}
            {shortcut && <kbd aria-hidden title={shortcut}>{shortcut.replace("+Shift+", "+⇧")}</kbd>}
          </button>
        ))}
      </nav>
      <details className="navigator-favourites" open>
        <summary><ChevronDown size={14} aria-hidden /> Favourites</summary>
        <div className="navigator-favourites-list">
          {favourites.map((tab) => (
            <FileItem
              key={tab.id}
              favourite
              tab={tab}
              isActive={tab.id === activeTabId}
              onSwitch={() => { useEditorStore.getState().openTab(tab.id); onNavigate?.(); }}
              onClose={() => useEditorStore.getState().deleteTab(tab.id)}
              hideMd={hideExtensions}
              mobile={Boolean(onNavigate)}
            />
          ))}
          {!favourites.length && <p className="navigator-empty">Pin a file to keep it here.</p>}
        </div>
      </details>
      <section className="navigator-workspace" aria-label="Workspace files">
        <div className="navigator-section-row">
          <button className="navigator-section-toggle" aria-expanded={workspaceExpanded} onClick={() => setWorkspaceExpanded(!workspaceExpanded)}>
            {workspaceExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Workspace
          </button>
          <button className="workspace-icon-button" title="New folder" aria-label="New folder" onClick={() => {
            useEditorStore.getState().createFolder("New Folder", scope?.folderId);
            setFilesExpanded(true);
            setWorkspaceExpanded(true);
          }}><FolderPlus size={16} /></button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="workspace-icon-button" aria-label="Workspace actions"><MoreHorizontal size={16} /></button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { useEditorStore.getState().requestCreateTab(); onNavigate?.(); }}><Plus /> New document</DropdownMenuItem>
              <DropdownMenuItem onSelect={onCreateProject}><Folder /> New project</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => {
                setToolbarVisible(!toolbarVisible);
                setFilesExpanded(true);
                setWorkspaceExpanded(true);
              }}><Settings /> {toolbarVisible ? "Hide file tree controls" : "Show file tree controls"}</DropdownMenuItem>
              {projects.length > 0 && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><FolderOpen /> File tree scope</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => chooseScope("")}>All files</DropdownMenuItem>
                    {projects.map((project) => (
                      <DropdownMenuItem key={project.id} onSelect={() => chooseScope(project.id)}>{project.name}</DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {workspaceExpanded && (
          <button className="navigator-root" aria-expanded={filesExpanded} onClick={() => setFilesExpanded(!filesExpanded)}>
            {filesExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {filesExpanded ? <FolderOpen size={17} /> : <Folder size={17} />}
            <span>{scope?.name ?? "Vault"}</span>
          </button>
        )}
        <div className="navigator-files" hidden={!workspaceExpanded || !filesExpanded}>
          <FileTree embedded mobile={Boolean(onNavigate)} onMobileClose={onNavigate} projectScope={scope?.id} toolbarVisible={toolbarVisible} />
        </div>
      </section>
      </div>
      <nav className="navigator-footer navigator-utilities" aria-label="Workspace tools">
        <button aria-current={mode === "graph" ? "page" : undefined} onClick={() => {
          useEditorStore.getState().setViewMode("graph");
          onNavigate?.();
        }}><Network size={15} /> Graph</button>
        <button aria-current={!activeTabId && mode !== "graph" && navigation.page === "trash" ? "page" : undefined}
          onClick={() => go("trash")}><Trash2 size={15} /> Trash</button>
      </nav>
    </aside>
  );
}
