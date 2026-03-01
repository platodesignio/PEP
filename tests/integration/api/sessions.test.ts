import { describe, it, expect } from "vitest";
import {
  createSessionSchema,
  batchEventsSchema,
  featureSeriesSchema,
  annotationSchema,
  interventionSchema,
  interventionRatingSchema,
} from "@/lib/validation";

describe("createSessionSchema", () => {
  it("accepts minimal input", () => {
    const result = createSessionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts full input", () => {
    const result = createSessionSchema.safeParse({
      eventSchemaVersion: "1.0.0",
      detectionConfigVersion: "1.0.0",
      deviceInfoJson: '{"platform":"Win32"}',
      permissionStateJson: '{"microphone":"granted"}',
    });
    expect(result.success).toBe(true);
  });
});

describe("batchEventsSchema", () => {
  it("accepts valid event batch", () => {
    const result = batchEventsSchema.safeParse({
      events: [
        {
          t0: 1000,
          t1: 2000,
          type: "FOCUS_COLLAPSE",
          confidence: 0.75,
          baselineDeviation: 3.2,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty events array", () => {
    const result = batchEventsSchema.safeParse({ events: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid event type", () => {
    const result = batchEventsSchema.safeParse({
      events: [{ t0: 0, t1: 1, type: "INVALID_TYPE", confidence: 0.5, baselineDeviation: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const result = batchEventsSchema.safeParse({
      events: [{ t0: 0, t1: 1, type: "FOCUS_COLLAPSE", confidence: 1.5, baselineDeviation: 1 }],
    });
    expect(result.success).toBe(false);
  });
});

describe("featureSeriesSchema", () => {
  it("accepts valid feature series", () => {
    const result = featureSeriesSchema.safeParse({
      kind: "audio_rms",
      sampleRateHz: 10,
      seriesJson: "[0.1, 0.2, 0.15]",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative sample rate", () => {
    const result = featureSeriesSchema.safeParse({
      kind: "audio_rms",
      sampleRateHz: -1,
      seriesJson: "[]",
    });
    expect(result.success).toBe(false);
  });
});

describe("annotationSchema", () => {
  it("accepts annotation without event", () => {
    const result = annotationSchema.safeParse({ text: "user note" });
    expect(result.success).toBe(true);
  });

  it("accepts annotation with eventId", () => {
    const result = annotationSchema.safeParse({ eventId: "event123", text: "confirmed" });
    expect(result.success).toBe(true);
  });
});

describe("interventionRatingSchema", () => {
  it("accepts valid rating", () => {
    const result = interventionRatingSchema.safeParse({
      interventionId: "iv123",
      rating: "USEFUL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid rating value", () => {
    const result = interventionRatingSchema.safeParse({
      interventionId: "iv123",
      rating: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional note", () => {
    const result = interventionRatingSchema.safeParse({
      interventionId: "iv123",
      rating: "FALSE_ALARM",
      note: "Not relevant in this context",
    });
    expect(result.success).toBe(true);
    expect(result.data?.note).toBe("Not relevant in this context");
  });
});
