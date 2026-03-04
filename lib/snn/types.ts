import type { EventType } from "@/lib/event/types";

// ─── ニューロン状態 ────────────────────────────────────────────────────────────
export interface NeuronState {
  v: number;            // 膜電位 (mV)
  refMs: number;        // 残り不応期 (ms)
  spikeTrace: number;   // STDP 用スパイクトレース (0〜1)
}

// ─── SNN ネットワーク設定 ──────────────────────────────────────────────────────
export interface SNNConfig {
  // ネットワーク構成
  nHiddenExc: number;       // 興奮性隠れニューロン数 (デフォルト 16)
  nHiddenInh: number;       // 抑制性隠れニューロン数 (デフォルト 4)

  // LIF パラメータ (興奮性)
  tauMExcMs: number;        // 膜時定数 ms (デフォルト 20)
  vThreshExcMv: number;     // 発火閾値 mV (デフォルト -50)

  // LIF パラメータ (抑制性)
  tauMInhMs: number;        // 膜時定数 ms (デフォルト 5)
  vThreshInhMv: number;     // 発火閾値 mV (デフォルト -52)

  // 共通 LIF パラメータ
  vRestMv: number;          // 静止膜電位 (デフォルト -65)
  vResetMv: number;         // リセット電位 (デフォルト -65)
  tRefExcMs: number;        // 興奮性不応期 (デフォルト 2)
  tRefInhMs: number;        // 抑制性不応期 (デフォルト 1)
  rMembrane: number;        // 膜抵抗 (スケーリング係数, デフォルト 1.0)

  // Poisson エンコーダー
  rMaxHz: number;           // 最大発火率 Hz (デフォルト 100)

  // STDP 学習
  aPlus: number;            // 増強振幅 (デフォルト 0.01)
  aMinus: number;           // 抑圧振幅 (デフォルト 0.012)
  tauStdpMs: number;        // STDP トレース時定数 (デフォルト 20)
  wMax: number;             // 最大重み (デフォルト 1.0)
  wMin: number;             // 最小重み (デフォルト 0.0)

  // 出力デコーダー
  outputThresholdHz: number; // イベント検出閾値 Hz (デフォルト 30)
  rateWindowMs: number;      // 発火率推定窓 ms (デフォルト 50)
}

// ─── Tick 結果（Worker → Main） ────────────────────────────────────────────────
export interface SNNTickResult {
  type: "tick";
  // 全ニューロンのスパイクヒストリー (100 steps × nTotal booleans を平坦化)
  spikeHistory: Uint8Array;       // shape: [stepsPerTick × nTotal]
  stepsPerTick: number;
  nTotal: number;                 // nIn + nExc + nInh + nOut
  nIn: number;
  nExc: number;
  nInh: number;
  nOut: number;
  // 最後のステップの膜電位
  vm: Float32Array;               // length: nTotal
  // 出力ニューロンの発火率 (Hz)
  outputRates: [number, number, number];
  // 重み行列 (STDP 更新後)
  wIn: Float32Array;              // shape [nIn × (nExc+nInh)]
  wOut: Float32Array;             // shape [(nExc+nInh) × nOut]
  // 検出イベント
  detectedEvent: EventType | null;
  detectedAt: number;             // timestamp ms
}

// ─── Worker メッセージ (Main → Worker) ────────────────────────────────────────
export type SNNWorkerIn =
  | { type: "features"; bundle: import("@/lib/event/types").FeatureBundle }
  | { type: "config"; config: SNNConfig }
  | { type: "reset" }
  | { type: "learning"; enabled: boolean };
