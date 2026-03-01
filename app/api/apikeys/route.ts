import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { apiKeySchema } from "@/lib/validation";
import { encrypt, decrypt } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.sub },
    select: { id: true, provider: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json({ keys });
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

  const parsed = apiKeySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const encryptedKey = encrypt(parsed.data.key);

  const key = await prisma.apiKey.upsert({
    where: { userId_provider: { userId: session.sub, provider: parsed.data.provider } },
    create: { userId: session.sub, provider: parsed.data.provider, encryptedKey },
    update: { encryptedKey },
    select: { id: true, provider: true, createdAt: true },
  });

  await writeAuditLog({
    userId: session.sub,
    action: "APIKEY_CREATE",
    entityType: "ApiKey",
    entityId: key.id,
    request,
  });

  return NextResponse.json(key, { status: 201 });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

  const key = await prisma.apiKey.findUnique({
    where: { userId_provider: { userId: session.sub, provider } },
  });
  if (!key) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.apiKey.delete({
    where: { userId_provider: { userId: session.sub, provider } },
  });

  await writeAuditLog({
    userId: session.sub,
    action: "APIKEY_DELETE",
    entityType: "ApiKey",
    entityId: key.id,
    request,
  });

  return NextResponse.json({ ok: true });
}

export async function getDecryptedApiKey(userId: string, provider: string): Promise<string | null> {
  const key = await prisma.apiKey.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!key) return null;
  try {
    return decrypt(key.encryptedKey);
  } catch {
    return null;
  }
}
