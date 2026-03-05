// ── Martial Neurocontrol — core types ────────────────────────────────────────

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface PlaceRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  active: boolean;
}

export interface RoutinePhase {
  name: string;
  durationSec: number;
  motionType: "static" | "kata" | "kumite" | "breathing" | "free";
}

export interface RoutineRecord {
  id: string;
  name: string;
  descJson: string;
  targetSec: number;
  phasesJson: string;
  active: boolean;
}

/** Raw accelerometer/gyro sample from DeviceMotionEvent */
export interface RawMotionSample {
  t: number;   // seconds from execution start
  ax: number;  // m/s²
  ay: number;
  az: number;
  gx?: number; // rad/s
  gy?: number;
  gz?: number;
}

/** Per-second windowed metrics from motion worker */
export interface MotionWindow {
  t: number;
  /** RMS of acceleration vector magnitude */
  rmsMag: number;
  /** RMS of jerk magnitude (derivative of acceleration) */
  rmsJerk: number;
  /** Stability 0-1 (1 = perfectly still relative to gravity) */
  bodyStability: number;
  /** sway power spectral density (postural sway) */
  swayPsd: number;
  tci?: number;
}

/** TCI component scores (all 0-1) */
export interface TciComponents {
  bodyStability: number;      // stillness + posture hold
  respRegularity: number;     // breathing regularity
  ansBalance: number;         // HRV LF/HF → autonomic balance
  motorErrorCorrection: number; // speed correcting unwanted micro-movements
  attentionPersistence: number; // variance of stability over window
}

/** Tanden Control Index (0-100) */
export interface TciResult {
  score: number;
  components: TciComponents;
}

export interface HrvSnapshot {
  rrMs: number;
  sdnn?: number;
  rmssd?: number;
  lfhf?: number;
}

export interface RespirationSnapshot {
  ratePerMin: number;
  depthScore?: number;
  regularity?: number;
}

export interface ExecutionMetrics {
  tciMean: number;
  tciMin: number;
  tciMax: number;
  bodyStabilityMean: number;
  respRegularityMean: number;
  ansBalanceMean: number;
  motorErrorMean: number;
  attentionPersistenceMean: number;
  motionSampleCount: number;
  hrvSampleCount: number;
  durationSec: number;
}

// ── Worker messages ───────────────────────────────────────────────────────────

export type MotionWorkerIn =
  | { type: "sample"; sample: RawMotionSample }
  | { type: "hrv"; hrv: HrvSnapshot }
  | { type: "respiration"; resp: RespirationSnapshot }
  | { type: "reset" };

export interface MotionWorkerOut {
  type: "tick";
  window: MotionWindow;
  tci: TciResult;
  coachHint?: string;
}

// ── Real-time coaching ────────────────────────────────────────────────────────

export interface CoachingRule {
  id: string;
  condition: (tci: TciResult, window: MotionWindow) => boolean;
  messageJa: string;
  messageEn: string;
  minIntervalMs: number;
}
