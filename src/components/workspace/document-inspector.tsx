"use client";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, CircleCheck, CheckCheck, Layers, RefreshCw, Tag, X } from "lucide-react";
import { getTabWorkspaceId, useEditorStore, type Tab } from "@/lib/store";
import { isTaskVisible, titleWithoutExtension } from "@/lib/projects";
import { markdownLanguage } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { extractDocumentIds } from "@/lib/document-links";
import { TabFileIcon } from "@/components/shell/file-tree";
import { Button } from "@/components/ui/button";
import { useSyncState } from "@/lib/sync-state";

function DocumentLink({ tab, excerpt }: { tab: Tab; excerpt?: string }) {
  return (
    <button data-note-type={tab.noteType} className="inspector-link inspector-document-link" onClick={() => useEditorStore.getState().openTab(tab.id)}>
      <TabFileIcon tab={tab} className="file-type-icon" />
      <span>
        <span className="inspector-document-title">{tab.title}</span>
        {excerpt && <small title={excerpt}>{excerpt}</small>}
      </span>
    </button>
  );
}

function backlinkExcerpt(source: Tab, target: Tab) {
  if (source.noteType !== "note") return undefined;
  const title = titleWithoutExtension(target.title).toLowerCase();
  const line = source.content.split("\n").find((line) =>
    extractDocumentIds(line).includes(target.id) ||
    [...line.matchAll(/\[\[([^\]]+)\]\]/g)].some((match) => titleWithoutExtension(match[1]).toLowerCase() === title),
  );
  return line?.replace(/\[([^\]]+)\]\(#note\/[^)]+\)|\[\[([^\]]+)\]\]/g, (_, linked, wiki) => linked || wiki).trim();
}


