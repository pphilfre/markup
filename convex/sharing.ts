import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    return await ctx.db
      .query("sharedNotes")
      .withIndex("by_share_id", (q) => q.eq("shareId", shareId))
      .unique();
  },
});

/** Get all shared notes owned by a user */
export const listByOwner = query({
  args: { ownerUserId: v.string() },
  handler: async (ctx, { ownerUserId }) => {
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
    visibility: v.string(),
    permission: v.string(),
    allowedUsers: v.array(v.string()),
    noteType: v.optional(v.string()),
    whiteboardData: v.optional(v.string()),
    mindmapData: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    if (doc && doc.permission === "edit") {
      await ctx.db.patch(doc._id, { content, title });
    }
  },
});

/** Update share settings (visibility, permission, allowed users) */
export const updateSettings = mutation({
  args: {
    ownerUserId: v.string(),
    tabId: v.string(),
    visibility: v.string(),
    permission: v.string(),
    allowedUsers: v.array(v.string()),
  },
  handler: async (ctx, { ownerUserId, tabId, visibility, permission, allowedUsers }) => {
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
