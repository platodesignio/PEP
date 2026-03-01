import { NextRequest, NextResponse } from "next/server";
import { getSession, clearSessionCookie } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  if (session) {
    await writeAuditLog({ userId: session.sub, action: "AUTH_LOGOUT", request });
  }

  return response;
}
