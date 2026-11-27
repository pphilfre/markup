const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
// Compile the actual domain modules for Node's test runner; no browser or backend is needed.
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
const {
  emptyProjectData,
  migrateProjectData,
  mergeProjectData,
  parseProjectData,
  serializeBoard,
  applyBoardContent,
  isTaskVisible,
} = require("../src/lib/projects.ts");
const { projectSlice } = require("../src/lib/project-actions.ts");
const { applyLinePrefix } = require("../src/lib/markdown-format.ts");
const { getWorkbenchLayout, getSplitLayout } = require("../src/lib/workbench-layout.ts");

test("navigation becomes a drawer before a narrow window loses writing space", () => {
  for (const width of [320, 390, 768, 879]) {
    const layout = getWorkbenchLayout(width, 440, true);
    assert.equal(layout.navigationIsDrawer, true);
    assert.equal(layout.inspectorCanDock, false);
    assert.equal(layout.aiCanDock, false);
  }

  for (const width of [880, 900, 1024, 1280, 1920]) {
    const layout = getWorkbenchLayout(width, 440, true);
    assert.equal(layout.navigationIsDrawer, false);
    assert.ok(width - layout.navigationWidth >= 620);
    assert.ok(layout.navigationWidth <= 440);
  }
});

test("inspector and AI docking use the space remaining after navigation", () => {
  assert.equal(getWorkbenchLayout(1120, 300, true).inspectorCanDock, false);
  assert.equal(getWorkbenchLayout(1120, 300, false).inspectorCanDock, true);
  assert.equal(getWorkbenchLayout(1200, 300, true).aiCanDock, false);
  assert.equal(getWorkbenchLayout(1220, 300, true).aiCanDock, true);

  const layout = getWorkbenchLayout(1440, 320, true);
  assert.ok(1440 - layout.navigationWidth - layout.inspectorWidth >= 620);
  assert.ok(1440 - layout.navigationWidth - layout.maxAiWidth >= 620);
});

