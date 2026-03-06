import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mindmaps")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const save = mutation({
  args: {
    userId: v.string(),
    nodes: v.string(),
    connections: v.string(),
    settings: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, ...data } = args;

    const existing = await ctx.db
      .query("mindmaps")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("mindmaps", { userId, ...data });
    }
  },
});
