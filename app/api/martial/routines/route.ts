import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { routineSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const routines = await prisma.routine.findMany({
    where: { userId: session.sub, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, descJson: true, targetSec: true, phasesJson: true, createdAt: true },
  });

  return NextResponse.json({ routines });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = routineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const routine = await prisma.routine.create({
    data: {
      userId:     session.sub,
      name:       parsed.data.name,
      descJson:   parsed.data.descJson   ?? "{}",
      targetSec:  parsed.data.targetSec  ?? 300,
      phasesJson: parsed.data.phasesJson ?? "[]",
    },
    select: { id: true, name: true, descJson: true, targetSec: true, phasesJson: true, createdAt: true },
  });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_ROUTINE_CREATE", entityType: "Routine", entityId: routine.id, request });
  return NextResponse.json(routine, { status: 201 });
}