test("split editing keeps portrait and short landscape panes usable", () => {
  assert.equal(getSplitLayout(390, 540).stacked, true);
  assert.equal(getSplitLayout(620, 520).stacked, true);
  assert.equal(getSplitLayout(620, 260).stacked, false);
  assert.equal(getSplitLayout(780, 520).stacked, false);
  assert.deepEqual(getSplitLayout(320, 170), { stacked: true, minimum: 50, maximum: 50 });
  assert.ok(getSplitLayout(620, 260).minimum * 620 / 100 >= 240);
});
test("heading choices change the current level and can return to a paragraph", () => {
  assert.equal(applyLinePrefix("# Project brief", "### "), "### Project brief");
  assert.equal(
    applyLinePrefix("### Project brief", "### "),
    "### Project brief",
  );
  assert.equal(applyLinePrefix("###### Project brief", ""), "Project brief");
  assert.equal(applyLinePrefix("Ordinary text", "## "), "## Ordinary text");
  assert.equal(applyLinePrefix("Next step", "1. ", 2), "3. Next step");
});
function board(id = "board-a") {
  return {
    id,
    title: "Delivery.kanban",
    workspaceId: "default",
    folderId: null,
    tags: ["work"],
    pinned: true,
    noteType: "kanban",
    content: JSON.stringify({
      version: 2,
      boardTitle: "Launch",
      showCompleted: true,
      columns: [
        {
          id: "todo",
          title: "Backlog",
          color: "#123456",
          wipLimit: 3,
          cards: [
            {
              id: "card-1",
              title: "Draft the brief",
              description: "Keep the context",
              labels: ["writing"],
              dueDate: "2026-11-01",
              priority: "high",
              completed: false,
              createdAt: 123,
            },
          ],
        },
        {
          id: "done",
          title: "Delivered",
          color: "#456789",
          wipLimit: null,
          cards: [],
        },
      ],
    }),
  };
}
function fixture(tabs = [board()]) {
  let state = {
    tabs,
    activeProfileId: "default",
    activeTabId: null,
    editorView: null,
    folders: [],
    createFolder(name) {
      const id = crypto.randomUUID();
      state = {
        ...state,
        folders: [...state.folders, { id, name, parentId: null }],
      };
      return id;
    },
    navigation: { page: "overview", projectId: null },
  };
  const get = () => state;
  const set = (patch) => {
    state = {
      ...state,
      ...(typeof patch === "function" ? patch(state) : patch),
    };
  };
  state = { ...state, ...projectSlice(set, get) };
  state.projectData = migrateProjectData(state.projectData, tabs);
  return { get, set };
}
test("legacy migration is idempotent and preserves the original document", () => {
  const tab = board(),
    before = structuredClone(tab);
  const first = migrateProjectData(emptyProjectData(), [tab]);
  assert.strictEqual(migrateProjectData(first, [tab]), first);
  assert.deepEqual(tab, before);
  const task = first.tasks["board-a:card-1"];
  assert.equal(task.title, "Draft the brief");
  assert.equal(task.dueDate, "2026-11-01");
  assert.equal(task.priority, "high");
  assert.equal(first.documents[tab.id].createdAt, null);
  assert.equal(first.documents[tab.id].updatedAt, 0);
});
test("copied board card IDs do not collide", () => {
  const data = migrateProjectData(emptyProjectData(), [
    board(),
    board("board-b"),
  ]);
  assert.equal(Object.keys(data.tasks).length, 2);
});
test("invalid board content is preserved without inventing tasks", () => {
  const tab = { ...board(), content: "not valid JSON" };
  const data = migrateProjectData(emptyProjectData(), [tab]);
  assert.equal(Object.keys(data.tasks).length, 0);
  assert.equal(tab.content, "not valid JSON");
});
test("board projection round-trips titles, custom columns, labels, and dates", () => {
  const data = migrateProjectData(emptyProjectData(), [board()]);
  const content = serializeBoard(
    data.boards["board-a"],
    Object.values(data.tasks),
  );
  const next = migrateProjectData(emptyProjectData(), [
    { ...board(), content },
  ]);
  assert.deepEqual(next.tasks, data.tasks);
  assert.deepEqual(next.boards, data.boards);
});
test("editing board cards retains stable task IDs and source links", () => {
  const data = migrateProjectData(emptyProjectData(), [board()]);
  data.tasks["board-a:card-1"].relatedDocumentIds = ["brief"];
  const content = JSON.parse(board().content);
  content.columns[0].cards[0].title = "Revised task";
  const next = applyBoardContent(data, {
    ...board(),
    content: JSON.stringify(content),
  });
  assert.equal(Object.keys(next.tasks).length, 1);
  assert.equal(next.tasks["board-a:card-1"].title, "Revised task");
  assert.deepEqual(next.tasks["board-a:card-1"].relatedDocumentIds, ["brief"]);
});
test("removing a card in the existing board puts its shared task in trash", () => {
  const data = migrateProjectData(emptyProjectData(), [board()]);
  const content = JSON.parse(board().content);
  content.columns[0].cards = [];
  const next = applyBoardContent(data, {
    ...board(),
    content: JSON.stringify(content),
  });
  assert.ok(next.tasks["board-a:card-1"].deletedAt);
  assert.equal(isTaskVisible(next.tasks["board-a:card-1"], next), false);
});
test("custom status identity survives a column rename", () => {
  const tab = board(),
    content = JSON.parse(tab.content);
  content.columns[1].title = "Shipped";
  content.columns[1].status = "done";
  content.columns[1].id = "delivery";
  content.columns[1].cards = content.columns[0].cards;
  content.columns[0].cards = [];
  const data = migrateProjectData(emptyProjectData(), [
    { ...tab, content: JSON.stringify(content) },
  ]);
  assert.equal(data.tasks["board-a:card-1"].status, "done");
});

