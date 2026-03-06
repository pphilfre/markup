import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const folderValidator = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  parentId: v.union(v.string(), v.null()),
  sortOrder: v.number(),
});

const settingsValidator = v.object({
  fontFamily: v.string(),
  fontSize: v.number(),
  lineHeight: v.number(),
  tabSize: v.number(),
  editorMargin: v.number(),
  accentColor: v.string(),
  hideMdExtensions: v.boolean(),
  // Typography
  letterSpacing: v.optional(v.number()),
  maxLineWidth: v.optional(v.number()),
  showInvisibleCharacters: v.optional(v.boolean()),
  // Markdown
  autoCloseBrackets: v.optional(v.boolean()),
  autoCloseMarkdownFormatting: v.optional(v.boolean()),
  autoFormatLists: v.optional(v.boolean()),
  continueListOnEnter: v.optional(v.boolean()),
  smartQuotes: v.optional(v.boolean()),
  smartDashes: v.optional(v.boolean()),
  convertTabsToSpaces: v.optional(v.boolean()),
  // Editing
  wordWrap: v.optional(v.boolean()),
  highlightCurrentLine: v.optional(v.boolean()),
  highlightMatchingBrackets: v.optional(v.boolean()),
  cursorAnimation: v.optional(v.string()),
  multiCursorSupport: v.optional(v.boolean()),
  // Appearance - Theme
  themeMode: v.optional(v.string()),
  // Appearance - UI
  sidebarPosition: v.optional(v.string()),
  sidebarWidth: v.optional(v.number()),
  compactMode: v.optional(v.boolean()),
  showIconsInSidebar: v.optional(v.boolean()),
  showFileExtensions: v.optional(v.boolean()),
  iconTheme: v.optional(v.string()),
  // Appearance - Editor Look
  codeBlockTheme: v.optional(v.string()),
  headingStyle: v.optional(v.string()),
  linkStyle: v.optional(v.string()),
  checkboxStyle: v.optional(v.string()),
});

const profileValidator = v.object({
  id: v.string(),
  name: v.string(),
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get the user's workspace (UI state + settings) by userId. */
export const get = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Upsert workspace UI state + settings for a user. */
export const save = mutation({
  args: {
    userId: v.string(),
    activeTabId: v.union(v.string(), v.null()),
    folders: v.array(folderValidator),
    viewMode: v.string(),
    theme: v.string(),
    fileTreeOpen: v.boolean(),
    settings: settingsValidator,
    profiles: v.array(profileValidator),
    activeProfileId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, ...data } = args;

    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("workspaces", { userId, ...data });
    }
  },
});

/** Delete the workspace for a user. */
export const remove = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
