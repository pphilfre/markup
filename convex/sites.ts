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

function pickLatestSite<T extends { updatedAt: number }>(sites: T[]): T | null {
  if (sites.length === 0) return null;
  let best = sites[0];
  for (let i = 1; i < sites.length; i++) {
    const s = sites[i];
    if (s.updatedAt > best.updatedAt) best = s;
  }
  return best;
}

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    try {
      const normalized = normalizeSlug(slug);
      if (!normalized) return null;
      const matches = await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", normalized))
        .collect();
      return pickLatestSite(matches);
    } catch {
      return null;
    }
  },
});

export const getByOwnerTab = query({
  args: { ownerUserId: v.string(), tabId: v.string() },
  handler: async (ctx, { ownerUserId, tabId }) => {
    try {
      const matches = await ctx.db
        .query("sites")
        .withIndex("by_owner_tab", (q) =>
          q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
        )
        .collect();
      return pickLatestSite(matches);
    } catch {
      return null;
    }
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
    const slugMatches = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .collect();
    const existingBySlug = pickLatestSite(slugMatches);

    if (existingBySlug && existingBySlug.ownerUserId !== args.ownerUserId) {
      throw new Error("That site URL is already taken.");
    }

    const tabMatches = await ctx.db
      .query("sites")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", args.ownerUserId).eq("tabId", args.tabId)
      )
      .collect();
    const existingByTab = pickLatestSite(tabMatches);

    if (existingBySlug) {
      await ctx.db.patch(existingBySlug._id, {
        tabId: args.tabId,
        title: args.title,
        content: args.content,
        updatedAt: now,
      });

      for (const doc of slugMatches) {
        if (doc._id !== existingBySlug._id) {
          await ctx.db.delete(doc._id);
        }
      }

      if (existingByTab && existingByTab._id !== existingBySlug._id) {
        await ctx.db.delete(existingByTab._id);
      }

      return { slug: existingBySlug.slug };
    }

    if (existingByTab) {
      if (existingByTab.slug !== slug) {
        const collisionMatches = await ctx.db
          .query("sites")
          .withIndex("by_slug", (q) => q.eq("slug", slug))
          .collect();
        const slugOwnerCollision = pickLatestSite(collisionMatches);
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

      for (const doc of tabMatches) {
        if (doc._id !== existingByTab._id) {
          await ctx.db.delete(doc._id);
        }
      }

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

export const unpublish = mutation({
  args: {
    ownerUserId: v.string(),
    tabId: v.string(),
  },
  handler: async (ctx, { ownerUserId, tabId }) => {
    const matches = await ctx.db
      .query("sites")
      .withIndex("by_owner_tab", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("tabId", tabId)
      )
      .collect();

    for (const doc of matches) {
      await ctx.db.delete(doc._id);
    }

    return { ok: true };
  },
});