test("a task can move between custom columns with the same general status", () => {
  const { get, set } = fixture();
  const data = get().projectData;
  data.boards["board-a"].columns.push(
    {
      id: "review",
      title: "Review",
      color: "#112233",
      status: "in-progress",
      wipLimit: 2,
    },
    {
      id: "blocked",
      title: "Blocked",
      color: "#223344",
      status: "in-progress",
      wipLimit: null,
    },
  );
  set({ projectData: data });
  get().updateTask("board-a:card-1", { columnId: "review" });
  assert.equal(get().projectData.tasks["board-a:card-1"].columnId, "review");
  get().updateTask("board-a:card-1", { columnId: "blocked" });
  assert.equal(get().projectData.tasks["board-a:card-1"].columnId, "blocked");
  const exported = JSON.parse(get().tabs[0].content);
  assert.equal(
    exported.columns.find((column) => column.id === "blocked").cards.length,
    1,
  );
  assert.equal(
    exported.columns.find((column) => column.id === "review").cards.length,
    0,
  );
});
test("list updates project into board content with no duplicate task", () => {
  const { get } = fixture();
  get().updateTask("board-a:card-1", { status: "done" });
  const data = get().projectData,
    parsed = JSON.parse(get().tabs[0].content);
  assert.equal(Object.keys(data.tasks).length, 1);
  assert.equal(parsed.columns[1].cards[0].completed, true);
});
test("adding a list task to a board retains identity through board edits", () => {
  const { get } = fixture();
  const id = get().addTask("New task", { boardId: "board-a" });
  const data = applyBoardContent(get().projectData, get().tabs[0]);
  assert.ok(data.tasks[id], "new list task must retain its original ID");
  assert.equal(Object.keys(data.tasks).length, 2);
});
test("moving a document moves board tasks without changing IDs", () => {
  const { get } = fixture();
  const id = get().createProject("Website refresh");
  get().assignDocument("board-a", id);
  assert.equal(get().projectData.tasks["board-a:card-1"].projectId, id);
  assert.equal(get().projectData.documents["board-a"].projectId, id);
});
test("cross-workspace assignment is rejected", () => {
  const { get, set } = fixture();
  const id = get().createProject("Elsewhere");
  set({
    projectData: {
      ...get().projectData,
      projects: {
        ...get().projectData.projects,
        [id]: { ...get().projectData.projects[id], workspaceId: "other" },
      },
    },
  });
  get().assignDocument("board-a", id);
  assert.equal(get().projectData.documents["board-a"].projectId, null);
});
test("merge preserves independent edits on different records", () => {
  const a = fixture(),
    b = fixture();
  const p = a.get().createProject("A");
  const q = b.get().createProject("B");
  const merged = mergeProjectData(
    a.get().projectData,
    JSON.stringify(b.get().projectData),
  );
  assert.ok(merged.projects[p]);
  assert.ok(merged.projects[q]);
});
test("restoring a document wins over a stale trash echo", () => {
  const { get, set } = fixture([]),
    tab = board();
  const data = migrateProjectData(emptyProjectData(), [tab]);
  data.trash[tab.id] = {
    id: tab.id,
    document: tab,
    deletedAt: 10,
    updatedAt: 10,
  };
  set({ projectData: data });
  get().restoreDocument(tab.id);
  const merged = mergeProjectData(get().projectData, data);
  assert.equal(merged.trash[tab.id], undefined);
  assert.equal(get().tabs.length, 1);
});
test("permanent deletion tombstone suppresses stale trash", () => {
  const { get, set } = fixture([]),
    tab = board();
  const data = migrateProjectData(emptyProjectData(), [tab]);
  data.trash[tab.id] = {
    id: tab.id,
    document: tab,
    deletedAt: 10,
    updatedAt: 10,
  };
  set({ projectData: data });
  get().purgeDocument(tab.id);
  assert.equal(
    mergeProjectData(get().projectData, data).trash[tab.id],
    undefined,
  );
});
test("malformed or future domain envelopes are rejected", () => {
  assert.throws(() => parseProjectData("{bad"));
  assert.throws(() => parseProjectData({ version: 99 }));
  assert.deepEqual(parseProjectData(undefined), emptyProjectData());
});

