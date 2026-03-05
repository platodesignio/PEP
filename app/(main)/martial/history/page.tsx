"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";

interface ExecutionSummary {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tciScore: number | null;
  inRange: boolean;
  place: { id: string; name: string } | null;
  routine: { id: string; name: string } | null;
}

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const { t } = useLocale();
  const m = t.martial;

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function loadPage(o: number) {
    setLoading(true);
    const r = await fetch(`/api/martial/executions?limit=${PAGE_SIZE}&offset=${o}`);
    if (r.ok) {
      const d = await r.json() as { executions: ExecutionSummary[]; total: number };
      setExecutions(d.executions);
      setTotal(d.total);
      setOffset(o);
    }
    setLoading(false);
  }

  useEffect(() => { loadPage(0).catch(() => {}); }, []);

  // Draw TCI trend chart
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || executions.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const scored = executions.filter((e) => e.tciScore !== null).reverse();
    if (scored.length < 2) return;

    const scores = scored.map((e) => e.tciScore as number);
    const minS = Math.min(...scores);
    const maxS = Math.max(...scores);
    const range = maxS - minS || 1;
    const padX = 24, padY = 12;
    const W2 = W - padX * 2;
    const H2 = H - padY * 2;

    // Grid
    ctx.strokeStyle = "var(--color-border, #e5e7eb)";
    ctx.lineWidth = 0.5;
    for (let v = 0; v <= 100; v += 25) {
      const y = padY + H2 * (1 - v / 100);
      ctx.beginPath(); ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
      ctx.fillStyle = "var(--color-text-muted, #6b7280)";
      ctx.font = "9px monospace";
      ctx.textAlign = "right";
      ctx.fillText(String(v), padX - 4, y + 3);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = "#6366f1";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    scored.forEach((ex, i) => {
      const x = padX + (i / (scored.length - 1)) * W2;
      const y = padY + H2 * (1 - (ex.tciScore! - minS) / range);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    scored.forEach((ex, i) => {
      const x = padX + (i / (scored.length - 1)) * W2;
      const y = padY + H2 * (1 - (ex.tciScore! - minS) / range);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
    });
  }, [executions]);

  const tciColor = (score: number | null) => {
    if (score === null) return "var(--color-text-muted)";
    if (score >= 70) return "var(--color-success, #22c55e)";
    if (score >= 40) return "var(--color-warning, #f59e0b)";
    return "var(--color-danger, #ef4444)";
  };

  return (
    <div style={{ padding: "24px", maxWidth: "700px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>{m.historyTitle} ({total})</h1>

      {/* Trend chart */}
      {executions.some((e) => e.tciScore !== null) && (
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>{m.tciTrend}</h2>
          <canvas ref={canvasRef} width={640} height={120} style={{ width: "100%", display: "block", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)" }} />
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>...</p>
      ) : executions.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{m.noSessions}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {executions.map((ex) => {
            const date = new Date(ex.startedAt).toLocaleString();
            const dur = ex.endedAt
              ? Math.round((new Date(ex.endedAt).getTime() - new Date(ex.startedAt).getTime()) / 60000)
              : null;
            return (
              <Link
                key={ex.id}
                href={`/martial/results/${ex.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: "var(--radius, 4px)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  textDecoration: "none",
                  color: "var(--color-text)",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>
                    {ex.place?.name ?? m.noPlace} / {ex.routine?.name ?? m.noRoutine}
                    {!ex.inRange && <span style={{ marginLeft: "6px", fontSize: "10px", color: "var(--color-danger, #ef4444)" }}>⚠️ out</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {date}{dur != null ? ` · ${dur}${m.min}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, fontFamily: "monospace", color: tciColor(ex.tciScore) }}>
                  {ex.tciScore?.toFixed(1) ?? "—"}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: "flex", gap: "8px", marginTop: "16px", justifyContent: "center" }}>
          <button onClick={() => loadPage(offset - PAGE_SIZE)} disabled={offset === 0 || loading} style={{ fontSize: "12px", padding: "4px 10px" }}>
            ← {m.prev}
          </button>
          <span style={{ fontSize: "12px", color: "var(--color-text-muted)", alignSelf: "center" }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}
          </span>
          <button onClick={() => loadPage(offset + PAGE_SIZE)} disabled={offset + PAGE_SIZE >= total || loading} style={{ fontSize: "12px", padding: "4px 10px" }}>
            {m.next} →
          </button>
        </div>
      )}
    </div>
  );
}
