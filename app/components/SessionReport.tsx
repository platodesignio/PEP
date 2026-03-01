"use client";

interface DensityPoint {
  windowStart: number;
  count: number;
}

interface SummaryData {
  session: {
    runId: string;
    startedAt: string;
    endedAt: string | null;
    durationSec: number | null;
    eventSchemaVersion: string;
    detectionConfigVersion: string;
  };
  events: {
    total: number;
    byType: Record<string, number>;
    confirmed: number;
    denied: number;
    unanswered: number;
    falseAlarmRate: number;
  };
  interventions: {
    total: number;
    rated: number;
    usefulRate: number | null;
  };
  missedEvents: number;
  densityTimeline: DensityPoint[];
}

interface Props {
  data: SummaryData;
}

export default function SessionReport({ data }: Props) {
  const { session, events, interventions, missedEvents, densityTimeline } = data;

  const durationStr = session.durationSec
    ? `${Math.floor(session.durationSec / 60)}分${Math.floor(session.durationSec % 60)}秒`
    : "計測中";

  const maxDensity = Math.max(1, ...densityTimeline.map((d) => d.count));

  return (
    <div>
      <div className="section">
        <h3 style={{ fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>セッション情報</h3>
        <div className="card">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <tbody>
              {[
                ["runId", session.runId],
                ["開始", new Date(session.startedAt).toLocaleString("ja-JP")],
                ["終了", session.endedAt ? new Date(session.endedAt).toLocaleString("ja-JP") : "未終了"],
                ["時間", durationStr],
                ["イベントスキーマ", session.eventSchemaVersion],
                ["検出設定", session.detectionConfigVersion],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td style={{ padding: "4px 0", color: "var(--color-text-muted)", width: "140px" }}>{label}</td>
                  <td style={{ padding: "4px 0", fontFamily: "monospace", fontSize: "11px" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>イベント統計</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "12px" }}>
          {[
            { label: "合計", value: events.total },
            { label: "確認済", value: events.confirmed },
            { label: "誤警報", value: events.denied },
            { label: "未回答", value: events.unanswered },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>{stat.value}</div>
              <div className="muted">{stat.label}</div>
            </div>
          ))}
        </div>
        <p className="muted">
          誤警報率: {(events.falseAlarmRate * 100).toFixed(1)}% / 種別: 集中崩壊 {events.byType.FOCUS_COLLAPSE ?? 0} 件 / 会話転調 {events.byType.CONVERSATION_TURN ?? 0} 件 / 動作異常 {events.byType.MOTION_ANOMALY ?? 0} 件
        </p>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>イベント密度タイムライン</h3>
        {densityTimeline.length === 0 ? (
          <p className="muted">データなし</p>
        ) : (
          <div style={{ display: "flex", gap: "2px", alignItems: "flex-end", height: "60px" }}>
            {densityTimeline.map((d) => (
              <div
                key={d.windowStart}
                title={`${Math.floor(d.windowStart / 60)}分: ${d.count}件`}
                style={{
                  flex: 1,
                  height: `${(d.count / maxDensity) * 100}%`,
                  minHeight: "2px",
                  background: "var(--color-accent)",
                  opacity: 0.7,
                  borderRadius: "1px",
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>介入統計</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
          {[
            { label: "発火回数", value: interventions.total },
            { label: "評価済", value: interventions.rated },
            {
              label: "有用率",
              value:
                interventions.usefulRate !== null
                  ? `${(interventions.usefulRate * 100).toFixed(0)}%`
                  : "未評価",
            },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: "center" }}>
              <div style={{ fontSize: "22px", fontWeight: 700 }}>{stat.value}</div>
              <div className="muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", marginBottom: "8px", fontWeight: 600 }}>見逃しイベント</h3>
        <p className="muted">
          後から追加した出来事（ユーザー記録）: {missedEvents} 件
        </p>
      </div>
    </div>
  );
}