const { reconcileRemoteProjectState } = require("../src/lib/project-sync.ts");
const {
  extractDocumentIds,
  resolveDocumentLink,
} = require("../src/lib/document-links.ts");
test("incoming older content cannot overwrite a newer local edit; both versions remain recoverable", () => {
  const tab = { ...board(), noteType: "note", content: "My offline edit" };
  const data = migrateProjectData(emptyProjectData(), [tab]);
  data.documents[tab.id].updatedAt = 20;
  const remote = structuredClone(data);
  remote.documents[tab.id].updatedAt = 10;
  const next = reconcileRemoteProjectState(
    { tabs: [tab], projectData: data, documentHistory: {} },
    [{ ...tab, content: "Earlier remote edit" }],
    remote,
  );
  assert.equal(next.tabs[0].content, "My offline edit");
  assert.equal(next.documentHistory[tab.id][0].content, "Earlier remote edit");
});
test("incoming newer content preserves the previous device version in history", () => {
  const tab = { ...board(), noteType: "note", content: "Previous device edit" };
  const data = migrateProjectData(emptyProjectData(), [tab]);
  data.documents[tab.id].updatedAt = 10;
  const remote = structuredClone(data);
  remote.documents[tab.id].updatedAt = 20;
  const next = reconcileRemoteProjectState(
    { tabs: [tab], projectData: data, documentHistory: {} },
    [{ ...tab, content: "New remote edit" }],
    remote,
  );
  assert.equal(next.tabs[0].content, "New remote edit");
  assert.equal(next.documentHistory[tab.id][0].content, tab.content);
});
test("stale remote document echoes cannot resurrect trash", () => {
  const tab = board(),
    data = migrateProjectData(emptyProjectData(), [tab]);
  data.trash[tab.id] = {
    id: tab.id,
    document: tab,
    deletedAt: 30,
    updatedAt: 30,
  };
  const next = reconcileRemoteProjectState(
    { tabs: [], projectData: data, documentHistory: {} },
    [tab],
    undefined,
  );
  assert.equal(next.tabs.length, 0);
});
test("stable links resolve after a rename and refuse another workspace", () => {
  const target = { ...board(), title: "Renamed brief.md" };
  const content = "[Old brief title](#note/board-a)";
  assert.deepEqual(extractDocumentIds(content), ["board-a"]);
  assert.equal(
    resolveDocumentLink("#note/board-a", [target], "default").title,
    target.title,
  );
  assert.equal(
    resolveDocumentLink("#note/board-a", [target], "other"),
    undefined,
  );
  assert.equal(
    resolveDocumentLink("#note/%ZZ", [target], "default"),
    undefined,
  );
});

const { useEditorStore } = require("../src/lib/store.ts");
function resetEditor() {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
}

test("creating a task from a note requires confirmation and preserves the source link", () => {
  resetEditor();
  useEditorStore.getState().createTab();
  const noteId = useEditorStore.getState().activeTabId;
  useEditorStore.getState().createTaskFromSelection();
  const state = useEditorStore.getState();
  assert.equal(Object.keys(state.projectData.tasks).length, 0);
  assert.equal(state.taskDraft.title, "");
  assert.equal(state.submitTaskDraft("   ", {}), null);
  const id = state.submitTaskDraft("Check the release", {});
  const task = useEditorStore.getState().projectData.tasks[id];
  assert.equal(task.title, "Check the release");
  assert.deepEqual(task.relatedDocumentIds, [noteId]);
});

test("selection task preserves the selected text and source note", () => {
  resetEditor();
  useEditorStore.getState().createTab();
  const noteId = useEditorStore.getState().activeTabId;
  useEditorStore.setState({
    editorView: {
      state: {
        selection: { main: { from: 0, to: 20 } },
        sliceDoc: () => "- [ ] Ship the mobile fix\nKeep keyboard access",
      },
    },
  });
  useEditorStore.getState().createTaskFromSelection();
  const state = useEditorStore.getState();
  const task = state.taskDraft;
  assert.equal(task.title, "Ship the mobile fix");
  assert.ok(task.description.includes("Keep keyboard access"));
  assert.deepEqual(task.relatedDocumentIds, [noteId]);
  state.cancelTaskDraft();
  assert.equal(Object.keys(useEditorStore.getState().projectData.tasks).length, 0);
});

test("adding a card to a new board preserves its column and chosen priority", () => {
  resetEditor();
  const state = useEditorStore.getState();
  state.createKanban();
  const boardId = useEditorStore.getState().activeTabId;
  state.beginTask({ boardId, columnId: "in-progress" });
  const id = state.submitTaskDraft("Review", { priority: "high" });
  const latest = useEditorStore.getState();
  assert.equal(latest.taskDraft, null);
  assert.equal(latest.projectData.tasks[id].columnId, "in-progress");
  assert.equal(latest.projectData.tasks[id].priority, "high");
  assert.equal(JSON.parse(latest.tabs.find((tab) => tab.id === boardId).content).columns[1].cards[0].priority, "high");
});

