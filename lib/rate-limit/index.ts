import { prisma } from "@/lib/db/prisma";
import { NextRequest } from "next/server";

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW ?? "60000");
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX ?? "100");

async function checkKey(key: string): Promise<{ count: number; windowEnd: Date }> {
  const now = new Date();
  const windowEnd = new Date(Math.ceil(now.getTime() / WINDOW_MS) * WINDOW_MS);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await (tx as typeof prisma).rateLimitLog.findUnique({
        where: { key_windowEnd: { key, windowEnd } },
      });

      if (!existing) {
        const created = await (tx as typeof prisma).rateLimitLog.create({
          data: { key, windowEnd, count: 1 },
        });
        return { count: created.count, windowEnd };
      }

      const updated = await (tx as typeof prisma).rateLimitLog.update({
        where: { id: existing.id },
        data: { count: { increment: 1 } },
      });
      return { count: updated.count, windowEnd };
    });

    if (Math.random() < 0.005) {
      prisma.rateLimitLog
        .deleteMany({ where: { windowEnd: { lt: now } } })
        .catch(() => {});
    }

    return result as { count: number; windowEnd: Date };
  } catch {
    return { count: 0, windowEnd };
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  headers: Record<string, string>;
}

export async function checkRateLimit(
  request: NextRequest,
  userId?: string
): Promise<RateLimitResult> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const keys = [`ip:${ip}`];
  if (userId) keys.push(`user:${userId}`);

  const results = await Promise.all(keys.map(checkKey));
  const maxCount = Math.max(...results.map((r) => r.count));
  const windowEnd = results[0].windowEnd;
  const allowed = maxCount <= MAX_REQUESTS;
  const remaining = Math.max(0, MAX_REQUESTS - maxCount);

  return {
    allowed,
    remaining,
    resetAt: windowEnd,
    headers: {
      "X-RateLimit-Limit": String(MAX_REQUESTS),
      "X-RateLimit-Remaining": String(remaining),
      "X-RateLimit-Reset": String(Math.floor(windowEnd.getTime() / 1000)),
    },
  };
}
