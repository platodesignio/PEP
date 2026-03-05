import { prisma } from "@/lib/db/prisma";
import { NextRequest } from "next/server";

export type AuditAction =
  | "AUTH_REGISTER"
  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "SESSION_CREATE"
  | "SESSION_END"
  | "SETTING_CHANGE"
  | "APIKEY_CREATE"
  | "APIKEY_DELETE"
  | "EXPORT_CREATE"
  | "EXPORT_DOWNLOAD"
  | "USER_DELETE"
  | "ADMIN_VIEW_STATS"
  | "ADMIN_VIEW_USERS"
  | "ADMIN_VIEW_FEEDBACK"
  | "MARTIAL_PLACE_CREATE"
  | "MARTIAL_PLACE_UPDATE"
  | "MARTIAL_PLACE_DELETE"
  | "MARTIAL_ROUTINE_CREATE"
  | "MARTIAL_ROUTINE_UPDATE"
  | "MARTIAL_ROUTINE_DELETE"
  | "MARTIAL_EXECUTION_CREATE"
  | "MARTIAL_EXECUTION_END"
  | "MARTIAL_COACH_QUERY";

export async function writeAuditLog(params: {
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  request?: NextRequest;
}): Promise<void> {
  const { userId, action, entityType, entityId, request } = params;

  const ip =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request?.headers.get("x-real-ip") ??
    null;

  const userAgent = request?.headers.get("user-agent")?.slice(0, 512) ?? null;

  await prisma.auditLog
    .create({
      data: {
        userId: userId ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId ?? null,
        ip,
        userAgent,
      },
    })
    .catch(() => {});
}