test("removing a board column moves its cards without changing task identity", () => {
  resetEditor();
  const state = useEditorStore.getState();
  state.createKanban();
  const boardId = useEditorStore.getState().activeTabId;
  const id = state.addTask("Review", { boardId, columnId: "in-progress" });
  const board = useEditorStore.getState().projectData.boards[boardId];
  state.updateBoard(boardId, { columns: board.columns.filter((column) => column.id !== "in-progress") });
  const latest = useEditorStore.getState();
  assert.equal(latest.projectData.tasks[id].title, "Review");
  assert.equal(latest.projectData.tasks[id].columnId, "todo");
  assert.equal(latest.projectData.tasks[id].status, "todo");
});

test("selection rectangles support reverse drags and scaled canvases", () => {
  const { selectionBounds, boundsOverlap, canvasPointer } = require("../src/lib/canvas-selection.ts");
  const bounds = selectionBounds({ x: 90, y: 70 }, { x: 10, y: 20 });
  assert.deepEqual(bounds, { x: 10, y: 20, w: 80, h: 50 });
  assert.equal(boundsOverlap(bounds, { x: 85, y: 65, w: 20, h: 20 }), true);
  assert.equal(boundsOverlap(bounds, { x: 95, y: 65, w: 20, h: 20 }), false);
  const canvas = { clientWidth: 400, clientHeight: 200, getBoundingClientRect: () => ({ left: 100, top: 100, width: 200, height: 100 }) };
  assert.deepEqual(canvasPointer({ clientX: 150, clientY: 125 }, canvas, { x: 20, y: 10 }, 2), { x: 40, y: 20 });
});

test("capture inherits a project's folder, then the current note folder", () => {
  resetEditor();
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = () => 0;
  try {
    const projectId = useEditorStore.getState().createProject("Release");
    const folderId =
      useEditorStore.getState().projectData.projects[projectId].folderId;
    useEditorStore.getState().createProjectDocument("note");
    let state = useEditorStore.getState();
    assert.equal(
      state.tabs.find((tab) => tab.id === state.activeTabId).folderId,
      folderId,
    );
    assert.equal(
      state.projectData.documents[state.activeTabId].projectId,
      projectId,
    );
    const subfolder = state.createFolder("Research", folderId);
    state.moveTabToFolder(state.activeTabId, subfolder);
    useEditorStore.getState().createProjectDocument("mindmap");
    state = useEditorStore.getState();
    assert.equal(
      state.tabs.find((tab) => tab.id === state.activeTabId).folderId,
      subfolder,
    );
  } finally {
    global.requestAnimationFrame = previous;
  }
});

test("loose captures share one Inbox folder", () => {
  resetEditor();
  const previous = global.requestAnimationFrame;
  global.requestAnimationFrame = () => 0;
  try {
    useEditorStore.getState().createProjectDocument();
    useEditorStore.getState().navigate("home");
    useEditorStore.getState().createProjectDocument("whiteboard");
    const state = useEditorStore.getState();
    assert.equal(
      state.folders.filter((folder) => folder.name === "Inbox").length,
      1,
    );
    assert.equal(state.tabs[0].folderId, state.tabs[1].folderId);
  } finally {
    global.requestAnimationFrame = previous;
  }
});

test("new notes and boards use the selected folder and its project", () => {
  resetEditor();
  const state = useEditorStore.getState();
  const projectId = state.createProject("Release");
  const root = useEditorStore.getState().projectData.projects[projectId].folderId;
  const folderId = state.createFolder("Research", root);
  state.navigate("files", null, folderId);
  state.requestCreateTab();
  state.createProjectDocument("kanban");

  const current = useEditorStore.getState();
  assert.equal(current.tabs.length, 2);
  for (const tab of current.tabs) {
    assert.equal(tab.folderId, folderId);
    assert.equal(current.projectData.documents[tab.id].projectId, projectId);
  }
});

