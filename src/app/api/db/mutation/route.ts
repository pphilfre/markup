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

type MutationBody = {
  key?: unknown;
  args?: unknown;
};

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

function ensureString(value: unknown, name: string): string {
  if (typeof value !== "string") {
    throw badRequest(`Invalid ${name}.`);
  }
  return value;
}

function optionalNullableString(value: unknown, name: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") return value;
  throw badRequest(`Invalid ${name}.`);
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return value;
}

function optionalStringArray(value: unknown, name: string): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw badRequest(`Invalid ${name}.`);
  }
  const invalid = value.find((item) => typeof item !== "string");
  if (invalid !== undefined) {
    throw badRequest(`Invalid ${name}.`);
  }
  return value as string[];
}

function stripUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>;
}

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[db/mutation]", error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

function validateSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  if (!/^[a-z0-9-]{3,40}$/.test(normalized)) {
    throw badRequest("Invalid site URL. Use 3-40 characters: letters, numbers, and hyphens.");
  }
  if (normalized === "new" || normalized === "edit" || normalized === "admin") {
    throw badRequest("That site URL is reserved. Please choose a different one.");
  }
  return normalized;
}

function generateShareId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${segment()}-${segment()}`;
}

const DEFAULT_WORKSPACE_SETTINGS = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: 14,
  lineHeight: 1.7,
  tabSize: 2,
  editorMargin: 24,
  accentColor: "#7c3aed",
  hideMdExtensions: false,
  spellCheck: true,
  autoPunctuation: true,
  suggestCorrectionsOnDoubleTap: true,
  themeMode: "dark",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as MutationBody;
    const key = typeof body?.key === "string" ? body.key : null;
    if (!key) {
      throw badRequest("Missing mutation key.");
    }

    const args = requireObject(body.args ?? {}, "args");

    switch (key) {
      case "users.upsert": {
        const workosId = requireString(args.workosId, "workosId");
        const email = requireString(args.email, "email");
        const firstName = optionalNullableString(args.firstName, "firstName");
        const lastName = optionalNullableString(args.lastName, "lastName");
        const profilePictureUrl = optionalNullableString(args.profilePictureUrl, "profilePictureUrl");

        const user = await requireAuthUser(req);
        assertUserIdMatch(workosId, user);

        await prisma.user.upsert({
          where: { workosId },
          update: stripUndefined({
            email,
            firstName,
            lastName,
            profilePictureUrl,
          }),
          create: {
            workosId,
            email,
            ...stripUndefined({ firstName, lastName, profilePictureUrl }),
          },
        });

        const existingWorkspace = await prisma.workspace.findUnique({
          where: { userId: workosId },
          select: { userId: true },
        });

        if (!existingWorkspace) {
          await prisma.workspace.create({
            data: {
              userId: workosId,
              activeTabId: null,
              openTabIds: [],
              folders: [],
              viewMode: "editor",
              theme: "dark",
              fileTreeOpen: true,
              settings: DEFAULT_WORKSPACE_SETTINGS,
              profiles: [{ id: "default", name: "Personal" }],
              activeProfileId: "default",
            },
          });
        }

        return NextResponse.json(workosId);
      }

      case "workspace.save": {
        const userId = requireString(args.userId, "userId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const data = stripUndefined({
          activeTabId: args.activeTabId,
          openTabIds: args.openTabIds,
          folders: args.folders,
          viewMode: args.viewMode,
          theme: args.theme,
          fileTreeOpen: args.fileTreeOpen,
          settings: args.settings,
          profiles: args.profiles,
          activeProfileId: args.activeProfileId,
        });

        const existing = await prisma.workspace.findUnique({
          where: { userId },
          select: { userId: true },
        });

        if (existing) {
          await prisma.workspace.update({
            where: { userId },
            data,
          });
        } else {
          await prisma.workspace.create({
            data: {
              userId,
              activeTabId: data.activeTabId ?? null,
              openTabIds: data.openTabIds ?? [],
              folders: data.folders ?? [],
              viewMode: data.viewMode ?? "editor",
              theme: data.theme ?? "dark",
              fileTreeOpen: data.fileTreeOpen ?? true,
              settings: data.settings ?? {},
              profiles: data.profiles ?? [{ id: "default", name: "Personal" }],
              activeProfileId: data.activeProfileId ?? "default",
            },
          });
        }

        return NextResponse.json(null);
      }

      case "tabs.upsert": {
        const userId = requireString(args.userId, "userId");
        const tabId = requireString(args.tabId, "tabId");
        const title = ensureString(args.title, "title");
        const content = ensureString(args.content, "content");
        const folderId = args.folderId === null || typeof args.folderId === "string"
          ? args.folderId
          : undefined;

        if (folderId === undefined) {
          throw badRequest("Invalid folderId.");
        }

        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const data = stripUndefined({
          title,
          content,
          workspaceId: optionalString(args.workspaceId),
          folderId,
          tags: optionalStringArray(args.tags, "tags"),
          pinned: typeof args.pinned === "boolean" ? args.pinned : undefined,
          noteType: optionalString(args.noteType),
          customIcon: optionalString(args.customIcon),
          iconColor: optionalString(args.iconColor),
        });

        await prisma.tab.upsert({
          where: {
            userId_tabId: {
              userId,
              tabId,
            },
          },
          create: stripUndefined({
            userId,
            tabId,
            ...data,
          }),
          update: data,
        });

        return NextResponse.json(null);
      }

      case "tabs.remove": {
        const userId = requireString(args.userId, "userId");
        const tabId = requireString(args.tabId, "tabId");
        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        await prisma.tab.deleteMany({
          where: {
            userId,
            tabId,
          },
        });

        return NextResponse.json(null);
      }

      case "tabs.syncAll": {
        const userId = requireString(args.userId, "userId");
        const rawTabs = args.tabs;

        if (!Array.isArray(rawTabs)) {
          throw badRequest("Invalid tabs.");
        }

        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const tabs = rawTabs.map((tab) => {
          if (!tab || typeof tab !== "object") {
            throw badRequest("Invalid tab payload.");
          }
          const tabRecord = tab as Record<string, unknown>;
          const tabId = requireString(tabRecord.tabId, "tabId");
          const title = ensureString(tabRecord.title, "title");
          const content = ensureString(tabRecord.content, "content");
          const folderId = tabRecord.folderId === null || typeof tabRecord.folderId === "string"
            ? tabRecord.folderId
            : undefined;

          if (folderId === undefined) {
            throw badRequest("Invalid folderId.");
          }

          return {
            tabId,
            title,
            content,
            workspaceId: optionalString(tabRecord.workspaceId),
            folderId,
            tags: optionalStringArray(tabRecord.tags, "tags"),
            pinned: typeof tabRecord.pinned === "boolean" ? tabRecord.pinned : undefined,
            noteType: optionalString(tabRecord.noteType),
            customIcon: optionalString(tabRecord.customIcon),
            iconColor: optionalString(tabRecord.iconColor),
          };
        });

        await prisma.$transaction(async (tx) => {
          if (tabs.length === 0) {
            await tx.tab.deleteMany({ where: { userId } });
            return;
          }

          const incomingIds = tabs.map((tab) => tab.tabId);

          await tx.tab.deleteMany({
            where: {
              userId,
              tabId: {
                notIn: incomingIds,
              },
            },
          });

          for (const tab of tabs) {
            const data = stripUndefined({
              title: tab.title,
              content: tab.content,
              workspaceId: tab.workspaceId,
              folderId: tab.folderId,
              tags: tab.tags,
              pinned: tab.pinned,
              noteType: tab.noteType,
              customIcon: tab.customIcon,
              iconColor: tab.iconColor,
            });

            await tx.tab.upsert({
              where: {
                userId_tabId: {
                  userId,
                  tabId: tab.tabId,
                },
              },
              create: stripUndefined({
                userId,
                tabId: tab.tabId,
                ...data,
              }),
              update: data,
            });
          }
        });

        return NextResponse.json(null);
      }

      case "sharing.share": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");
        const title = ensureString(args.title, "title");
        const content = ensureString(args.content, "content");
        const visibility = requireString(args.visibility, "visibility");
        const permission = requireString(args.permission, "permission");
        const allowedUsers = optionalStringArray(args.allowedUsers, "allowedUsers") ?? [];
        const noteType = optionalString(args.noteType);
        const whiteboardData = optionalNullableString(args.whiteboardData, "whiteboardData");
        const mindmapData = optionalNullableString(args.mindmapData, "mindmapData");

        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        const normalizedAllowed = allowedUsers.map((email) => normalizeEmail(email));

        const existing = await prisma.sharedNote.findUnique({
          where: {
            ownerUserId_tabId: {
              ownerUserId,
              tabId,
            },
          },
          select: { shareId: true },
        });

        if (existing) {
          await prisma.sharedNote.update({
            where: { shareId: existing.shareId },
            data: stripUndefined({
              title,
              content,
              visibility,
              permission,
              allowedUsers: normalizedAllowed,
              noteType,
              whiteboardData,
              mindmapData,
            }),
          });
          return NextResponse.json(existing.shareId);
        }

        let shareId = "";
        let attempt = 0;
        while (!shareId && attempt < 5) {
          attempt += 1;
          const candidate = generateShareId();
          const collision = await prisma.sharedNote.findUnique({
            where: { shareId: candidate },
            select: { shareId: true },
          });
          if (!collision) {
            shareId = candidate;
          }
        }

        if (!shareId) {
          throw badRequest("Unable to generate a share link.");
        }

        await prisma.sharedNote.create({
          data: stripUndefined({
            shareId,
            ownerUserId,
            tabId,
            title,
            content,
            visibility,
            permission,
            allowedUsers: normalizedAllowed,
            noteType,
            whiteboardData,
            mindmapData,
          }),
        });

        return NextResponse.json(shareId);
      }

      case "sharing.updateContent": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");
        const title = ensureString(args.title, "title");
        const content = ensureString(args.content, "content");

        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        await prisma.sharedNote.updateMany({
          where: {
            ownerUserId,
            tabId,
          },
          data: {
            title,
            content,
          },
        });

        return NextResponse.json(null);
      }

      case "sharing.updateByShareId": {
        const shareId = requireString(args.shareId, "shareId");
        const title = ensureString(args.title, "title");
        const content = ensureString(args.content, "content");

        const sharedNote = await prisma.sharedNote.findUnique({
          where: { shareId },
          select: {
            shareId: true,
            permission: true,
            visibility: true,
            ownerUserId: true,
            allowedUsers: true,
          },
        });

        if (!sharedNote || sharedNote.permission !== "edit") {
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

        await prisma.sharedNote.update({
          where: { shareId },
          data: {
            title,
            content,
          },
        });

        return NextResponse.json(null);
      }

      case "sharing.updateSettings": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");
        const visibility = requireString(args.visibility, "visibility");
        const permission = requireString(args.permission, "permission");
        const allowedUsers = optionalStringArray(args.allowedUsers, "allowedUsers") ?? [];

        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        await prisma.sharedNote.updateMany({
          where: {
            ownerUserId,
            tabId,
          },
          data: {
            visibility,
            permission,
            allowedUsers: allowedUsers.map((email) => normalizeEmail(email)),
          },
        });

        return NextResponse.json(null);
      }

      case "sharing.unshare": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");

        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        await prisma.sharedNote.deleteMany({
          where: {
            ownerUserId,
            tabId,
          },
        });

        return NextResponse.json(null);
      }

      case "sites.publish": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");
        const slugInput = ensureString(args.slug, "slug");
        const title = ensureString(args.title, "title");
        const content = ensureString(args.content, "content");

        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        const slug = validateSlug(slugInput);
        const now = new Date();

        const existingBySlug = await prisma.site.findUnique({
          where: { slug },
        });

        if (existingBySlug && existingBySlug.ownerUserId !== ownerUserId) {
          throw badRequest("That site URL is already taken.");
        }

        const existingByTab = await prisma.site.findUnique({
          where: {
            ownerUserId_tabId: {
              ownerUserId,
              tabId,
            },
          },
        });

        if (existingBySlug) {
          await prisma.site.update({
            where: { slug },
            data: {
              tabId,
              title,
              content,
              updatedAt: now,
            },
          });

          if (existingByTab && existingByTab.slug !== slug) {
            await prisma.site.delete({
              where: { slug: existingByTab.slug },
            });
          }

          return NextResponse.json({ slug });
        }

        if (existingByTab) {
          await prisma.site.update({
            where: {
              ownerUserId_tabId: {
                ownerUserId,
                tabId,
              },
            },
            data: {
              slug,
              title,
              content,
              updatedAt: now,
            },
          });

          return NextResponse.json({ slug });
        }

        await prisma.site.create({
          data: {
            slug,
            ownerUserId,
            tabId,
            title,
            content,
            publishedAt: now,
            updatedAt: now,
          },
        });

        return NextResponse.json({ slug });
      }

      case "sites.unpublish": {
        const ownerUserId = requireString(args.ownerUserId, "ownerUserId");
        const tabId = requireString(args.tabId, "tabId");

        const user = await requireAuthUser(req);
        assertUserIdMatch(ownerUserId, user);

        await prisma.site.deleteMany({
          where: {
            ownerUserId,
            tabId,
          },
        });

        return NextResponse.json({ ok: true });
      }

      case "pdfFiles.generateUploadUrl": {
        const origin = new URL(req.url).origin;
        return NextResponse.json(`${origin}/api/db/pdf-files/upload`);
      }

      case "pdfFiles.upsert": {
        const userId = requireString(args.userId, "userId");
        const tabId = requireString(args.tabId, "tabId");
        const fileName = ensureString(args.fileName, "fileName");
        const mimeType = ensureString(args.mimeType, "mimeType");
        const size = typeof args.size === "number" ? args.size : NaN;

        if (!Number.isFinite(size) || size <= 0) {
          throw badRequest("Refusing to save an empty PDF file.");
        }

        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        const result = await prisma.pdfFile.updateMany({
          where: {
            userId,
            tabId,
          },
          data: {
            fileName: fileName.trim() || "Document.pdf",
            mimeType,
            size,
            uploadedAt: new Date(),
          },
        });

        if (result.count === 0) {
          throw badRequest("Uploaded PDF data was not found.");
        }

        return NextResponse.json(null);
      }

      case "whiteboards.save": {
        const userId = requireString(args.userId, "userId");
        const elements = ensureString(args.elements, "elements");
        const canvasSettings = ensureString(args.canvasSettings, "canvasSettings");

        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        await prisma.whiteboard.upsert({
          where: { userId },
          create: {
            userId,
            elements,
            canvasSettings,
          },
          update: {
            elements,
            canvasSettings,
          },
        });

        return NextResponse.json(null);
      }

      case "mindmaps.save": {
        const userId = requireString(args.userId, "userId");
        const nodes = ensureString(args.nodes, "nodes");
        const connections = ensureString(args.connections, "connections");
        const settings = ensureString(args.settings, "settings");

        const user = await requireAuthUser(req);
        assertUserIdMatch(userId, user);

        await prisma.mindmap.upsert({
          where: { userId },
          create: {
            userId,
            nodes,
            connections,
            settings,
          },
          update: {
            nodes,
            connections,
            settings,
          },
        });

        return NextResponse.json(null);
      }

      default:
        throw badRequest(`Unknown mutation key: ${key}`);
    }
  } catch (error) {
    return handleError(error);
  }
}
