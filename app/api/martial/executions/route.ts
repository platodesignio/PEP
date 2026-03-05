import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createExecutionSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const url = new URL(request.url);
  const limit  = Math.min(50, parseInt(url.searchParams.get("limit")  ?? "20"));
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const executions = await prisma.execution.findMany({
    where: { userId: session.sub },
    orderBy: { startedAt: "desc" },
    take: limit,
    skip: offset,
    select: {
      id: true, startedAt: true, endedAt: true, tciScore: true, inRange: true,
      place:   { select: { id: true, name: true } },
      routine: { select: { id: true, name: true } },
    },
  });

  const total = await prisma.execution.count({ where: { userId: session.sub } });
  return NextResponse.json({ executions, total });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createExecutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const execution = await prisma.execution.create({
    data: {
      userId:    session.sub,
      placeId:   parsed.data.placeId   ?? null,
      routineId: parsed.data.routineId ?? null,
      inRange:   parsed.data.inRange   ?? true,
    },
    select: { id: true, startedAt: true, placeId: true, routineId: true, inRange: true },
  });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_EXECUTION_CREATE", entityType: "Execution", entityId: execution.id, request });
  return NextResponse.json(execution, { status: 201 });
}