test("the template picker retains the requested folder until the note is created", () => {
  resetEditor();
  const state = useEditorStore.getState();
  const projectId = state.createProject("Release");
  const folderId = useEditorStore.getState().projectData.projects[projectId].folderId;
  state.updateSettings({ promptForTemplateOnNewFile: true });
  state.createProjectDocument();
  assert.equal(useEditorStore.getState().tabs.length, 0);
  assert.equal(useEditorStore.getState().newTabTemplateDialogOpen, true);
  state.navigate("home");
  state.createTabFromTemplate("todo");

  const current = useEditorStore.getState();
  const [note] = current.tabs;
  assert.match(note.content, /Todo List/);
  assert.equal(note.folderId, folderId);
  assert.equal(current.projectData.documents[note.id].projectId, projectId);
  assert.equal(current.newTabTemplateDialogOpen, false);
});

test("a workspace switch clears the previous project's destination and pending template", () => {
  resetEditor();
  const state = useEditorStore.getState();
  state.createProject("Release");
  state.updateSettings({ promptForTemplateOnNewFile: true });
  state.requestCreateTab();
  const workspaceId = state.createProfile("Other");
  state.switchProfile(workspaceId);

  const current = useEditorStore.getState();
  assert.equal(current.activeProfileId, workspaceId);
  assert.deepEqual(current.navigation, { page: "home", projectId: null });
  assert.equal(current.newTabTemplateDialogOpen, false);
  assert.equal(current.newTabTemplateContext, null);
});

test("closing or deleting a board returns to the next note in source mode", () => {
  resetEditor();
  const state = useEditorStore.getState();
  state.createTab();
  const noteId = useEditorStore.getState().activeTabId;
  state.createProjectDocument("kanban");
  const boardId = useEditorStore.getState().activeTabId;
  state.closeTab(boardId);
  assert.equal(useEditorStore.getState().activeTabId, noteId);
  assert.equal(useEditorStore.getState().viewMode, "editor");
  state.openTab(boardId);
  state.deleteTab(boardId);
  assert.equal(useEditorStore.getState().activeTabId, noteId);
  assert.equal(useEditorStore.getState().viewMode, "editor");
});

test("opening and closing a file keeps the library folder selected", () => {
  resetEditor();
  const state = useEditorStore.getState();
  const folderId = state.createFolder("Reference");
  state.createTab(folderId);
  const noteId = useEditorStore.getState().activeTabId;
  state.closeTab(noteId);
  state.navigate("files", null, folderId);
  state.openTab(noteId);
  state.closeTab(noteId);

  assert.equal(useEditorStore.getState().activeTabId, null);
  assert.deepEqual(useEditorStore.getState().navigation, { page: "files", projectId: null, folderId });
});

test("pointer frames coalesce drags, preserve freehand samples, and flush the last move", () => {
  const { createFrameQueue } = require("../src/lib/frame-queue.ts");
  const received = [];
  let callback,
    scheduled = 0,
    cancelled = 0;
  const queue = createFrameQueue(
    (value) => received.push(value),
    (fn) => {
      callback = fn;
      return ++scheduled;
    },
    () => cancelled++,
  );
  queue.push(1);
  queue.push(2);
  queue.push(3);
  assert.equal(scheduled, 1);
  callback();
  assert.deepEqual(received, [3]);
  queue.push(4);
  queue.flush();
  assert.deepEqual(received, [3, 4]);
  queue.push(5);
  queue.cancel();
  callback();
  assert.deepEqual(received, [3, 4]);
  assert.ok(cancelled);
  const ink = createFrameQueue(
    (value) => received.push(value),
    (fn) => {
      callback = fn;
      return 1;
    },
    () => {},
    true,
  );
  ink.push(6);
  ink.push(7);
  ink.push(8);
  callback();
  assert.deepEqual(received, [3, 4, 6, 7, 8]);
});
test("presentation switches never create documents", () => {
  resetEditor();
  let state = useEditorStore.getState();
  state.createTab();
  for (const mode of [
    "kanban",
    "whiteboard",
    "pdf",
    "mindmap",
    "editor",
    "inline",
    "split",
    "preview",
  ])
    state.setViewMode(mode);
  assert.equal(useEditorStore.getState().tabs.length, 1);
  state.createWhiteboard();
  state.setViewMode("editor");
  assert.equal(useEditorStore.getState().tabs.length, 2);
  assert.equal(useEditorStore.getState().viewMode, "whiteboard");
});
test("closing a tab preserves its document and recent history", () => {
  resetEditor();
  useEditorStore.getState().createTab();
  const id = useEditorStore.getState().activeTabId;
  useEditorStore.getState().openTab(id);
  useEditorStore.getState().closeTab(id);
  const state = useEditorStore.getState();
  assert.equal(state.tabs.length, 1);
  assert.equal(state.openTabIds.length, 0);
  assert.ok(state.projectData.documents[id].lastOpenedAt);
});
test("delete and restore preserve content and document identity", () => {
  resetEditor();
  useEditorStore.getState().createTab();
  const id = useEditorStore.getState().activeTabId;
  useEditorStore.getState().updateContent(id, "# Important work");
  useEditorStore.getState().deleteTab(id);
  assert.equal(useEditorStore.getState().tabs.length, 0);
  assert.equal(
    useEditorStore.getState().projectData.trash[id].document.content,
    "# Important work",
  );
  useEditorStore.getState().restoreDocument(id);
  assert.equal(useEditorStore.getState().tabs[0].id, id);
  assert.equal(useEditorStore.getState().tabs[0].content, "# Important work");
});
test("editing a heading does not unexpectedly rename the document", () => {
  resetEditor();
  useEditorStore.getState().createTab();
  const id = useEditorStore.getState().activeTabId;
  useEditorStore.getState().renameTab(id, "My brief.md");
  useEditorStore.getState().updateContent(id, "# Different heading");
  assert.equal(useEditorStore.getState().tabs[0].title, "My brief.md");
});
test("opening a note leaves graph exploration and returns to the editor", () => {
  resetEditor();
  useEditorStore.getState().createTab();
  const id = useEditorStore.getState().activeTabId;
  useEditorStore.getState().setViewMode("graph");
  useEditorStore.getState().openTab(id);
  assert.equal(useEditorStore.getState().viewMode, "editor");
});

