import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { placeSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const places = await prisma.place.findMany({
    where: { userId: session.sub, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, lat: true, lng: true, radiusM: true, createdAt: true },
  });

  return NextResponse.json({ places });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = placeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const place = await prisma.place.create({
    data: { userId: session.sub, ...parsed.data, radiusM: parsed.data.radiusM ?? 50 },
    select: { id: true, name: true, lat: true, lng: true, radiusM: true, createdAt: true },
  });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_PLACE_CREATE", entityType: "Place", entityId: place.id, request });
  return NextResponse.json(place, { status: 201 });
}
