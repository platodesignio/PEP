import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { routineSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { routineId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const routine = await prisma.routine.findUnique({ where: { id: params.routineId } });
  if (!routine || routine.userId !== session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = routineSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const updated = await prisma.routine.update({
    where: { id: params.routineId },
    data: parsed.data,
    select: { id: true, name: true, descJson: true, targetSec: true, phasesJson: true, updatedAt: true },
  });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_ROUTINE_UPDATE", entityType: "Routine", entityId: updated.id, request });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { routineId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const routine = await prisma.routine.findUnique({ where: { id: params.routineId } });
  if (!routine || routine.userId !== session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.routine.update({ where: { id: params.routineId }, data: { active: false } });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_ROUTINE_DELETE", entityType: "Routine", entityId: params.routineId, request });
  return NextResponse.json({ ok: true });
}
