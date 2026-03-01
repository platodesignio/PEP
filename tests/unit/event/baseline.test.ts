import { describe, it, expect } from "vitest";
import {
  computeMedian,
  computeMAD,
  computeBaselineEstimate,
  computeDeviation,
  SlidingWindowBaseline,
  MultiFeatureBaseline,
} from "@/lib/event/baseline";

describe("computeMedian", () => {
  it("returns 0 for empty array", () => {
    expect(computeMedian([])).toBe(0);
  });

  it("returns single value", () => {
    expect(computeMedian([5])).toBe(5);
  });

  it("computes median of odd-length array", () => {
    expect(computeMedian([1, 3, 2])).toBe(2);
  });

  it("computes median of even-length array", () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles negative values", () => {
    expect(computeMedian([-2, -1, 0, 1, 2])).toBe(0);
  });
});

describe("computeMAD", () => {
  it("returns non-zero MAD for constant array", () => {
    const mad = computeMAD([5, 5, 5], 5);
    expect(mad).toBeGreaterThan(0);
  });

  it("computes correct MAD", () => {
    const values = [1, 2, 3, 4, 5];
    const median = 3;
    const mad = computeMAD(values, median);
    expect(mad).toBeCloseTo(1);
  });

  it("returns epsilon for zero MAD", () => {
    const mad = computeMAD([3, 3, 3], 3);
    expect(mad).toBeGreaterThan(0);
    expect(mad).toBeLessThan(0.001);
  });
});

describe("computeBaselineEstimate", () => {
  it("returns zeros for empty array", () => {
    const est = computeBaselineEstimate([]);
    expect(est.n).toBe(0);
  });

  it("computes correct estimate", () => {
    const values = Array.from({ length: 20 }, (_, i) => i);
    const est = computeBaselineEstimate(values);
    expect(est.median).toBeCloseTo(9.5);
    expect(est.n).toBe(20);
    expect(est.mad).toBeGreaterThan(0);
  });
});

describe("computeDeviation", () => {
  it("returns 0 when n=0", () => {
    expect(computeDeviation(5, { median: 0, mad: 1, n: 0 })).toBe(0);
  });

  it("returns large deviation for outlier", () => {
    const baseline = { median: 1, mad: 0.1, n: 100 };
    const dev = computeDeviation(10, baseline);
    expect(dev).toBeGreaterThan(5);
  });

  it("returns small deviation for typical value", () => {
    const baseline = { median: 1, mad: 0.5, n: 100 };
    const dev = computeDeviation(1.1, baseline);
    expect(dev).toBeLessThan(1);
  });
});

describe("SlidingWindowBaseline", () => {
  it("maintains window size", () => {
    const bl = new SlidingWindowBaseline(10);
    for (let i = 0; i < 15; i++) bl.push(i);
    expect(bl.size).toBe(10);
  });

  it("ignores non-finite values", () => {
    const bl = new SlidingWindowBaseline(100);
    bl.push(1);
    bl.push(NaN);
    bl.push(Infinity);
    expect(bl.size).toBe(1);
  });

  it("computes meaningful deviation after enough samples", () => {
    const bl = new SlidingWindowBaseline(100);
    for (let i = 0; i < 50; i++) bl.push(1 + Math.random() * 0.1);
    const dev = bl.deviation(10);
    expect(dev).toBeGreaterThan(5);
  });

  it("resets correctly", () => {
    const bl = new SlidingWindowBaseline(100);
    for (let i = 0; i < 50; i++) bl.push(i);
    bl.reset();
    expect(bl.size).toBe(0);
  });
});

describe("MultiFeatureBaseline", () => {
  it("tracks multiple features independently", () => {
    const mfb = new MultiFeatureBaseline(100);
    for (let i = 0; i < 30; i++) {
      mfb.push("featureA", 1 + Math.random() * 0.1);
      mfb.push("featureB", 100 + Math.random() * 10);
    }
    const devA = mfb.deviation("featureA", 10);
    const devB = mfb.deviation("featureB", 110);
    expect(devA).toBeGreaterThan(devB);
  });

  it("returns 0 for unknown feature", () => {
    const mfb = new MultiFeatureBaseline(100);
    expect(mfb.deviation("unknown", 5)).toBe(0);
  });
});
