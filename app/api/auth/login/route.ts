import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation";
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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  const passwordOk = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !passwordOk) {
    await new Promise((r) => setTimeout(r, 300));
    return NextResponse.json({ error: "メールアドレスまたはパスワードが正しくありません" }, { status: 401 });
  }

  const token = await createSessionToken({ sub: user.id, role: user.role });
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, token);

  await writeAuditLog({ userId: user.id, action: "AUTH_LOGIN", request });

  return response;
}
