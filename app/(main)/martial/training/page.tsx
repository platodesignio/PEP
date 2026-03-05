"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/app/components/LocaleProvider";
import type { MotionWorkerIn, MotionWorkerOut } from "@/lib/martial/types";
import type { TciResult, MotionWindow } from "@/lib/martial/types";

interface Place { id: string; name: string; lat: number; lng: number; radiusM: number; }
interface Routine { id: string; name: string; targetSec: number; }

const SAVE_INTERVAL_MS = 5000;

export default function TrainingPage() {
  const { t } = useLocale();
  const m = t.martial;
  const router = useRouter();

  const [places, setPlaces] = useState<Place[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);

  const [running, setRunning] = useState(false);
  const [execId, setExecId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [inRange, setInRange] = useState<boolean | null>(null);
  const [geoMsg, setGeoMsg] = useState("");

  const [tci, setTci] = useState<TciResult | null>(null);
  const [coachHint, setCoachHint] = useState<string>("");
  const [hintKey, setHintKey] = useState(0);

  // ── Camera state ─────────────────────────────────────────────────────────
  const [cameraOn, setCameraOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraDenied, setCameraDenied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pendingWindowsRef = useRef<MotionWindow[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const motionHandlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const tciHistoryRef = useRef<TciResult[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/martial/places").then((r) => r.json()),
      fetch("/api/martial/routines").then((r) => r.json()),
    ]).then(([pd, rd]) => {
      setPlaces(pd.places ?? []);
      setRoutines(rd.routines ?? []);
    }).catch(() => {});
  }, []);

  // ── Camera helpers ────────────────────────────────────────────────────────

  async function startCamera(facing: "user" | "environment") {
    // Stop previous stream first
    stopCamera();
    setCameraDenied(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch {
      setCameraDenied(true);
      setCameraOn(false);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function toggleCamera() {
    if (cameraOn) {
      stopCamera();
    } else {
      await startCamera(facingMode);
    }
  }

  async function switchFacing() {
    const next = facingMode === "user" ? "environment" : "user";
    setFacingMode(next);
    if (cameraOn) await startCamera(next);
  }

  // Cleanup camera on unmount
  useEffect(() => () => stopCamera(), []);

  // ── TCI gauge draw ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const score = tci?.score ?? 0;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H * 0.65, r = Math.min(W, H) * 0.38;
    const startAngle = Math.PI * 0.75;
    const endAngle   = Math.PI * 2.25;
    const scoreAngle = startAngle + (score / 100) * (endAngle - startAngle);

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.strokeStyle = "var(--color-border, #e5e7eb)";
    ctx.lineWidth = 12; ctx.lineCap = "round";
    ctx.stroke();

    const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, scoreAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 12; ctx.lineCap = "round";
    ctx.stroke();

    ctx.fillStyle = "var(--color-text, #0a0a0a)";
    ctx.font = `bold ${Math.floor(r * 0.55)}px monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(score.toFixed(1), cx, cy);

    ctx.font = `${Math.floor(r * 0.18)}px sans-serif`;
    ctx.fillStyle = "var(--color-text-muted, #6b7280)";
    ctx.fillText("TCI", cx, cy + r * 0.45);

    if (tci) {
      const comps = tci.components;
      const labels: [string, number][] = [
        [m.bodyStability,        comps.bodyStability],
        [m.respRegularity,       comps.respRegularity],
        [m.ansBalance,           comps.ansBalance],
        [m.motorError,           comps.motorErrorCorrection],
        [m.attentionPersistence, comps.attentionPersistence],
      ];
      const barY0 = cy + r * 0.65;
      const barW = W - 32;
      const barH = 8;
      const gap = 16;
      ctx.font = "10px sans-serif";
      labels.forEach(([label, val], i) => {
        const y = barY0 + i * (barH + gap);
        ctx.fillStyle = "var(--color-text-muted, #6b7280)";
        ctx.textAlign = "left";
        ctx.fillText(label, 16, y - 1);
        ctx.fillStyle = "var(--color-border, #e5e7eb)";
        ctx.fillRect(16, y + 2, barW, barH);
        ctx.fillStyle = color;
        ctx.fillRect(16, y + 2, barW * val, barH);
      });
    }
  }, [tci, m]);

  // ── Geofence ─────────────────────────────────────────────────────────────

  const checkGeofence = useCallback(async (place: Place): Promise<boolean> => {
    setGeoMsg(m.detecting);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const dLat = pos.coords.latitude - place.lat;
          const dLng = pos.coords.longitude - place.lng;
          const dist = Math.sqrt(dLat * dLat + dLng * dLng) * 111320;
          const ok = dist <= place.radiusM;
          setInRange(ok);
          setGeoMsg(ok ? `✅ ${m.inRange} (${dist.toFixed(0)}m)` : `⚠️ ${m.outOfRange} (${dist.toFixed(0)}m)`);
          resolve(ok);
        },
        () => { setGeoMsg(m.geoDenied); setInRange(null); resolve(true); },
        { timeout: 8000 }
      );
    });
  }, [m]);

  // ── Motion batch save ─────────────────────────────────────────────────────

  const flushMotionBatch = useCallback(async (id: string) => {
    const windows = pendingWindowsRef.current.splice(0);
    if (windows.length === 0 || !id) return;
    const samples = windows.map((w) => ({ t: w.t, ax: w.rmsMag, ay: 0, az: 0, tci: w.tci }));
    await fetch(`/api/martial/executions/${id}/motion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samples }),
    }).catch(() => {});
  }, []);

  // ── Start training ────────────────────────────────────────────────────────

  async function start() {
    let rangeOk = true;
    if (selectedPlace) rangeOk = await checkGeofence(selectedPlace);

    if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === "function") {
      const perm = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      if (perm !== "granted") return;
    }

    const r = await fetch("/api/martial/executions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: selectedPlace?.id, routineId: selectedRoutine?.id, inRange: rangeOk }),
    });
    if (!r.ok) return;
    const { id } = await r.json() as { id: string };
    setExecId(id);

    const worker = new Worker(new URL("@/app/workers/motion.worker.ts", import.meta.url));
    workerRef.current = worker;
    worker.postMessage({ type: "reset" } satisfies MotionWorkerIn);

    worker.onmessage = (e: MessageEvent<MotionWorkerOut>) => {
      const { tci: newTci, window, coachHint: hint } = e.data;
      setTci(newTci);
      tciHistoryRef.current.push(newTci);
      pendingWindowsRef.current.push({ ...window, tci: newTci.score });
      if (hint) { setCoachHint(hint); setHintKey((k) => k + 1); }
    };

    const t0 = Date.now();
    startTimeRef.current = t0;
    const handler = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const sample: MotionWorkerIn = {
        type: "sample",
        sample: { t: (Date.now() - t0) / 1000, ax: a.x ?? 0, ay: a.y ?? 0, az: a.z ?? 0 },
      };
      worker.postMessage(sample);
    };
    motionHandlerRef.current = handler;
    window.addEventListener("devicemotion", handler);

    timerRef.current    = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    saveTimerRef.current = setInterval(() => flushMotionBatch(id), SAVE_INTERVAL_MS);

    setRunning(true);
  }

  // ── Stop training ─────────────────────────────────────────────────────────

  async function stop() {
    if (!execId) return;

    if (timerRef.current) clearInterval(timerRef.current);
    if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    if (motionHandlerRef.current) window.removeEventListener("devicemotion", motionHandlerRef.current);
    workerRef.current?.terminate();
    await flushMotionBatch(execId);

    // Stop camera
    stopCamera();

    const history = tciHistoryRef.current;
    const scores = history.map((h) => h.score);
    const mean = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;
    function avg(arr: number[]) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }

    const metrics = {
      tciMean: mean,
      tciMin: scores.length ? Math.min(...scores) : 0,
      tciMax: scores.length ? Math.max(...scores) : 0,
      bodyStabilityMean:      avg(history.map((h) => h.components.bodyStability)),
      respRegularityMean:     avg(history.map((h) => h.components.respRegularity)),
      ansBalanceMean:         avg(history.map((h) => h.components.ansBalance)),
      motorErrorMean:         avg(history.map((h) => h.components.motorErrorCorrection)),
      attentionPersistenceMean: avg(history.map((h) => h.components.attentionPersistence)),
      motionSampleCount: history.length,
      hrvSampleCount: 0,
      durationSec: elapsed,
    };

    await fetch(`/api/martial/executions/${execId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tciScore: mean, metricsJson: JSON.stringify(metrics) }),
    });

    setRunning(false);
    router.push(`/martial/results/${execId}`);
  }

  const fmtTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px", maxWidth: "480px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "20px" }}>{m.trainingTitle}</h1>

      {/* ── Setup (before start) ── */}
      {!running && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "24px" }}>
          <label style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {m.selectPlace}
            <select
              value={selectedPlace?.id ?? ""}
              onChange={(e) => setSelectedPlace(places.find((p) => p.id === e.target.value) ?? null)}
              style={{ padding: "6px 10px", borderRadius: "var(--radius, 4px)", border: "1px solid var(--color-border)", fontSize: "13px", background: "var(--color-bg)", color: "var(--color-text)" }}
            >
              <option value="">{m.noPlace}</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label style={{ fontSize: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
            {m.selectRoutine}
            <select
              value={selectedRoutine?.id ?? ""}
              onChange={(e) => setSelectedRoutine(routines.find((r) => r.id === e.target.value) ?? null)}
              style={{ padding: "6px 10px", borderRadius: "var(--radius, 4px)", border: "1px solid var(--color-border)", fontSize: "13px", background: "var(--color-bg)", color: "var(--color-text)" }}
            >
              <option value="">{m.noRoutine}</option>
              {routines.map((r) => <option key={r.id} value={r.id}>{r.name} ({Math.round(r.targetSec / 60)}{m.min})</option>)}
            </select>
          </label>

          {/* Camera toggle in setup */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={toggleCamera} style={{ fontSize: "12px", padding: "6px 12px", flex: 1 }}>
              {cameraOn ? m.cameraOff : m.cameraOn}
            </button>
            {cameraOn && (
              <button onClick={switchFacing} style={{ fontSize: "12px", padding: "6px 12px" }}>
                {m.switchCamera}
              </button>
            )}
          </div>
          {cameraDenied && <p style={{ fontSize: "11px", color: "var(--color-danger, #ef4444)" }}>{m.cameraDenied}</p>}

          {/* Camera preview in setup */}
          {cameraOn && (
            <div style={{ position: "relative", width: "100%", aspectRatio: "4/3", background: "#000", borderRadius: "var(--radius, 4px)", overflow: "hidden" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none",
                }}
              />
            </div>
          )}

          {geoMsg && <p style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>{geoMsg}</p>}
          <button onClick={start} style={{ padding: "12px", fontSize: "14px", fontWeight: 700 }}>
            {m.startTraining}
          </button>
        </div>
      )}

      {/* ── Running ── */}
      {running && (
        <>
          {/* Elapsed */}
          <div style={{ textAlign: "center", fontSize: "32px", fontFamily: "monospace", fontWeight: 700, marginBottom: "16px" }}>
            {fmtTime(elapsed)}
          </div>

          {/* Camera PiP overlay */}
          {cameraOn && (
            <div style={{
              position: "fixed",
              top: "60px",
              right: "12px",
              width: "120px",
              height: "90px",
              background: "#000",
              borderRadius: "8px",
              overflow: "hidden",
              border: "2px solid var(--color-border)",
              zIndex: 200,
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: "100%", height: "100%", objectFit: "cover",
                  transform: facingMode === "user" ? "scaleX(-1)" : "none",
                }}
              />
            </div>
          )}

          {/* Camera + switch buttons during training */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button onClick={toggleCamera} style={{ fontSize: "11px", padding: "4px 10px" }}>
              {cameraOn ? m.cameraOff : m.cameraOn}
            </button>
            {cameraOn && (
              <button onClick={switchFacing} style={{ fontSize: "11px", padding: "4px 10px" }}>
                {m.switchCamera}
              </button>
            )}
          </div>

          {/* TCI gauge */}
          <canvas
            ref={canvasRef}
            width={400}
            height={340}
            style={{ width: "100%", display: "block" }}
          />

          {/* Coach hint */}
          {coachHint && (
            <div
              key={hintKey}
              style={{
                marginTop: "12px",
                padding: "10px 14px",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius, 4px)",
                fontSize: "13px",
                color: "var(--color-text)",
                animation: "fadeIn 0.4s ease",
              }}
            >
              🥋 {coachHint}
            </div>
          )}

          {/* Geo status */}
          {geoMsg && (
            <p style={{ fontSize: "11px", color: inRange === false ? "var(--color-danger, #ef4444)" : "var(--color-text-muted)", marginTop: "8px" }}>
              {geoMsg}
            </p>
          )}

          <button
            onClick={stop}
            style={{ marginTop: "20px", padding: "12px", fontSize: "14px", fontWeight: 700, width: "100%", background: "var(--color-danger, #ef4444)", color: "#fff", border: "none", borderRadius: "var(--radius, 4px)", cursor: "pointer" }}
          >
            {m.stopTraining}
          </button>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
      `}</style>
    </div>
  );
}
