/**
 * Loihi 風 SNN ネットワーク
 *
 * 構成:
 *   入力層  (9 Poisson ニューロン)
 *   隠れ層  (nHiddenExc 興奮性 + nHiddenInh 抑制性 LIF)
 *   出力層  (3 LIF ニューロン)
 *
 * 重み:
 *   wIn  [N_IN × nHid]   — STDP 対象
 *   wRec [nHid × nHid]   — 固定ラテラル抑制
 *   wOut [nHid × N_OUT]  — STDP 対象
 *
 * 学習則: STDP (nearest-neighbor)
 *   post 発火時: Δw += A+ × x_pre   (LTP)
 *   pre  発火時: Δw -= A- × x_post  (LTD)
 */
import type { SNNConfig, SNNTickResult } from "./types";
import type { EventType } from "@/lib/event/types";
import { lifStep, decayTrace, createNeuron, V_REST } from "./lif";
import type { LIFParams } from "./lif";
import { encodeSpikes } from "./encoder";
import type { FeatureBundle } from "@/lib/event/types";

export const N_IN = 9;
export const N_OUT = 3;
const STEPS_PER_TICK = 100;
const EVENT_NAMES: EventType[] = [
  "FOCUS_COLLAPSE",
  "CONVERSATION_TURN",
  "MOTION_ANOMALY",
];

export class SNNNetwork {
  private cfg: SNNConfig;
  private nHid: number;

  // ニューロン状態
  private hidStates: ReturnType<typeof createNeuron>[];
  private outStates: ReturnType<typeof createNeuron>[];

  // 重み行列 (flat, row-major)
  wIn: Float32Array;   // [N_IN × nHid]
  wRec: Float32Array;  // [nHid × nHid]
  wOut: Float32Array;  // [nHid × N_OUT]

  // STDP トレース
  private preTraceIn: Float32Array;   // [N_IN]
  private preTraceHid: Float32Array;  // [nHid]
  private postTraceHid: Float32Array; // [nHid]
  private postTraceOut: Float32Array; // [N_OUT]

  // 前ステップの隠れスパイク (recurrent 入力用)
  private prevHidSpikes: Uint8Array;

  // 出力スパイクカウント (per tick)
  private outSpikeCount: Int32Array;

  // STDP ON/OFF
  learningEnabled = true;

  constructor(cfg: SNNConfig) {
    this.cfg = cfg;
    this.nHid = cfg.nHiddenExc + cfg.nHiddenInh;

    this.hidStates = Array.from({ length: this.nHid }, createNeuron);
    this.outStates = Array.from({ length: N_OUT }, createNeuron);

    this.wIn = new Float32Array(N_IN * this.nHid);
    this.wRec = new Float32Array(this.nHid * this.nHid);
    this.wOut = new Float32Array(this.nHid * N_OUT);

    this.preTraceIn = new Float32Array(N_IN);
    this.preTraceHid = new Float32Array(this.nHid);
    this.postTraceHid = new Float32Array(this.nHid);
    this.postTraceOut = new Float32Array(N_OUT);

    this.prevHidSpikes = new Uint8Array(this.nHid);
    this.outSpikeCount = new Int32Array(N_OUT);

    this.initWeights();
  }

  // ─── 重み初期化 ──────────────────────────────────────────────────────────────

  private initWeights(): void {
    const nHid = this.nHid;
    const { nHiddenExc, wMax } = this.cfg;

    // wIn: スパース, 特徴量グループごとに優先バイアス
    //   audio (0-2)  → exc の前 1/3
    //   video (3-5)  → exc の中 1/3
    //   input (6-8)  → exc の後 1/3
    for (let i = 0; i < N_IN; i++) {
      for (let j = 0; j < nHid; j++) {
        if (Math.random() < 0.5) {
          let w = (Math.random() * 0.4 + 0.1) * wMax;
          const t3 = nHiddenExc / 3;
          if (i < 3 && j < t3) w *= 2;
          if (i >= 3 && i < 6 && j >= t3 && j < t3 * 2) w *= 2;
          if (i >= 6 && j >= t3 * 2 && j < nHiddenExc) w *= 2;
          this.wIn[i * nHid + j] = Math.min(w, wMax);
        }
      }
    }

    // wRec: 抑制性→興奮性 (-), 興奮性→抑制性 (+)
    for (let i = 0; i < nHid; i++) {
      for (let j = 0; j < nHid; j++) {
        if (i === j) continue;
        if (i >= nHiddenExc && j < nHiddenExc && Math.random() < 0.6) {
          this.wRec[i * nHid + j] = -(Math.random() * 0.3 + 0.1) * wMax;
        } else if (i < nHiddenExc && j >= nHiddenExc && Math.random() < 0.4) {
          this.wRec[i * nHid + j] = (Math.random() * 0.2 + 0.05) * wMax;
        }
      }
    }

    // wOut: イベントタイプごとのバイアス
    //   FOCUS_COLLAPSE (0)    ← input ブロック (後 1/3)
    //   CONVERSATION_TURN (1) ← audio ブロック (前 1/3)
    //   MOTION_ANOMALY (2)    ← video ブロック (中 1/3)
    for (let j = 0; j < nHid; j++) {
      for (let k = 0; k < N_OUT; k++) {
        if (j < nHiddenExc && Math.random() < 0.5) {
          let w = (Math.random() * 0.3 + 0.05) * wMax;
          const t3 = nHiddenExc / 3;
          if (k === 0 && j >= t3 * 2) w *= 2.5;
          if (k === 1 && j < t3) w *= 2.5;
          if (k === 2 && j >= t3 && j < t3 * 2) w *= 2.5;
          this.wOut[j * N_OUT + k] = Math.min(w, wMax);
        }
      }
    }
  }

