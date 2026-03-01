import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50"));
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: {
        select: { sessions: true },
      },
    },
  });

  const total = await prisma.user.count();

  await writeAuditLog({ userId: session.sub, action: "ADMIN_VIEW_USERS", request });

  return NextResponse.json({ users, total });
}
