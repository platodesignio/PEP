/**
 * Apple Watch HRV Bridge — receives HRV data from companion iOS app or
 * any POST request (e.g., a Shortcut on iPhone).
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { hrvSampleSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
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

  const parsed = hrvSampleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const sample = await prisma.hRVSample.create({
    data: { executionId: params.execId, ...parsed.data },
    select: { id: true, t: true, rrMs: true, sdnn: true, rmssd: true, lfhf: true },
  });

  return NextResponse.json(sample, { status: 201 });
}

export async function GET(
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

  const samples = await prisma.hRVSample.findMany({
    where: { executionId: params.execId },
    orderBy: { t: "asc" },
    select: { id: true, t: true, rrMs: true, sdnn: true, rmssd: true, lfhf: true },
  });

  return NextResponse.json({ samples });
}
