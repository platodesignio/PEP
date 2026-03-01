import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { featureSeriesSchema } from "@/lib/validation";
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

  const parsed = featureSeriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const created = await prisma.featureSeries.create({
    data: {
      sessionId: dbSession.id,
      runId: dbSession.runId,
      kind: parsed.data.kind,
      sampleRateHz: parsed.data.sampleRateHz,
      seriesJson: parsed.data.seriesJson,
    },
    select: { id: true, kind: true },
  });

  return NextResponse.json(created, { status: 201 });
}
