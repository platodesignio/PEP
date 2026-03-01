import { vi } from "vitest";

process.env.SESSION_SECRET = "test-secret-minimum-32-chars-long-abc";
process.env.ENCRYPTION_KEY = "dGVzdC1rZXktMzItYnl0ZXMtbG9uZy1hYmNkZWY=";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.APP_URL = "http://localhost:3000";
process.env.RATE_LIMIT_WINDOW = "60000";
process.env.RATE_LIMIT_MAX = "1000";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    session: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    event: { createMany: vi.fn(), findMany: vi.fn() },
    featureSeries: { create: vi.fn() },
    annotation: { create: vi.fn(), findMany: vi.fn() },
    intervention: { create: vi.fn(), findMany: vi.fn() },
    interventionRating: { upsert: vi.fn() },
    aBAssignment: { findFirst: vi.fn(), create: vi.fn() },
    apiKey: { findUnique: vi.fn(), upsert: vi.fn(), delete: vi.fn() },
    feedback: { create: vi.fn(), findMany: vi.fn() },
    errorReport: { create: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    exportJob: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    rateLimitLog: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
}));
