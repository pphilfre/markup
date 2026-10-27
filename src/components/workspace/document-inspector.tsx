"use client";
import { useState } from "react";
import { Link2, CheckCheck, History } from "lucide-react";
import { useEditorStore } from "@/lib/store";
import { isTaskVisible } from "@/lib/projects";
import { extractDocumentIds } from "@/lib/document-links";
import { Button } from "@/components/ui/button";
export function DocumentContext({ onClose }: { onClose: () => void }) {
  const tab = useEditorStore((s) =>
    s.tabs.find((tab) => tab.id === s.activeTabId),
  );
  const data = useEditorStore((s) => s.projectData);
  const tabs = useEditorStore((s) => s.tabs);
  const history = useEditorStore((s) =>
    tab ? s.documentHistory[tab.id] : undefined,
  );
  const restore = useEditorStore((s) => s.restoreSnapshot);
  const assign = useEditorStore((s) => s.assignDocument);
  const [restored, setRestored] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  if (!tab) return null;
  const tasks = Object.values(data.tasks).filter(
    (task) =>
      isTaskVisible(task, data) && task.relatedDocumentIds.includes(tab.id),
  );
  const preview = history?.find((snapshot) => snapshot.id === previewId);
  const incoming = tabs.filter((source) => {
    if (
      source.id === tab.id ||
      (source.workspaceId ?? "default") !== (tab.workspaceId ?? "default")
    )
      return false;
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
      <div className="workspace-section-heading">
        <h2>Inspector</h2>
        <button onClick={onClose} className="workspace-text-button">
          Close
        </button>
      </div>
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
      {incoming.length > 0 && (
        <section className="linked-work">
          <h3>Referenced by</h3>
          {incoming.map((source) => (
            <button
              key={source.id}
              onClick={() => useEditorStore.getState().openTab(source.id)}
            >
              <Link2 size={14} />
              {source.title}
            </button>
          ))}
        </section>
      )}
      {tasks.length > 0 && (
        <section className="linked-work">
          <h3>
            <Link2 size={15} />
            Linked tasks
          </h3>
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => useEditorStore.getState().selectTask(task.id)}
            >
              <CheckCheck size={14} />
              {task.title}
            </button>
          ))}
        </section>
      )}
      <section className="linked-work">
        <h3>
          <History size={15} />
          History on this device
        </h3>
        <p>Up to 10 recent snapshots of this note are kept here.</p>
        {history?.map((snapshot) => (
          <button
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
      </section>
    </aside>
  );
}