function Section({ title, count, children, collapsed = false }: {
  title: string;
  count?: number;
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  return (
    <details className="inspector-section" open={!collapsed || undefined}>
      <summary><ChevronDown size={14} />{title}{count !== undefined && <span>{count}</span>}</summary>
      <div className="inspector-section-body">{children}</div>
    </details>
  );
}

function jumpToHeading(line: number) {
  const view = useEditorStore.getState().editorView;
  if (view && line <= view.state.doc.lines) {
    const anchor = view.state.doc.line(line).from;
    view.dispatch({ selection: { anchor }, effects: EditorView.scrollIntoView(anchor, { y: "start" }) });
    view.focus();
    return;
  }
  const heading = document.querySelector('.workspace-content [data-document-line="' + line + '"]');
  heading?.scrollIntoView({ block: "start" });
  if (heading instanceof HTMLElement) heading.focus({ preventScroll: true });
}
export function DocumentContext({ onClose }: { onClose: () => void }) {
  const tab = useEditorStore((s) =>
    s.tabs.find((tab) => tab.id === s.activeTabId),
  );
  const data = useEditorStore((s) => s.projectData);
  const tabs = useEditorStore((s) => s.tabs);
  const history = useEditorStore((s) =>
    tab ? s.documentHistory[tab.id] : undefined,
  );
  const sync = useSyncState();
  const restore = useEditorStore((s) => s.restoreSnapshot);
  const assign = useEditorStore((s) => s.assignDocument);
  const [selectedHeading, setSelectedHeading] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const content = tab?.noteType === "note" ? tab.content : "";
  const headings = useMemo(() => {
    const entries: { title: string; line: number; level: number }[] = [];
    markdownLanguage.parser.parse(content).iterate({
      enter(node) {
        const match = /^(ATX|Setext)Heading([1-6])$/.exec(node.name);
        if (!match) return;
        const source = content.slice(node.from, node.to);
        const title = match[1] === "ATX"
          ? source.replace(/^#+\s*/, "").replace(/\s+#+\s*$/, "")
          : source.split("\n").slice(0, -1).join(" ").trim();
        if (title) entries.push({
          title, level: Number(match[2]), line: content.slice(0, node.from).split("\n").length,
        });
      },
    });
    return entries;
  }, [content]);
  if (!tab) return null;
  const workspaceTabs = tabs.filter((source) => source.id !== tab.id && getTabWorkspaceId(source) === getTabWorkspaceId(tab));
  const linkedIds = extractDocumentIds(content);
  const wikiTitles = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => titleWithoutExtension(match[1]).toLowerCase());
  const outgoing = workspaceTabs.filter((target) => linkedIds.includes(target.id) || wikiTitles.includes(titleWithoutExtension(target.title).toLowerCase()));
  const documentMeta = data.documents[tab.id];
  const typeLabel = { note: "Markdown", whiteboard: "Whiteboard", mindmap: "Mind map", kanban: "Task board", pdf: "PDF" }[tab.noteType];
  const tasks = Object.values(data.tasks).filter(
    (task) =>
      isTaskVisible(task, data) && task.relatedDocumentIds.includes(tab.id),
  );
  const preview = history?.find((snapshot) => snapshot.id === previewId);
  const incoming = workspaceTabs.filter((source) => {
    if (source.noteType === "note")
      return (
        extractDocumentIds(source.content).includes(tab.id) ||
        [...source.content.matchAll(/\[\[([^\]]+)\]\]/g)].some(
          (match) =>
            match[1].replace(/\.md$/i, "").toLowerCase() ===
            tab.title.replace(/\.md$/i, "").toLowerCase(),
        )
      );
    try {
      return JSON.parse(source.content).linkedTabIds?.includes(tab.id);
    } catch {
      return false;
    }
  });
  return (
    <aside className="document-context" aria-label="Document context">
      <div className="inspector-mobile-heading">
        <h2>Inspector</h2>
        <button onClick={onClose} className="workspace-icon-button" aria-label="Close inspector"><X size={15} /></button>
      </div>
      {tab.noteType === "note" && (
        <Section title="Outline" count={headings.length}>
          <div className="inspector-outline-tree">
            {headings.map(({ title, line, level }, index) => (
              <button
                key={line + ":" + level + ":" + title}
                className="inspector-link inspector-outline"
                data-level={index === 0 ? 1 : Math.max(2, level)}
                aria-current={(selectedHeading ?? headings[0]?.line) === line ? "location" : undefined}
                style={{ paddingInlineStart: index === 0 ? 28 : 41 + Math.max(0, level - 2) * 10 }}
                onClick={() => { setSelectedHeading(line); jumpToHeading(line); }}
              >{title}</button>
            ))}
          </div>
          {!headings.length && <p className="inspector-empty">Add headings to navigate this note.</p>}
        </Section>
      )}
      <Section title="Backlinks" count={incoming.length}>
        {incoming.map((source) => <DocumentLink key={source.id} tab={source} excerpt={backlinkExcerpt(source, tab)} />)}
        {!incoming.length && <p className="inspector-empty">No documents link here yet.</p>}
      </Section>
      <Section title="Properties">
        <dl className="inspector-properties">
          <dt><Tag size={16} />Tags</dt>
          <dd className="inspector-tags">
            {tab.tags.map((tag) => (
              <span key={tag}>{tag}<button aria-label={"Remove tag " + tag} onClick={() => useEditorStore.getState().removeTag(tab.id, tag)}><X size={11} /></button></span>
            ))}
            {!tab.tags.length && <span className="inspector-none">No tags</span>}
          </dd>
          {documentMeta?.createdAt ? <><dt><CalendarDays size={16} />Created</dt><dd>{new Date(documentMeta.createdAt).toLocaleString()}</dd></> : null}
          {documentMeta?.updatedAt ? <><dt><CalendarDays size={16} />Updated</dt><dd>{new Date(documentMeta.updatedAt).toLocaleString()}</dd></> : null}
          <dt><RefreshCw size={16} />Sync</dt>
          <dd>{tab.origin === "local" || (sync.status === "idle" || sync.status === "disabled") ? "Local" :
            sync.status === "synced" ? <span className="inspector-synced"><CircleCheck size={15} />Synced</span> :
            sync.status === "syncing" ? "Syncing..." : sync.status === "offline" ? "Offline" : "Needs attention"}</dd>
          <dt><Layers size={16} />Type</dt><dd><span className="inspector-type">{typeLabel}</span></dd>
        </dl>
        <details className="inspector-manage">
          <summary>Manage file</summary>
          <label className="workspace-field">
            File name
            <input
              defaultValue={tab.title}
              key={tab.id + tab.title}
              onBlur={(event) => {
                if (event.target.value.trim())
                  useEditorStore
                    .getState()
                    .renameTab(tab.id, event.target.value.trim());
              }}
            />
          </label>
          <label className="workspace-field">
            Project
            <select
              value={data.documents[tab.id]?.projectId ?? ""}
              onChange={(e) => assign(tab.id, e.target.value || null)}
            >
              <option value="">No project</option>
              {Object.values(data.projects)
                .filter(
                  (project) =>
                    project.workspaceId === (tab.workspaceId ?? "default") &&
                    !project.archivedAt,
                )
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </label>
        </details>
      </Section>
      <Section title="Linked Docs" count={outgoing.length}>
        {outgoing.map((target) => <DocumentLink key={target.id} tab={target} />)}
        {!outgoing.length && <p className="inspector-empty">No outgoing links.</p>}
      </Section>
      {tasks.length > 0 && (
        <Section title="Linked tasks" count={tasks.length}>
          {tasks.map((task) => (
            <button
              className="inspector-link"
              key={task.id}
              onClick={() => useEditorStore.getState().selectTask(task.id)}
            >
              <CheckCheck size={14} />
              {task.title}
            </button>
          ))}
        </Section>
      )}
      <Section title="History on this device" count={history?.length ?? 0} collapsed>
        <p>Up to 10 recent snapshots of this note are kept here.</p>
        {history?.map((snapshot) => (
          <button
            className="inspector-link"
            key={snapshot.id}
            onClick={() => {
              setPreviewId(snapshot.id);
              setRestored(false);
            }}
          >
            {new Date(snapshot.savedAt).toLocaleString()}
            {snapshot.reason === "conflict" ? " (incoming change)" : ""}
          </button>
        ))}
        {!history?.length && (
          <p>
            Snapshots appear as you edit. Other devices keep their own history.
          </p>
        )}
        {preview && (
          <div className="snapshot-preview">
            <pre>{preview.content.slice(0, 2000)}</pre>
            <Button
              size="sm"
              onClick={() => {
                restore(tab.id, preview.id);
                setPreviewId(null);
                setRestored(true);
              }}
            >
              Restore this version
            </Button>
          </div>
        )}
        {restored && (
          <p role="status">
            Restored. The previous version is also saved in history.
          </p>
        )}
      </Section>
    </aside>
  );
}
