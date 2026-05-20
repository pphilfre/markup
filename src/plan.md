## Plan: Dual Database Provider Toggle

Introduce a database provider abstraction so deployments can choose Convex or Postgres via a build-time environment toggle. Keep the UI and sync behavior consistent while routing reads/writes to the selected provider; Convex remains supported, Postgres uses Prisma-backed API routes and bytea storage for PDFs. No dual-write; each deployment uses exactly one backend.

**Steps**
1. Define provider selection and shared types
   1. Add a provider selector module under src/lib that reads NEXT_PUBLIC_DB_PROVIDER and exposes a typed enum plus helpers (client and server); include a guard that validates required env (Convex URL or DATABASE_URL).
   2. Define a provider-agnostic data contract (types for users, tabs, workspace, sharing, sites, whiteboards, mindmaps, pdf metadata) under src/lib so both providers return the same shapes.
2. Introduce a provider interface and wiring
   1. Create a database provider interface (queries + mutations used by the UI) and a thin hook layer replacing direct useQuery/useMutation at call sites; choose a naming convention that matches existing usage (e.g., useDbQuery/useDbMutation) to minimize churn.
   2. Replace Convex-only provider in the root layout with a new DatabaseClientProvider that picks ConvexClientProvider or a PostgresClientProvider based on the toggle; keep AuthLoader shared.
   3. Update sync entrypoint on the home page to render ConvexSync or a new PostgresSync component based on the toggle; keep useSyncState as the shared UI status contract.
3. Build the Convex adapter (minimal change)
   1. Wrap existing Convex hooks and api.* calls behind the new provider interface so current behavior is preserved.
   2. Keep Convex-specific error banners (missing NEXT_PUBLIC_CONVEX_URL) but only show them when provider=convex.
4. Build the Postgres backend (Prisma + API routes)
   1. Add Prisma schema and migration structure at the repo root; model tables that match existing Convex schema (users, tabs, workspaces, pdf_files, shared_notes, sites, whiteboards, mindmaps) with indexes equivalent to Convex indexes.
   2. Add Next.js API routes under src/app/api for each query/mutation used by the client; implement server-side validation and authorization (use WorkOS session/cookies, verify userId matches session).
   3. Implement PDF storage as bytea in Postgres with upload/download endpoints; update response shapes to match existing Convex behavior (generateUploadUrl equivalent replaced with direct upload endpoint).
5. Build the Postgres client adapter
   1. Implement the provider interface by calling the new API routes with fetch; add local caching/polling where Convex previously used real-time subscriptions (e.g., workspace/tabs/shared notes).
   2. Implement a PostgresSync component that mirrors ConvexSync’s responsibilities: initial hydration, debounced saves, manual sync, and conflict strategy (server wins for remote updates, local wins for unsaved changes).
6. Update UI and feature modules to use the abstraction
   1. Replace direct Convex hook usage in components (publish/share/shared-note viewer/sites/pdf editor) with provider hooks; keep data flow and state logic intact.
   2. Update desktop debug notice to report missing Postgres config when provider=postgres.
7. Config, docs, and build pipeline
   1. Add environment documentation for NEXT_PUBLIC_DB_PROVIDER, NEXT_PUBLIC_CONVEX_URL, DATABASE_URL, and any Postgres-specific settings; update README and deployment notes.
   2. Update Tauri build workflow to set NEXT_PUBLIC_DB_PROVIDER and any required Postgres envs when building desktop artifacts.

**Relevant files**
- src/components/convex-client-provider.tsx — wrap or supersede with provider selector; keep shared AuthLoader.
- src/lib/convex-sync.tsx — move into provider adapter or split into provider-specific sync components.
- src/app/layout.tsx — swap ConvexClientProvider for new DatabaseClientProvider.
- src/app/page.tsx — render provider-specific sync component.
- src/components/shell/publish-dialog.tsx — replace Convex queries/mutations with provider abstraction.
- src/components/shell/share-dialog.tsx — replace Convex queries/mutations with provider abstraction.
- src/components/shell/shared-note-viewer.tsx — replace Convex queries/mutations with provider abstraction.
- src/components/shell/pdf-editor.tsx — replace Convex storage calls with provider abstraction (bytea upload/download).
- src/app/sites/[slug]/page.tsx — replace Convex queries with provider abstraction.
- src/components/shell/desktop-debug-notice.tsx — add provider-aware config warnings.
- next.config.ts — confirm CSP/connect-src allowances for Postgres API host if needed.
- .github/workflows/tauri-build.yml — set provider env for desktop builds.
- package.json — add Prisma scripts/deps if needed.

**Verification**
1. Web: run app with NEXT_PUBLIC_DB_PROVIDER=convex and verify existing sync, share, publish, and PDF behavior remains unchanged.
2. Web: run app with NEXT_PUBLIC_DB_PROVIDER=postgres and verify login, initial hydration, sync, share, publish, and PDF upload/download via Postgres API routes.
3. Desktop: build Tauri with each provider and validate debug notices, auth flow, and sync behavior.
4. Data integrity: verify tab/workspace CRUD parity and shared note editing across two clients for Postgres mode (polling update path).

**Decisions**
- Use build-time toggle NEXT_PUBLIC_DB_PROVIDER to select a single backend per deployment; no dual writes or automatic migration.
- Use Prisma + Postgres and store PDFs as bytea for the first implementation.

**Further Considerations**
1. Feature parity scope: this plan assumes Postgres supports sharing, sites, whiteboards, and mindmaps; reduce scope if you want an MVP.
2. Polling + conflict strategy: define a polling cadence and merge rules for Postgres sync to balance freshness and load.
