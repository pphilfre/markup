import { mutation, query } from "./_generated/server";
import { requireUser } from "./auth";
import { v } from "convex/values";
import type { Auth } from "convex/server";

async function canAccessShare(
  auth: Auth,
  note: { visibility: string; ownerUserId: string; allowedUsers: string[] },
) {
  if (note.visibility === "public") return true;
  if (note.visibility !== "private") return false;

  const identity = await auth.getUserIdentity();
  if (identity?.subject === note.ownerUserId) return true;

  if (identity?.markup_email_verified !== true || typeof identity.markup_email !== "string") {
    return false;
  }
  const email = identity.markup_email.trim().toLowerCase();
  return Boolean(email) && note.allowedUsers.some((allowed) => allowed.trim().toLowerCase() === email);
}

// ── Helpers ─────────────────────────────────────────────────────────────

/** Generate a random XXXX-XXXX share ID */
function generateShareId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${segment()}-${segment()}`;
}

// ── Queries ─────────────────────────────────────────────────────────────

/** Get a shared note by its public share ID (for viewing) */
export const getByShareId = query({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }) => {
    const note = await ctx.db
      .query("sharedNotes")
      .withIndex("by_share_id", (q) => q.eq("shareId", shareId))
      .unique();
    if (!note || !(await canAccessShare(ctx.auth, note))) return null;

    // Owner-only sharing settings are available through the owner queries.
    return { ...note, allowedUsers: [] };
  },
});

/** Get all shared notes owned by a user */
export const listByOwner = query({
  args: { ownerUserId: v.string() },
  handler: async (ctx, { ownerUserId }) => {
    await requireUser(ctx, ownerUserId);
    return await ctx.db
      .query("sharedNotes")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", ownerUserId))
      .collect();
  },
});

/** Get the share record for a specific tab (if any) */
export const getByOwnerTab = query({
  args: { ownerUserId: v.string(), tabId: v.string() },
  handler: async (ctx, { ownerUserId, tabId }) => {
    await requireUser(ctx, ownerUserId);
    return await ctx.db
      .query("sharedNotes")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
      )
      .unique();
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

/** Share a note: creates a share record and returns the share ID */
export const share = mutation({
  args: {
    ownerUserId: v.string(),
    tabId: v.string(),
    title: v.string(),
    content: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    permission: v.union(v.literal("read"), v.literal("edit")),
    allowedUsers: v.array(v.string()),
    noteType: v.optional(v.string()),
    whiteboardData: v.optional(v.string()),
    mindmapData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx, args.ownerUserId);
    // Check if already shared
    const existing = await ctx.db
      .query("sharedNotes")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", args.ownerUserId).eq("tabId", args.tabId)
      )
      .unique();

    if (existing) {
      // Update existing share
      await ctx.db.patch(existing._id, {
        title: args.title,
        content: args.content,
        visibility: args.visibility,
        permission: args.permission,
        allowedUsers: args.allowedUsers,
        noteType: args.noteType,
        whiteboardData: args.whiteboardData,
        mindmapData: args.mindmapData,
      });
      return existing.shareId;
    }

    // Create new share
    const shareId = generateShareId();
    await ctx.db.insert("sharedNotes", {
      shareId,
      ownerUserId: args.ownerUserId,
      tabId: args.tabId,
      title: args.title,
      content: args.content,
      visibility: args.visibility,
      permission: args.permission,
      allowedUsers: args.allowedUsers,
      noteType: args.noteType,
      whiteboardData: args.whiteboardData,
      mindmapData: args.mindmapData,
    });
    return shareId;
  },
});

/** Update the content of a shared note (for real-time sync from owner) */
export const updateContent = mutation({
  args: {
    ownerUserId: v.string(),
    tabId: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, { ownerUserId, tabId, title, content }) => {
    await requireUser(ctx, ownerUserId);
    const doc = await ctx.db
      .query("sharedNotes")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
      )
      .unique();

    if (doc) {
      await ctx.db.patch(doc._id, { title, content });
    }
  },
});

/** Update shared note content by share ID (for collaborators with edit access) */
export const updateByShareId = mutation({
  args: {
    shareId: v.string(),
    content: v.string(),
    title: v.string(),
  },
  handler: async (ctx, { shareId, content, title }) => {
    const doc = await ctx.db
      .query("sharedNotes")
      .withIndex("by_share_id", (q) => q.eq("shareId", shareId))
      .unique();

    if (doc && doc.permission === "edit" && await canAccessShare(ctx.auth, doc)) {
      await ctx.db.patch(doc._id, { content, title });
    }
  },
});

/** Update share settings (visibility, permission, allowed users) */
export const updateSettings = mutation({
  args: {
    ownerUserId: v.string(),
    tabId: v.string(),
    visibility: v.union(v.literal("private"), v.literal("public")),
    permission: v.union(v.literal("read"), v.literal("edit")),
    allowedUsers: v.array(v.string()),
  },
  handler: async (ctx, { ownerUserId, tabId, visibility, permission, allowedUsers }) => {
    await requireUser(ctx, ownerUserId);
    const doc = await ctx.db
      .query("sharedNotes")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
      )
      .unique();

    if (doc) {
      await ctx.db.patch(doc._id, { visibility, permission, allowedUsers });
    }
  },
});

/** Unshare a note */
export const unshare = mutation({
  args: { ownerUserId: v.string(), tabId: v.string() },
  handler: async (ctx, { ownerUserId, tabId }) => {
    await requireUser(ctx, ownerUserId);
    const doc = await ctx.db
      .query("sharedNotes")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
      )
      .unique();

    if (doc) {
      await ctx.db.delete(doc._id);
    }
  },
});
