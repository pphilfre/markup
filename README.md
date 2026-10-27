# Markup

<p align="center">
  <img src="https://raw.githubusercontent.com/pphilfre/markup-home/refs/heads/main/public/app.png" alt="Markup App Preview" width="100%" />
</p>

A keyboard-first Markdown workspace for connected notes, tasks, and visual thinking, built with **Next.js**, **TypeScript**, **Zustand**, **Convex or PostgreSQL**, and **WorkOS AuthKit**.
Write with source, live editing, split preview, and the full formatting toolbar. Organise files in folders or projects, switch between task lists and full boards, and work across whiteboards, mind maps, PDFs, graph links, sharing, and local/remote sync.

## Project workspace

- Create projects inside existing workspaces. Existing documents retain their folders and IDs. New captures inherit the current folder or project; loose captures go to **Inbox**, with batch moves into folders and projects.
- Manage the same tasks in List and Board views, including tasks imported from existing `.kanban` documents.
- Choose **Task** in a note to create a linked task; selecting text first uses it as the title and description.
- Search files, tags, note text, folders, projects, tasks, and the original commands with **Ctrl+K**. The `?` prefix still searches text only, with navigation to matching lines.
- Close tabs without deleting files. Deleted documents and tasks go to **Trash**; documents can be restored or permanently removed with confirmation.
- Device saves, cloud sync, and desktop folder mirroring have separate status reporting. Local Markdown history keeps up to ten snapshots on the current device; competing incoming versions can be recovered there.

The first project migration saves an untouched backup under `markup-backup-before-projects-v1` in IndexedDB. Original document IDs and legacy board files are preserved. Project/task records use the versioned `projectData` workspace envelope in both backends. Local files, their board cards, tasks linked to local files, and local trash contents are excluded from cloud transport.

### Upgrading an existing installation

For PostgreSQL, apply the included migration with `npx prisma migrate deploy`, then regenerate the client and deploy the web build. For Convex, deploy the updated schema and workspace functions with your usual configured deployment. Deploy the backend changes before distributing the new frontend. No live database migration or production deployment is performed by the local validation commands below.

```bash
npm test
npm run typecheck
npm run lint
npm run build:docker
```

`build:docker` creates the production web build without deploying Convex. `build:tauri` creates the desktop frontend export; `tauri:build -- --no-bundle` also compiles the native executable. Installer/updater signing remains part of the release workflow.

The default backend is Convex; select PostgreSQL with `NEXT_PUBLIC_DB_PROVIDER=postgres`. Cloud sync and sharing require their configured service and account. Signed desktop releases and end-to-end multi-account sync require the corresponding credentials and deployment environment. The core project workflow works locally without signing in.

---

## Features

* ⚡ **Keyboard-first markdown editing**
* 👀 **Live preview** with:

  * GitHub Flavored Markdown (`remark-gfm`)
  * Math (`remark-math` + `rehype-katex`)
  * Syntax highlighting (`rehype-highlight`)
  * Mermaid diagram support
* 🧭 **Multiple workspace modes**

  * Editor / Split / Preview
  * Graph view (backlink-based)
  * Whiteboard mode
  * Mind map mode
* 🗂️ **File + folder organization**

  * Folder colors and hierarchy support
  * Pinning, tags, custom note icons/colors
* 🔎 **Spotlight search**

  * Search files, folders, features, and text lines
* ☁️ **Cloud sync**

  * PostgreSQL + Prisma powered sync
  * Workspace + tabs synced per authenticated user
  * Offline-aware syncing/hydration strategy
* 🔐 **Authentication with WorkOS AuthKit**
* 🔗 **Shared notes viewer**

  * Public/private share modes with read-only rendering
* 🖥️ **Desktop support via Tauri**

  * Local filesystem sync (`.md`, `.canvas`, `.mindmap`)
* 🎨 **Modern UI**

  * shadcn/ui + Radix primitives + Tailwind CSS

---

## Tech Stack

* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **UI:** shadcn/ui, Radix UI, Tailwind CSS, Lucide icons
* **State:** Zustand
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Auth:** WorkOS AuthKit
* **Desktop:** Tauri (optional target)
* **Editor/Rendering:** CodeMirror, React Markdown ecosystem, KaTeX, Mermaid, d3-force

---

## Project Structure

```txt
.
├── prisma/                    # Prisma schema + migrations
├── src/
│   ├── app/                  # Next.js app router
│   ├── components/
│   │   ├── editor/           # Editor + markdown preview
│   │   ├── shell/            # Main app shell, views, spotlight, graph, whiteboard
│   │   └── ui/               # shadcn/radix UI components
│   └── lib/                  # Store, sync logic, utilities
├── scripts/                  # Build scripts (including Tauri helpers)
├── public/
│   └── app.png               # README preview image
├── components.json           # shadcn/ui config
└── package.json
```

