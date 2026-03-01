import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { feedbackSchema } from "@/lib/validation";
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

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: {
      userId: session?.sub ?? null,
      sessionId: parsed.data.sessionId ?? null,
      runId: parsed.data.runId,
      message: parsed.data.message,
      metaJson: parsed.data.metaJson ?? "{}",
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json(feedback, { status: 201 });
}
