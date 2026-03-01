import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [userCount, sessionCount, eventCount, errorCount, feedbackCount, storageRows] =
    await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.event.count(),
      prisma.errorReport.count(),
      prisma.feedback.count(),
      prisma.featureSeries.count(),
    ]);

  const rateLimitFired = await prisma.rateLimitLog.aggregate({
    _sum: { count: true },
    where: { updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const recentErrors = await prisma.errorReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, runId: true, message: true, createdAt: true },
  });

  await writeAuditLog({
    userId: session.sub,
    action: "ADMIN_VIEW_STATS",
    request,
  });

  return NextResponse.json({
    userCount,
    sessionCount,
    eventCount,
    errorCount,
    feedbackCount,
    featureSeriesCount: storageRows,
    rateLimitHits24h: rateLimitFired._sum.count ?? 0,
    recentErrors,
  });
}
