import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const [userCount, sessionCount, eventCount, errorCount, feedbackCount, featureSeriesCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.session.count(),
      prisma.event.count(),
      prisma.errorReport.count(),
      prisma.feedback.count(),
      prisma.featureSeries.count(),
    ]);

  const rateLimitResult = await prisma.rateLimitLog.aggregate({
    _sum: { count: true },
    where: { updatedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });

  const recentErrors = await prisma.errorReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, runId: true, message: true, createdAt: true },
  });

  const recentFeedbacks = await prisma.feedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, runId: true, message: true, createdAt: true },
  });

  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { sessions: true } },
    },
  });

  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, action: true, entityType: true, createdAt: true, ip: true },
  });

  return (
    <div>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>管理ダッシュボード</h2>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>プラットフォーム統計</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px", marginBottom: "8px" }}>
          {[
            { label: "ユーザー数", value: userCount },
            { label: "セッション数", value: sessionCount },
            { label: "イベント数", value: eventCount },
            { label: "エラー数", value: errorCount },
            { label: "フィードバック数", value: feedbackCount },
            { label: "特徴量系列数", value: featureSeriesCount },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>{stat.value}</div>
              <div className="muted">{stat.label}</div>
            </div>
          ))}
        </div>
        <p className="muted">
          レート制限発火数 (24h): {rateLimitResult._sum.count ?? 0}
        </p>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>最近のユーザー (メタ情報のみ)</h3>
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr>
                {["メール", "ロール", "セッション数", "登録日"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id}>
                  <td style={{ padding: "6px 8px" }}>{u.email}</td>
                  <td style={{ padding: "6px 8px" }}>{u.role}</td>
                  <td style={{ padding: "6px 8px" }}>{u._count.sessions}</td>
                  <td style={{ padding: "6px 8px" }}>{new Date(u.createdAt).toLocaleDateString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>最近のフィードバック</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {recentFeedbacks.map((f) => (
            <div key={f.id} className="card" style={{ padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span className="muted" style={{ fontFamily: "monospace", fontSize: "11px" }}>{f.runId}</span>
                <span className="muted">{new Date(f.createdAt).toLocaleString("ja-JP")}</span>
              </div>
              <p style={{ fontSize: "12px" }}>{f.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>最近のエラー</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {recentErrors.map((e) => (
            <div key={e.id} className="card" style={{ padding: "8px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span className="muted" style={{ fontFamily: "monospace", fontSize: "11px" }}>{e.runId}</span>
                <span className="muted">{new Date(e.createdAt).toLocaleString("ja-JP")}</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-danger)" }}>{e.message}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>監査ログ</h3>
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr>
                {["アクション", "対象", "IP", "日時"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "4px 6px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ padding: "4px 6px", fontFamily: "monospace" }}>{log.action}</td>
                  <td style={{ padding: "4px 6px" }}>{log.entityType ?? "—"}</td>
                  <td style={{ padding: "4px 6px" }}>{log.ip ?? "—"}</td>
                  <td style={{ padding: "4px 6px" }}>{new Date(log.createdAt).toLocaleString("ja-JP")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
