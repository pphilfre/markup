import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { ApiError, badRequest, assertUserIdMatch, requireAuthUser } from "@/lib/server/api";

export const runtime = "nodejs";

function handleError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[db/pdf-files/download]", error);
  return NextResponse.json({ error: "Internal server error." }, { status: 500 });
}

function safeFileName(name: string): string {
  return name.replace(/[\r\n"]/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");
    const tabId = url.searchParams.get("tabId");

    if (!userId || !tabId) {
      throw badRequest("Missing userId or tabId.");
    }

    const user = await requireAuthUser(req);
    assertUserIdMatch(userId, user);

    const record = await prisma.pdfFile.findUnique({
      where: {
        userId_tabId: {
          userId,
          tabId,
        },
      },
      select: {
        data: true,
        fileName: true,
        mimeType: true,
        size: true,
      },
    });

    if (!record || record.size <= 0) {
      return NextResponse.json({ error: "PDF not found." }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", record.mimeType || "application/pdf");
    headers.set("Content-Length", record.size.toString());
    headers.set("Content-Disposition", `inline; filename="${safeFileName(record.fileName)}"`);
    headers.set("Cache-Control", "no-store");

    return new NextResponse(new Uint8Array(record.data), {
      status: 200,
      headers,
    });
  } catch (error) {
    return handleError(error);
  }
}
