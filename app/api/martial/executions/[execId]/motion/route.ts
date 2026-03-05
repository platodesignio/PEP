import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { motionSampleBatchSchema } from "@/lib/validation";
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
  if (exec.endedAt) {
    return NextResponse.json({ error: "Execution already ended" }, { status: 409 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = motionSampleBatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  await prisma.motionSample.createMany({
    data: parsed.data.samples.map((s) => ({
      executionId: params.execId,
      ...s,
    })),
  });

  return NextResponse.json({ saved: parsed.data.samples.length });
}
