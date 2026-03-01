"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import MetricsDisplay from "@/app/components/MetricsDisplay";
import EventTimeline from "@/app/components/EventTimeline";
import InterventionOverlay from "@/app/components/InterventionOverlay";
import PermissionStatus from "@/app/components/PermissionStatus";
import FeedbackButton from "@/app/components/FeedbackButton";
import { getDefaultDetectionConfig } from "@/lib/event/definitions";
import type { DetectedEvent, DetectedIntervention, WorkerOutMessage, FeatureBundle } from "@/lib/event/types";

interface LiveEvent {
  id: string;
  t0: number;
  t1: number;
  type: string;
  confidence: number;
  userConfirmed: boolean | null;
  featuresSummary: Record<string, number>;
  baselineSummary: Record<string, number>;
}

interface PendingIntervention extends DetectedIntervention {
  tempId: string;
}

const BATCH_INTERVAL_MS = 30000;
const FEATURE_SAMPLE_INTERVAL_MS = 100;
const VIDEO_SAMPLE_INTERVAL_MS = 200;

export default function LiveSessionPage() {
  const params = useParams<{ runId: string }>();
  const router = useRouter();
  const runId = params.runId;

  const [sessionStartTime] = useState(() => Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [currentIntervention, setCurrentIntervention] = useState<DetectedIntervention | null>(null);
  const [metrics, setMetrics] = useState({ rms: 0, motionQty: 0, inputVariance: 0, eventCount: 0, sessionElapsedSec: 0 });
  const [permissionState, setPermissionState] = useState({
    microphone: "prompt" as "granted" | "denied" | "prompt" | "unavailable",
    camera: "prompt" as "granted" | "denied" | "prompt" | "unavailable",
    keyboard: "active" as "active" | "unavailable",
    mouse: "active" as "active" | "unavailable",
  });
  const [ended, setEnded] = useState(false);
  const [ending, setEnding] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<unknown[]>([]);

  const workerRef = useRef<Worker | null>(null);
  const pendingEventsRef = useRef<DetectedEvent[]>([]);
  const pendingInterventionsRef = useRef<PendingIntervention[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef = useRef<Uint8Array | null>(null);
  const keyTimesRef = useRef<number[]>([]);
  const mouseSpeedsRef = useRef<number[]>([]);
  const lastMouseRef = useRef({ x: 0, y: 0, time: 0 });
  const lastInputRef = useRef(Date.now());
  const featureSamplesRef = useRef<Array<Record<string, number>>>([]);

  const reportError = useCallback(async (message: string) => {
    await fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId, message: message.slice(0, 1000) }),
    }).catch(() => {});
  }, [runId]);

  const sendBatch = useCallback(async (evs: DetectedEvent[], ivs: PendingIntervention[]) => {
    if (evs.length === 0 && ivs.length === 0) return;

    const send = async () => {
      if (evs.length > 0) {
        await fetch(`/api/sessions/${runId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            events: evs.map((e) => ({
              t0: e.t0,
              t1: e.t1,
              type: e.type,
              confidence: e.confidence,
              baselineDeviation: e.baselineDeviation,
              featuresSummaryJson: JSON.stringify(e.featuresSummary),
              baselineSummaryJson: JSON.stringify(e.baselineSummary),
            })),
          }),
        });
      }

      for (const iv of ivs) {
        await fetch(`/api/sessions/${runId}/interventions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: iv.kind,
            firedAt: iv.firedAt,
            metaJson: JSON.stringify({ reason: iv.reason }),
          }),
        });
      }
    };

    if (!navigator.onLine) {
      const entry = JSON.stringify({ runId, evs, ivs });
      setOfflineQueue((q) => [...q, entry]);
      return;
    }

    try {
      await send();
    } catch {
      setOfflineQueue((q) => [...q, JSON.stringify({ runId, evs, ivs })]);
    }
  }, [runId]);

  const drainOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    const queue = [...offlineQueue];
    setOfflineQueue([]);
    for (const item of queue) {
      try {
        const { runId: qRunId, evs, ivs } = JSON.parse(item as string) as {
          runId: string;
          evs: DetectedEvent[];
          ivs: PendingIntervention[];
        };
        if (qRunId === runId) await sendBatch(evs, ivs);
      } catch {
        // discard malformed entries
      }
    }
  }, [offlineQueue, runId, sendBatch]);

  useEffect(() => {
    const handler = () => drainOfflineQueue();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [drainOfflineQueue]);

  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("@/app/workers/event-detector.worker.ts", import.meta.url)
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
        const msg = e.data;
        if (msg.type === "event" && msg.event) {
          const ev = msg.event;
          const liveEv: LiveEvent = {
            id: `${ev.type}-${ev.t0}-${Math.random()}`,
            t0: ev.t0,
            t1: ev.t1,
            type: ev.type,
            confidence: ev.confidence,
            userConfirmed: null,
            featuresSummary: ev.featuresSummary,
            baselineSummary: ev.baselineSummary,
          };
          setEvents((prev) => [...prev, liveEv]);
          pendingEventsRef.current.push(ev);
        } else if (msg.type === "intervention" && msg.intervention) {
          const iv = msg.intervention;
          const pending: PendingIntervention = { ...iv, tempId: `${iv.kind}-${iv.firedAt}` };
          setCurrentIntervention(iv);
          pendingInterventionsRef.current.push(pending);
        }
      };

      worker.onerror = (err) => {
        reportError(`Worker error: ${err.message}`);
      };
    } catch {
      reportError("Web Worker initialization failed");
    }

    return () => {
      worker?.terminate();
      workerRef.current = null;
    };
  }, [reportError]);

  useEffect(() => {
    async function initAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        setPermissionState((p) => ({ ...p, microphone: "granted" }));
        const ctx = new AudioContext({ sampleRate: 44100 });
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;
      } catch {
        setPermissionState((p) => ({ ...p, microphone: "denied" }));
      }
    }

    async function initVideo() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
        setPermissionState((p) => ({ ...p, camera: "granted" }));
        const video = document.createElement("video");
        video.srcObject = stream;
        video.playsInline = true;
        await video.play();
        videoRef.current = video;

        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        canvasRef.current = canvas;
      } catch {
        setPermissionState((p) => ({ ...p, camera: "denied" }));
      }
    }

    initAudio();
    initVideo();

    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onKey = () => {
      keyTimesRef.current.push(Date.now());
      if (keyTimesRef.current.length > 30) keyTimesRef.current.shift();
      lastInputRef.current = Date.now();
    };

    const onMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const dt = now - lastMouseRef.current.time;
      if (dt > 0 && dt < 200) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        mouseSpeedsRef.current.push(speed);
        if (mouseSpeedsRef.current.length > 30) mouseSpeedsRef.current.shift();
      }
      lastMouseRef.current = { x: e.clientX, y: e.clientY, time: now };
      lastInputRef.current = now;
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  function computeVariance(arr: number[]): number {
    if (arr.length < 2) return 0;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  }

  function computeAudioFeatures(analyser: AnalyserNode) {
    const timeData = new Float32Array(analyser.fftSize);
    const freqData = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatTimeDomainData(timeData);
    analyser.getFloatFrequencyData(freqData);

    const rms = Math.sqrt(timeData.reduce((s, v) => s + v * v, 0) / timeData.length);

    let zeroCrossings = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i - 1] >= 0) !== (timeData[i] >= 0)) zeroCrossings++;
    }
    const zcr = zeroCrossings / timeData.length;

    let weightedSum = 0;
    let totalPower = 0;
    const nyquist = (audioCtxRef.current?.sampleRate ?? 44100) / 2;
    for (let i = 0; i < freqData.length; i++) {
      const power = Math.pow(10, freqData[i] / 10);
      const freq = (i / freqData.length) * nyquist;
      weightedSum += power * freq;
      totalPower += power;
    }
    const spectralCentroid = totalPower > 0 ? weightedSum / totalPower : 0;

    const prev = featureSamplesRef.current.slice(-1)[0]?.rms ?? rms;
    const shortTimeChangeRate = Math.abs(rms - prev);

    return { rms, zcr, spectralCentroid, spectralFlatness: 0, bandEnergyLow: 0, bandEnergyMid: 0, bandEnergyHigh: 0, shortTimeChangeRate };
  }

  function computeVideoFeatures() {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 32, 32);
    const frame = ctx.getImageData(0, 0, 32, 32);
    const gray = new Uint8Array(32 * 32);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.round(0.299 * frame.data[i * 4] + 0.587 * frame.data[i * 4 + 1] + 0.114 * frame.data[i * 4 + 2]);
    }
    const prev = prevFrameRef.current;
    prevFrameRef.current = gray;
    if (!prev) return null;

    let motionTotal = 0;
    let motionSqTotal = 0;
    for (let i = 0; i < gray.length; i++) {
      const diff = Math.abs(gray[i] - prev[i]);
      motionTotal += diff;
      motionSqTotal += diff * diff;
    }
    const motionQuantity = motionTotal / (gray.length * 255);
    const motionMean = motionTotal / gray.length;
    const motionSpatialVariance = motionSqTotal / gray.length - motionMean ** 2;
    return { motionQuantity, motionSpatialVariance, globalChangeRate: motionQuantity };
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionStartTime]);

  useEffect(() => {
    const config = getDefaultDetectionConfig();
    const interval = setInterval(() => {
      if (!workerRef.current) return;

      const analyser = analyserRef.current;
      const audioFeatures = analyser ? computeAudioFeatures(analyser) : null;
      const videoFeatures = computeVideoFeatures();

      const keyIntervals = keyTimesRef.current.slice(1).map((t, i) => t - keyTimesRef.current[i]);
      const keyIntervalVariance = computeVariance(keyIntervals);
      const mouseVelocityVariance = computeVariance(mouseSpeedsRef.current);
      const pauseDuration = (Date.now() - lastInputRef.current) / 1000;

      const inputFeatures = {
        keyIntervalVariance,
        mouseVelocityVariance,
        clickRate: 0,
        scrollRate: 0,
        pauseDuration,
      };

      const bundle: FeatureBundle = {
        timestamp: Date.now() - sessionStartTime,
        audio: audioFeatures,
        video: videoFeatures,
        input: inputFeatures,
      };

      featureSamplesRef.current.push({ rms: audioFeatures?.rms ?? 0 });
      if (featureSamplesRef.current.length > 600) featureSamplesRef.current.shift();

      workerRef.current.postMessage({ type: "features", bundle, config });

      setMetrics({
        rms: audioFeatures?.rms ?? 0,
        motionQty: videoFeatures?.motionQuantity ?? 0,
        inputVariance: Math.min(1, keyIntervalVariance / 10000),
        eventCount: pendingEventsRef.current.length,
        sessionElapsedSec: Math.floor((Date.now() - sessionStartTime) / 1000),
      });
    }, FEATURE_SAMPLE_INTERVAL_MS);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStartTime]);

  useEffect(() => {
    const sendTimer = setInterval(async () => {
      const evs = pendingEventsRef.current.splice(0);
      const ivs = pendingInterventionsRef.current.splice(0);
      await sendBatch(evs, ivs);

      if (featureSamplesRef.current.length >= 10) {
        const series = featureSamplesRef.current.map((s) => s.rms);
        featureSamplesRef.current = [];
        await fetch(`/api/sessions/${runId}/features`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "audio_rms",
            sampleRateHz: 10,
            seriesJson: JSON.stringify(series),
          }),
        }).catch(() => {});
      }
    }, BATCH_INTERVAL_MS);

    return () => clearInterval(sendTimer);
  }, [runId, sendBatch]);

  const VIDEO_INTERVAL = VIDEO_SAMPLE_INTERVAL_MS;
  useEffect(() => {
    const interval = setInterval(() => {
      computeVideoFeatures();
    }, VIDEO_INTERVAL);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function endSession() {
    setEnding(true);
    const evs = pendingEventsRef.current.splice(0);
    const ivs = pendingInterventionsRef.current.splice(0);
    await sendBatch(evs, ivs);
    await fetch(`/api/sessions/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endedAt: new Date().toISOString() }),
    });
    setEnded(true);
    router.push(`/session/${runId}/summary`);
  }

  async function confirmEvent(eventId: string, confirmed: boolean | null) {
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, userConfirmed: confirmed } : e));
  }

  function handleInterventionRate(rating: "USEFUL" | "USELESS" | "FALSE_ALARM") {
    const iv = pendingInterventionsRef.current.slice(-1)[0];
    if (iv) {
      fetch(`/api/sessions/${runId}/ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interventionId: `temp-${iv.firedAt}`, rating }),
      }).catch(() => {});
    }
  }

  if (ended) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "24px" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>計測中</h2>
            <p className="muted" style={{ fontFamily: "monospace", fontSize: "11px" }}>{runId}</p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <FeedbackButton runId={runId} />
            <button data-variant="danger" onClick={endSession} disabled={ending}>
              {ending ? "終了中..." : "セッション終了"}
            </button>
          </div>
        </div>

        <div className="card section">
          <h3 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>センサー状態</h3>
          <PermissionStatus permissions={permissionState} />
        </div>

        <div className="card section">
          <h3 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>リアルタイム指標</h3>
          <MetricsDisplay metrics={{ ...metrics, sessionElapsedSec: elapsedSec }} />
        </div>

        <div className="card">
          <h3 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>
            イベントタイムライン ({events.length}件)
          </h3>
          <EventTimeline
            events={events}
            sessionDurationSec={elapsedSec}
            onConfirm={confirmEvent}
          />
        </div>
      </div>

      <div>
        {!navigator.onLine && (
          <div
            className="card"
            style={{
              marginBottom: "12px",
              borderColor: "var(--color-warning)",
              color: "var(--color-warning)",
              fontSize: "12px",
              padding: "8px 12px",
            }}
          >
            オフラインです。データはキューに保持され復帰時に送信されます。
          </div>
        )}
        <div className="card">
          <h3 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "12px" }}>保存データについて</h3>
          <p className="muted">
            保存されるデータ: 音声RMSエネルギー 動き量 入力リズム イベントメタデータ 介入評価
          </p>
          <p className="muted" style={{ marginTop: "4px" }}>
            保存されないデータ: 音声録音 映像録画 入力内容 生フレーム
          </p>
        </div>
      </div>

      <InterventionOverlay
        intervention={currentIntervention}
        onRate={handleInterventionRate}
        onDismiss={() => setCurrentIntervention(null)}
      />
    </div>
  );
}
