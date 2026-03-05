"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";
import type { ExecutionMetrics } from "@/lib/martial/types";

interface Execution {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tciScore: number | null;
  metricsJson: string;
  coachNoteJson: string;
  inRange: boolean;
  place: { name: string } | null;
  routine: { name: string; targetSec: number } | null;
  _count: { motionSamples: number; hrvSamples: number };
}

export default function ResultsPage() {
  const { execId } = useParams<{ execId: string }>();
  const { t, locale } = useLocale();
  const m = t.martial;

  const [exec, setExec] = useState<Execution | null>(null);
  const [metrics, setMetrics] = useState<ExecutionMetrics | null>(null);
  const [coachAdvice, setCoachAdvice] = useState<string>("");
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [coachError, setCoachError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch(`/api/martial/executions/${execId}`)
      .then((r) => r.json())
      .then((d: Execution) => {
        setExec(d);
        try {
          setMetrics(JSON.parse(d.metricsJson) as ExecutionMetrics);
        } catch { /* no metrics yet */ }
        try {
          const note = JSON.parse(d.coachNoteJson) as { advice?: string };
          if (note.advice) setCoachAdvice(note.advice);
        } catch { /* no advice yet */ }
      })
      .catch(() => {});
  }, [execId]);

  // Draw component radar
  useEffect(() => {
    if (!metrics || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) * 0.38;
    const comps = [
      metrics.bodyStabilityMean,
      metrics.respRegularityMean,
      metrics.ansBalanceMean,
      metrics.motorErrorMean,
      metrics.attentionPersistenceMean,
    ];
    const labels = [m.bodyStability, m.respRegularity, m.ansBalance, m.motorError, m.attentionPersistence];
    const n = comps.length;

    // Grid circles
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * i / 4, 0, Math.PI * 2);
      ctx.strokeStyle = "var(--color-border, #e5e7eb)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Axes
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
      ctx.strokeStyle = "var(--color-border, #e5e7eb)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Data polygon
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const v = comps[i] ?? 0;
      const x = cx + r * v * Math.cos(angle);
      const y = cy + r * v * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(99, 102, 241, 0.2)";
    ctx.fill();
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Labels
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "var(--color-text-muted, #6b7280)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = cx + (r + 24) * Math.cos(angle);
      const y = cy + (r + 24) * Math.sin(angle);
      ctx.fillText(labels[i], x, y);
    }
  }, [metrics, m]);

  async function requestCoach() {
    setLoadingCoach(true);
    setCoachError("");
    const r = await fetch(`/api/martial/executions/${execId}/coach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
    setLoadingCoach(false);
    if (r.ok) {
      const d = await r.json() as { advice: string };
      setCoachAdvice(d.advice);
    } else {
      const d = await r.json() as { error?: string };
      setCoachError(d.error ?? "Error");
    }
  }

  if (!exec) return <div style={{ padding: "24px", fontSize: "13px", color: "var(--color-text-muted)" }}>...</div>;

  const dur = exec.endedAt
    ? Math.round((new Date(exec.endedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)
    : null;

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ fontSize: "18px", fontWeight: 700 }}>{m.resultsTitle}</h1>
        <Link href="/martial" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{m.back}</Link>
      </div>

      {/* Header stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "TCI", value: exec.tciScore?.toFixed(1) ?? "—" },
          { label: m.duration, value: dur != null ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, "0")}` : "—" },
          { label: m.samples, value: String(exec._count.motionSamples) },
        ].map(({ label, value }) => (
          <div key={label} style={{ padding: "12px", textAlign: "center", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)" }}>
            <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Place / Routine */}
      <div style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "20px" }}>
        📍 {exec.place?.name ?? m.noPlace} &nbsp;·&nbsp; 📋 {exec.routine?.name ?? m.noRoutine}
        {!exec.inRange && <span style={{ marginLeft: "8px", color: "var(--color-danger, #ef4444)" }}>⚠️ {m.outOfRange}</span>}
      </div>

      {/* Radar */}
      {metrics && (
        <>
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>{m.componentRadar}</h2>
          <canvas ref={canvasRef} width={320} height={320} style={{ width: "100%", maxWidth: "320px", display: "block", margin: "0 auto 24px" }} />
        </>
      )}

      {/* TCI breakdown */}
      {metrics && (
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>{m.tciBreakdown}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {([
              [m.bodyStability,        metrics.bodyStabilityMean],
              [m.respRegularity,       metrics.respRegularityMean],
              [m.ansBalance,           metrics.ansBalanceMean],
              [m.motorError,           metrics.motorErrorMean],
              [m.attentionPersistence, metrics.attentionPersistenceMean],
            ] as [string, number][]).map(([label, val]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", width: "140px", flexShrink: 0 }}>{label}</span>
                <div style={{ flex: 1, height: "8px", background: "var(--color-border)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${(val * 100).toFixed(0)}%`, height: "100%", background: "#6366f1", borderRadius: "4px" }} />
                </div>
                <span style={{ fontSize: "12px", fontFamily: "monospace", width: "36px", textAlign: "right" }}>{(val * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Coach */}
      <div style={{ padding: "16px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600, marginBottom: "10px" }}>🥋 {m.aiCoach}</h2>
        {coachAdvice ? (
          <pre style={{ fontSize: "13px", whiteSpace: "pre-wrap", fontFamily: "inherit", lineHeight: 1.6 }}>{coachAdvice}</pre>
        ) : (
          <>
            {coachError && <p style={{ fontSize: "12px", color: "var(--color-danger, #ef4444)", marginBottom: "8px" }}>{coachError}</p>}
            <button onClick={requestCoach} disabled={loadingCoach} style={{ fontSize: "13px", padding: "8px 16px" }}>
              {loadingCoach ? "..." : m.requestCoachAnalysis}
            </button>
            <p style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "6px" }}>{m.requiresOpenAI}</p>
          </>
        )}
      </div>
    </div>
  );
}
