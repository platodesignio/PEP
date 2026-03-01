import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { annotationSchema } from "@/lib/validation";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = annotationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  if (parsed.data.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: parsed.data.eventId, sessionId: dbSession.id },
    });
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const annotation = await prisma.annotation.create({
    data: {
      userId: session.sub,
      runId: dbSession.runId,
      eventId: parsed.data.eventId ?? null,
      text: parsed.data.text ?? null,
      tagsJson: parsed.data.tagsJson ?? "[]",
    },
    select: { id: true, eventId: true, text: true, tagsJson: true, createdAt: true },
  });

  return NextResponse.json(annotation, { status: 201 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const annotations = await prisma.annotation.findMany({
    where: { runId: dbSession.runId, userId: session.sub },
    orderBy: { createdAt: "asc" },
    select: { id: true, eventId: true, text: true, tagsJson: true, createdAt: true },
  });

  return NextResponse.json({ annotations });
}
