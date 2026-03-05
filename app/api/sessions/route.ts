import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createSessionSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { EVENT_SCHEMA_VERSION, DETECTION_CONFIG_VERSION } from "@/lib/event/definitions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const url = new URL(request.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20"));
  const offset = parseInt(url.searchParams.get("offset") ?? "0");

  const sessions = await prisma.session.findMany({
    where: { userId: session.sub },
    select: {
      id: true,
      runId: true,
      startedAt: true,
      endedAt: true,
      eventSchemaVersion: true,
      detectionConfigVersion: true,
      _count: { select: { events: true, interventions: true } },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    skip: offset,
  });

  const total = await prisma.session.count({ where: { userId: session.sub } });

  return NextResponse.json({ sessions, total });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { deviceInfoJson, permissionStateJson, samplingConfigJson } = parsed.data;

  const newSession = await prisma.session.create({
    data: {
      userId: session.sub,
      eventSchemaVersion: EVENT_SCHEMA_VERSION,
      detectionConfigVersion: DETECTION_CONFIG_VERSION,
      deviceInfoJson: deviceInfoJson ?? "{}",
      permissionStateJson: permissionStateJson ?? "{}",
      samplingConfigJson: samplingConfigJson ?? "{}",
    },
    select: { id: true, runId: true, startedAt: true, eventSchemaVersion: true, detectionConfigVersion: true },
  });

  await writeAuditLog({
    userId: session.sub,
    action: "SESSION_CREATE",
    entityType: "Session",
    entityId: newSession.id,
    request,
  });

  return NextResponse.json(newSession, { status: 201 });
}
