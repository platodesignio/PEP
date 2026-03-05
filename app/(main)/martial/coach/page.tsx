"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/app/components/LocaleProvider";

interface StudentExecution {
  id: string;
  startedAt: string;
  endedAt: string | null;
  tciScore: number | null;
  place: { name: string } | null;
  routine: { name: string } | null;
}

interface Student {
  id: string;
  email: string;
  createdAt: string;
  executions: StudentExecution[];
  _count: { executions: number };
}

export default function CoachPage() {
  const { t } = useLocale();
  const m = t.martial;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/martial/coach/students")
      .then(async (r) => {
        if (!r.ok) {
          const d = await r.json() as { error?: string };
          setError(d.error ?? "Error");
          return;
        }
        const d = await r.json() as { students: Student[] };
        setStudents(d.students);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const avgTci = (execs: StudentExecution[]) => {
    const scored = execs.filter((e) => e.tciScore !== null);
    if (scored.length === 0) return null;
    return scored.reduce((s, e) => s + (e.tciScore ?? 0), 0) / scored.length;
  };

  const tciColor = (score: number | null) => {
    if (score === null) return "var(--color-text-muted)";
    if (score >= 70) return "var(--color-success, #22c55e)";
    if (score >= 40) return "var(--color-warning, #f59e0b)";
    return "var(--color-danger, #ef4444)";
  };

  if (loading) return <div style={{ padding: "24px", fontSize: "13px", color: "var(--color-text-muted)" }}>...</div>;
  if (error) return <div style={{ padding: "24px", fontSize: "13px", color: "var(--color-danger, #ef4444)" }}>{error}</div>;

  return (
    <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>{m.coachTitle}</h1>
      <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginBottom: "24px" }}>
        {students.length} {m.students}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {students.map((s) => {
          const avg = avgTci(s.executions);
          return (
            <div key={s.id} style={{ padding: "16px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{s.email}</div>
                  <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {s._count.executions} {m.sessionCount}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "monospace", color: tciColor(avg) }}>
                    {avg?.toFixed(1) ?? "—"}
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>avg TCI</div>
                </div>
              </div>

              {/* Recent sessions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {s.executions.slice(0, 3).map((ex) => (
                  <Link
                    key={ex.id}
                    href={`/martial/results/${ex.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "var(--radius, 4px)",
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-border)",
                      textDecoration: "none",
                      color: "var(--color-text)",
                      fontSize: "12px",
                    }}
                  >
                    <span>
                      {new Date(ex.startedAt).toLocaleDateString()}
                      {" — "}{ex.place?.name ?? m.noPlace} / {ex.routine?.name ?? m.noRoutine}
                    </span>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: tciColor(ex.tciScore) }}>
                      {ex.tciScore?.toFixed(1) ?? "—"}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        {students.length === 0 && (
          <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{m.noStudents}</p>
        )}
      </div>
    </div>
  );
}
