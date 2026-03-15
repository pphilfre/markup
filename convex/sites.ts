import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
    throw new Error("Invalid site URL. Use 3–40 characters: letters, numbers, and hyphens.");
  }
  if (normalized === "new" || normalized === "edit" || normalized === "admin") {
    throw new Error("That site URL is reserved. Please choose a different one.");
  }
  return normalized;
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const normalized = normalizeSlug(slug);
    if (!normalized) return null;
    return await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", normalized))
      .unique();
  },
});

export const getByOwnerTab = query({
  args: { ownerUserId: v.string(), tabId: v.string() },
  handler: async (ctx, { ownerUserId, tabId }) => {
    return await ctx.db
      .query("sites")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
      )
      .unique();
  },
});

export const publish = mutation({
  args: {
    ownerUserId: v.string(),
    tabId: v.string(),
    slug: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const slug = validateSlug(args.slug);

    const now = Date.now();
    const existingBySlug = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (existingBySlug && existingBySlug.ownerUserId !== args.ownerUserId) {
      throw new Error("That site URL is already taken.");
    }

    const existingByTab = await ctx.db
      .query("sites")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", args.ownerUserId).eq("tabId", args.tabId)
      )
      .unique();

    if (existingBySlug) {
      await ctx.db.patch(existingBySlug._id, {
        tabId: args.tabId,
        title: args.title,
        content: args.content,
        updatedAt: now,
      });

      if (existingByTab && existingByTab._id !== existingBySlug._id) {
        await ctx.db.delete(existingByTab._id);
      }

      return { slug: existingBySlug.slug };
    }

    if (existingByTab) {
      if (existingByTab.slug !== slug) {
        const slugOwnerCollision = await ctx.db
          .query("sites")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .unique();
        if (slugOwnerCollision && slugOwnerCollision.ownerUserId !== args.ownerUserId) {
          throw new Error("That site URL is already taken.");
        }
      }

      await ctx.db.patch(existingByTab._id, {
        slug,
        title: args.title,
        content: args.content,
        updatedAt: now,
      });
      return { slug };
    }

    await ctx.db.insert("sites", {
      slug,
      ownerUserId: args.ownerUserId,
      tabId: args.tabId,
      title: args.title,
      content: args.content,
      publishedAt: now,
      updatedAt: now,
    });

    return { slug };
  },
});
