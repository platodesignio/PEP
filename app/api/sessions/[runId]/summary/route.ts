import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

async function resolveSession(runId: string, userId: string) {
  return prisma.session.findFirst({ where: { runId, userId } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [events, interventions, annotations] = await Promise.all([
    prisma.event.findMany({
      where: { sessionId: dbSession.id },
      orderBy: { t0: "asc" },
    }),
    prisma.intervention.findMany({
      where: { sessionId: dbSession.id },
      include: { ratings: { where: { userId: session.sub } } },
      orderBy: { firedAt: "asc" },
    }),
    prisma.annotation.findMany({
      where: { runId: dbSession.runId, userId: session.sub, eventId: null },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const durationSec = dbSession.endedAt
    ? (dbSession.endedAt.getTime() - dbSession.startedAt.getTime()) / 1000
    : null;

  const byType = {
    FOCUS_COLLAPSE: 0,
    CONVERSATION_TURN: 0,
    MOTION_ANOMALY: 0,
  } as Record<string, number>;
  for (const e of events) {
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  const confirmed = events.filter((e) => e.userConfirmed === true).length;
  const denied = events.filter((e) => e.userConfirmed === false).length;
  const unanswered = events.filter((e) => e.userConfirmed === null).length;
  const falseAlarmRate = events.length > 0 ? denied / events.length : 0;

  const usefulRatings = interventions.flatMap((i) =>
    i.ratings.filter((r) => r.rating === "USEFUL")
  ).length;
  const totalRatings = interventions.flatMap((i) => i.ratings).length;
  const usefulRate = totalRatings > 0 ? usefulRatings / totalRatings : null;

  const densityWindowSec = 300;
  const densityWindows: Record<number, number> = {};
  for (const e of events) {
    const window = Math.floor(e.t0 / 1000 / densityWindowSec);
    densityWindows[window] = (densityWindows[window] ?? 0) + 1;
  }
  const densityTimeline = Object.entries(densityWindows).map(([w, count]) => ({
    windowStart: parseInt(w) * densityWindowSec,
    count,
  }));

  return NextResponse.json({
    session: {
      runId: dbSession.runId,
      startedAt: dbSession.startedAt,
      endedAt: dbSession.endedAt,
      durationSec,
      eventSchemaVersion: dbSession.eventSchemaVersion,
      detectionConfigVersion: dbSession.detectionConfigVersion,
    },
    events: {
      total: events.length,
      byType,
      confirmed,
      denied,
      unanswered,
      falseAlarmRate,
    },
    interventions: {
      total: interventions.length,
      rated: totalRatings,
      usefulRate,
    },
    missedEvents: annotations.length,
    densityTimeline,
  });
}
