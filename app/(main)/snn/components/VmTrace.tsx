"use client";

import { useEffect, useRef } from "react";

/**
 * 出力ニューロン膜電位トレース (Canvas)
 * X 軸: 時間 (tick ごと)、Y 軸: mV
 * 3 本のラインで FC / CT / MA を表示
 */

const V_MIN = -80;
const V_MAX = -44;
const V_THRESH = -50;

const OUT_COLORS = ["#f59e0b", "#34d399", "#f87171"] as const;
const OUT_LABELS = ["FC", "CT", "MA"] as const;

interface Props {
  vmHistory: Float32Array[];
  nTotal: number;
  nIn: number;
  nExc: number;
  nInh: number;
  width?: number;
  height?: number;
}

export default function VmTrace({
  vmHistory,
  nTotal,
  nIn,
  nExc,
  nInh,
  width = 580,
  height = 140,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    if (vmHistory.length === 0) return;

    const nOut = nTotal - nIn - nExc - nInh;
    const outStart = nIn + nExc + nInh;

    // V_th 水平線
    const vThY = height - ((V_THRESH - V_MIN) / (V_MAX - V_MIN)) * height;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, vThY);
    ctx.lineTo(width, vThY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "8px monospace";
    ctx.fillText("V_th", 3, vThY - 2);

    const xStep = width / Math.max(vmHistory.length - 1, 1);

    for (let k = 0; k < nOut; k++) {
      const ni = outStart + k;
      ctx.strokeStyle = OUT_COLORS[k];
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      vmHistory.forEach((vm, i) => {
        if (ni >= vm.length) return;
        const v = Math.max(V_MIN, Math.min(V_MAX, vm[ni]));
        const x = i * xStep;
        const y = height - ((v - V_MIN) / (V_MAX - V_MIN)) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });

      ctx.stroke();

      // ラベル (右端)
      const lastVm = vmHistory[vmHistory.length - 1];
      if (lastVm && ni < lastVm.length) {
        const v = Math.max(V_MIN, Math.min(V_MAX, lastVm[ni]));
        const y = height - ((v - V_MIN) / (V_MAX - V_MIN)) * height;
        ctx.fillStyle = OUT_COLORS[k];
        ctx.font = "8px monospace";
        ctx.fillText(OUT_LABELS[k], width - 16, y - 2);
      }
    }
  }, [vmHistory, nTotal, nIn, nExc, nInh, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", width: "100%", borderRadius: "4px" }}
    />
  );
}
