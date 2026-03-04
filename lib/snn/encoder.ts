/**
 * センサー特徴量 → Poisson スパイク列エンコーダー
 *
 * Loihi の DVS (Dynamic Vision Sensor) や音声スパイクエンコーダーに相当。
 * 各特徴量を [0,1] に正規化し、Poisson 過程でスパイクを生成する。
 *
 * P(spike | dt=1ms) = rate_Hz × 0.001 = feature × rMax × 0.001
 */
import type { FeatureBundle } from "@/lib/event/types";

/** FeatureBundle から 9次元の特徴量ベクトルを抽出 */
function extractFeatures(bundle: FeatureBundle): number[] {
  const audio = bundle.audio;
  const video = bundle.video;
  const input = bundle.input;

  return [
    // audio (0,1,2)
    clamp01(audio ? audio.rms * 10 : 0),                   // RMS: 0〜0.1 → 0〜1
    clamp01(audio ? audio.zcr / 200 : 0),                  // ZCR: 0〜200 → 0〜1
    clamp01(audio ? audio.spectralCentroid / 8000 : 0),    // SC: 0〜8kHz → 0〜1
    // video (3,4,5)
    clamp01(video ? video.motionQuantity * 20 : 0),         // MQ: 0〜0.05 → 0〜1
    clamp01(video ? video.motionSpatialVariance * 50 : 0),  // MSV
    clamp01(video ? video.globalChangeRate * 20 : 0),       // GCR
    // input (6,7,8)
    clamp01(input ? Math.sqrt(input.keyIntervalVariance) / 500 : 0), // 鍵盤分散
    clamp01(input ? Math.sqrt(input.mouseVelocityVariance) / 200 : 0), // マウス速度分散
    clamp01(input ? Math.min(input.pauseDuration / 15, 1) : 0),        // 停止時間
  ];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * 1ms の Poisson スパイクサンプル (9ニューロン分)
 * @param bundle   センサーBundle
 * @param rMaxHz   最大発火率 (Hz)
 * @returns        各ニューロンがスパイクしたか
 */
export function encodeSpikes(bundle: FeatureBundle, rMaxHz: number): boolean[] {
  const features = extractFeatures(bundle);
  const dt = 0.001; // 1ms in seconds
  return features.map((f) => Math.random() < f * rMaxHz * dt);
}

/** センサー種別インデックスの定数 */
export const INPUT_IDX = {
  AUDIO_RMS: 0,
  AUDIO_ZCR: 1,
  AUDIO_SC: 2,
  VIDEO_MQ: 3,
  VIDEO_MSV: 4,
  VIDEO_GCR: 5,
  INPUT_KV: 6,
  INPUT_MV: 7,
  INPUT_PAUSE: 8,
} as const;

export const N_INPUT = 9;
