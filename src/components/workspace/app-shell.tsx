"use client";
import { useEffect, useState } from "react";
import { Menu, Network, Search, Sparkles, X, Settings } from "lucide-react";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";
import { titleWithoutExtension } from "@/lib/projects";
import { useAiChatStore } from "@/lib/ai-chat-store";
import { MainContent } from "@/components/shell/main-content";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { ShareDialog } from "@/components/shell/share-dialog";
import { ExportDialog } from "@/components/shell/export-dialog";
import { PublishDialog } from "@/components/shell/publish-dialog";
import { OrgPanel } from "@/components/shell/org-panel";
import { Navigator } from "./navigator";
import { CreateMenu, NewProjectDialog, ProjectPages } from "./project-pages";
import { TaskDrawer } from "./task-view";
import { EditorToolbar } from "./editor-toolbar";
import { SaveStatus } from "./save-status";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [newProject, setNewProject] = useState(false),
    [navigationOpen, setNavigationOpen] = useState(false);
  const [action, setAction] = useState<"share" | "export" | "publish" | null>(
    null,
  );
  const activeId = useEditorStore((s) => s.activeTabId),
    tabs = useEditorStore((s) => s.tabs),
    openIds = useEditorStore((s) => s.openTabIds),
    workspaceId = useEditorStore((s) => s.activeProfileId),
    mode = useEditorStore((s) => s.viewMode),
    sidebarOpen = useEditorStore((s) => s.fileTreeOpen);
  const fileTreeWidth = useEditorStore((s) => s.settings.fileTreeWidth);
  const sidebarPosition = useEditorStore((s) => s.settings.sidebarPosition);
  const project = useEditorStore((s) =>
    s.navigation.projectId
      ? s.projectData.projects[s.navigation.projectId]
      : null,
  );
  const aiOpen = useAiChatStore((s) => s.panelOpen),
    setAiOpen = useAiChatStore((s) => s.setPanelOpen);
  const active = tabs.find((tab) => tab.id === activeId);
  const opened = openIds.flatMap((id) => {
    const tab = tabs.find((tab) => tab.id === id);
    return tab && getTabWorkspaceId(tab) === workspaceId ? [tab] : [];
  });
  useEffect(() => {
    const projectHandler = () => setNewProject(true),
      share = () => setAction("share"),
      exp = () => setAction("export"),
      publish = () => setAction("publish");
    document.addEventListener("create-project", projectHandler);
    document.addEventListener("open-share", share);
    document.addEventListener("open-export", exp);
    document.addEventListener("open-publish", publish);
    return () => {
      document.removeEventListener("create-project", projectHandler);
      document.removeEventListener("open-share", share);
      document.removeEventListener("open-export", exp);
      document.removeEventListener("open-publish", publish);
    };
  }, []);
  return (
    <div
      className={`workspace-shell markup-workbench${!sidebarOpen ? " workspace-sidebar-hidden" : ""}${sidebarPosition === "right" ? " workbench-sidebar-right" : ""}`}
    >
      <div
        className="workspace-desktop-sidebar"
        style={{ width: fileTreeWidth }}
      >
        <Navigator onCreateProject={() => setNewProject(true)} />
      </div>
      <div className="workspace-main">
        <header className="workbench-header">
          <button
            className="workspace-icon-button workspace-menu-button"
            aria-label="Open workspace navigation"
            onClick={() => setNavigationOpen(true)}
          >
            <Menu size={19} />
          </button>
          <div className="workbench-location">
            {project && (
              <button
                onClick={() =>
                  useEditorStore.getState().navigate("overview", project.id)
                }
              >
                {project.name}
              </button>
            )}
          </div>
          <button
            className="workbench-search"
            aria-label="Search workspace"
            onClick={() =>
              document.dispatchEvent(new CustomEvent("open-spotlight"))
            }
          >
            <Search size={14} />
            <span>Search files, text, commands</span>
            <kbd>Ctrl K</kbd>
          </button>
          <SaveStatus compact />
          <button
            className="workspace-icon-button"
            title="Graph"
            aria-label="Graph view"
            onClick={() => useEditorStore.getState().setViewMode("graph")}
          >
            <Network size={16} />
          </button>
          <button
            className={`workbench-ai${aiOpen ? " is-active" : ""}`}
            aria-label="Markup AI"
            aria-expanded={aiOpen}
            onClick={() => setAiOpen(!aiOpen)}
          >
            <Sparkles size={15} />
            <span>AI</span>
          </button>
          <button
            className="workspace-icon-button workbench-settings"
            title="Settings"
            aria-label="Settings"
            onClick={() =>
              document.dispatchEvent(new CustomEvent("open-settings"))
            }
          >
            <Settings size={16} />
          </button>
          <div className="workbench-mobile-create">
            <CreateMenu label="New" />
          </div>
        </header>
        {opened.length > 0 && (
          <div
            className="workspace-tabs"
            role="tablist"
            aria-label="Open documents"
          >
            {opened.map((tab) => (
              <DocumentTab
                key={tab.id}
                tab={tab}
                active={tab.id === activeId}
              />
            ))}
          </div>
        )}
        <div className="workspace-content">
          {mode === "graph" ? (
            <MainContent />
          ) : active ? (
            <>
              <EditorToolbar />
              <MainContent />
            </>
          ) : (
            <ProjectPages onCreateProject={() => setNewProject(true)} />
          )}
        </div>
      </div>
      {children}
      <SpotlightSearch />
      <TaskDrawer />
      <OrgPanel />
      <NewProjectDialog
        open={newProject}
        onClose={() => setNewProject(false)}
      />
      <Dialog open={navigationOpen} onOpenChange={setNavigationOpen}>
        <DialogContent
          className="workspace-mobile-navigation translate-x-0 translate-y-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Workspace navigation</DialogTitle>
            <DialogDescription>
              Browse your files, projects, and folders.
            </DialogDescription>
          </DialogHeader>
          <Navigator
            onCreateProject={() => {
              setNavigationOpen(false);
              setNewProject(true);
            }}
            onNavigate={() => setNavigationOpen(false)}
          />
        </DialogContent>
      </Dialog>
      {action === "share" && (
        <ShareDialog open onOpenChange={() => setAction(null)} />
      )}{" "}
      {action === "export" && (
        <ExportDialog open onOpenChange={() => setAction(null)} />
      )}{" "}
      {action === "publish" && (
        <PublishDialog open onOpenChange={() => setAction(null)} />
      )}
    </div>
  );
}
function DocumentTab({ tab, active }: { tab: Tab; active: boolean }) {
  const [editing, setEditing] = useState(false),
    [name, setName] = useState("");
  const commit = () => {
    const value = name.trim();
    if (value) {
      const extension = {
        note: ".md",
        whiteboard: ".canvas",
        mindmap: ".mindmap",
        kanban: ".kanban",
        pdf: ".pdf",
      }[tab.noteType];
      useEditorStore
        .getState()
        .renameTab(tab.id, titleWithoutExtension(value) + extension);
    }
    setEditing(false);
  };
  return (
    <div className={`workspace-tab${active ? " active" : ""}`}>
      {editing ? (
        <input
          autoFocus
          aria-label="Rename document"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
        />
      ) : (
        <button
          role="tab"
          aria-selected={active}
          onClick={() => useEditorStore.getState().openTab(tab.id)}
          onDoubleClick={() => {
            setName(titleWithoutExtension(tab.title));
            setEditing(true);
          }}
          title="Double-click to rename"
        >
          {titleWithoutExtension(tab.title)}
        </button>
      )}
      <button
        aria-label={`Close ${tab.title}`}
        onClick={() => useEditorStore.getState().closeTab(tab.id)}
      >
        <X size={12} />
      </button>
    </div>
  );
}
