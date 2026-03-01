"use client";

import { useEffect, useState } from "react";
import type { DetectedIntervention } from "@/lib/event/types";

interface Props {
  intervention: DetectedIntervention | null;
  onRate: (rating: "USEFUL" | "USELESS" | "FALSE_ALARM") => void;
  onDismiss: () => void;
}

const LABELS: Record<string, string> = {
  BREATH_GUIDE: "深呼吸",
  UI_MICRO_CHANGE: "画面休憩",
  TIMER_START: "タイマー",
  SCREEN_TIDY: "画面整理",
};

const MESSAGES: Record<string, string> = {
  BREATH_GUIDE: "ゆっくり深呼吸してみましょう",
  UI_MICRO_CHANGE: "少し目を休めましょう",
  TIMER_START: "短い休憩を取りましょう",
  SCREEN_TIDY: "作業スペースを整理しましょう",
};

export default function InterventionOverlay({ intervention, onRate, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (!intervention) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setCountdown(30);

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [intervention, onDismiss]);

  if (!visible || !intervention) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        width: "280px",
        background: "var(--color-bg)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius)",
        padding: "16px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        zIndex: 200,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600 }}>
          {LABELS[intervention.kind] ?? intervention.kind}
        </span>
        <span className="muted">{countdown}s</span>
      </div>
      <p style={{ fontSize: "13px", marginBottom: "12px" }}>
        {MESSAGES[intervention.kind] ?? "しばらく休憩しましょう"}
      </p>
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          style={{ fontSize: "11px", padding: "4px 8px" }}
          onClick={() => { onRate("USEFUL"); onDismiss(); }}
        >
          有用
        </button>
        <button
          style={{ fontSize: "11px", padding: "4px 8px" }}
          onClick={() => { onRate("USELESS"); onDismiss(); }}
        >
          無用
        </button>
        <button
          style={{ fontSize: "11px", padding: "4px 8px" }}
          onClick={() => { onRate("FALSE_ALARM"); onDismiss(); }}
        >
          誤警報
        </button>
      </div>
    </div>
  );
}
