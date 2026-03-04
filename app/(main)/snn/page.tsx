"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DEFAULT_SNN_CONFIG } from "@/lib/snn/config";
import type { SNNConfig, SNNTickResult } from "@/lib/snn/types";
import type { FeatureBundle } from "@/lib/event/types";
import RasterPlot from "./components/RasterPlot";
import VmTrace from "./components/VmTrace";
import WeightHeatmap from "./components/WeightHeatmap";
import NetworkGraph from "./components/NetworkGraph";
import ParamPanel from "./components/ParamPanel";
import { useLocale } from "@/app/components/LocaleProvider";

// ─── 定数 ────────────────────────────────────────────────────────────────────
const MAX_TICK_HISTORY = 15;   // ラスタープロット用 (15 tick = 1.5s)
const MAX_VM_HISTORY   = 200;  // Vm トレース用 (200 snap = 20s)
const TICK_INTERVAL_MS = 100;

interface EventLog {
  id: string;
  type: string;
  detectedAt: number;
  outputRates: [number, number, number];
}

const EVENT_COLORS: Record<string, string> = {
  FOCUS_COLLAPSE:    "#f59e0b",
  CONVERSATION_TURN: "#34d399",
  MOTION_ANOMALY:    "#f87171",
};

// ─── メインページ ──────────────────────────────────────────────────────────────
export default function SNNPage() {
  // ── UI 状態 ──────────────────────────────────────────────────────────────
  const { t } = useLocale();
  const [running,         setRunning]         = useState(false);
  const [learningEnabled, setLearningEnabled] = useState(true);
  const [config,          setConfig]          = useState<SNNConfig>(DEFAULT_SNN_CONFIG);
  const [tickHistory,     setTickHistory]     = useState<SNNTickResult[]>([]);
  const [vmHistory,       setVmHistory]       = useState<Float32Array[]>([]);
  const [eventLogs,       setEventLogs]       = useState<EventLog[]>([]);
  const [outputRates,     setOutputRates]     = useState<[number,number,number]>([0,0,0]);
  const [runId,           setRunId]           = useState<string | null>(null);
  const [permMic,         setPermMic]         = useState<"prompt"|"granted"|"denied">("prompt");
  const [permCam,         setPermCam]         = useState<"prompt"|"granted"|"denied">("prompt");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const workerRef      = useRef<Worker | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const prevFrameRef   = useRef<Uint8Array | null>(null);
  const keyTimesRef    = useRef<number[]>([]);
  const mouseSpeedsRef = useRef<number[]>([]);
  const lastMouseRef   = useRef({ x: 0, y: 0, time: 0 });
  const lastInputRef   = useRef(Date.now());
  const startTimeRef   = useRef(Date.now());
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const runIdRef       = useRef<string | null>(null);

  // ── Worker 初期化 ─────────────────────────────────────────────────────────
  useEffect(() => {
    let worker: Worker;
    try {
      worker = new Worker(
        new URL("@/app/workers/snn-simulator.worker.ts", import.meta.url)
      );
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<SNNTickResult>) => {
        const result = e.data;

        setTickHistory((prev) => {
          const next = [...prev, result];
          if (next.length > MAX_TICK_HISTORY) next.shift();
          return next;
        });

        setVmHistory((prev) => {
          const next = [...prev, result.vm];
          if (next.length > MAX_VM_HISTORY) next.shift();
          return next;
        });

        setOutputRates(result.outputRates);

        if (result.detectedEvent) {
          const log: EventLog = {
            id:          `${result.detectedEvent}-${result.detectedAt}-${Math.random()}`,
            type:        result.detectedEvent,
            detectedAt:  result.detectedAt,
            outputRates: result.outputRates,
          };
          setEventLogs((prev) => [log, ...prev].slice(0, 60));

          // セッション保存
          if (runIdRef.current) {
            const now = Date.now();
            fetch(`/api/sessions/${runIdRef.current}/events`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                events: [{
                  t0:               now - TICK_INTERVAL_MS,
                  t1:               now,
                  type:             result.detectedEvent,
                  confidence:       Math.min(1, Math.max(...result.outputRates) / 100),
                  baselineDeviation: 1.0,
                  featuresSummaryJson: "{}",
                  baselineSummaryJson: "{}",
                }],
              }),
            }).catch(() => {});
          }
        }
      };

      worker.onerror = (err) => {
        console.error("SNN Worker error:", err.message);
      };
    } catch (err) {
      console.error("Failed to create SNN Worker:", err);
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // ── キーボード・マウス追跡 ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = () => {
      keyTimesRef.current.push(Date.now());
      if (keyTimesRef.current.length > 30) keyTimesRef.current.shift();
      lastInputRef.current = Date.now();
    };

    const onMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const dt  = now - lastMouseRef.current.time;
      if (dt > 0 && dt < 200) {
        const dx = e.clientX - lastMouseRef.current.x;
        const dy = e.clientY - lastMouseRef.current.y;
        mouseSpeedsRef.current.push(Math.sqrt(dx * dx + dy * dy) / dt);
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

  // ── アンマウント時クリーンアップ ────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // ── センサー初期化 ────────────────────────────────────────────────────────
  async function initSensors() {
    // マイク
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setPermMic("granted");
      const ctx = new AudioContext({ sampleRate: 44100 });
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      src.connect(analyser);
      analyserRef.current = analyser;
    } catch {
      setPermMic("denied");
    }

    // カメラ
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      });
      setPermCam("granted");
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
      setPermCam("denied");
    }
  }

  // ── 特徴量計算 ────────────────────────────────────────────────────────────
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

    let zc = 0;
    for (let i = 1; i < timeData.length; i++) {
      if ((timeData[i - 1] >= 0) !== (timeData[i] >= 0)) zc++;
    }
    const zcr = zc / timeData.length;

    let ws = 0, tp = 0;
    const nyquist = (audioCtxRef.current?.sampleRate ?? 44100) / 2;
    for (let i = 0; i < freqData.length; i++) {
      const p = Math.pow(10, freqData[i] / 10);
      ws += p * (i / freqData.length) * nyquist;
      tp += p;
    }
    const spectralCentroid = tp > 0 ? ws / tp : 0;

    return {
      rms, zcr, spectralCentroid,
      spectralFlatness: 0, bandEnergyLow: 0,
      bandEnergyMid: 0, bandEnergyHigh: 0, shortTimeChangeRate: 0,
    };
  }

  function computeVideoFeatures() {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 32, 32);
    const frame = ctx.getImageData(0, 0, 32, 32);
    const gray = new Uint8Array(32 * 32);
    for (let i = 0; i < gray.length; i++) {
      gray[i] = Math.round(
        0.299 * frame.data[i * 4] +
        0.587 * frame.data[i * 4 + 1] +
        0.114 * frame.data[i * 4 + 2]
      );
    }
    const prev = prevFrameRef.current;
    prevFrameRef.current = gray;
    if (!prev) return null;

    let mt = 0, mst = 0;
    for (let i = 0; i < gray.length; i++) {
      const d = Math.abs(gray[i] - prev[i]);
      mt += d; mst += d * d;
    }
    const mq = mt / (gray.length * 255);
    const mm = mt / gray.length;
    return { motionQuantity: mq, motionSpatialVariance: mst / gray.length - mm * mm, globalChangeRate: mq };
  }

  // ── 開始 ──────────────────────────────────────────────────────────────────
  async function start() {
    await initSensors();

    // セッション作成
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceInfoJson: JSON.stringify({ userAgent: navigator.userAgent.slice(0, 200) }),
        }),
      });
      if (res.ok) {
        const data = await res.json() as { runId: string };
        setRunId(data.runId);
        runIdRef.current = data.runId;
      }
    } catch { /* セッション保存なしで続行 */ }

    // Worker を初期化
    const worker = workerRef.current;
    if (worker) {
      worker.postMessage({ type: "reset" });
      worker.postMessage({ type: "config", config });
      worker.postMessage({ type: "learning", enabled: learningEnabled });
    }

    setTickHistory([]);
    setVmHistory([]);
    setEventLogs([]);
    setOutputRates([0, 0, 0]);
    startTimeRef.current = Date.now();
    setRunning(true);

    // 100ms ごとにセンサーデータを Worker に送信
    const iv = setInterval(() => {
      if (!workerRef.current) return;

      const audioFeatures = analyserRef.current
        ? computeAudioFeatures(analyserRef.current)
        : null;
      const videoFeatures = computeVideoFeatures();

      const keyIntervals = keyTimesRef.current
        .slice(1)
        .map((t, i) => t - keyTimesRef.current[i]);

      const bundle: FeatureBundle = {
        timestamp: Date.now() - startTimeRef.current,
        audio: audioFeatures,
        video: videoFeatures,
        input: {
          keyIntervalVariance:   computeVariance(keyIntervals),
          mouseVelocityVariance: computeVariance(mouseSpeedsRef.current),
          clickRate:   0,
          scrollRate:  0,
          pauseDuration: (Date.now() - lastInputRef.current) / 1000,
        },
      };

      workerRef.current.postMessage({ type: "features", bundle });
    }, TICK_INTERVAL_MS);

    intervalRef.current = iv;
  }

  // ── 停止 ──────────────────────────────────────────────────────────────────
  function stop() {
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    prevFrameRef.current = null;

    if (runIdRef.current) {
      fetch(`/api/sessions/${runIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endedAt: new Date().toISOString() }),
      }).catch(() => {});
      setRunId(null);
      runIdRef.current = null;
    }
  }

  // ── パラメータ変更 ─────────────────────────────────────────────────────────
  const handleConfigChange = useCallback((cfg: SNNConfig) => {
    setConfig(cfg);
    workerRef.current?.postMessage({ type: "config", config: cfg });
  }, []);

  function handleLearningToggle() {
    const next = !learningEnabled;
    setLearningEnabled(next);
    workerRef.current?.postMessage({ type: "learning", enabled: next });
  }

  // ── 描画データ準備 ─────────────────────────────────────────────────────────
  const latestTick = tickHistory[tickHistory.length - 1];
  const nHid = config.nHiddenExc + config.nHiddenInh;
  const nTotal = 9 + nHid + 3;

  const lastSpikes: Uint8Array | null = latestTick
    ? latestTick.spikeHistory.slice(
        (latestTick.stepsPerTick - 1) * latestTick.nTotal,
        latestTick.stepsPerTick * latestTick.nTotal
      )
    : null;

  const permStatus = (perm: "prompt" | "granted" | "denied", icon: string) => (
    <span
      style={{
        fontSize: "12px",
        color: perm === "granted" ? "var(--color-success, #4ade80)"
          : perm === "denied"  ? "var(--color-danger, #f87171)"
          : "var(--color-text-muted)",
      }}
    >
      {icon}{perm === "granted" ? "✓" : perm === "denied" ? "✗" : "?"}
    </span>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: "1180px" }}>

      {/* ── コントロールバー ─────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ fontSize: "15px", fontWeight: 700, marginRight: "4px" }}>
          {t.snn.title}
        </h2>

        {/* センサー状態 */}
        <div style={{ display: "flex", gap: "6px" }}>
          {permStatus(permMic, "🎤")}
          {permStatus(permCam, "📷")}
          <span style={{ fontSize: "12px", color: "var(--color-success, #4ade80)" }}>⌨✓</span>
        </div>

        <button
          data-variant={running ? "danger" : "primary"}
          onClick={running ? stop : start}
          style={{ minWidth: "64px" }}
        >
          {running ? t.snn.stop : t.snn.start}
        </button>

        <button onClick={handleLearningToggle} style={{ fontSize: "11px", padding: "4px 10px" }}>
          {learningEnabled ? t.snn.learningOn : t.snn.learningOff}
        </button>

        {runId && (
          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--color-text-muted)" }}>
            RID:{runId.slice(0, 8)}…
          </span>
        )}

        {/* 出力発火率 */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "14px", fontFamily: "monospace", fontSize: "11px" }}>
          <span style={{ color: "#f59e0b" }}>FC {outputRates[0].toFixed(0)}Hz</span>
          <span style={{ color: "#34d399" }}>CT {outputRates[1].toFixed(0)}Hz</span>
          <span style={{ color: "#f87171" }}>MA {outputRates[2].toFixed(0)}Hz</span>
        </div>
      </div>

      {/* ── 上段: ラスター + ヒートマップ ────────────────────────────────── */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}
      >
        <div className="card" style={{ padding: "8px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
            {t.snn.rasterPlot}
          </h3>
          <RasterPlot tickResults={tickHistory} />
        </div>

        <div className="card" style={{ padding: "8px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
            {t.snn.weightHeatmap}
          </h3>
          {latestTick ? (
            <WeightHeatmap
              wIn={latestTick.wIn}
              wOut={latestTick.wOut}
              nIn={latestTick.nIn}
              nHid={nHid}
              nOut={latestTick.nOut}
            />
          ) : (
            <div style={{ height: "150px", background: "#0f172a", borderRadius: "4px" }} />
          )}
        </div>
      </div>

      {/* ── 中段: Vm トレース + ネットワーク図 ──────────────────────────── */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}
      >
        <div className="card" style={{ padding: "8px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
            {t.snn.vmTrace}
          </h3>
          <VmTrace
            vmHistory={vmHistory}
            nTotal={latestTick?.nTotal ?? nTotal}
            nIn={latestTick?.nIn ?? 9}
            nExc={latestTick?.nExc ?? config.nHiddenExc}
            nInh={latestTick?.nInh ?? config.nHiddenInh}
          />
        </div>

        <div className="card" style={{ padding: "8px" }}>
          <h3 style={{ fontSize: "11px", fontWeight: 600, marginBottom: "5px" }}>
            {t.snn.networkGraph}
          </h3>
          <NetworkGraph
            nIn={latestTick?.nIn ?? 9}
            nExc={latestTick?.nExc ?? config.nHiddenExc}
            nInh={latestTick?.nInh ?? config.nHiddenInh}
            nOut={latestTick?.nOut ?? 3}
            lastSpikes={lastSpikes}
            vm={latestTick?.vm ?? null}
            wIn={latestTick?.wIn ?? new Float32Array(0)}
            wOut={latestTick?.wOut ?? new Float32Array(0)}
          />
        </div>
      </div>

      {/* ── パラメータパネル ─────────────────────────────────────────────── */}
      <div className="card section" style={{ marginBottom: "10px" }}>
        <h3 style={{ fontSize: "11px", fontWeight: 600, marginBottom: "10px" }}>
          {t.snn.params}
        </h3>
        <ParamPanel config={config} onChange={handleConfigChange} />
      </div>

      {/* ── イベントログ ──────────────────────────────────────────────────── */}
      <div className="card">
        <h3 style={{ fontSize: "11px", fontWeight: 600, marginBottom: "8px" }}>
          {t.snn.eventLog} ({eventLogs.length}{t.snn.eventsCount})
        </h3>
        <div
          style={{
            maxHeight: "130px",
            overflowY: "auto",
            fontFamily: "monospace",
            fontSize: "10px",
          }}
        >
          {eventLogs.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
              {running ? t.snn.waiting : t.snn.startToRecord}
            </p>
          ) : (
            eventLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: "flex",
                  gap: "10px",
                  padding: "2px 0",
                  borderBottom: "1px solid var(--color-border)",
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
                  {new Date(log.detectedAt).toLocaleTimeString()}
                </span>
                <span
                  style={{
                    color: EVENT_COLORS[log.type] ?? "var(--color-text)",
                    fontWeight: 700,
                    minWidth: "80px",
                  }}
                >
                  {log.type === "FOCUS_COLLAPSE"    ? t.snn.focusCollapse
                 : log.type === "CONVERSATION_TURN" ? t.snn.conversationTurn
                 : log.type === "MOTION_ANOMALY"    ? t.snn.motionAnomaly
                 : log.type}
                </span>
                <span style={{ color: "var(--color-text-muted)" }}>
                  FC:{log.outputRates[0].toFixed(0)}&nbsp;
                  CT:{log.outputRates[1].toFixed(0)}&nbsp;
                  MA:{log.outputRates[2].toFixed(0)} Hz
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
