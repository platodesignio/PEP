import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { batchEventsSchema, eventConfirmSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function resolveSession(runId: string, userId: string) {
  return prisma.session.findFirst({ where: { runId, userId } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (dbSession.endedAt) return NextResponse.json({ error: "Session ended" }, { status: 409 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = batchEventsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { events } = parsed.data;
  const created = await prisma.event.createMany({
    data: events.map((e) => ({
      sessionId: dbSession.id,
      runId: dbSession.runId,
      t0: e.t0,
      t1: e.t1,
      type: e.type,
      confidence: e.confidence,
      baselineDeviation: e.baselineDeviation,
      featuresSummaryJson: e.featuresSummaryJson ?? "{}",
      baselineSummaryJson: e.baselineSummaryJson ?? "{}",
    })),
  });

  return NextResponse.json({ created: created.count }, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const limit = Math.min(200, parseInt(url.searchParams.get("limit") ?? "100"));
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const events = await prisma.event.findMany({
    where: { sessionId: dbSession.id },
    orderBy: { t0: "asc" },
    take: limit,
    skip: offset,
  });

  const total = await prisma.event.count({ where: { sessionId: dbSession.id } });
  return NextResponse.json({ events, total });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const eventId = url.searchParams.get("eventId");
  if (!eventId) return NextResponse.json({ error: "eventId required" }, { status: 400 });

  const event = await prisma.event.findFirst({
    where: { id: eventId, sessionId: dbSession.id },
  });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = eventConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: {
      userConfirmed: parsed.data.userConfirmed,
      userAnnotation: parsed.data.userAnnotation,
    },
    select: { id: true, userConfirmed: true, userAnnotation: true },
  });

  return NextResponse.json(updated);
}
