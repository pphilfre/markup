import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { ApiError, badRequest, assertUserIdMatch, requireAuthUser } from "@/lib/server/api";

export const runtime = "nodejs";

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[db/pdf-files/upload]", error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

function normalizePdfTitle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    let userId = url.searchParams.get("userId") ?? undefined;
    let tabId = url.searchParams.get("tabId") ?? undefined;
    let fileName = url.searchParams.get("fileName") ?? undefined;
    let mimeType = req.headers.get("content-type") ?? "application/pdf";

    let buffer: Buffer | null = null;

    if (mimeType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (form.get("userId")) userId = String(form.get("userId"));
      if (form.get("tabId")) tabId = String(form.get("tabId"));
      if (form.get("fileName")) fileName = String(form.get("fileName"));

      if (!(file instanceof Blob)) {
        throw badRequest("Missing PDF file.");
      }

      buffer = Buffer.from(await file.arrayBuffer());
      if (!fileName && "name" in file) {
        fileName = typeof file.name === "string" ? file.name : undefined;
      }
      if (file.type) {
        mimeType = file.type;
      }
    } else {
      buffer = Buffer.from(await req.arrayBuffer());
      if (!fileName) {
        fileName = req.headers.get("x-file-name") ?? undefined;
      }
    }

    if (!userId || !tabId) {
      throw badRequest("Missing userId or tabId.");
    }

    if (!buffer || buffer.byteLength <= 0) {
      throw badRequest("Cannot upload an empty PDF file.");
    }

    const user = await requireAuthUser(req);
    assertUserIdMatch(userId, user);

    const persistedFileName = normalizePdfTitle(fileName ?? "Document.pdf");
    const persistedMimeType = mimeType || "application/pdf";
    const now = new Date();

    const record = await prisma.pdfFile.upsert({
      where: {
        userId_tabId: {
          userId,
          tabId,
        },
      },
      create: {
        userId,
        tabId,
        fileName: persistedFileName,
        mimeType: persistedMimeType,
        size: buffer.byteLength,
        uploadedAt: now,
        data: buffer,
      },
      update: {
        fileName: persistedFileName,
        mimeType: persistedMimeType,
        size: buffer.byteLength,
        uploadedAt: now,
        data: buffer,
      },
    });

    return NextResponse.json({ storageId: record.id });
  } catch (error) {
    return handleError(error);
  }
}
