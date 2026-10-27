import {
  mergeProjectData,
  migrateProjectData,
  parseProjectData,
  serializeBoard,
  type DocumentSnapshot,
  type ProjectData,
  type StoredDocument,
} from "./projects";

/** Keep recoverable versions when incoming document content competes with local edits. */
export function reconcileRemoteProjectState<T extends StoredDocument>(
  local: {
    tabs: T[];
    projectData: ProjectData;
    documentHistory: Record<string, DocumentSnapshot[]>;
  },
  incomingTabs: T[],
  incomingData: unknown,
) {
  const remote = parseProjectData(incomingData);
  const projectData = migrateProjectData(
    mergeProjectData(local.projectData, remote),
    incomingTabs,
  );
  const documentHistory = { ...local.documentHistory };
  const tabs = incomingTabs
    .filter((tab) => !projectData.trash[tab.id] && !projectData.purged[tab.id])
    .map((incoming) => {
      const previous = local.tabs.find((tab) => tab.id === incoming.id);
      const localModified =
        local.projectData.documents[incoming.id]?.updatedAt ?? 0;
      const remoteModified = remote.documents[incoming.id]?.updatedAt ?? 0;
      let result = incoming;
      if (
        previous &&
        previous.content !== incoming.content &&
        incoming.noteType === "note"
      ) {
        const keepLocal = localModified > remoteModified;
        const alternate = keepLocal ? incoming : previous;
        if (alternate.content && alternate.content.length <= 200_000) {
          const history = documentHistory[incoming.id] ?? [];
          if (!history.some((entry) => entry.content === alternate.content))
            documentHistory[incoming.id] = [
              {
                id: crypto.randomUUID(),
                title: alternate.title,
                content: alternate.content,
                reason: "conflict" as const,
                savedAt: Date.now(),
              },
              ...history,
            ].slice(0, 10);
        }
        if (keepLocal) result = previous;
      }
      const board = projectData.boards[incoming.id];
      return board
        ? {
            ...result,
            content: serializeBoard(
              board,
              Object.values(projectData.tasks).filter(
                (task) => task.boardId === board.id,
              ),
            ),
          }
        : result;
    });
  return { tabs, projectData, documentHistory };
}
