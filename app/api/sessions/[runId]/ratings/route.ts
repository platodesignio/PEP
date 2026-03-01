import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { interventionRatingSchema } from "@/lib/validation";
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

  const parsed = interventionRatingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const intervention = await prisma.intervention.findFirst({
    where: { id: parsed.data.interventionId, sessionId: dbSession.id },
  });
  if (!intervention) return NextResponse.json({ error: "Intervention not found" }, { status: 404 });

  const rating = await prisma.interventionRating.upsert({
    where: {
      userId_interventionId: { userId: session.sub, interventionId: parsed.data.interventionId },
    },
    create: {
      userId: session.sub,
      runId: dbSession.runId,
      interventionId: parsed.data.interventionId,
      rating: parsed.data.rating,
      note: parsed.data.note ?? null,
    },
    update: {
      rating: parsed.data.rating,
      note: parsed.data.note ?? null,
    },
    select: { id: true, rating: true, note: true, createdAt: true },
  });

  return NextResponse.json(rating);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbSession = await resolveSession(params.runId, session.sub);
  if (!dbSession) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ratings = await prisma.interventionRating.findMany({
    where: { userId: session.sub, runId: dbSession.runId },
    orderBy: { createdAt: "asc" },
    select: { id: true, interventionId: true, rating: true, note: true, createdAt: true },
  });

  return NextResponse.json({ ratings });
}
