import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/** Generate a signed upload URL for Convex file storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Upsert PDF file metadata for a tab. */
export const upsert = mutation({
  args: {
    userId: v.string(),
    tabId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    if (args.size <= 0) {
      throw new Error("Refusing to save an empty PDF file.");
    }

    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) {
      throw new Error("Uploaded PDF was not found in storage.");
    }
    if (metadata.size <= 0) {
      throw new Error("Uploaded PDF is empty (0 bytes).");
    }

    const persistedFileName = args.fileName.trim() || "Document.pdf";
    const persistedMimeType = metadata.contentType ?? args.mimeType;

    const existing = await ctx.db
      .query("pdfFiles")
      .withIndex("by_user_tab", (q) => q.eq("userId", args.userId).eq("tabId", args.tabId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        fileName: persistedFileName,
        mimeType: persistedMimeType,
        size: metadata.size,
        uploadedAt: Date.now(),
      });
      return;
    }

    await ctx.db.insert("pdfFiles", {
      userId: args.userId,
      tabId: args.tabId,
      storageId: args.storageId,
      fileName: persistedFileName,
      mimeType: persistedMimeType,
      size: metadata.size,
      uploadedAt: Date.now(),
    });
  },
});

/** Resolve a signed download URL for a tab's PDF file. */
export const getFileUrl = query({
  args: {
    userId: v.string(),
    tabId: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("pdfFiles")
      .withIndex("by_user_tab", (q) => q.eq("userId", args.userId).eq("tabId", args.tabId))
      .first();

    if (!doc) return null;

    const metadata = await ctx.storage.getMetadata(doc.storageId);
    if (!metadata || metadata.size <= 0) {
      return null;
    }

    return await ctx.storage.getUrl(doc.storageId);
  },
});
