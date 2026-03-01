"use client";

interface Metrics {
  rms: number;
  motionQty: number;
  inputVariance: number;
  eventCount: number;
  sessionElapsedSec: number;
}

interface Props {
  metrics: Metrics;
}

function MeterBar({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
        <span className="muted">{label}</span>
        <span className="muted">{pct.toFixed(0)}%</span>
      </div>
      <div className="meter">
        <div className="meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MetricsDisplay({ metrics }: Props) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "24px",
          marginBottom: "12px",
          fontSize: "20px",
          fontWeight: 700,
        }}
      >
        <span title="セッション経過時間">
          {formatDuration(metrics.sessionElapsedSec)}
        </span>
        <span title="検出イベント数" style={{ fontSize: "14px", alignSelf: "flex-end" }}>
          {metrics.eventCount} イベント
        </span>
      </div>
      <MeterBar value={metrics.rms} label="音声エネルギー" />
      <MeterBar value={metrics.motionQty} label="映像動き量" />
      <MeterBar value={metrics.inputVariance} label="入力リズム変動" />
    </div>
  );
}
