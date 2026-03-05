/**
 * Leaky Integrate-and-Fire (LIF) ニューロンモデル
 *
 * 方程式 (離散時間, dt=1ms):
 *   V[t] = V[t-1] + (dt / τ_m) × (-(V[t-1] - V_rest) + R × I[t])
 *   if V[t] >= V_th: spike → V = V_reset, refractory = t_ref
 *
 * Loihi の CUBA (Current-Based) モデルに対応。
 */
import type { NeuronState } from "./types";

export const V_REST = -65; // mV (全ニューロン共通)
export const V_RESET = -65; // mV

export interface LIFParams {
  tauMMs: number;    // 膜時定数 (ms)
  vThreshMv: number; // 発火閾値 (mV)
  tRefMs: number;    // 不応期 (ms)
  rMembrane: number; // 膜抵抗スケーリング
}

/** 初期ニューロン状態を生成 */
export function createNeuron(): NeuronState {
  return { v: V_REST, refMs: 0, spikeTrace: 0 };
}

/**
 * LIF ニューロンを 1ms 進める
 * @param state  現在のニューロン状態 (変更される)
 * @param I      入力電流 (シナプス重み × スパイクの和)
 * @param params LIF パラメータ
 * @returns      このステップでスパイクしたか
 */
export function lifStep(
  state: NeuronState,
  I: number,
  params: LIFParams
): boolean {
  const dt = 1; // ms

  // 不応期中は V を変化させない
  if (state.refMs > 0) {
    state.refMs -= dt;
    state.v = V_RESET;
    return false;
  }

  // 膜電位更新 (Euler 法)
  state.v +=
    (dt / params.tauMMs) *
    (-(state.v - V_REST) + params.rMembrane * I);

  // 閾値超えでスパイク
  if (state.v >= params.vThreshMv) {
    state.v = V_RESET;
    state.refMs = params.tRefMs;
    return true;
  }

  // 膜電位をクランプ (数値安定性)
  if (state.v < V_REST - 30) state.v = V_REST - 30;

  return false;
}

/**
 * STDP スパイクトレースを 1ms 減衰させる
 * x(t) = x(t-1) × exp(-dt/τ_stdp) + spike
 */
export function decayTrace(trace: number, tauMs: number, spiked: boolean): number {
  const decayed = trace * Math.exp(-1 / tauMs);
  return spiked ? decayed + 1 : decayed;
}
