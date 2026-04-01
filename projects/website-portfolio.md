## Markup — fast, keyboard-first markdown workspace

Markup is a productivity-first markdown workspace I built with a focus on speed, keyboard ergonomics, and flexible document types (notes, whiteboards, mind maps). It combines a full-featured Markdown editor with live preview, graph/backlink views, collaborative cloud sync, and an optional native desktop experience via Tauri.

### What it does

- Provides a keyboard-first Markdown editing experience with split preview and a distraction-free mode.
- Renders math (KaTeX), diagrams (Mermaid), and code blocks with syntax highlighting.
- Supports multiple document types: standard markdown notes, whiteboards (canvas), and mind maps; all can be saved, synced, and shared.
- Offers workspace state persistence (open tabs, folders, UI settings) plus a Spotlight-style quick-search across notes and features.
- Syncs user data to Convex (cloud) and supports offline-first behavior with local hydration and later sync.
- Exports and desktop-sync via Tauri: maps a local folder to notes and supports packaged desktop builds and auto-updates.

### Key features

- Keyboard-first Markdown editor (CodeMirror 6) with extensible keybindings
- Live split preview with:
	- GitHub-flavored markdown, math (remark-math + rehype-katex)
	- Syntax highlighting and code block rendering
	- Mermaid diagrams and LaTeX support
- Backlink/graph view (built with d3 + custom graph code)
- Whiteboard and mindmap modes with JSON-serialised canvas/mindmap state
- Shareable note viewer (public/private shares)
- Spotlight search for fast navigation and feature access
- Convex-powered cloud sync (users, tabs, workspaces, mindmaps, whiteboards)
- Tauri desktop support with local filesystem sync and auto-update integration

### Tech stack

- Framework: Next.js (App Router)
- Language: TypeScript
- UI: Tailwind CSS, shadcn/ui (Radix primitives), Lucide icons
- Editor: CodeMirror 6 and various editor extensions
- Data & backend: Convex (serverless data + functions)
- Auth: WorkOS AuthKit (Next.js integration)
- State: Zustand
- Desktop: Tauri (v2) with multiple platform bundle targets and the Tauri updater plugin
- Extras: mermaid, KaTeX, rehype/remark pipeline, d3-force, jszip, file-saver

Notable dependencies (high level): next, react, convex, tauri tooling, codemirror, mermaid, katex, zustand, tailwindcss.

### Architecture & data model (high level)

- The app is a Next.js app using the App Router for client and server routes.
- Convex stores the core data model: `users`, `tabs` (documents), `workspaces` (UI state + settings), `whiteboards`, `mindmaps`, and `sharedNotes`. The schema and key queries live in the `convex/` folder.
- The UI is modular: `src/components/editor` holds the editor and preview components; `src/components/shell` manages the main shell views (sidebar, file tree, graph, whiteboard, spotlight search). Global sync logic and helpers are in `src/lib`.
- Desktop builds use a static export (when building for Tauri) and a lightweight relay for OAuth to support WorkOS desktop sign-in flows.

### Role / responsibilities

I designed, implemented, and maintain the full-stack product including:

- UX and keyboard-first editor interactions
- Client architecture and state synchronization
- Convex schema design and server functions
- Tauri desktop integration and build tooling
- Authentication flows with WorkOS

### How to run (development)

From the project root (Windows PowerShell):

```powershell
npm install
npm run dev
```

This runs Next.js and Convex locally in parallel. For desktop development (Tauri):

```powershell
# run Tauri dev with Convex
npm run tauri:dev
```

Build for production (web + Convex deploy):

```powershell
npm run build
```

Build a packaged desktop app (requires Rust + Tauri toolchain):

```powershell
npm run build:tauri
```

Environment notes

- The app requires Convex deployment and WorkOS credentials to enable cloud sync and authentication. Create a `.env.local` with the required keys (e.g. `NEXT_PUBLIC_CONVEX_URL`, `WORKOS_CLIENT_ID`, `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, `NEXT_PUBLIC_WORKOS_REDIRECT_URI`).

### Links

- Repo: https://github.com/pphilfre/markup
- Live/demo: (if hosted, add URL here)

---

If you'd like, I can add a short gallery (screenshots) and a short 'case study' paragraph explaining design trade-offs (offline-first sync, Tauri static export choices, and editor UX decisions). Would you like that included in this portfolio page?
