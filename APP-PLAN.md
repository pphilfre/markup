# Markup workbench

Markup is a keyboard-first Markdown workspace. Notes, tasks, folders, projects, and visual documents belong in one working environment. Projects add organisation without replacing the editor, file tree, search commands, or specialist tools.

## Interface direction

- Keep the lowercase `markup|` wordmark and cyan cursor.
- Use the existing Geist interface family and configurable writing fonts. Keep all existing themes.
- Base light colours: white `#FFFFFF`, ink `#202C3C`, panel `#F5F7FA`, border `#DCE2EA`, blue `#3559C7`, cursor `#4AC8D9`. Dark mode uses the corresponding dark surfaces and readable accent colours.
- One file navigator, one tab row, one editor toolbar. File names belong in tabs and the inspector, without another title bar above the same document.
- Use borders and spacing to distinguish folders, files, and controls. Avoid descriptive slogans, decorative dashboard statistics, and permanent related-work footers.
- Every file type is available from New and Home. Keep keyboard shortcuts and non-drag alternatives.

## Navigation and pages

Home is a starting point: create a note, whiteboard, mind map, task board, or PDF; reopen recent and pinned files; enter a project; see due tasks.

Files groups documents by folder path, with type/folder/text filters and batch organisation. Inbox contains loose captures and legacy files without a folder or project. New captures inherit the current folder or project; otherwise they go into one Inbox folder. Batch moves can use an existing folder, a named new folder, or a project.

Project overview contains the user's goal, project files, full task-board shortcuts, overdue/in-progress work, and task capture. Empty sections direct users toward an action instead of displaying invented activity.

Tasks shows the shared records as a list or board. Existing `.kanban` files retain their full editor: columns, colours, WIP limits, card descriptions, priorities, dates, labels, duplication, and movement. Their List view edits those same records. Task drawers use column IDs so custom columns remain distinguishable even when they share a general status.

## Writing and finding

The toolbar offers source, live editing, preview, and split view; bold, italic, strike; paragraph and H1–H6; lists and checklists; quotes, code, links, images, tables, maths, and highlights. Choosing a heading level replaces the existing level.

Task creation works with or without selected text and links the task to the source note. Stable document links survive renames. References, linked tasks, project assignment, filename editing, and local version history live in the optional inspector.

Search retains the original commands, filename/folder matches, keyboard navigation, and text-line search. Ordinary queries also match content, tags, projects, and tasks. The `?` prefix remains a text-only shortcut. Content matches open the source editor at the matching line.

## Responsive controls

Settings uses one focus-trapped dialog with a section navigator and independently scrolling content. It becomes full-screen on phones. Menus and sheets are bounded by the viewport.

Mobile navigation opens from the screen edge and closes after navigation or creation. Task List is the narrow-screen default. Split editing stacks source and preview on phones. Canvas toolbar groups scroll within the available canvas width.

AI is optional: a resizable right pane on desktop and full-screen chat on phones, with note attachments, model selection, retry, and useful draft prompts. Opening it is separate from the writing workflow.

## Data and performance

- Preserve document IDs, folders, tags, existing board formats, and closed files. Closing a tab is separate from deletion.
- Keep versioned project/task metadata, repeatable legacy-board migration, and a pre-migration local backup.
- Share task identity between list and board projections.
- Keep trash restoration, bounded local note history, and recoverable competing incoming note versions.
- Report completed device saves separately from cloud and folder-sync state; surface save failures.
- Keep local documents, their derived tasks/board cards, and local trash contents out of cloud transport.
- Add the project envelope to Convex and PostgreSQL, with per-record merge behaviour.
- Coalesce drag events to animation frames, preserve freehand samples, stop idle canvas redraws, cap drawing pixel density, and index mind-map connection endpoints.

## Validation and release

Local automated coverage includes 34 migration, task identity, custom-column, source-task, capture-folder, close/delete/restore, note-link, conflict, local-transport, heading, and pointer-frame tests. Run `npm test`, `npm run typecheck`, and `npm run lint`.

Browser checks cover project creation, note-to-task creation, content-search line navigation, Inbox batch moves, full-board/list task identity, whiteboard shape movement, and mind-map node movement. Review the editor, navigator, settings, and menus at desktop and 390px phone widths.

Build the Windows app with `npm run tauri:build -- --no-bundle`, then build the web app with `npm run build:docker`. The desktop export uses Next's build directory, so run the web build last when both are needed.

Before production rollout, deploy the Convex schema/functions or apply the PostgreSQL migration and regenerate its client. Live multi-account sync, reconnect behaviour, sharing permissions, AI responses, native folder permissions, and signed installer/updater delivery need the configured services and release environment. Local builds do not deploy a backend or publish a signed release.

Simultaneous multiplayer editing, project-wide permissions, automation, dependencies, and new document types remain outside this implementation.
