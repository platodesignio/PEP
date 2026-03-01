import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { abAssignmentSchema } from "@/lib/validation";
import { hashString } from "@/lib/crypto";

function deterministicVariant(userId: string, scope: string): "A" | "B" {
  const hash = hashString(userId + scope);
  const byte = parseInt(hash.slice(0, 2), 16);
  return byte < 128 ? "A" : "B";
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");

  const assignments = await prisma.aBAssignment.findMany({
    where: {
      userId: session.sub,
      ...(runId ? { runId } : {}),
    },
    orderBy: { assignedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ assignments });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = abAssignmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { scope, runId, sessionId } = parsed.data;

  let variant: "A" | "B";
  if (scope === "user") {
    variant = deterministicVariant(session.sub, "user");
  } else {
    variant = Math.random() < 0.5 ? "A" : "B";
  }

  const assignment = await prisma.aBAssignment.create({
    data: {
      userId: session.sub,
      runId: runId ?? null,
      sessionId: sessionId ?? null,
      variant,
    },
    select: { id: true, variant: true, assignedAt: true },
  });

  return NextResponse.json(assignment, { status: 201 });
}
