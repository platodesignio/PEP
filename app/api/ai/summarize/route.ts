import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { decrypt } from "@/lib/crypto";
import { aiSummarizeSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = await checkRateLimit(request, session.sub);
  if (!rl.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

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
  try {
    apiKey = decrypt(apiKeyRecord.encryptedKey);
  } catch {
    return NextResponse.json({ error: "APIキーの復号に失敗しました" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = aiSummarizeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message }, { status: 400 });
  }

  const { runId, events, annotations, ratings } = parsed.data;

  const eventSummary = events
    .map((e) => `[${e.type}] t=${e.t0.toFixed(1)}-${e.t1.toFixed(1)}s conf=${e.confidence.toFixed(2)} confirmed=${e.userConfirmed}`)
    .join("\n");

  const annotationText = annotations.map((a) => a.text).join("; ");
  const ratingText = `有用=${ratings.filter((r) => r.rating === "USEFUL").length} 無用=${ratings.filter((r) => r.rating === "USELESS").length} 誤警報=${ratings.filter((r) => r.rating === "FALSE_ALARM").length}`;

  const prompt = `以下はセッション(runId: ${runId})の計測データです。\n\nイベント一覧:\n${eventSummary}\n\nユーザー注釈: ${annotationText}\n\n介入評価: ${ratingText}\n\nこのセッションのイベント定義の性能を評価し、閾値調整の提案を日本語で簡潔にまとめてください。`;

  const baseUrl = process.env.OPENAI_API_BASE ?? "https://api.openai.com/v1";

  const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 512,
      temperature: 0.3,
    }),
  });

  if (!aiResponse.ok) {
    return NextResponse.json(
      { error: `AI API エラー: ${aiResponse.status}` },
      { status: 502 }
    );
  }

  const aiData = await aiResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = aiData.choices?.[0]?.message?.content ?? "";

  return NextResponse.json({ summary: content, runId });
}
