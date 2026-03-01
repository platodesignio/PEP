import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const sessions = await prisma.session.findMany({
    where: { userId: session.sub },
    orderBy: { startedAt: "desc" },
    take: 20,
    select: {
      runId: true,
      startedAt: true,
      endedAt: true,
      eventSchemaVersion: true,
      detectionConfigVersion: true,
      _count: { select: { events: true, interventions: true } },
    },
  });

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 700 }}>ダッシュボード</h2>
        <Link href="/session/new">
          <button data-variant="primary">新規セッション</button>
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "16px" }}>
            セッションがありません
          </p>
          <Link href="/session/new">
            <button data-variant="primary">最初のセッションを開始する</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sessions.map((s) => (
            <div
              key={s.runId}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
              }}
            >
              <div>
                <div style={{ fontFamily: "monospace", fontSize: "12px", marginBottom: "2px" }}>
                  {s.runId}
                </div>
                <div className="muted">
                  {new Date(s.startedAt).toLocaleString("ja-JP")}
                  {s.endedAt ? ` 〜 ${new Date(s.endedAt).toLocaleString("ja-JP")}` : " 〜 進行中"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <span className="muted">{s._count.events} イベント</span>
                <span className="muted">{s._count.interventions} 介入</span>
                {!s.endedAt && (
                  <Link href={`/session/${s.runId}/live`}>
                    <button style={{ fontSize: "11px", padding: "4px 8px" }}>再開</button>
                  </Link>
                )}
                <Link href={`/session/${s.runId}/summary`}>
                  <button style={{ fontSize: "11px", padding: "4px 8px" }}>レポート</button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
