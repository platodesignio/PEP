import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { endExecutionSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { execId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const exec = await prisma.execution.findUnique({
    where: { id: params.execId },
    include: {
      place:   { select: { id: true, name: true } },
      routine: { select: { id: true, name: true, targetSec: true } },
      _count: {
        select: { motionSamples: true, hrvSamples: true, respSamples: true },
      },
    },
  });

  if (!exec || exec.userId !== session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(exec);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { execId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const exec = await prisma.execution.findUnique({ where: { id: params.execId } });
  if (!exec || exec.userId !== session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = endExecutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const updated = await prisma.execution.update({
    where: { id: params.execId },
    data: {
      endedAt:       new Date(),
      tciScore:      parsed.data.tciScore,
      metricsJson:   parsed.data.metricsJson   ?? "{}",
      coachNoteJson: parsed.data.coachNoteJson ?? "{}",
    },
    select: { id: true, endedAt: true, tciScore: true, metricsJson: true },
  });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_EXECUTION_END", entityType: "Execution", entityId: params.execId, request });
  return NextResponse.json(updated);
}
