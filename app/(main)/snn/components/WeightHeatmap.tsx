"use client";

import { useEffect, useRef } from "react";

/**
 * 重み行列ヒートマップ (Canvas)
 * 左: W_in  [nIn × nHid]
 * 右: W_out [nHid × nOut]
 *
 * 色: 0 → 濃紺, 1 → 朱赤 (w≥0)
 *     負の重み → 青系 (抑制性 recurrent のみ; wIn・wOut は [0,1] にクランプ)
 */

const W_MAX = 1.0;
const LABEL_W = 28;
const PAD = 6;

function weightToRGB(w: number): string {
  const t = Math.max(0, Math.min(1, Math.abs(w) / W_MAX));
  if (w >= 0) {
    // 0: 濃紺 (#1e3a8a) → 1: 朱赤 (#ef4444)
    const r = Math.round(30 + t * (239 - 30));
    const g = Math.round(58 + t * (68 - 58));
    const b = Math.round(138 + t * (68 - 138));
    return `rgb(${r},${g},${b})`;
  } else {
    // 負: 暗い青系
    const r = Math.round(15);
    const g = Math.round(23 + t * 80);
    const b = Math.round(42 + t * 160);
    return `rgb(${r},${g},${b})`;
  }
}

interface Props {
  wIn: Float32Array;   // [nIn × nHid]
  wOut: Float32Array;  // [nHid × nOut]
  nIn: number;
  nHid: number;
  nOut: number;
  width?: number;
  height?: number;
}

const FEATURE_LABELS = ["RMS", "ZCR", "SC", "MQ", "MSV", "GCR", "KV", "MV", "PAU"];
const OUT_LABELS = ["FC", "CT", "MA"];

export default function WeightHeatmap({
  wIn,
  wOut,
  nIn,
  nHid,
  nOut,
  width = 580,
  height = 150,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    const innerH = height - PAD * 3 - 12; // 12 = bottom label space

    // ── W_in ────────────────────────────────────────────────────────────────
    const inSectionW = (width - LABEL_W - PAD * 3) * 0.55;
    const cw = inSectionW / nHid;
    const ch = innerH / nIn;

    for (let i = 0; i < nIn; i++) {
      for (let j = 0; j < nHid; j++) {
        ctx.fillStyle = weightToRGB(wIn[i * nHid + j] ?? 0);
        ctx.fillRect(
          LABEL_W + j * cw,
          PAD + 10 + i * ch,
          Math.max(1, cw - 0.5),
          Math.max(1, ch - 0.5)
        );
      }
    }

    // 行ラベル (特徴量)
    ctx.font = "7px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let i = 0; i < nIn; i++) {
      ctx.fillText(FEATURE_LABELS[i] ?? `f${i}`, 1, PAD + 10 + i * ch + ch / 2 + 2.5);
    }

    // セクションタイトル
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "8px monospace";
    ctx.fillText("W_in", LABEL_W + 2, 9);

    // ── W_out ───────────────────────────────────────────────────────────────
    const outX = LABEL_W + inSectionW + PAD * 2;
    const outW = width - outX - PAD;
    const cw2 = outW / nOut;
    const ch2 = innerH / nHid;

    for (let j = 0; j < nHid; j++) {
      for (let k = 0; k < nOut; k++) {
        ctx.fillStyle = weightToRGB(wOut[j * nOut + k] ?? 0);
        ctx.fillRect(
          outX + k * cw2,
          PAD + 10 + j * ch2,
          Math.max(1, cw2 - 0.5),
          Math.max(1, ch2 - 0.5)
        );
      }
    }

    // 列ラベル (出力)
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "7px monospace";
    for (let k = 0; k < nOut; k++) {
      ctx.fillText(OUT_LABELS[k] ?? `o${k}`, outX + k * cw2 + 1, height - 2);
    }

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "8px monospace";
    ctx.fillText("W_out", outX + 2, 9);

    // カラースケールバー
    const barX = outX + outW + PAD;
    if (barX + 10 < width) {
      for (let py = 0; py < innerH; py++) {
        const t = 1 - py / innerH;
        ctx.fillStyle = weightToRGB(t * W_MAX);
        ctx.fillRect(barX, PAD + 10 + py, 6, 1);
      }
    }
  }, [wIn, wOut, nIn, nHid, nOut, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", width: "100%", borderRadius: "4px" }}
    />
  );
}
