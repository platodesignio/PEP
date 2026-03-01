import type { BaselineEstimate } from "./types";

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function computeMAD(values: number[], median: number): number {
  if (values.length === 0) return 1;
  const deviations = values.map((v) => Math.abs(v - median));
  const mad = computeMedian(deviations);
  return mad === 0 ? 1e-6 : mad;
}

export function computeBaselineEstimate(window: number[]): BaselineEstimate {
  if (window.length === 0) return { median: 0, mad: 1, n: 0 };
  const median = computeMedian(window);
  const mad = computeMAD(window, median);
  return { median, mad, n: window.length };
}

export function computeDeviation(value: number, baseline: BaselineEstimate): number {
  if (baseline.n === 0) return 0;
  const scale = baseline.mad * 1.4826;
  return Math.abs(value - baseline.median) / (scale + 1e-9);
}

export function signedDeviation(value: number, baseline: BaselineEstimate): number {
  if (baseline.n === 0) return 0;
  const scale = baseline.mad * 1.4826;
  return (value - baseline.median) / (scale + 1e-9);
}

export class SlidingWindowBaseline {
  private window: number[];
  private readonly maxSize: number;
  private estimate: BaselineEstimate;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.window = [];
    this.estimate = { median: 0, mad: 1, n: 0 };
  }

  push(value: number): void {
    if (!isFinite(value)) return;
    this.window.push(value);
    if (this.window.length > this.maxSize) {
      this.window.shift();
    }
    if (this.window.length % 10 === 0 || this.window.length < 10) {
      this.estimate = computeBaselineEstimate(this.window);
    }
  }

  getEstimate(): BaselineEstimate {
    return this.estimate;
  }

  deviation(value: number): number {
    return computeDeviation(value, this.estimate);
  }

  signedDeviation(value: number): number {
    return signedDeviation(value, this.estimate);
  }

  get size(): number {
    return this.window.length;
  }

  reset(): void {
    this.window = [];
    this.estimate = { median: 0, mad: 1, n: 0 };
  }
}

export class MultiFeatureBaseline {
  private baselines: Map<string, SlidingWindowBaseline>;
  private readonly windowSize: number;

  constructor(windowSize: number) {
    this.windowSize = windowSize;
    this.baselines = new Map();
  }

  push(key: string, value: number): void {
    if (!this.baselines.has(key)) {
      this.baselines.set(key, new SlidingWindowBaseline(this.windowSize));
    }
    this.baselines.get(key)!.push(value);
  }

  deviation(key: string, value: number): number {
    const bl = this.baselines.get(key);
    if (!bl || bl.size < 5) return 0;
    return bl.deviation(value);
  }

  signedDeviation(key: string, value: number): number {
    const bl = this.baselines.get(key);
    if (!bl || bl.size < 5) return 0;
    return bl.signedDeviation(value);
  }

  getEstimate(key: string): BaselineEstimate {
    return this.baselines.get(key)?.getEstimate() ?? { median: 0, mad: 1, n: 0 };
  }

  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const [key, bl] of this.baselines) {
      summary[`${key}_median`] = bl.getEstimate().median;
      summary[`${key}_mad`] = bl.getEstimate().mad;
    }
    return summary;
  }

  getSize(key: string): number {
    return this.baselines.get(key)?.size ?? 0;
  }
}
