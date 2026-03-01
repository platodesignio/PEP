import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const feedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      runId: true,
      message: true,
      metaJson: true,
      createdAt: true,
    },
  });

  const total = await prisma.feedback.count();

  await writeAuditLog({ userId: session.sub, action: "ADMIN_VIEW_FEEDBACK", request });

  return NextResponse.json({ feedbacks, total });
}
