import { prisma } from "@/lib/db/prisma";
import { stringify } from "csv-stringify/sync";

export interface ExportData {
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
  sessions: SessionExport[];
  exportedAt: string;
  eventSchemaVersion: string;
  detectionConfigVersion: string;
}

interface SessionExport {
  runId: string;
  startedAt: string;
  endedAt: string | null;
  eventSchemaVersion: string;
  detectionConfigVersion: string;
  events: EventExport[];
  featureSeries: FeatureSeriesExport[];
  interventions: InterventionExport[];
  annotations: AnnotationExport[];
  ratings: RatingExport[];
  abAssignments: ABExport[];
}

interface EventExport {
  id: string;
  t0: number;
  t1: number;
  type: string;
  confidence: number;
  baselineDeviation: number;
  userConfirmed: boolean | null;
  userAnnotation: string | null;
  featuresSummary: unknown;
  baselineSummary: unknown;
  createdAt: string;
}

interface FeatureSeriesExport {
  kind: string;
  sampleRateHz: number;
  series: unknown;
}

interface InterventionExport {
  id: string;
  kind: string;
  firedAt: number;
  meta: unknown;
  createdAt: string;
}

interface AnnotationExport {
  id: string;
  eventId: string | null;
  text: string | null;
  tags: unknown;
  createdAt: string;
}

interface RatingExport {
  interventionId: string;
  rating: string;
  note: string | null;
  createdAt: string;
}

interface ABExport {
  variant: string;
  runId: string | null;
  assignedAt: string;
}

export async function generateExportData(userId: string): Promise<ExportData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) throw new Error("User not found");

  const sessions = await prisma.session.findMany({
    where: { userId },
    include: {
      events: {
        include: { annotations: { where: { userId } } },
      },
      featureSeries: true,
      interventions: { include: { ratings: { where: { userId } } } },
      abAssignments: { where: { userId } },
    },
    orderBy: { startedAt: "asc" },
  });

  const schemaVersions = [...new Set(sessions.map((s) => s.eventSchemaVersion))].join(",");
  const configVersions = [...new Set(sessions.map((s) => s.detectionConfigVersion))].join(",");

  const sessionExports: SessionExport[] = sessions.map((s) => ({
    runId: s.runId,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    eventSchemaVersion: s.eventSchemaVersion,
    detectionConfigVersion: s.detectionConfigVersion,
    events: s.events.map((e) => ({
      id: e.id,
      t0: e.t0,
      t1: e.t1,
      type: e.type,
      confidence: e.confidence,
      baselineDeviation: e.baselineDeviation,
      userConfirmed: e.userConfirmed,
      userAnnotation: e.userAnnotation,
      featuresSummary: safeJsonParse(e.featuresSummaryJson),
      baselineSummary: safeJsonParse(e.baselineSummaryJson),
      createdAt: e.createdAt.toISOString(),
    })),
    featureSeries: s.featureSeries.map((f) => ({
      kind: f.kind,
      sampleRateHz: f.sampleRateHz,
      series: safeJsonParse(f.seriesJson),
    })),
    interventions: s.interventions.map((i) => ({
      id: i.id,
      kind: i.kind,
      firedAt: i.firedAt,
      meta: safeJsonParse(i.metaJson),
      createdAt: i.createdAt.toISOString(),
    })),
    annotations: s.events.flatMap((e) =>
      e.annotations.map((a) => ({
        id: a.id,
        eventId: a.eventId,
        text: a.text,
        tags: safeJsonParse(a.tagsJson),
        createdAt: a.createdAt.toISOString(),
      }))
    ),
    ratings: s.interventions.flatMap((i) =>
      i.ratings.map((r) => ({
        interventionId: r.interventionId,
        rating: r.rating,
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      }))
    ),
    abAssignments: s.abAssignments.map((ab) => ({
      variant: ab.variant,
      runId: ab.runId,
      assignedAt: ab.assignedAt.toISOString(),
    })),
  }));

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    sessions: sessionExports,
    exportedAt: new Date().toISOString(),
    eventSchemaVersion: schemaVersions,
    detectionConfigVersion: configVersions,
  };
}

export function exportToJson(data: ExportData): string {
  return JSON.stringify(data, null, 2);
}

export function exportEventsToCsv(data: ExportData): string {
  const rows: string[][] = [];

  for (const session of data.sessions) {
    for (const event of session.events) {
      rows.push([
        session.runId,
        session.eventSchemaVersion,
        session.detectionConfigVersion,
        event.id,
        String(event.t0),
        String(event.t1),
        event.type,
        String(event.confidence),
        String(event.baselineDeviation),
        event.userConfirmed === null ? "" : String(event.userConfirmed),
        event.userAnnotation ?? "",
        event.createdAt,
      ]);
    }
  }

  return stringify(rows, {
    header: true,
    columns: [
      "runId",
      "eventSchemaVersion",
      "detectionConfigVersion",
      "eventId",
      "t0",
      "t1",
      "type",
      "confidence",
      "baselineDeviation",
      "userConfirmed",
      "userAnnotation",
      "createdAt",
    ],
  });
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
