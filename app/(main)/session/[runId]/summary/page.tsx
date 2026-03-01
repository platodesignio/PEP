import { getSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import SessionReport from "@/app/components/SessionReport";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface Props {
  params: { runId: string };
}

export default async function SummaryPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const dbSession = await prisma.session.findFirst({
    where: { runId: params.runId, userId: session.sub },
  });
  if (!dbSession) notFound();

  const events = await prisma.event.findMany({
    where: { sessionId: dbSession.id },
    orderBy: { t0: "asc" },
  });

  const interventions = await prisma.intervention.findMany({
    where: { sessionId: dbSession.id },
    include: { ratings: { where: { userId: session.sub } } },
    orderBy: { firedAt: "asc" },
  });

  const annotations = await prisma.annotation.findMany({
    where: { runId: dbSession.runId, userId: session.sub, eventId: null },
    orderBy: { createdAt: "asc" },
  });

  const durationSec = dbSession.endedAt
    ? (dbSession.endedAt.getTime() - dbSession.startedAt.getTime()) / 1000
    : null;

  const byType = { FOCUS_COLLAPSE: 0, CONVERSATION_TURN: 0, MOTION_ANOMALY: 0 } as Record<string, number>;
  for (const e of events) byType[e.type] = (byType[e.type] ?? 0) + 1;

  const confirmed = events.filter((e) => e.userConfirmed === true).length;
  const denied = events.filter((e) => e.userConfirmed === false).length;
  const unanswered = events.filter((e) => e.userConfirmed === null).length;
  const falseAlarmRate = events.length > 0 ? denied / events.length : 0;

  const allRatings = interventions.flatMap((i) => i.ratings);
  const usefulRatings = allRatings.filter((r) => r.rating === "USEFUL").length;
  const usefulRate = allRatings.length > 0 ? usefulRatings / allRatings.length : null;

  const densityWindowSec = 300;
  const densityMap: Record<number, number> = {};
  for (const e of events) {
    const w = Math.floor(e.t0 / 1000 / densityWindowSec);
    densityMap[w] = (densityMap[w] ?? 0) + 1;
  }
  const densityTimeline = Object.entries(densityMap).map(([w, count]) => ({
    windowStart: parseInt(w) * densityWindowSec,
    count,
  }));

  const data = {
    session: {
      runId: dbSession.runId,
      startedAt: dbSession.startedAt.toISOString(),
      endedAt: dbSession.endedAt?.toISOString() ?? null,
      durationSec,
      eventSchemaVersion: dbSession.eventSchemaVersion,
      detectionConfigVersion: dbSession.detectionConfigVersion,
    },
    events: { total: events.length, byType, confirmed, denied, unanswered, falseAlarmRate },
    interventions: { total: interventions.length, rated: allRatings.length, usefulRate },
    missedEvents: annotations.length,
    densityTimeline,
  };

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 700 }}>セッションレポート</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <Link href="/dashboard">
            <button>ダッシュボードに戻る</button>
          </Link>
          {!dbSession.endedAt && (
            <Link href={`/session/${params.runId}/live`}>
              <button data-variant="primary">再開</button>
            </Link>
          )}
        </div>
      </div>
      <SessionReport data={data} />
    </div>
  );
}
