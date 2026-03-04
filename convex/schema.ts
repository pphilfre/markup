import { defineSchema, defineTable } from "convex/server";
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
});

const profileValidator = v.object({
  id: v.string(),
  name: v.string(),
});

export default defineSchema({
  // ── Users ─────────────────────────────────────────────────────────────
  users: defineTable({
    workosId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
  }).index("by_workos_id", ["workosId"]),

  // ── Tabs (one row per file, linked to a user) ────────────────────────
  tabs: defineTable({
    userId: v.string(),       // workosId
    tabId: v.string(),        // client-generated UUID
    title: v.string(),
    content: v.string(),
    folderId: v.union(v.string(), v.null()),
  })
    .index("by_user", ["userId"])
    .index("by_user_tab", ["userId", "tabId"]),

  // ── Workspaces (UI state + settings per user, no tabs) ───────────────
  workspaces: defineTable({
    userId: v.string(),
    activeTabId: v.union(v.string(), v.null()),
    folders: v.array(folderValidator),
    viewMode: v.string(),
    theme: v.string(),
    fileTreeOpen: v.boolean(),
    settings: settingsValidator,
    profiles: v.array(profileValidator),
    activeProfileId: v.string(),
  }).index("by_user", ["userId"]),
});
