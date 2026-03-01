import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const sessions = await prisma.session.findMany({
    where: { userId: session.sub },
    include: {
      events: true,
      interventions: { include: { ratings: { where: { userId: session.sub } } } },
    },
    orderBy: { startedAt: "desc" },
    take: 30,
  });

  const totalSessions = sessions.length;
  const totalEvents = sessions.reduce((s, sess) => s + sess.events.length, 0);
  const totalFalseAlarms = sessions
    .flatMap((s) => s.events)
    .filter((e) => e.userConfirmed === false).length;
  const falseAlarmRate = totalEvents > 0 ? (totalFalseAlarms / totalEvents) * 100 : 0;

  const allRatings = sessions.flatMap((s) => s.interventions.flatMap((i) => i.ratings));
  const usefulCount = allRatings.filter((r) => r.rating === "USEFUL").length;
  const usefulRate = allRatings.length > 0 ? (usefulCount / allRatings.length) * 100 : null;

  const byType: Record<string, number> = { FOCUS_COLLAPSE: 0, CONVERSATION_TURN: 0, MOTION_ANOMALY: 0 };
  for (const s of sessions) {
    for (const e of s.events) byType[e.type] = (byType[e.type] ?? 0) + 1;
  }

  const abGroups: Record<string, { sessions: number; events: number; falseAlarms: number }> = {};
  for (const s of sessions) {
    const assignment = await prisma.aBAssignment.findFirst({ where: { sessionId: s.id } });
    const variant = assignment?.variant ?? "UNASSIGNED";
    if (!abGroups[variant]) abGroups[variant] = { sessions: 0, events: 0, falseAlarms: 0 };
    abGroups[variant].sessions++;
    abGroups[variant].events += s.events.length;
    abGroups[variant].falseAlarms += s.events.filter((e) => e.userConfirmed === false).length;
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>分析</h2>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>全体統計</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
          {[
            { label: "セッション数", value: totalSessions },
            { label: "総イベント数", value: totalEvents },
            { label: "誤警報率", value: `${falseAlarmRate.toFixed(1)}%` },
            { label: "介入有用率", value: usefulRate !== null ? `${usefulRate.toFixed(1)}%` : "未評価" },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 700 }}>{stat.value}</div>
              <div className="muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>イベント種別内訳</h3>
        <div className="card">
          {Object.entries(byType).map(([type, count]) => {
            const labels: Record<string, string> = {
              FOCUS_COLLAPSE: "集中崩壊境界",
              CONVERSATION_TURN: "会話転調境界",
              MOTION_ANOMALY: "動作異常境界",
            };
            const pct = totalEvents > 0 ? (count / totalEvents) * 100 : 0;
            return (
              <div key={type} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span className="badge" data-type={type}>{labels[type] ?? type}</span>
                  <span className="muted">{count}件 ({pct.toFixed(1)}%)</span>
                </div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>A/Bテスト比較</h3>
        {Object.keys(abGroups).length === 0 ? (
          <p className="muted">A/B割り当てがありません</p>
        ) : (
          <div className="card">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr>
                  {["バリアント", "セッション数", "イベント数", "誤警報数", "誤警報率"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "1px solid var(--color-border)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(abGroups).map(([variant, stats]) => (
                  <tr key={variant}>
                    <td style={{ padding: "6px 8px" }}>{variant}</td>
                    <td style={{ padding: "6px 8px" }}>{stats.sessions}</td>
                    <td style={{ padding: "6px 8px" }}>{stats.events}</td>
                    <td style={{ padding: "6px 8px" }}>{stats.falseAlarms}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {stats.events > 0 ? `${((stats.falseAlarms / stats.events) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
