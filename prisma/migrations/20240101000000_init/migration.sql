-- CreateTable
CREATE TABLE "users" (
    "workosId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "profilePictureUrl" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("workosId")
);

-- CreateTable
CREATE TABLE "tabs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "workspaceId" TEXT,
    "folderId" TEXT,
    "tags" JSONB,
    "pinned" BOOLEAN,
    "noteType" TEXT,
    "customIcon" TEXT,
    "iconColor" TEXT,

    CONSTRAINT "tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activeTabId" TEXT,
    "openTabIds" JSONB,
    "folders" JSONB,
    "viewMode" TEXT,
    "theme" TEXT,
    "fileTreeOpen" BOOLEAN,
    "settings" JSONB,
    "profiles" JSONB,
    "activeProfileId" TEXT,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whiteboards" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "elements" TEXT NOT NULL,
    "canvasSettings" TEXT NOT NULL,

    CONSTRAINT "whiteboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mindmaps" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodes" TEXT NOT NULL,
    "connections" TEXT NOT NULL,
    "settings" TEXT NOT NULL,

    CONSTRAINT "mindmaps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_notes" (
    "id" TEXT NOT NULL,
    "shareId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "allowedUsers" TEXT[],
    "noteType" TEXT,
    "whiteboardData" TEXT,
    "mindmapData" TEXT,

    CONSTRAINT "shared_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pdf_files" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tabId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "pdf_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tabs_userId_tabId_key" ON "tabs"("userId", "tabId");

-- CreateIndex
CREATE INDEX "tabs_userId_idx" ON "tabs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_userId_key" ON "workspaces"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "whiteboards_userId_key" ON "whiteboards"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mindmaps_userId_key" ON "mindmaps"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_notes_shareId_key" ON "shared_notes"("shareId");

-- CreateIndex
CREATE UNIQUE INDEX "shared_notes_ownerUserId_tabId_key" ON "shared_notes"("ownerUserId", "tabId");

-- CreateIndex
CREATE INDEX "shared_notes_ownerUserId_idx" ON "shared_notes"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "sites_slug_key" ON "sites"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sites_ownerUserId_tabId_key" ON "sites"("ownerUserId", "tabId");

-- CreateIndex
CREATE INDEX "sites_ownerUserId_idx" ON "sites"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "pdf_files_userId_tabId_key" ON "pdf_files"("userId", "tabId");

-- CreateIndex
CREATE INDEX "pdf_files_userId_idx" ON "pdf_files"("userId");

-- AddForeignKey
ALTER TABLE "tabs" ADD CONSTRAINT "tabs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whiteboards" ADD CONSTRAINT "whiteboards_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mindmaps" ADD CONSTRAINT "mindmaps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_notes" ADD CONSTRAINT "shared_notes_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pdf_files" ADD CONSTRAINT "pdf_files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("workosId") ON DELETE CASCADE ON UPDATE CASCADE;
