import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import {
  ApiError,
  badRequest,
  assertUserIdMatch,
  getAuthUser,
  requireAuthUser,
  normalizeEmail,
} from "@/lib/server/api";

export const runtime = "nodejs";

type QueryBody = {
  key?: unknown;
  args?: unknown;
};

const workspaceSelect = {
  userId: true,
  activeTabId: true,
  openTabIds: true,
  folders: true,
  viewMode: true,
  theme: true,
  fileTreeOpen: true,
  settings: true,
  profiles: true,
  activeProfileId: true,
};

const tabSelect = {
  userId: true,
  tabId: true,
  title: true,
  content: true,
  workspaceId: true,
  folderId: true,
  tags: true,
  pinned: true,
  noteType: true,
  customIcon: true,
  iconColor: true,
};

const sharedNoteSelect = {
  shareId: true,
  ownerUserId: true,
  tabId: true,
  title: true,
  content: true,
  visibility: true,
  permission: true,
  allowedUsers: true,
  noteType: true,
  whiteboardData: true,
  mindmapData: true,
};

const siteSelect = {
  slug: true,
  ownerUserId: true,
  tabId: true,
  title: true,
  content: true,
  publishedAt: true,
  updatedAt: true,
};

type SiteRecord = {
  slug: string;
  ownerUserId: string;
  tabId: string;
  title: string;
  content: string;
  publishedAt: Date;
  updatedAt: Date;
};

function serializeSite(site: SiteRecord) {
  return {
    slug: site.slug,
    ownerUserId: site.ownerUserId,
    tabId: site.tabId,
    title: site.title,
    content: site.content,
    publishedAt: site.publishedAt.getTime(),
    updatedAt: site.updatedAt.getTime(),
  };
}

function requireObject(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw badRequest(`Invalid ${name}.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`Missing ${name}.`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[db/query] Unhandled error:", message, error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QueryBody;
    const key = typeof body?.key === "string" ? body.key : null;
    if (!key) {
      throw badRequest("Missing query key.");
    }

    const args = requireObject(body.args ?? {}, "args");

    switch (key) {
      case "workspace.get": {
        const userId = requireString(args.userId, "userId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const workspace = await prisma.workspace.findUnique({
          where: { userId },
          select: workspaceSelect,
        });

        return NextResponse.json(workspace);
      }

      case "tabs.list": {
        const userId = requireString(args.userId, "userId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const tabs = await prisma.tab.findMany({
          where: { userId },
          select: tabSelect,
        });

        return NextResponse.json(tabs);
      }

      case "sharing.listByOwner": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        const sharedNotes = await prisma.sharedNote.findMany({
          where: { ownerUserId },
          select: sharedNoteSelect,
        });

        return NextResponse.json(sharedNotes);
      }

      case "sharing.getByShareId": {
        const shareId = requireString(args.shareId, "shareId");
        const sharedNote = await prisma.sharedNote.findUnique({
          where: { shareId },
          select: sharedNoteSelect,
        });

        if (!sharedNote) {
          return NextResponse.json(null);
        }

        if (sharedNote.visibility === "private") {
          const user = await getAuthUser(req);
          if (!user) {
            return NextResponse.json(null);
          }
          if (sharedNote.ownerUserId !== user.id) {
            const allowed = sharedNote.allowedUsers.map((email) =>
              normalizeEmail(email)
            );
            const email = normalizeEmail(user.email || "");
            if (!email || !allowed.includes(email)) {
              return NextResponse.json(null);
            }
          }
        }

        return NextResponse.json(sharedNote);
      }

      case "sharing.getByOwnerTab": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        const sharedNote = await prisma.sharedNote.findUnique({
          where: {
            ownerUserId_tabId: {
              ownerUserId,
              tabId,
            },
          },
          select: sharedNoteSelect,
        });

        return NextResponse.json(sharedNote);
      }

      case "sites.getBySlug": {
        const slug = optionalString(args.slug);
        if (!slug) {
          return NextResponse.json(null);
        }

        const site = await prisma.site.findUnique({
          where: { slug },
          select: siteSelect,
        });

        return NextResponse.json(site ? serializeSite(site as SiteRecord) : null);
      }

      case "sites.getByOwnerTab": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        const site = await prisma.site.findUnique({
          where: {
            ownerUserId_tabId: {
              ownerUserId,
              tabId,
            },
          },
          select: siteSelect,
        });

        return NextResponse.json(site ? serializeSite(site as SiteRecord) : null);
      }

      case "whiteboards.get": {
        const userId = requireString(args.userId, "userId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const whiteboard = await prisma.whiteboard.findUnique({
          where: { userId },
          select: {
            userId: true,
            elements: true,
            canvasSettings: true,
          },
        });

        return NextResponse.json(whiteboard);
      }

      case "mindmaps.get": {
        const userId = requireString(args.userId, "userId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const mindmap = await prisma.mindmap.findUnique({
          where: { userId },
          select: {
            userId: true,
            nodes: true,
            connections: true,
            settings: true,
          },
        });

        return NextResponse.json(mindmap);
      }

      case "pdfFiles.getFileUrl": {
        const userId = requireString(args.userId, "userId");
        const tabId = requireString(args.tabId, "tabId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const record = await prisma.pdfFile.findUnique({
          where: {
            userId_tabId: {
              userId,
              tabId,
            },
          },
          select: {
            size: true,
          },
        });

        if (!record || record.size <= 0) {
          return NextResponse.json(null);
        }

        const origin = new URL(req.url).origin;
        const url = `${origin}/api/db/pdf-files/download?userId=${encodeURIComponent(
          userId
        )}&tabId=${encodeURIComponent(tabId)}`;

        return NextResponse.json(url);
      }

      default:
        throw badRequest(`Unknown query key: ${key}`);
    }
  } catch (error) {
    return handleError(error);
  }
}
