import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get all tabs for a user. */
export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Upsert a single tab (create or update). */
export const upsert = mutation({
  args: {
    userId: v.string(),
    tabId: v.string(),
    title: v.string(),
    content: v.string(),
    folderId: v.union(v.string(), v.null()),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
    noteType: v.optional(v.string()),
    customIcon: v.optional(v.string()),
    iconColor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, tabId, ...data } = args;

    const existing = await ctx.db
      .query("tabs")
      .withIndex("by_user_tab", (q) =>
        q.eq("userId", userId).eq("tabId", tabId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("tabs", { userId, tabId, ...data });
    }
  },
});

/** Bulk sync: replace all tabs for a user with the given set. */
export const syncAll = mutation({
  args: {
    userId: v.string(),
    tabs: v.array(
      v.object({
        tabId: v.string(),
        title: v.string(),
        content: v.string(),
        folderId: v.union(v.string(), v.null()),
        tags: v.optional(v.array(v.string())),
        pinned: v.optional(v.boolean()),
        noteType: v.optional(v.string()),
        customIcon: v.optional(v.string()),
        iconColor: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { userId, tabs } = args;

    // Get existing tabs
    const existing = await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const incomingIds = new Set(tabs.map((t) => t.tabId));
    const existingMap = new Map(existing.map((e) => [e.tabId, e]));

    // Delete tabs that are no longer present
    for (const doc of existing) {
      if (!incomingIds.has(doc.tabId)) {
        await ctx.db.delete(doc._id);
      }
    }

    // Upsert each incoming tab
    for (const tab of tabs) {
      const doc = existingMap.get(tab.tabId);
      if (doc) {
        await ctx.db.patch(doc._id, {
          title: tab.title,
          content: tab.content,
          folderId: tab.folderId,
          tags: tab.tags,
          pinned: tab.pinned,
          noteType: tab.noteType,
          customIcon: tab.customIcon,
          iconColor: tab.iconColor,
        });
      } else {
        await ctx.db.insert("tabs", { userId, ...tab });
      }
    }
  },
});

/** Delete a single tab. */
export const remove = mutation({
  args: { userId: v.string(), tabId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("tabs")
      .withIndex("by_user_tab", (q) =>
        q.eq("userId", args.userId).eq("tabId", args.tabId)
      )
      .first();

    if (doc) {
      await ctx.db.delete(doc._id);
    }
  },
});

/** Delete all tabs for a user. */
export const removeAll = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("tabs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }
  },
});
