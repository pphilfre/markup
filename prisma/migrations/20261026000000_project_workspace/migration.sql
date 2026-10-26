-- Project records share the existing per-user workspace transport.
-- Nullable for existing installations; the client migrates legacy files without rewriting their IDs.
ALTER TABLE "workspaces" ADD COLUMN "projectData" TEXT;
