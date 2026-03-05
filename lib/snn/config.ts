import type { SNNConfig } from "./types";

/**
 * Loihi デフォルト SNN 設定
 * スライダーで全フィールドが上書き可能。
 */
export const DEFAULT_SNN_CONFIG: SNNConfig = {
  // ネットワーク構成
  nHiddenExc: 16,
  nHiddenInh: 4,

  // LIF パラメータ (興奮性)
  tauMExcMs: 20,
  vThreshExcMv: -50,

  // LIF パラメータ (抑制性)
  tauMInhMs: 5,
  vThreshInhMv: -52,

  // 共通
  vRestMv: -65,
  vResetMv: -65,
  tRefExcMs: 2,
  tRefInhMs: 1,
  rMembrane: 1.0,

  // Poisson エンコーダー
  rMaxHz: 100,

  // STDP
  aPlus: 0.01,
  aMinus: 0.012,
  tauStdpMs: 20,
  wMax: 1.0,
  wMin: 0.0,

  // 出力デコーダー
  outputThresholdHz: 30,
  rateWindowMs: 100,
};
