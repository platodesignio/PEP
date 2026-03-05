/**
 * POST /api/martial/executions/:execId/coach
 * GPT-powered post-session coaching analysis.
 */
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { checkRateLimit } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { buildCoachPrompt } from "@/lib/martial/coaching";
import type { ExecutionMetrics } from "@/lib/martial/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { execId: string } }
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const exec = await prisma.execution.findUnique({ where: { id: params.execId } });
  if (!exec || exec.userId !== session.sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const apiKeyRecord = await prisma.apiKey.findUnique({
    where: { userId_provider: { userId: session.sub, provider: "openai" } },
  });
  if (!apiKeyRecord) {
    return NextResponse.json(
      { error: "OpenAI APIキーが登録されていません。設定画面で登録してください。" },
      { status: 400 }
    );
  }

  let apiKey: string;
  try { apiKey = decrypt(apiKeyRecord.encryptedKey); }
  catch { return NextResponse.json({ error: "APIキーの復号に失敗しました" }, { status: 500 }); }

  let body: unknown;
  try { body = await request.json(); }
  catch { body = {}; }
  const locale = ((body as Record<string, unknown>)?.locale as "ja" | "en" | undefined) ?? "ja";

  // Parse stored metrics
  let metrics: ExecutionMetrics;
  try {
    metrics = JSON.parse(exec.metricsJson) as ExecutionMetrics;
  } catch {
    return NextResponse.json({ error: "Metrics not available" }, { status: 422 });
  }

  const prompt = buildCoachPrompt({ executionId: params.execId, metrics, locale });

  const baseUrl = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";
  const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
      temperature: 0.4,
    }),
  });

  if (!aiResponse.ok) {
    return NextResponse.json({ error: `AI API エラー: ${aiResponse.status}` }, { status: 502 });
  }

  const aiData = await aiResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const advice = aiData.choices?.[0]?.message?.content ?? "";

  // Persist coach note
  const coachNoteJson = JSON.stringify({ advice, locale, generatedAt: new Date().toISOString() });
  await prisma.execution.update({ where: { id: params.execId }, data: { coachNoteJson } });

  await writeAuditLog({ userId: session.sub, action: "MARTIAL_COACH_QUERY", entityType: "Execution", entityId: params.execId, request });
  return NextResponse.json({ advice, executionId: params.execId });
}
