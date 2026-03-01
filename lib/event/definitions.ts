import type { DetectionConfig } from "./types";

export const EVENT_SCHEMA_VERSION = "1.0.0";
export const DETECTION_CONFIG_VERSION = "1.0.0";

export function getDefaultDetectionConfig(): DetectionConfig {
  return {
    version: DETECTION_CONFIG_VERSION,
    focusCollapse: {
      inputVarianceDeviationThreshold: 2.5,
      pauseDurationThresholdSec: 8,
      mouseDwellDeviationThreshold: 2.0,
      minConcurrentConditions: 2,
      cooldownSec: 60,
    },
    conversationTurn: {
      silenceGapDeviationThreshold: 3.0,
      spectralChangeDeviationThreshold: 2.5,
      energyVarianceDeviationThreshold: 2.0,
      cooldownSec: 30,
    },
    motionAnomaly: {
      motionAlternationWindowSec: 10,
      motionAlternationCount: 4,
      noiseSpikeCount: 3,
      inputIrregularStopCount: 3,
      cooldownSec: 90,
    },
    interventions: {
      enabled: true,
      minIntervalSec: 120,
      maxPerSession: 20,
    },
    baseline: {
      windowSamples: 300,
      minSamplesBeforeDetection: 60,
      alpha: 0.05,
    },
  };
}

export function getDetectionConfigVariantB(): DetectionConfig {
  const base = getDefaultDetectionConfig();
  return {
    ...base,
    version: DETECTION_CONFIG_VERSION + "-B",
    focusCollapse: {
      ...base.focusCollapse,
      inputVarianceDeviationThreshold: 3.0,
      cooldownSec: 90,
    },
    conversationTurn: {
      ...base.conversationTurn,
      silenceGapDeviationThreshold: 3.5,
      cooldownSec: 45,
    },
  };
}
