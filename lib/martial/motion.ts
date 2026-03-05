import type { RawMotionSample, MotionWindow } from "./types";

const GRAVITY = 9.81; // m/s²

/** Magnitude of a 3-vector */
function mag(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/** Root-mean-square of an array */
function rms(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sum = arr.reduce((s, v) => s + v * v, 0);
  return Math.sqrt(sum / arr.length);
}

/**
 * Process a 1-second window of raw motion samples into MotionWindow metrics.
 *
 * @param samples - raw samples (ideally ~50 at 50 Hz)
 * @param t       - window centre time (s from execution start)
 */
export function processWindow(samples: RawMotionSample[], t: number): MotionWindow {
  if (samples.length === 0) {
    return { t, rmsMag: 0, rmsJerk: 0, bodyStability: 0, swayPsd: 0 };
  }

  // Magnitudes
  const mags = samples.map((s) => mag(s.ax, s.ay, s.az));
  const rmsMag = rms(mags);

  // Jerk = finite differences of acceleration magnitude
  const jerks: number[] = [];
  for (let i = 1; i < mags.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt > 0) jerks.push(Math.abs(mags[i] - mags[i - 1]) / dt);
  }
  const rmsJerk = rms(jerks);

  // Body stability: ratio of net acceleration to gravity
  // Perfect stillness → net accel ≈ GRAVITY (only gravity)
  // Movement → net accel > GRAVITY
  const excess = Math.abs(rmsMag - GRAVITY) / GRAVITY;
  const bodyStability = Math.max(0, Math.min(1, 1 - excess));

  // Postural sway: variance of horizontal (ax, ay) acceleration
  const axArr = samples.map((s) => s.ax);
  const ayArr = samples.map((s) => s.ay);
  const varAx = variance(axArr);
  const varAy = variance(ayArr);
  const swayPsd = varAx + varAy;

  return { t, rmsMag, rmsJerk, bodyStability, swayPsd };
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}

/**
 * Motor-error correction speed metric.
 *
 * Measures how quickly jerk returns to baseline after perturbations.
 * Returns 0-1 (1 = fast correction).
 */
export function motorErrorCorrection(windows: MotionWindow[]): number {
  if (windows.length < 3) return 0.5;
  // Find windows with high jerk (perturbation) and measure ramp-down
  const correctionScores: number[] = [];
  for (let i = 1; i < windows.length - 1; i++) {
    if (windows[i].rmsJerk > 2) {
      const before = windows[i - 1].rmsJerk;
      const after = windows[i + 1].rmsJerk;
      const correctionRatio = before > 0 ? Math.min(1, after / before) : 1;
      correctionScores.push(1 - correctionRatio);
    }
  }
  if (correctionScores.length === 0) return 0.7; // no perturbation = good
  return correctionScores.reduce((s, v) => s + v, 0) / correctionScores.length;
}

/**
 * Attention-persistence metric.
 *
 * Low variance in body-stability score over recent windows = high persistence.
 * Returns 0-1.
 */
export function attentionPersistence(windows: MotionWindow[]): number {
  if (windows.length < 2) return 0.5;
  const stabilities = windows.map((w) => w.bodyStability);
  const v = variance(stabilities);
  // clamp: v=0 → 1.0, v=0.05 → 0.0
  return Math.max(0, Math.min(1, 1 - v / 0.05));
}
