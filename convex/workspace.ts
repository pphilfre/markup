import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const folderValidator = v.object({
  id: v.string(),
  name: v.string(),
  color: v.string(),
  parentId: v.union(v.string(), v.null()),
  sortOrder: v.number(),
});

const customThemeColorsValidator = v.object({
  background: v.optional(v.string()),
  foreground: v.optional(v.string()),
  sidebar: v.optional(v.string()),
  sidebarForeground: v.optional(v.string()),
  popover: v.optional(v.string()),
  popoverForeground: v.optional(v.string()),
  border: v.optional(v.string()),
  muted: v.optional(v.string()),
  mutedForeground: v.optional(v.string()),
  accent: v.optional(v.string()),
  accentForeground: v.optional(v.string()),
  primary: v.optional(v.string()),
  primaryForeground: v.optional(v.string()),
});

const settingsValidator = v.object({
  fontFamily: v.optional(v.string()),
  fontSize: v.optional(v.number()),
  lineHeight: v.optional(v.number()),
  tabSize: v.optional(v.number()),
  editorMargin: v.optional(v.number()),
  accentColor: v.optional(v.string()),
  hideMdExtensions: v.optional(v.boolean()),
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
  customThemeColors: v.optional(customThemeColorsValidator),
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
  // Custom fonts
  customFontFamily: v.optional(v.union(v.string(), v.null())),
  // Panel sizes
  fileTreeWidth: v.optional(v.number()),
  splitRatio: v.optional(v.number()),
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
    activeTabId: v.optional(v.union(v.string(), v.null())),
    openTabIds: v.optional(v.array(v.string())),
    folders: v.optional(v.array(folderValidator)),
    viewMode: v.optional(v.string()),
    theme: v.optional(v.string()),
    fileTreeOpen: v.optional(v.boolean()),
    settings: v.optional(settingsValidator),
    profiles: v.optional(v.array(profileValidator)),
    activeProfileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...data } = args;

    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Filter out undefined values from data to avoid overwriting with null/undefined
      const patchData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      await ctx.db.patch(existing._id, patchData);
    } else {
      // For insert, we need to provide defaults for required fields in schema
      const insertData = {
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
      };
      await ctx.db.insert("workspaces", insertData);
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
