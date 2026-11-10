"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, Menu, PanelLeft, PanelRight, Pin, Plus, Search, Share2, Sparkles, X, Settings } from "lucide-react";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";
import { titleWithoutExtension } from "@/lib/projects";
import { useAiChatStore } from "@/lib/ai-chat-store";
import { MainContent } from "@/components/shell/main-content";
import { SpotlightSearch } from "@/components/shell/spotlight-search";
import { ShareDialog } from "@/components/shell/share-dialog";
import { ExportDialog } from "@/components/shell/export-dialog";
import { PublishDialog } from "@/components/shell/publish-dialog";
import { OrgPanel } from "@/components/shell/org-panel";
import { TabFileIcon } from "@/components/shell/file-tree";
import { Navigator } from "./navigator";
import { CreateMenu, NewProjectDialog, ProjectPages } from "./project-pages";
import { TaskDrawer } from "./task-view";
import { EditorToolbar } from "./editor-toolbar";
import { SaveStatus } from "./save-status";
import { DocumentContext } from "./document-inspector";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const destinations = { home: "Home", files: "Files", recent: "Recent", tasks: "Tasks", unfiled: "Inbox", trash: "Trash", overview: "Project", notes: "Notes", resources: "Resources" };

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
  const folders = useEditorStore((s) => s.folders);
  const page = useEditorStore((s) => s.navigation.page);
  const documentProject = useEditorStore((s) => {
    const id = activeId && s.projectData.documents[activeId]?.projectId;
    return id ? s.projectData.projects[id] : undefined;
  });
  const [inspectorOpen, setInspectorOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1240px)").matches);
  const tabList = useRef<HTMLDivElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);
  const sidebarDrag = useRef<{ x: number; width: number; pending: number } | null>(null);
  const setSidebarWidth = (width: number) => useEditorStore.getState().updateSettings({ fileTreeWidth: Math.max(220, Math.min(440, width)) });
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const active = tabs.find((tab) => tab.id === activeId && getTabWorkspaceId(tab) === workspaceId);
  const currentProject = active ? documentProject : project;
  const showInspector = Boolean(active && mode !== "graph" && inspectorOpen && !aiOpen);
  const folderPath = [];
  const visited = new Set<string>();
  let folderId = active?.folderId;
  while (folderId && !visited.has(folderId)) {
    visited.add(folderId);
    const folder = folders.find((entry) => entry.id === folderId);
    if (!folder) break;
    if (folder.id !== currentProject?.folderId) folderPath.unshift(folder);
    folderId = folder.parentId;
  }
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
  useEffect(() => {
    tabList.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId, mode]);

  useEffect(() => {
    const list = tabList.current;
    if (!list) return;
    const measure = () => setTabsOverflow(list.scrollWidth > list.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    list.querySelectorAll(".workspace-tab").forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [openIds]);

  return (
    <div
      className={`workspace-shell markup-workbench${!sidebarOpen ? " workspace-sidebar-hidden" : ""}${sidebarPosition === "right" ? " workbench-sidebar-right" : ""}`}
    >
      <div
        className="workspace-desktop-sidebar"
        ref={sidebar}
        style={{ width: "var(--filetree-drag-width, " + fileTreeWidth + "px)" }}
      >
        <Navigator onCreateProject={() => setNewProject(true)} />
        <div
          className="workbench-sidebar-resize"
          role="separator"
          aria-label="Resize navigation"
          aria-orientation="vertical"
          aria-valuemin={220}
          aria-valuemax={440}
          aria-valuenow={Math.max(220, Math.min(440, fileTreeWidth))}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const direction = (event.key === "ArrowRight" ? 1 : -1) * (sidebarPosition === "right" ? -1 : 1);
            setSidebarWidth(Math.max(220, Math.min(440, fileTreeWidth)) + direction * 10);
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !sidebar.current) return;
            const width = sidebar.current.getBoundingClientRect().width;
            sidebarDrag.current = { x: event.clientX, width, pending: width };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = sidebarDrag.current;
            if (!drag) return;
            drag.pending = Math.max(220, Math.min(440, drag.width + (event.clientX - drag.x) * (sidebarPosition === "right" ? -1 : 1)));
            sidebar.current?.style.setProperty("--filetree-drag-width", drag.pending + "px");
          }}
          onPointerUp={() => {
            const drag = sidebarDrag.current;
            if (drag) setSidebarWidth(Math.round(drag.pending));
          }}
          onLostPointerCapture={() => {
            sidebarDrag.current = null;
            sidebar.current?.style.removeProperty("--filetree-drag-width");
          }}
        />
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
          <nav className="workbench-location" aria-label="Breadcrumb">
            <Folder size={16} aria-hidden />
            {currentProject && (
              <>
                <ChevronRight size={12} aria-hidden />
                <button onClick={() => useEditorStore.getState().navigate("overview", currentProject.id)}>
                  {currentProject.name}
                </button>
              </>
            )}
            {folderPath.map((folder) => (
              <span key={folder.id} className="breadcrumb-folder"><ChevronRight size={12} aria-hidden />{folder.name}</span>
            ))}
            <ChevronRight size={12} aria-hidden />
            <span className="breadcrumb-current" aria-current="page">
              {mode === "graph" ? "Knowledge graph" : active?.title ?? destinations[page]}
            </span>
          </nav>
          <button
            className="workbench-search"
            aria-label="Search workspace"
            onClick={() =>
              document.dispatchEvent(new CustomEvent("open-spotlight"))
            }
          >
            <Search size={14} />
            <span>Search <kbd>(Ctrl K)</kbd></span>
          </button>
          <div className="workbench-header-actions">
            <button
              className={"workspace-icon-button workbench-ai" + (aiOpen ? " is-active" : "")}
              aria-label="Markup AI"
              title="Markup AI"
              aria-expanded={aiOpen}
              onClick={() => setAiOpen(!aiOpen)}
            >
              <Sparkles size={19} />
            </button>
            {active && mode !== "graph" && (
              <button className="workspace-icon-button workbench-share" title="Share document" aria-label="Share document" onClick={() => setAction("share")}>
                <Share2 size={19} />
              </button>
            )}
            <button
              className="workspace-icon-button workbench-sidebar-toggle"
              aria-label={sidebarOpen ? "Hide navigation" : "Show navigation"}
              aria-pressed={sidebarOpen}
              title="Toggle navigation (Alt+B)"
              onClick={() => useEditorStore.getState().toggleFileTree()}
            >
              <PanelLeft size={20} />
            </button>
            {active && mode !== "graph" && (
              <button
                className="workspace-icon-button workbench-inspector-toggle"
                aria-label="Document inspector"
                aria-pressed={showInspector}
                title={showInspector ? "Hide inspector" : "Show inspector"}
                onClick={() => {
                  if (aiOpen) setAiOpen(false);
                  setInspectorOpen(!showInspector);
                }}
              >
                <PanelRight size={20} />
              </button>
            )}
            {!sidebarOpen && (
              <button className="workspace-icon-button workbench-settings" title="Settings" aria-label="Settings" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}>
                <Settings size={17} />
              </button>
            )}
            <div className="workbench-mobile-create"><CreateMenu label="New" /></div>
          </div>
        </header>
        {opened.length > 0 && (
          <div className="workbench-tabbar">
            {active && mode !== "graph" && (
              <button
                className="workspace-icon-button workbench-pin"
                aria-label={active.pinned ? "Remove from favourites" : "Add to favourites"}
                aria-pressed={active.pinned}
                title={active.pinned ? "Remove from favourites" : "Add to favourites"}
                onClick={() => useEditorStore.getState().togglePin(active.id)}
              >
                <Pin size={16} />
              </button>
            )}
            <div
              className="workspace-tabs"
              ref={tabList}
              role="tablist"
              aria-label="Open documents"
              onKeyDown={(event) => {
                if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab") return;
                const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
                const index = buttons.indexOf(event.target as HTMLButtonElement);
                const destination = {
                  ArrowLeft: (index + buttons.length - 1) % buttons.length,
                  ArrowRight: (index + 1) % buttons.length,
                  Home: 0,
                  End: buttons.length - 1,
                }[event.key];
                if (destination === undefined) return;
                event.preventDefault();
                buttons[destination]?.focus();
                buttons[destination]?.click();
              }}
            >
              {opened.map((tab) => (
                <DocumentTab key={tab.id} tab={tab} active={tab.id === activeId && mode !== "graph"} />
              ))}
            </div>
            <button className="workspace-icon-button" aria-label="New tab" title="New tab (Alt+T)" onClick={() => useEditorStore.getState().requestCreateTab()}>
              <Plus size={16} />
            </button>
            {tabsOverflow && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="workspace-icon-button" aria-label="List open documents" title="Open documents"><ChevronDown size={16} /></button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {opened.map((tab) => (
                    <DropdownMenuItem key={tab.id} onSelect={() => useEditorStore.getState().openTab(tab.id)}>
                      {tab.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        <div className="workbench-body">
          <div className="workspace-content">
            {mode === "graph" ? (
              <MainContent />
            ) : active ? (
              <>
                <EditorToolbar onInspect={() => { setAiOpen(false); setInspectorOpen(true); }} />
                <MainContent key={active.id} />
              </>
            ) : (
              <ProjectPages onCreateProject={() => setNewProject(true)} />
            )}
          </div>
          {showInspector && <DocumentContext key={activeId} onClose={() => setInspectorOpen(false)} />}
        </div>
        <footer className="workbench-status">
          {active?.noteType === "note" && mode !== "graph" && (
            <>
              <span>{active.content.trim() ? active.content.trim().split(/\s+/).length.toLocaleString() : 0} words</span>
              <span className="workbench-status-type">Markdown</span>
            </>
          )}
          <SaveStatus compact />
        </footer>
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
  const hideExtensions = useEditorStore((s) => s.settings.hideMdExtensions || !s.settings.showFileExtensions);
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
    <div data-note-type={tab.noteType} className={`workspace-tab${active ? " active" : ""}`}>
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
          <TabFileIcon tab={tab} className="file-type-icon" />
          <span>{hideExtensions ? titleWithoutExtension(tab.title) : tab.title}</span>
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
