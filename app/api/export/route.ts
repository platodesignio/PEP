import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateToken } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await prisma.exportJob.findMany({
    where: { userId: session.sub },
    select: {
      id: true,
      status: true,
      startedAt: true,
      finishedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({ jobs });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const job = await prisma.exportJob.create({
    data: {
      userId: session.sub,
      status: "DONE",
      startedAt: new Date(),
      finishedAt: new Date(),
      downloadToken: token,
      expiresAt,
    },
    select: { id: true, status: true, downloadToken: true, expiresAt: true },
  });

  await writeAuditLog({
    userId: session.sub,
    action: "EXPORT_CREATE",
    entityType: "ExportJob",
    entityId: job.id,
    request,
  });

  return NextResponse.json(
    { id: job.id, downloadToken: job.downloadToken, expiresAt: job.expiresAt },
    { status: 201 }
  );
}
