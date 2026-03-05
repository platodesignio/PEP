"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/app/components/LocaleProvider";

interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusM: number;
  createdAt: string;
}

export default function PlacesPage() {
  const { t } = useLocale();
  const m = t.martial;

  const [places, setPlaces] = useState<Place[]>([]);
  const [name, setName] = useState("");
  const [radiusM, setRadiusM] = useState(50);
  const [geoStatus, setGeoStatus] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadPlaces() {
    const r = await fetch("/api/martial/places");
    if (r.ok) { const d = await r.json(); setPlaces(d.places ?? []); }
  }

  useEffect(() => { loadPlaces().catch(() => {}); }, []);

  async function detectLocation() {
    setGeoStatus(m.detecting);
    if (!navigator.geolocation) { setGeoStatus(m.geoUnavailable); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
      },
      () => setGeoStatus(m.geoDenied),
      { timeout: 8000 }
    );
  }

  async function handleSave() {
    if (!name) { setError(m.nameRequired); return; }
    if (!coords) { setError(m.locationRequired); return; }
    setSaving(true);
    setError("");
    const r = await fetch("/api/martial/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, lat: coords.lat, lng: coords.lng, radiusM }),
    });
    setSaving(false);
    if (r.ok) {
      setName(""); setCoords(null); setGeoStatus("");
      await loadPlaces();
    } else {
      const d = await r.json() as { error?: string };
      setError(d.error ?? "Error");
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/martial/places/${id}`, { method: "DELETE" });
    await loadPlaces();
  }

  return (
    <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>{m.managePlaces}</h1>

      {/* Add form */}
      <div style={{ padding: "16px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)", marginBottom: "24px" }}>
        <h2 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>{m.addPlace}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={m.placeName}
            style={{ padding: "6px 10px", borderRadius: "var(--radius, 4px)", border: "1px solid var(--color-border)", fontSize: "13px", background: "var(--color-bg)", color: "var(--color-text)" }}
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button onClick={detectLocation} style={{ fontSize: "12px", padding: "6px 12px" }}>
              📍 {m.detectLocation}
            </button>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{geoStatus}</span>
          </div>
          <label style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {m.radius}: {radiusM}m
            <input type="range" min={10} max={500} step={10} value={radiusM}
              onChange={(e) => setRadiusM(parseInt(e.target.value))}
              style={{ accentColor: "var(--color-accent)" }} />
          </label>
          {error && <p style={{ fontSize: "12px", color: "var(--color-danger, #ef4444)" }}>{error}</p>}
          <button onClick={handleSave} disabled={saving} style={{ fontSize: "13px", padding: "8px 16px", fontWeight: 600 }}>
            {saving ? "..." : m.save}
          </button>
        </div>
      </div>

      {/* Place list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {places.length === 0 && <p style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>{m.noPlaces}</p>}
        {places.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius, 4px)" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{p.name}</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                {p.lat.toFixed(5)}, {p.lng.toFixed(5)} · r={p.radiusM}m
              </div>
            </div>
            <button onClick={() => handleDelete(p.id)} style={{ fontSize: "11px", padding: "4px 8px", color: "var(--color-danger, #ef4444)" }}>
              {m.delete}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
