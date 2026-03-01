import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";

const confirmSchema = z.object({
  password: z.string().min(1),
  confirm: z.literal("DELETE_MY_ACCOUNT"),
});

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "パスワードと確認文字列 DELETE_MY_ACCOUNT が必要です" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) return NextResponse.json({ error: "パスワードが正しくありません" }, { status: 403 });

  await writeAuditLog({
    userId: session.sub,
    action: "USER_DELETE",
    entityType: "User",
    entityId: session.sub,
    request,
  });

  await prisma.user.delete({ where: { id: session.sub } });

  const response = NextResponse.json({ ok: true, message: "アカウントとすべてのデータを削除しました" });
  clearSessionCookie(response);
  return response;
}
