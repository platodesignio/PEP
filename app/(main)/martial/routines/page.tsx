"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";

interface Routine {
  id: string;
  name: string;
  descJson: string;
  targetSec: number;
  phasesJson: string;
  createdAt: string;
}

export default function RoutinesPage() {
  const { t } = useLocale();
  const m = t.martial;

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [targetMin, setTargetMin] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadRoutines() {
    const r = await fetch("/api/martial/routines");
    if (r.ok) { const d = await r.json(); setRoutines(d.routines ?? []); }
  }

  useEffect(() => { loadRoutines().catch(() => {}); }, []);

  async function handleSave() {
    if (!name) { setError(m.nameRequired); return; }
    setSaving(true);
    setError("");
    const r = await fetch("/api/martial/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, descJson: JSON.stringify({ desc }), targetSec: targetMin * 60 }),
    });
    setSaving(false);
    if (r.ok) {
      setName(""); setDesc(""); setTargetMin(5);
      await loadRoutines();
    } else {
      const d = await r.json() as { error?: string };
      setError(d.error ?? "Error");
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/martial/routines/${id}`, { method: "DELETE" });
    await loadRoutines();
  }

  return (
    <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>{m.manageRoutines}</h1>

      {/* Add form */}
      <div style={{ padding: "16px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>{m.addRoutine}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={m.routineName}
            style={{ padding: "6px 10px", borderRadius: "var(--radius, 4px)", border: "1px solid var(--color-border)", fontSize: "13px", background: "var(--color-bg)", color: "var(--color-text)" }}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={m.routineDesc}
            rows={3}
            style={{ padding: "6px 10px", borderRadius: "var(--radius, 4px)", border: "1px solid var(--color-border)", fontSize: "13px", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical" }}
          />
          <label style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {m.targetDuration}: {targetMin}{m.min}
            <input type="range" min={1} max={60} step={1} value={targetMin}
              onChange={(e) => setTargetMin(parseInt(e.target.value))}
              style={{ accentColor: "var(--color-accent)" }} />
          </label>
          {error && <p style={{ fontSize: "12px", color: "var(--color-danger, #ef4444)" }}>{error}</p>}
          <button onClick={handleSave} disabled={saving} style={{ fontSize: "13px", padding: "8px 16px", fontWeight: 600 }}>
            {saving ? "..." : m.save}
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {routines.length === 0 && <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{m.noRoutines}</p>}
        {routines.map((r) => {
          const desc2 = (() => { try { return (JSON.parse(r.descJson) as { desc?: string }).desc ?? ""; } catch { return ""; } })();
          return (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>{r.name}</div>
                {desc2 && <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "2px" }}>{desc2}</div>}
                <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{Math.round(r.targetSec / 60)}{m.min}</div>
              </div>
              <button onClick={() => handleDelete(r.id)} style={{ fontSize: "11px", padding: "4px 8px", color: "var(--color-danger, #ef4444)" }}>
                {m.delete}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
