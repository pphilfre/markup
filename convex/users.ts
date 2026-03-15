import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get a user by their WorkOS ID. */
export const getByWorkosId = query({
  args: { workosId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Upsert a user from WorkOS profile data. Returns the user document ID. */
export const upsert = mutation({
  args: {
    workosId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workos_id", (q) => q.eq("workosId", args.workosId))
      .first();

    let userId: string;
    let userDocId: any;

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        profilePictureUrl: args.profilePictureUrl,
      });
      userId = existing.workosId;
      userDocId = existing._id;
    } else {
      userDocId = await ctx.db.insert("users", args);
      userId = args.workosId;
    }

    // Ensure a workspace exists for this user
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!workspace) {
      await ctx.db.insert("workspaces", {
        userId,
        activeTabId: null,
        openTabIds: [],
        folders: [],
        viewMode: "editor",
        theme: "dark",
        fileTreeOpen: true,
        settings: {
          fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
          fontSize: 14,
          lineHeight: 1.7,
          tabSize: 2,
          editorMargin: 24,
          accentColor: "#7c3aed",
          hideMdExtensions: false,
          themeMode: "dark",
        },
        profiles: [{ id: "default", name: "Personal" }],
        activeProfileId: "default",
      });
    }

    return userDocId;
  },
});
