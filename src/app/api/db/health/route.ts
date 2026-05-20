import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_URL is not set." },
        { status: 500 }
      );
    }

    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[db/health]", error);
    return NextResponse.json(
      { ok: false, error: "Database unavailable." },
      { status: 500 }
    );
  }
}