test("local-only trash content never enters the cloud transport", () => {
  const { serializeCloudProjectData } = require("../src/lib/projects.ts");
  const data = emptyProjectData(),
    tab = { ...board(), origin: "local", content: "local private writing" };
  data.trash[tab.id] = {
    id: tab.id,
    document: tab,
    deletedAt: 10,
    updatedAt: 10,
  };
  assert.equal(
    serializeCloudProjectData(data).includes("local private writing"),
    false,
  );
  assert.equal(data.trash[tab.id].document.content, "local private writing");
});

test("local board cards and tasks extracted from local notes stay out of cloud transport", () => {
  const { serializeCloudProjectData } = require("../src/lib/projects.ts");
  const local = { ...board(), origin: "local" };
  const data = migrateProjectData(emptyProjectData(), [local]);
  data.tasks["local-note-task"] = {
    ...data.tasks["board-a:card-1"],
    id: "local-note-task",
    boardId: null,
    relatedDocumentIds: ["local-note"],
    title: "Private local task",
  };
  const transport = JSON.parse(
    serializeCloudProjectData(data, [
      local,
      { ...local, id: "local-note", noteType: "note" },
    ]),
  );
  assert.deepEqual(transport.tasks, {});
  assert.deepEqual(transport.boards, {});
  assert.deepEqual(transport.documents, {});
  assert.equal(Object.keys(data.tasks).length, 2);
});
test("moving a board across workspaces updates its shared tasks and clears the old project", () => {
  resetEditor();
  useEditorStore.getState().createKanban();
  const id = useEditorStore.getState().activeTabId;
  const project = useEditorStore.getState().createProject("Original project");
  const domain = migrateProjectData(
    useEditorStore.getState().projectData,
    useEditorStore.getState().tabs,
  );
  useEditorStore.setState({
    projectData: domain,
    profiles: [
      ...useEditorStore.getState().profiles,
      { id: "other", name: "Other", color: "#3559c7", preset: "custom" },
    ],
  });
  useEditorStore.getState().assignDocument(id, project);
  const taskId = useEditorStore.getState().addTask("Deliver", { boardId: id });
  useEditorStore.getState().moveTabToWorkspace(id, "other");
  assert.equal(
    useEditorStore.getState().projectData.tasks[taskId].workspaceId,
    "other",
  );
  assert.equal(
    useEditorStore.getState().projectData.tasks[taskId].projectId,
    null,
  );
  assert.equal(
    useEditorStore.getState().projectData.documents[id].projectId,
    null,
  );
});