  // ─── 設定変更 (スライダー変更時) ──────────────────────────────────────────────

  reconfigure(cfg: SNNConfig): void {
    const newNHid = cfg.nHiddenExc + cfg.nHiddenInh;
    if (newNHid !== this.nHid) {
      // ニューロン数が変わった → 完全再初期化
      this.cfg = cfg;
      this.nHid = newNHid;
      this.hidStates = Array.from({ length: newNHid }, createNeuron);
      this.outStates = Array.from({ length: N_OUT }, createNeuron);
      this.wIn = new Float32Array(N_IN * newNHid);
      this.wRec = new Float32Array(newNHid * newNHid);
      this.wOut = new Float32Array(newNHid * N_OUT);
      this.preTraceIn = new Float32Array(N_IN);
      this.preTraceHid = new Float32Array(newNHid);
      this.postTraceHid = new Float32Array(newNHid);
      this.postTraceOut = new Float32Array(N_OUT);
      this.prevHidSpikes = new Uint8Array(newNHid);
      this.outSpikeCount = new Int32Array(N_OUT);
      this.initWeights();
    } else {
      // パラメータのみ更新
      this.cfg = cfg;
    }
  }

  // ─── リセット ────────────────────────────────────────────────────────────────

  reset(): void {
    for (let j = 0; j < this.nHid; j++) {
      this.hidStates[j] = createNeuron();
    }
    for (let k = 0; k < N_OUT; k++) {
      this.outStates[k] = createNeuron();
    }
    this.preTraceIn.fill(0);
    this.preTraceHid.fill(0);
    this.postTraceHid.fill(0);
    this.postTraceOut.fill(0);
    this.prevHidSpikes.fill(0);
    this.outSpikeCount.fill(0);
  }

  // ─── メイン Tick (100ms = 100 ステップ) ────────────────────────────────────

