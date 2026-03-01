export type EventType = "FOCUS_COLLAPSE" | "CONVERSATION_TURN" | "MOTION_ANOMALY";

export type InterventionKind = "UI_MICRO_CHANGE" | "TIMER_START" | "SCREEN_TIDY" | "BREATH_GUIDE";

export interface AudioFeatures {
  rms: number;
  zcr: number;
  spectralCentroid: number;
  spectralFlatness: number;
  bandEnergyLow: number;
  bandEnergyMid: number;
  bandEnergyHigh: number;
  shortTimeChangeRate: number;
}

export interface VideoFeatures {
  motionQuantity: number;
  motionSpatialVariance: number;
  globalChangeRate: number;
}

export interface InputFeatures {
  keyIntervalVariance: number;
  mouseVelocityVariance: number;
  clickRate: number;
  scrollRate: number;
  pauseDuration: number;
}

export interface FeatureBundle {
  timestamp: number;
  audio: AudioFeatures | null;
  video: VideoFeatures | null;
  input: InputFeatures | null;
}

export interface BaselineEstimate {
  median: number;
  mad: number;
  n: number;
}

export interface FeatureBaseline {
  audio: Record<keyof AudioFeatures, BaselineEstimate>;
  video: Record<keyof VideoFeatures, BaselineEstimate>;
  input: Record<keyof InputFeatures, BaselineEstimate>;
}

export interface DetectedEvent {
  type: EventType;
  t0: number;
  t1: number;
  confidence: number;
  baselineDeviation: number;
  featuresSummary: Record<string, number>;
  baselineSummary: Record<string, number>;
}

export interface DetectedIntervention {
  kind: InterventionKind;
  firedAt: number;
  reason: string;
  eventType: EventType;
}

export interface WorkerInMessage {
  type: "features";
  bundle: FeatureBundle;
  config: DetectionConfig;
}

export interface WorkerOutMessage {
  type: "event" | "intervention" | "baseline_update";
  event?: DetectedEvent;
  intervention?: DetectedIntervention;
  baseline?: FeatureBaseline;
}

export interface DetectionConfig {
  version: string;
  focusCollapse: FocusCollapseConfig;
  conversationTurn: ConversationTurnConfig;
  motionAnomaly: MotionAnomalyConfig;
  interventions: InterventionConfig;
  baseline: BaselineConfig;
}

export interface FocusCollapseConfig {
  inputVarianceDeviationThreshold: number;
  pauseDurationThresholdSec: number;
  mouseDwellDeviationThreshold: number;
  minConcurrentConditions: number;
  cooldownSec: number;
}

export interface ConversationTurnConfig {
  silenceGapDeviationThreshold: number;
  spectralChangeDeviationThreshold: number;
  energyVarianceDeviationThreshold: number;
  cooldownSec: number;
}

export interface MotionAnomalyConfig {
  motionAlternationWindowSec: number;
  motionAlternationCount: number;
  noiseSpikeCount: number;
  inputIrregularStopCount: number;
  cooldownSec: number;
}

export interface InterventionConfig {
  enabled: boolean;
  minIntervalSec: number;
  maxPerSession: number;
}

export interface BaselineConfig {
  windowSamples: number;
  minSamplesBeforeDetection: number;
  alpha: number;
}
