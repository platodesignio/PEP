import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rl = await checkRateLimit(request);
  if (!rl.allowed) {
    return NextResponse.json({ error: "レート制限に達しました" }, { status: 429, headers: rl.headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエスト形式です" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "入力値が不正です" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const strengthCheck = validatePasswordStrength(password);
  if (!strengthCheck.valid) {
    return NextResponse.json({ error: strengthCheck.reason }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "このメールアドレスは既に使用されています" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash },
    select: { id: true, role: true },
  });

  const token = await createSessionToken({ sub: user.id, role: user.role });
  const response = NextResponse.json({ ok: true }, { status: 201 });
  setSessionCookie(response, token);

  await writeAuditLog({ userId: user.id, action: "AUTH_REGISTER", request });

  return response;
}