---

## Requirements

* **Node.js** 18+ (recommended: latest LTS)
* **npm** (or compatible package manager)
* A **PostgreSQL** database
* **WorkOS** app credentials
* (Optional) **Tauri v2** toolchain for desktop builds

---

## Environment Variables

Create a `.env.local` file in the project root.

```bash
# PostgreSQL / Prisma
DATABASE_URL=postgresql://user:password@localhost:5432/markup

# Select "convex" or "postgres"
NEXT_PUBLIC_DB_PROVIDER=

# WorkOS AuthKit
WORKOS_CLIENT_ID=...
WORKOS_API_KEY=...
WORKOS_COOKIE_PASSWORD=...
NEXT_PUBLIC_WORKOS_REDIRECT_URI=...
```

You may also need additional WorkOS/AuthKit callback/session variables depending on your WorkOS setup.
If unsure, follow the WorkOS AuthKit for Next.js setup documentation and mirror the values used in your WorkOS dashboard.

---

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Generate the Prisma client**

   ```bash
   npx prisma generate
   ```

3. **Run database migrations**

   ```bash
   npx prisma migrate dev
   ```

4. **Run the development server**

   ```bash
   npm run dev
   ```

5. Open the app:

   ```txt
   http://localhost:3000
   ```

---

## Available Scripts

From `package.json`:

* `npm run dev` – run Next.js development server
* `npm run build` – build production app
* `npm run start` – run production Next.js server
* `npm run lint` – run ESLint
* `npm run tauri:dev` – run Tauri development build
* `npm run tauri:build` – build desktop app via Tauri
* `npm run build:tauri` – run custom Tauri build script

---

## Database Model Overview

The database includes key models for:

* **users** – WorkOS identity mapping
* **tabs** – note/whiteboard/mindmap documents
* **workspaces** – persisted UI state, settings, folders, open tabs, profile selection
* **shares** – public/private shared note access

Workspace settings include typography/editor behavior, markdown rendering settings, appearance/theme configuration, and sidebar/editor preferences.

---

## Notes on Sync Behavior

* App state is hydrated from PostgreSQL when authenticated.
* Local edits can continue while offline and are flushed when connectivity returns.
* In Tauri mode, notes can sync to a local folder with format-aware extensions:

  * `.md`
  * `.canvas`
  * `.mindmap`

---

## Updating for Contributors

Edit the `version.json` file to the next release version and run:

```bash
npm run sync-changes
```

---

## Deployment

### Web

The repository sets Vercel's Build Command to `npm run build:vercel`, overriding any dashboard command that wraps `npm run build` in another Convex deployment.

- `npm run build` builds the frontend only (Prisma generation and Next.js).
- `npm run build:convex` explicitly deploys Convex and builds the frontend once.
- `npm run build:docker` remains the frontend-only Docker build alias.

Vercel's entry point selects the backend workflow:

| Environment | Configuration | Behaviour |
| --- | --- | --- |
| Production / Convex | Production `CONVEX_DEPLOY_KEY` | Deploy the backend and build once. |
| Preview / Convex | Preview `CONVEX_DEPLOY_KEY` | Create an isolated preview backend and build once. |
| Preview / Convex | Existing `NEXT_PUBLIC_CONVEX_URL` or production deploy key | Build against the existing backend without deploying backend changes. An explicit URL takes precedence; a standard cloud URL can otherwise be derived from the production key's public deployment name. |
| PostgreSQL | `NEXT_PUBLIC_DB_PROVIDER=postgres` | Build without running Convex; configure the database, migrations, and account environment separately. |

Scope production keys to Vercel's Production environment. For isolated PR previews, configure a [Convex Preview Deploy Key](https://docs.convex.dev/production/hosting/vercel#preview-deployments) in Vercel's Preview environment. A frontend-only preview uses the existing backend's functions and data; backend changes require a separate backend deployment or an isolated preview key. Merging to Vercel's production branch runs the production workflow, including the Convex deployment.

### Desktop

Use the Tauri build scripts after setting up the Rust/Tauri toolchain.

### Docker Updates

The Docker build can check for newer releases and surface an in-app notification.
When an update is available, pull the latest image (or rebuild) and restart the container.

You can customize the update check URLs by setting these build args:

```bash
NEXT_PUBLIC_DOCKER_UPDATE_URL=https://raw.githubusercontent.com/pphilfre/markup/main/version.json
NEXT_PUBLIC_DOCKER_UPDATE_DOCS_URL=https://github.com/pphilfre/markup#docker-updates
```

---

## License

[Apache License 2.0](https://github.com/pphilfre/markup/blob/main/LICENSE)

---

## Credits

Built by **Freddie Philpot**

* GitHub: [https://github.com/pphilfre](https://github.com/pphilfre)
* Website: [https://freddiephilpot.dev](https://freddiephilpot.dev)
