import type { TciResult, MotionWindow, CoachingRule } from "./types";
import type { ExecutionMetrics } from "./types";

// ── Real-time rule-based coaching ────────────────────────────────────────────

export const COACHING_RULES: CoachingRule[] = [
  {
    id: "low_tci",
    condition: (tci) => tci.score < 30,
    messageJa: "立て直してください。丹田に意識を向けてください。",
    messageEn: "Recompose yourself. Focus on your tanden (core center).",
    minIntervalMs: 8000,
  },
  {
    id: "unstable_body",
    condition: (tci) => tci.components.bodyStability < 0.3,
    messageJa: "重心を安定させてください。膝を少し曲げ、体軸を意識して。",
    messageEn: "Stabilize your center of gravity. Slightly bend your knees.",
    minIntervalMs: 6000,
  },
  {
    id: "poor_breathing",
    condition: (tci) => tci.components.respRegularity < 0.3,
    messageJa: "呼吸を整えてください。腹式呼吸でゆっくりと。",
    messageEn: "Regulate your breathing. Breathe slowly with your diaphragm.",
    minIntervalMs: 10000,
  },
  {
    id: "poor_ans",
    condition: (tci) => tci.components.ansBalance < 0.25,
    messageJa: "自律神経が乱れています。肩の力を抜いてリラックスしてください。",
    messageEn: "Autonomic balance is disrupted. Relax your shoulders.",
    minIntervalMs: 12000,
  },
  {
    id: "good_flow",
    condition: (tci) => tci.score >= 80,
    messageJa: "良い流れです。その集中を維持してください。",
    messageEn: "Excellent flow. Maintain this focus.",
    minIntervalMs: 20000,
  },
  {
    id: "high_jerk",
    condition: (_tci, window) => window.rmsJerk > 5,
    messageJa: "動作が急すぎます。ゆっくり、流れるように動いてください。",
    messageEn: "Movements are too abrupt. Move slowly and fluidly.",
    minIntervalMs: 5000,
  },
];

/** Mutable map of rule ID → last fired timestamp (ms) */
const lastFired = new Map<string, number>();

/**
 * Evaluate coaching rules and return the message for the first triggered rule
 * that has not been recently shown. Returns null if nothing to say.
 */
export function evaluateRules(
  tci: TciResult,
  window: MotionWindow,
  locale: "ja" | "en" = "ja"
): string | null {
  const now = Date.now();
  for (const rule of COACHING_RULES) {
    const sinceLastFired = now - (lastFired.get(rule.id) ?? 0);
    if (sinceLastFired < rule.minIntervalMs) continue;
    if (!rule.condition(tci, window)) continue;
    lastFired.set(rule.id, now);
    return locale === "ja" ? rule.messageJa : rule.messageEn;
  }
  return null;
}

/** Reset fired state (call when session starts/resets). */
export function resetCoachingState(): void {
  lastFired.clear();
}

// ── GPT post-session analysis ─────────────────────────────────────────────────

export interface GptCoachRequest {
  executionId: string;
  metrics: ExecutionMetrics;
  locale: "ja" | "en";
}

export interface GptCoachResponse {
  advice: string;
  strengths: string[];
  improvements: string[];
}

/**
 * Build a prompt for the GPT coach from execution metrics.
 */
export function buildCoachPrompt(req: GptCoachRequest): string {
  const { metrics, locale } = req;
  const fmt = (v: number) => (v * 100).toFixed(0) + "%";

  if (locale === "ja") {
    return `以下は武道稽古セッションの計測データです。

【丹田制御指数 (TCI)】
- 平均: ${metrics.tciMean.toFixed(1)} / 100
- 最高: ${metrics.tciMax.toFixed(1)} / 最低: ${metrics.tciMin.toFixed(1)}
- 体軸安定性: ${fmt(metrics.bodyStabilityMean)}
- 呼吸規則性: ${fmt(metrics.respRegularityMean)}
- 自律神経バランス: ${fmt(metrics.ansBalanceMean)}
- 動作誤り修正: ${fmt(metrics.motorErrorMean)}
- 集中持続性: ${fmt(metrics.attentionPersistenceMean)}
- 稽古時間: ${Math.round(metrics.durationSec / 60)} 分

このデータを元に、武道コーチとして以下を日本語で提供してください：
1. 3つ以内の強み
2. 3つ以内の改善点と具体的なアドバイス
3. 次回稽古への提案

簡潔かつ実践的にまとめてください。`;
  }

  return `Martial arts training session metrics:

【Tanden Control Index (TCI)】
- Mean: ${metrics.tciMean.toFixed(1)} / 100
- Max: ${metrics.tciMax.toFixed(1)} / Min: ${metrics.tciMin.toFixed(1)}
- Body Stability: ${fmt(metrics.bodyStabilityMean)}
- Respiration Regularity: ${fmt(metrics.respRegularityMean)}
- ANS Balance: ${fmt(metrics.ansBalanceMean)}
- Motor Error Correction: ${fmt(metrics.motorErrorMean)}
- Attention Persistence: ${fmt(metrics.attentionPersistenceMean)}
- Duration: ${Math.round(metrics.durationSec / 60)} min

As a martial arts coach, provide:
1. Up to 3 strengths
2. Up to 3 areas for improvement with specific advice
3. Suggestions for the next training session

Be concise and practical.`;
}
