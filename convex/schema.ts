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
  // Custom fonts
  customFontFamily: v.optional(v.union(v.string(), v.null())),
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
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
    noteType: v.optional(v.string()),    // "note" | "whiteboard" | "mindmap"
    customIcon: v.optional(v.string()),  // lucide icon name
    iconColor: v.optional(v.string()),   // hex color
  })
    .index("by_user", ["userId"])
    .index("by_user_tab", ["userId", "tabId"]),

  // ── Workspaces (UI state + settings per user, no tabs) ───────────────
  workspaces: defineTable({
    userId: v.string(),
    activeTabId: v.union(v.string(), v.null()),
    openTabIds: v.optional(v.array(v.string())),
    folders: v.array(folderValidator),
    viewMode: v.string(),
    theme: v.string(),
    fileTreeOpen: v.boolean(),
    settings: settingsValidator,
    profiles: v.array(profileValidator),
    activeProfileId: v.string(),
  }).index("by_user", ["userId"]),

  // ── Whiteboards (one per user, stores canvas state) ────────────────
  whiteboards: defineTable({
    userId: v.string(),
    elements: v.string(),        // JSON-serialized WhiteboardElement[]
    canvasSettings: v.string(),  // JSON-serialized CanvasSettings
  }).index("by_user", ["userId"]),

  // ── Mindmaps (one per user, stores nodes + connections) ──────────
  mindmaps: defineTable({
    userId: v.string(),
    nodes: v.string(),           // JSON-serialized MindmapNode[]
    connections: v.string(),     // JSON-serialized MindmapConnection[]
    settings: v.string(),        // JSON-serialized MindmapSettings
  }).index("by_user", ["userId"]),

  // ── Shared Notes ─────────────────────────────────────────────────────
  sharedNotes: defineTable({
    shareId: v.string(),        // XXXX-XXXX format, used in URL
    ownerUserId: v.string(),    // workosId of the owner
    tabId: v.string(),          // client-generated tab UUID
    title: v.string(),
    content: v.string(),
    visibility: v.string(),     // "public" | "private"
    permission: v.string(),     // "read" | "edit"
    allowedUsers: v.array(v.string()), // emails allowed for private notes
    noteType: v.optional(v.string()),         // "markdown" | "whiteboard" | "mindmap"
    whiteboardData: v.optional(v.string()),   // JSON-serialized whiteboard elements + settings
    mindmapData: v.optional(v.string()),      // JSON-serialized mindmap nodes + connections + settings
  })
    .index("by_share_id", ["shareId"])
    .index("by_owner", ["ownerUserId"])
    .index("by_owner_tab", ["ownerUserId", "tabId"]),
});
