"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, Menu, PanelLeft, PanelRight, Pin, Plus, Search, Share2, Sparkles, X, Settings } from "lucide-react";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";
import { titleWithoutExtension } from "@/lib/projects";
import { useAiChatStore } from "@/lib/ai-chat-store";
import { useLayoutSize } from "@/lib/use-layout-size";
import { getWorkbenchLayout, MIN_NAVIGATION_WIDTH } from "@/lib/workbench-layout";
import { AiChatPanel } from "@/components/shell/ai-chat-panel";
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
import { DocumentActions, EditorToolbar } from "./editor-toolbar";
import { SaveStatus } from "./save-status";
import { DocumentContext } from "./document-inspector";
import { PaneResizeHandle } from "./pane-resize-handle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const destinations = { home: "Home", files: "Files", recent: "Recent", tasks: "Tasks", unfiled: "Inbox", trash: "Trash", overview: "Project", notes: "Notes", resources: "Resources" };

export function AppShell() {
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
  const [inspectorOpen, setInspectorOpen] = useState<boolean | null>(null);
  const [navigationPreview, setNavigationPreview] = useState<number | null>(null);
  const { ref: shell, width } = useLayoutSize<HTMLDivElement>();
  const zoom = useEditorStore((s) => s.zoomLevel) / 100;
  const layout = getWorkbenchLayout(width, navigationPreview ?? fileTreeWidth, sidebarOpen);
  const navigationButton = useRef<HTMLButtonElement>(null);
  const inspectorButton = useRef<HTMLButtonElement>(null);
  const aiButton = useRef<HTMLButtonElement>(null);
  const afterInspectorClose = useRef<(() => void) | null>(null);
  const tabList = useRef<HTMLDivElement>(null);
  const [tabsOverflow, setTabsOverflow] = useState(false);
  const active = tabs.find((tab) => tab.id === activeId && getTabWorkspaceId(tab) === workspaceId);
  const currentProject = active ? documentProject : project;
  const showInspector = Boolean(active && mode !== "graph" && !aiOpen &&
    (inspectorOpen ?? (width >= 1240 && layout.inspectorCanDock)));
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
  const hasSelectedTab = Boolean(active && mode !== "graph");
  const panelId = hasSelectedTab ? "workspace-document-panel" : undefined;
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
    const toggleNavigation = () => {
      if (layout.navigationIsDrawer) setNavigationOpen((open) => !open);
      else useEditorStore.getState().toggleFileTree();
    };
    document.addEventListener("toggle-workspace-navigation", toggleNavigation);
    return () => document.removeEventListener("toggle-workspace-navigation", toggleNavigation);
  }, [layout.navigationIsDrawer]);

  useEffect(() => {
    if (layout.navigationIsDrawer) return;
    const frame = requestAnimationFrame(() => {
      setNavigationOpen(false);
      setNavigationPreview(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [layout.navigationIsDrawer]);

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
      ref={shell}
      className={`workspace-shell markup-workbench${sidebarPosition === "right" ? " workbench-sidebar-right" : ""}`}
    >
        <div
          className="workspace-desktop-sidebar"
          style={{ width: layout.navigationWidth }}
          hidden={layout.navigationIsDrawer || !sidebarOpen}
        >
          <Navigator onCreateProject={() => setNewProject(true)} />
          <PaneResizeHandle
            className="workbench-sidebar-resize"
            label="Resize navigation"
            axis="x"
            value={layout.navigationWidth}
            min={MIN_NAVIGATION_WIDTH}
            max={layout.maxNavigationWidth}
            step={10}
            unitsPerPixel={(sidebarPosition === "right" ? -1 : 1) / zoom}
            onPreview={setNavigationPreview}
            onCommit={(next) => useEditorStore.getState().updateSettings({ fileTreeWidth: next })}
          />
        </div>
      <div className="workspace-main">
        <header className="workbench-header">
          {layout.navigationIsDrawer && <button
            ref={navigationButton}
            className="workspace-icon-button workbench-drawer-toggle"
            aria-label="Open workspace navigation"
            aria-haspopup="dialog"
            aria-expanded={navigationOpen}
            onClick={() => setNavigationOpen(true)}
          >
            <Menu size={19} />
          </button>}
          <nav className="workbench-location" aria-label="Breadcrumb">
            <Folder size={16} aria-hidden />
            {currentProject && (
              <>
                <ChevronRight size={12} aria-hidden />
                <button title={currentProject.name} onClick={() => useEditorStore.getState().navigate("overview", currentProject.id)}>
                  {currentProject.name}
                </button>
              </>
            )}
            {folderPath.map((folder) => (
              <span key={folder.id} className="breadcrumb-folder">
                <ChevronRight size={12} aria-hidden />
                <button title={folder.name} onClick={() => useEditorStore.getState().navigate("files", null, folder.id)}>
                  {folder.name}
                </button>
              </span>
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
            <span>Search <kbd>Ctrl+K</kbd></span>
          </button>
          <div className="workbench-header-actions">
            <button
              ref={aiButton}
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
            {!layout.navigationIsDrawer && <button
              className="workspace-icon-button workbench-sidebar-toggle"
              aria-label={sidebarOpen ? "Hide navigation" : "Show navigation"}
              aria-pressed={sidebarOpen}
              title="Toggle navigation (Alt+B)"
              onClick={() => useEditorStore.getState().toggleFileTree()}
            >
              <PanelLeft size={20} />
            </button>}
            {active && mode !== "graph" && (
              <button
                ref={inspectorButton}
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
            <button className="workspace-icon-button workbench-settings" title="Settings (Alt+S)" aria-label="Settings" onClick={() => document.dispatchEvent(new CustomEvent("open-settings"))}>
              <Settings size={18} />
            </button>
            {(!opened.length || layout.navigationIsDrawer) && <CreateMenu iconOnly />}
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
                const nextTab = buttons[destination];
                nextTab?.click();
                requestAnimationFrame(() => nextTab?.focus());
              }}
            >
              {opened.map((tab, index) => (
                <DocumentTab
                  key={tab.id}
                  tab={tab}
                  active={hasSelectedTab && tab.id === activeId}
                  tabStop={hasSelectedTab ? tab.id === activeId : index === 0}
                  panelId={panelId}
                />
              ))}
            </div>
            {!layout.navigationIsDrawer && <button className="workspace-icon-button" aria-label="New tab" title="New tab (Alt+T)" onClick={() => useEditorStore.getState().requestCreateTab()}>
              <Plus size={16} />
            </button>}
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
            {hasSelectedTab && <DocumentActions onInspect={() => { setAiOpen(false); setInspectorOpen(true); }} />}
          </div>
        )}
        <div className="workbench-body">
          <div
            className="workspace-content"
            id={panelId}
            role={panelId ? "tabpanel" : undefined}
            aria-labelledby={panelId ? `document-tab-${activeId}` : undefined}
          >
            {mode === "graph" ? (
              <MainContent />
            ) : active ? (
              <>
                {active.noteType === "note" && <EditorToolbar />}
                <MainContent key={active.id} />
              </>
            ) : (
              <div className="workbench-page-scroll" key={workspaceId + ":" + page}>
                <ProjectPages onCreateProject={() => setNewProject(true)} />
              </div>
            )}
          </div>
          {showInspector && layout.inspectorCanDock && (
            <DocumentContext key={activeId} width={layout.inspectorWidth} onClose={() => setInspectorOpen(false)} />
          )}
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
      <AiChatPanel docked={layout.aiCanDock} maxWidth={layout.maxAiWidth} zoom={zoom} trigger={aiButton} />
      <Dialog open={showInspector && !layout.inspectorCanDock} onOpenChange={(open) => { if (!open) setInspectorOpen(false); }}>
        <DialogContent
          className="workbench-inspector-dialog"
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const action = afterInspectorClose.current;
            afterInspectorClose.current = null;
            if (action) action();
            else if (document.activeElement === document.body) inspectorButton.current?.focus();
          }}
        >
          <DialogTitle className="sr-only">Document inspector</DialogTitle>
          <DialogDescription className="sr-only">Outline, links and file properties.</DialogDescription>
          <DocumentContext
            key={activeId}
            onClose={() => setInspectorOpen(false)}
            onNavigate={(action) => {
              afterInspectorClose.current = action;
              setInspectorOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <SpotlightSearch />
      <TaskDrawer />
      <OrgPanel />
      <NewProjectDialog
        open={newProject}
        onClose={() => setNewProject(false)}
      />
      <Dialog open={layout.navigationIsDrawer && navigationOpen} onOpenChange={setNavigationOpen}>
        <DialogContent
          className="workspace-mobile-navigation translate-x-0 translate-y-0"
          data-side={sidebarPosition}
          showCloseButton={false}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (!document.activeElement || document.activeElement === document.body) navigationButton.current?.focus();
          }}
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
function DocumentTab({ tab, active, tabStop, panelId }: { tab: Tab; active: boolean; tabStop: boolean; panelId?: string }) {
  const [editing, setEditing] = useState(false),
    [name, setName] = useState("");
  const tabButton = useRef<HTMLButtonElement>(null);
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
  const startRename = () => {
    setName(titleWithoutExtension(tab.title));
    setEditing(true);
  };
  return (
    <div data-note-type={tab.noteType} className={`workspace-tab${active ? " active" : ""}`}>
      {editing ? (
        <input
          autoFocus
          id={`document-tab-${tab.id}`}
          aria-label="Rename document"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || (e.key !== "Enter" && e.key !== "Escape")) return;
            e.preventDefault();
            if (e.key === "Enter") commit();
            else setEditing(false);
            requestAnimationFrame(() => tabButton.current?.focus());
          }}
        />
      ) : (
        <button
          ref={tabButton}
          id={`document-tab-${tab.id}`}
          role="tab"
          aria-selected={active}
          aria-controls={active ? panelId : undefined}
          aria-keyshortcuts="F2"
          tabIndex={tabStop ? 0 : -1}
          onClick={() => useEditorStore.getState().openTab(tab.id)}
          onDoubleClick={startRename}
          onKeyDown={(event) => {
            if (event.key === "F2") {
              event.preventDefault();
              startRename();
            }
          }}
          title={tab.title}
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
