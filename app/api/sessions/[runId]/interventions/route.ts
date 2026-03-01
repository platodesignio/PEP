import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { interventionSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

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

  const parsed = interventionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  if (parsed.data.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: parsed.data.eventId, sessionId: dbSession.id },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const intervention = await prisma.intervention.create({
    data: {
      sessionId: dbSession.id,
      runId: dbSession.runId,
      kind: parsed.data.kind,
      firedAt: parsed.data.firedAt,
      eventId: parsed.data.eventId ?? null,
      metaJson: parsed.data.metaJson ?? "{}",
    },
    select: { id: true, kind: true, firedAt: true, createdAt: true },
  });

  return NextResponse.json(intervention, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const interventions = await prisma.intervention.findMany({
    where: { sessionId: dbSession.id },
    include: {
      ratings: {
        where: { userId: session.sub },
        select: { rating: true, note: true, createdAt: true },
      },
    },
    orderBy: { firedAt: "asc" },
  });

  return NextResponse.json({ interventions });
}
