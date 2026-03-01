import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください").max(254),
  password: z.string().min(10).max(128),
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

export const createSessionSchema = z.object({
  eventSchemaVersion: z.string().max(32),
  detectionConfigVersion: z.string().max(32),
  deviceInfoJson: z.string().max(2048).optional(),
  permissionStateJson: z.string().max(1024).optional(),
  samplingConfigJson: z.string().max(1024).optional(),
});

export const endSessionSchema = z.object({
  endedAt: z.string().datetime().optional(),
});

export const eventItemSchema = z.object({
  t0: z.number().finite(),
  t1: z.number().finite(),
  type: z.enum(["FOCUS_COLLAPSE", "CONVERSATION_TURN", "MOTION_ANOMALY"]),
  confidence: z.number().min(0).max(1),
  baselineDeviation: z.number().finite(),
  featuresSummaryJson: z.string().max(4096).optional(),
  baselineSummaryJson: z.string().max(4096).optional(),
});

export const batchEventsSchema = z.object({
  events: z.array(eventItemSchema).min(1).max(100),
});

export const featureSeriesSchema = z.object({
  kind: z.string().max(64),
  sampleRateHz: z.number().positive().max(1000),
  seriesJson: z.string().max(524288),
});

export const annotationSchema = z.object({
  eventId: z.string().max(128).optional(),
  text: z.string().max(4096).optional(),
  tagsJson: z.string().max(1024).optional(),
});

export const interventionSchema = z.object({
  kind: z.enum(["UI_MICRO_CHANGE", "TIMER_START", "SCREEN_TIDY", "BREATH_GUIDE"]),
  firedAt: z.number().finite(),
  eventId: z.string().max(128).optional(),
  metaJson: z.string().max(2048).optional(),
});

export const interventionRatingSchema = z.object({
  interventionId: z.string().max(128),
  rating: z.enum(["USEFUL", "USELESS", "FALSE_ALARM"]),
  note: z.string().max(1024).optional(),
});

export const apiKeySchema = z.object({
  provider: z.string().max(64).regex(/^[a-z0-9_-]+$/),
  key: z.string().min(1).max(512),
});

export const feedbackSchema = z.object({
  message: z.string().min(1).max(4096),
  runId: z.string().max(128),
  sessionId: z.string().max(128).optional(),
  metaJson: z.string().max(4096).optional(),
});

export const errorReportSchema = z.object({
  runId: z.string().max(128),
  message: z.string().max(4096),
  stackHash: z.string().max(64).optional(),
  metaJson: z.string().max(4096).optional(),
});

export const abAssignmentSchema = z.object({
  scope: z.enum(["user", "session"]),
  runId: z.string().max(128).optional(),
  sessionId: z.string().max(128).optional(),
});

export const aiSummarizeSchema = z.object({
  runId: z.string().max(128),
  events: z
    .array(
      z.object({
        type: z.string().max(64),
        t0: z.number(),
        t1: z.number(),
        confidence: z.number(),
        userConfirmed: z.boolean().nullable(),
      })
    )
    .max(500),
  annotations: z.array(z.object({ text: z.string().max(1024) })).max(100),
  ratings: z
    .array(
      z.object({
        rating: z.string().max(32),
      })
    )
    .max(200),
});

export const eventConfirmSchema = z.object({
  userConfirmed: z.boolean().nullable(),
  userAnnotation: z.string().max(1024).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type BatchEventsInput = z.infer<typeof batchEventsSchema>;
export type FeatureSeriesInput = z.infer<typeof featureSeriesSchema>;
export type AnnotationInput = z.infer<typeof annotationSchema>;
export type InterventionInput = z.infer<typeof interventionSchema>;
export type InterventionRatingInput = z.infer<typeof interventionRatingSchema>;
export type ApiKeyInput = z.infer<typeof apiKeySchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
export type ErrorReportInput = z.infer<typeof errorReportSchema>;
export type AiSummarizeInput = z.infer<typeof aiSummarizeSchema>;
