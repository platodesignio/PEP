import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorReportSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();

  const rl = await checkRateLimit(request, session?.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = errorReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const report = await prisma.errorReport.create({
    data: {
      userId: session?.sub ?? null,
      runId: parsed.data.runId,
      message: parsed.data.message,
      stackHash: parsed.data.stackHash ?? null,
      metaJson: parsed.data.metaJson ?? "{}",
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json(report, { status: 201 });
}
