"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";

interface ExecutionSummary {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tciScore: number | null;
  place: { name: string } | null;
  routine: { name: string } | null;
}

export default function MartialDashboard() {
  const { t } = useLocale();
  const m = t.martial;

  const [executions, setExecutions] = useState<ExecutionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/martial/executions?limit=5")
      .then((r) => r.json())
      .then((d) => { setExecutions(d.executions ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const tciColor = (score: number | null) => {
    if (score === null) return "var(--color-text-muted)";
    if (score >= 70) return "var(--color-success, #22c55e)";
    if (score >= 40) return "var(--color-warning, #f59e0b)";
    return "var(--color-danger, #ef4444)";
  };

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "4px" }}>{m.title}</h1>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "24px" }}>{m.subtitle}</p>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", marginBottom: "32px" }}>
        {[
          { href: "/martial/training", label: m.startTraining, accent: true },
          { href: "/martial/places",   label: m.managePlaces },
          { href: "/martial/routines", label: m.manageRoutines },
          { href: "/martial/history",  label: m.history },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "block",
              padding: "14px 16px",
              borderRadius: "var(--radius, 4px)",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
              background: item.accent ? "var(--color-accent)" : "var(--color-surface)",
              color:      item.accent ? "var(--color-bg)"     : "var(--color-text)",
              border: "1px solid var(--color-border)",
            }}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Recent executions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <h2 style={{ fontSize: "14px", fontWeight: 600 }}>{m.recentSessions} ({total})</h2>
        <Link href="/martial/history" style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{m.seeAll}</Link>
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>...</p>
      ) : executions.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{m.noSessions}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {date}{dur != null ? ` · ${dur}${m.min}` : ""}
                  </div>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 700, color: tciColor(ex.tciScore), fontFamily: "monospace" }}>
                  {ex.tciScore != null ? ex.tciScore.toFixed(1) : "—"}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