  tick(bundle: FeatureBundle): SNNTickResult {
    const cfg = this.cfg;
    const nHid = this.nHid;
    const nTotal = N_IN + nHid + N_OUT;
    const STEPS = STEPS_PER_TICK;

    const spikeHistory = new Uint8Array(STEPS * nTotal);
    this.outSpikeCount.fill(0);

    const excParams: LIFParams = {
      tauMMs: cfg.tauMExcMs,
      vThreshMv: cfg.vThreshExcMv,
      tRefMs: cfg.tRefExcMs,
      rMembrane: cfg.rMembrane,
    };
    const inhParams: LIFParams = {
      tauMMs: cfg.tauMInhMs,
      vThreshMv: cfg.vThreshInhMv,
      tRefMs: cfg.tRefInhMs,
      rMembrane: cfg.rMembrane,
    };

    // GC プレッシャーを減らすためステップ間でバッファを再利用
    const hidSpikes = new Uint8Array(nHid);
    const outSpikes = new Uint8Array(N_OUT);

    for (let s = 0; s < STEPS; s++) {
      // 1. Poisson 入力スパイク生成
      const inputSpikes = encodeSpikes(bundle, cfg.rMaxHz);

      // 2. 入力 pre-trace 更新
      for (let i = 0; i < N_IN; i++) {
        this.preTraceIn[i] = decayTrace(this.preTraceIn[i], cfg.tauStdpMs, inputSpikes[i]);
      }

      // 3. 隠れ層電流 (入力 + recurrent) → LIF → スパイク
      for (let j = 0; j < nHid; j++) {
        let I = 0;
        for (let i = 0; i < N_IN; i++) {
          if (inputSpikes[i]) I += this.wIn[i * nHid + j];
        }
        for (let k = 0; k < nHid; k++) {
          if (this.prevHidSpikes[k]) I += this.wRec[k * nHid + j];
        }

        const params = j < cfg.nHiddenExc ? excParams : inhParams;
        const fired = lifStep(this.hidStates[j], I, params);
        hidSpikes[j] = fired ? 1 : 0;

        // STDP トレース更新
        this.preTraceHid[j] = decayTrace(this.preTraceHid[j], cfg.tauStdpMs, fired);
        this.postTraceHid[j] = decayTrace(this.postTraceHid[j], cfg.tauStdpMs, fired);
      }

      // prevHidSpikes を更新 (次ステップの recurrent 用)
      this.prevHidSpikes.set(hidSpikes);

      // 4. wIn STDP
      if (this.learningEnabled) {
        for (let i = 0; i < N_IN; i++) {
          for (let j = 0; j < nHid; j++) {
            const idx = i * nHid + j;
            if (inputSpikes[i]) {
              // pre 発火 → LTD (post の過去トレース)
              this.wIn[idx] -= cfg.aMinus * this.postTraceHid[j];
            }
            if (hidSpikes[j]) {
              // post 発火 → LTP (pre の過去トレース)
              this.wIn[idx] += cfg.aPlus * this.preTraceIn[i];
            }
            this.wIn[idx] = Math.max(cfg.wMin, Math.min(cfg.wMax, this.wIn[idx]));
          }
        }
      }

      // 5. 出力層電流 → LIF → スパイク
      for (let k = 0; k < N_OUT; k++) {
        let I = 0;
        for (let j = 0; j < nHid; j++) {
          if (hidSpikes[j]) I += this.wOut[j * N_OUT + k];
        }
        const fired = lifStep(this.outStates[k], I, excParams);
        outSpikes[k] = fired ? 1 : 0;
        if (fired) this.outSpikeCount[k]++;
        this.postTraceOut[k] = decayTrace(this.postTraceOut[k], cfg.tauStdpMs, fired);
      }

      // 6. wOut STDP
      if (this.learningEnabled) {
        for (let j = 0; j < nHid; j++) {
          for (let k = 0; k < N_OUT; k++) {
            const idx = j * N_OUT + k;
            if (hidSpikes[j]) {
              this.wOut[idx] -= cfg.aMinus * this.postTraceOut[k];
            }
            if (outSpikes[k]) {
              this.wOut[idx] += cfg.aPlus * this.preTraceHid[j];
            }
            this.wOut[idx] = Math.max(cfg.wMin, Math.min(cfg.wMax, this.wOut[idx]));
          }
        }
      }

      // 7. スパイク履歴記録
      const base = s * nTotal;
      for (let i = 0; i < N_IN; i++) spikeHistory[base + i] = inputSpikes[i] ? 1 : 0;
      for (let j = 0; j < nHid; j++) spikeHistory[base + N_IN + j] = hidSpikes[j];
      for (let k = 0; k < N_OUT; k++) spikeHistory[base + N_IN + nHid + k] = outSpikes[k];
    }

    // 出力発火率 (Hz): count / 0.1s
    const tickDurationS = STEPS / 1000;
    const outputRates: [number, number, number] = [
      this.outSpikeCount[0] / tickDurationS,
      this.outSpikeCount[1] / tickDurationS,
      this.outSpikeCount[2] / tickDurationS,
    ];

    // イベント検出
    let detectedEvent: EventType | null = null;
    let maxRate = cfg.outputThresholdHz;
    for (let k = 0; k < N_OUT; k++) {
      if (outputRates[k] > maxRate) {
        maxRate = outputRates[k];
        detectedEvent = EVENT_NAMES[k];
      }
    }

    // 最終ステップの膜電位スナップショット
    const vm = new Float32Array(nTotal);
    for (let i = 0; i < N_IN; i++) vm[i] = V_REST;
    for (let j = 0; j < nHid; j++) vm[N_IN + j] = this.hidStates[j].v;
    for (let k = 0; k < N_OUT; k++) vm[N_IN + nHid + k] = this.outStates[k].v;

    return {
      type: "tick",
      spikeHistory,
      stepsPerTick: STEPS,
      nTotal,
      nIn: N_IN,
      nExc: cfg.nHiddenExc,
      nInh: cfg.nHiddenInh,
      nOut: N_OUT,
      vm,
      outputRates,
      wIn: new Float32Array(this.wIn),   // コピーして返す (transfer 用)
      wOut: new Float32Array(this.wOut),
      detectedEvent,
      detectedAt: detectedEvent ? Date.now() : 0,
    };
  }
}
