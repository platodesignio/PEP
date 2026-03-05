import type { HrvSnapshot } from "./types";

/**
 * Compute RMSSD from an array of RR intervals (ms).
 * RMSSD = sqrt( mean( (RR[i+1] - RR[i])^2 ) )
 */
export function rmssd(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < rrIntervals.length; i++) {
    const diff = rrIntervals[i] - rrIntervals[i - 1];
    sum += diff * diff;
  }
  return Math.sqrt(sum / (rrIntervals.length - 1));
}

/**
 * Compute SDNN (standard deviation of NN intervals).
 */
export function sdnn(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  const mean = rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length;
  const variance =
    rrIntervals.reduce((s, v) => s + (v - mean) ** 2, 0) / rrIntervals.length;
  return Math.sqrt(variance);
}

/**
 * Approximate LF/HF ratio from RR intervals using simple frequency-domain proxy.
 *
 * This is a heuristic: it uses the ratio of slow oscillations (≥10s) to fast
 * oscillations (<10s) in the RR series. A proper implementation would use an
 * FFT, but that requires many more samples than a mobile Apple Watch bridge
 * typically delivers.
 *
 * For real HealthKit data, prefer using the Apple Watch computed HRV directly.
 */
export function approximateLfhf(rrIntervals: number[]): number | null {
  if (rrIntervals.length < 5) return null;
  // HF: adjacent differences (breathing frequency band)
  const hfPower = rmssd(rrIntervals) ** 2;
  // LF proxy: slower oscillations → look at differences 2 apart
  const lf: number[] = [];
  for (let i = 2; i < rrIntervals.length; i++) {
    lf.push(rrIntervals[i] - rrIntervals[i - 2]);
  }
  const lfPower = lf.reduce((s, v) => s + v * v, 0) / lf.length - hfPower;
  if (hfPower <= 0) return null;
  return Math.max(0.1, lfPower / hfPower);
}

/**
 * Build an HrvSnapshot from a buffer of RR intervals.
 */
export function buildHrvSnapshot(rrIntervals: number[]): HrvSnapshot | null {
  if (rrIntervals.length === 0) return null;
  const lastRr = rrIntervals[rrIntervals.length - 1];
  return {
    rrMs: lastRr,
    sdnn: sdnn(rrIntervals),
    rmssd: rmssd(rrIntervals),
    lfhf: approximateLfhf(rrIntervals) ?? undefined,
  };
}
