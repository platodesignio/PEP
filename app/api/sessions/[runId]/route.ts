import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { endSessionSchema } from "@/lib/validation";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function resolveSession(runId: string, userId: string) {
  return prisma.session.findFirst({
    where: { runId, userId },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [eventCount, interventionCount, ratingCount, falseAlarmCount, missedCount] =
    await Promise.all([
      prisma.event.count({ where: { sessionId: dbSession.id } }),
      prisma.intervention.count({ where: { sessionId: dbSession.id } }),
      prisma.interventionRating.count({ where: { runId: dbSession.runId } }),
      prisma.event.count({ where: { sessionId: dbSession.id, userConfirmed: false } }),
      prisma.annotation.count({
        where: { runId: dbSession.runId, eventId: null, userId: session.sub },
      }),
    ]);

  return NextResponse.json({
    ...dbSession,
    stats: { eventCount, interventionCount, ratingCount, falseAlarmCount, missedCount },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (dbSession.endedAt) return NextResponse.json({ error: "Session already ended" }, { status: 409 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = endSessionSchema.safeParse(body);
  const endedAt = parsed.success && parsed.data.endedAt ? new Date(parsed.data.endedAt) : new Date();

  const updated = await prisma.session.update({
    where: { id: dbSession.id },
    data: { endedAt },
    select: { id: true, runId: true, endedAt: true },
  });

  await writeAuditLog({
    userId: session.sub,
    action: "SESSION_END",
    entityType: "Session",
    entityId: dbSession.id,
    request,
  });

  return NextResponse.json(updated);
}
