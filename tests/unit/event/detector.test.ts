import { describe, it, expect, beforeEach } from "vitest";
import { EventDetector } from "@/lib/event/detector";
import { getDefaultDetectionConfig } from "@/lib/event/definitions";
import type { FeatureBundle } from "@/lib/event/types";

function makeBundle(overrides: Partial<FeatureBundle> = {}): FeatureBundle {
  return {
    timestamp: Date.now(),
    audio: {
      rms: 0.05,
      zcr: 0.1,
      spectralCentroid: 2000,
      spectralFlatness: 0.3,
      bandEnergyLow: 0.2,
      bandEnergyMid: 0.5,
      bandEnergyHigh: 0.3,
      shortTimeChangeRate: 0.01,
    },
    video: {
      motionQuantity: 0.01,
      motionSpatialVariance: 0.001,
      globalChangeRate: 0.01,
    },
    input: {
      keyIntervalVariance: 500,
      mouseVelocityVariance: 0.01,
      clickRate: 0.1,
      scrollRate: 0.05,
      pauseDuration: 0,
    },
    ...overrides,
  };
}

describe("EventDetector", () => {
  let detector: EventDetector;

  beforeEach(() => {
    detector = new EventDetector(getDefaultDetectionConfig());
  });

  it("does not fire events before min sample threshold", () => {
    const bundle = makeBundle();
    const result = detector.process(bundle);
    expect(result.events).toHaveLength(0);
    expect(result.interventions).toHaveLength(0);
  });

  it("builds baseline without firing premature events", () => {
    const config = getDefaultDetectionConfig();
    for (let i = 0; i < config.baseline.minSamplesBeforeDetection - 1; i++) {
      const result = detector.process(makeBundle({ timestamp: i * 100 }));
      expect(result.events).toHaveLength(0);
    }
  });

  it("detects focus collapse with extreme input variance", () => {
    const config = getDefaultDetectionConfig();
    const d = new EventDetector(config);

    const normalVariance = 500;
    for (let i = 0; i < config.baseline.minSamplesBeforeDetection + 10; i++) {
      d.process(makeBundle({
        timestamp: i * 100,
        input: {
          keyIntervalVariance: normalVariance + Math.random() * 50,
          mouseVelocityVariance: 0.01,
          clickRate: 0.1,
          scrollRate: 0.05,
          pauseDuration: 0,
        },
      }));
    }

    const extremeBundle = makeBundle({
      timestamp: (config.baseline.minSamplesBeforeDetection + 20) * 100,
      input: {
        keyIntervalVariance: normalVariance * 100,
        mouseVelocityVariance: 0,
        clickRate: 0,
        scrollRate: 0,
        pauseDuration: 15,
      },
    });

    const result = d.process(extremeBundle);
    expect(result.events.some((e) => e.type === "FOCUS_COLLAPSE")).toBe(true);
  });

  it("respects cooldown period", () => {
    const config = { ...getDefaultDetectionConfig(), focusCollapse: { ...getDefaultDetectionConfig().focusCollapse, cooldownSec: 60 } };
    const d = new EventDetector(config);

    for (let i = 0; i < config.baseline.minSamplesBeforeDetection + 10; i++) {
      d.process(makeBundle({ timestamp: i * 100 }));
    }

    const trigger = (ts: number) => d.process(makeBundle({
      timestamp: ts,
      input: { keyIntervalVariance: 1000000, mouseVelocityVariance: 0, clickRate: 0, scrollRate: 0, pauseDuration: 20 },
    }));

    const first = trigger((config.baseline.minSamplesBeforeDetection + 20) * 100);
    const second = trigger((config.baseline.minSamplesBeforeDetection + 25) * 100);

    const firstFired = first.events.some((e) => e.type === "FOCUS_COLLAPSE");
    const secondFired = second.events.some((e) => e.type === "FOCUS_COLLAPSE");

    if (firstFired) {
      expect(secondFired).toBe(false);
    }
  });

  it("does not fire interventions when disabled", () => {
    const config = {
      ...getDefaultDetectionConfig(),
      interventions: { enabled: false, minIntervalSec: 120, maxPerSession: 20 },
    };
    const d = new EventDetector(config);

    for (let i = 0; i < config.baseline.minSamplesBeforeDetection + 50; i++) {
      const result = d.process(makeBundle({
        timestamp: i * 100,
        input: { keyIntervalVariance: i * 1000, mouseVelocityVariance: 0, clickRate: 0, scrollRate: 0, pauseDuration: i },
      }));
      expect(result.interventions).toHaveLength(0);
    }
  });
});
