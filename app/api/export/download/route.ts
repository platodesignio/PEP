import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateExportData, exportToJson, exportEventsToCsv } from "@/lib/export";
import { writeAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const format = url.searchParams.get("format") ?? "json";

  if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });

  const job = await prisma.exportJob.findUnique({
    where: { downloadToken: token },
    include: { user: { select: { id: true } } },
  });

  if (!job) return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });

  if (job.expiresAt && job.expiresAt < new Date()) {
    return NextResponse.json({ error: "Download link has expired" }, { status: 410 });
  }

  const data = await generateExportData(job.userId);

  await writeAuditLog({
    userId: job.userId,
    action: "EXPORT_DOWNLOAD",
    entityType: "ExportJob",
    entityId: job.id,
    request,
  });

  if (format === "csv") {
    const csv = exportEventsToCsv(data);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="pep-events-${job.userId}-${Date.now()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const json = exportToJson(data);
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="pep-export-${job.userId}-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
