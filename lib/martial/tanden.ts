import type { TciComponents, TciResult, MotionWindow, HrvSnapshot, RespirationSnapshot } from "./types";
import { motorErrorCorrection, attentionPersistence } from "./motion";

/** Weights for each TCI component (must sum to 1) */
const WEIGHTS: Record<keyof TciComponents, number> = {
  bodyStability:         0.30,
  respRegularity:        0.20,
  ansBalance:            0.20,
  motorErrorCorrection:  0.15,
  attentionPersistence:  0.15,
};

/**
 * Convert LF/HF ratio to ANS-balance score (0-1).
 * Optimal ratio ≈ 1.0 → score 1.0; extremes → lower.
 */
function lfhfToAns(lfhf: number): number {
  // Gaussian centred at ln(1) = 0 with σ = 0.8
  const x = Math.log(Math.max(0.01, lfhf));
  return Math.exp(-(x * x) / (2 * 0.8 * 0.8));
}

/**
 * Convert breathing rate and regularity to a respiration score (0-1).
 */
function respScore(resp: RespirationSnapshot | null): number {
  if (!resp) return 0.5; // neutral when no data
  // Ideal breathing for martial arts: 6-12 breaths/min
  const rateScore = Math.max(0, 1 - Math.abs(resp.ratePerMin - 9) / 9);
  const regScore = resp.regularity ?? 0.5;
  return 0.5 * rateScore + 0.5 * regScore;
}

/**
 * Compute Tanden Control Index from recent motion windows and biometric data.
 *
 * @param windows        - sliding window of recent MotionWindow (last N seconds)
 * @param currentWindow  - the latest MotionWindow for bodyStability
 * @param hrv            - latest HRV snapshot (or null)
 * @param resp           - latest respiration snapshot (or null)
 */
export function computeTci(
  windows: MotionWindow[],
  currentWindow: MotionWindow,
  hrv: HrvSnapshot | null,
  resp: RespirationSnapshot | null
): TciResult {
  const components: TciComponents = {
    bodyStability:        currentWindow.bodyStability,
    respRegularity:       respScore(resp),
    ansBalance:           hrv?.lfhf != null ? lfhfToAns(hrv.lfhf) : 0.5,
    motorErrorCorrection: motorErrorCorrection(windows),
    attentionPersistence: attentionPersistence(windows),
  };

  let score = 0;
  for (const [key, w] of Object.entries(WEIGHTS) as [keyof TciComponents, number][]) {
    score += components[key] * w * 100;
  }

  return { score: Math.round(score * 10) / 10, components };
}
