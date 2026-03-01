"use client";

import { useState } from "react";

interface EventItem {
  id: string;
  t0: number;
  t1: number;
  type: string;
  confidence: number;
  userConfirmed: boolean | null;
}

interface Props {
  events: EventItem[];
  sessionDurationSec: number;
  onConfirm?: (eventId: string, confirmed: boolean | null) => void;
}

const TYPE_LABELS: Record<string, string> = {
  FOCUS_COLLAPSE: "集中崩壊",
  CONVERSATION_TURN: "会話転調",
  MOTION_ANOMALY: "動作異常",
};

export default function EventTimeline({ events, sessionDurationSec, onConfirm }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (events.length === 0) {
    return <p className="muted">イベントはまだありません</p>;
  }

  const totalSec = sessionDurationSec || 1;

  return (
    <div>
      <div
        style={{
          position: "relative",
          height: "32px",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius)",
          marginBottom: "12px",
          overflow: "hidden",
        }}
      >
        {events.map((e) => {
          const left = (e.t0 / 1000 / totalSec) * 100;
          const width = Math.max(0.5, ((e.t1 - e.t0) / 1000 / totalSec) * 100);
          return (
            <div
              key={e.id}
              title={TYPE_LABELS[e.type] ?? e.type}
              style={{
                position: "absolute",
                top: "8px",
                left: `${left}%`,
                width: `${width}%`,
                minWidth: "4px",
                height: "16px",
                background:
                  e.type === "FOCUS_COLLAPSE"
                    ? "#8b4513"
                    : e.type === "CONVERSATION_TURN"
                    ? "#1a5276"
                    : "#6c3483",
                opacity: 0.6 + e.confidence * 0.4,
                borderRadius: "2px",
                cursor: "pointer",
              }}
              onClick={() => setExpandedId(e.id === expandedId ? null : e.id)}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {events.map((e) => (
          <div
            key={e.id}
            className="card"
            style={{
              padding: "8px 12px",
              cursor: "pointer",
              borderColor:
                expandedId === e.id ? "var(--color-accent)" : "var(--color-border)",
            }}
            onClick={() => setExpandedId(e.id === expandedId ? null : e.id)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="badge" data-type={e.type}>
                {TYPE_LABELS[e.type] ?? e.type}
              </span>
              <span className="muted">
                {(e.t0 / 1000).toFixed(1)}s 信頼度 {(e.confidence * 100).toFixed(0)}%
              </span>
              {e.userConfirmed !== null && (
                <span
                  className="badge"
                  data-confirmed={String(e.userConfirmed)}
                  style={{ marginLeft: "8px" }}
                >
                  {e.userConfirmed ? "確認済" : "誤警報"}
                </span>
              )}
            </div>

            {expandedId === e.id && onConfirm && (
              <div
                style={{ display: "flex", gap: "6px", marginTop: "8px" }}
                onClick={(ev) => ev.stopPropagation()}
              >
                <button
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                  onClick={() => onConfirm(e.id, true)}
                >
                  有用
                </button>
                <button
                  style={{ fontSize: "11px", padding: "3px 8px" }}
                  onClick={() => onConfirm(e.id, false)}
                >
                  誤警報
                </button>
                {e.userConfirmed !== null && (
                  <button
                    style={{ fontSize: "11px", padding: "3px 8px" }}
                    onClick={() => onConfirm(e.id, null)}
                  >
                    未回答に戻す
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
