# Markup

A fast, keyboard-first markdown workspace built with **Next.js**, **TypeScript**, **Convex**, **WorkOS AuthKit**, and **shadcn/ui**.  
Markup combines markdown editing with advanced note tooling like split preview, graph view, whiteboards, mind maps, sharing, and local/remote sync.

## Features

- ⚡ **Keyboard-first markdown editing**
- 👀 **Live preview** with:
  - GitHub Flavored Markdown (`remark-gfm`)
  - Math (`remark-math` + `rehype-katex`)
  - Syntax highlighting (`rehype-highlight`)
  - Mermaid diagram support
- 🧭 **Multiple workspace modes**
  - Editor / Split / Preview
  - Graph view (backlink-based)
  - Whiteboard mode
  - Mind map mode
- 🗂️ **File + folder organization**
  - Folder colors and hierarchy support
  - Pinning, tags, custom note icons/colors
- 🔎 **Spotlight search**
  - Search files, folders, features, and text lines
- ☁️ **Convex-backed cloud sync**
  - Workspace + tabs synced per authenticated user
  - Offline-aware syncing/hydration strategy
- 🔐 **Authentication with WorkOS AuthKit**
- 🔗 **Shared notes viewer**
  - Public/private share modes with read-only rendering
- 🖥️ **Desktop support via Tauri**
  - Local filesystem sync (`.md`, `.canvas`, `.mindmap`)
- 🎨 **Modern UI**
  - shadcn/ui + Radix primitives + Tailwind CSS

---

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **UI:** shadcn/ui, Radix UI, Tailwind CSS, Lucide icons
- **State:** Zustand
- **Backend/Data:** Convex
- **Auth:** WorkOS AuthKit
- **Desktop:** Tauri (optional target)
- **Editor/Rendering:** CodeMirror, React Markdown ecosystem, KaTeX, Mermaid, d3-force

---

## Project Structure

```txt
.
├── convex/                    # Convex schema + functions
├── src/
│   ├── app/                  # Next.js app router
│   ├── components/
│   │   ├── editor/           # Editor + markdown preview
│   │   ├── shell/            # Main app shell, views, spotlight, graph, whiteboard
│   │   └── ui/               # shadcn/radix UI components
│   └── lib/                  # Store, sync logic, utilities
├── scripts/                  # Build scripts (including Tauri helpers)
├── components.json           # shadcn/ui config
└── package.json
```

---

## Requirements

- **Node.js** 18+ (recommended: latest LTS)
- **npm** (or compatible package manager)
- A **Convex** project/deployment
- **WorkOS** app credentials
- (Optional) **Tauri v2** toolchain for desktop builds

---

## Environment Variables

Create a `.env.local` file in the project root.

Because this app uses both Next.js + Convex + WorkOS, configure at least:

```bash
# Convex
NEXT_PUBLIC_CONVEX_URL=...

# WorkOS AuthKit
WORKOS_CLIENT_ID=...
WORKOS_API_KEY=...
WORKOS_COOKIE_PASSWORD=...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=...
```

You may also need additional WorkOS/AuthKit callback/session variables depending on your WorkOS setup.  
If unsure, follow WorkOS AuthKit for Next.js setup docs and mirror the values used in your WorkOS dashboard.

---

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Run development servers (Next.js + Convex)**
   ```bash
   npm run dev
   ```

   This runs both:
   - `next dev`
   - `npx convex dev`

3. Open:
   - App: `http://localhost:3000`
   - Convex dashboard/dev output in your terminal session

---

## Available Scripts

From `package.json`:

- `npm run dev` – run Next.js and Convex in parallel
- `npm run dev:next` – run Next.js only
- `npm run dev:convex` – run Convex dev only
- `npm run build` – deploy Convex and build Next.js
- `npm run start` – run production Next.js server
- `npm run lint` – run ESLint
- `npm run tauri:dev` – run Tauri dev + Convex dev
- `npm run tauri:build` – build desktop app via Tauri
- `npm run build:tauri` – run custom Tauri build script

---

## Data Model (Convex Overview)

The schema includes key tables for:

- **users** – WorkOS identity mapping
- **tabs** – note/whiteboard/mindmap documents
- **workspaces** – persisted UI state, settings, folders, open tabs, profile selection
- (plus sharing-related entities used by the shared note viewer flow)

Workspace settings include typography/editor behavior, markdown behavior, appearance/theme settings, and sidebar/editor preferences.

---

## Notes on Sync Behavior

- App state is hydrated from Convex when authenticated.
- Local edits can continue while offline and are flushed when connectivity returns.
- In Tauri mode, notes can sync to a local folder with format-aware extensions:
  - `.md`
  - `.canvas`
  - `.mindmap`

---

## Deployment

### Web
Deploy as a standard Next.js app (e.g. Vercel), with:
- Convex deployment configured
- All required env vars set in hosting provider

### Desktop
Use Tauri build scripts after setting up the Rust/Tauri toolchain.

---

## License

[Apache Licensce 2.0](https://github.com/pphilfre/markup/blob/main/LICENSE)

---

## Credits

Built by **Freddie Philpot**  
- GitHub: https://github.com/pphilfre  
- Website: https://freddiephilpot.dev
