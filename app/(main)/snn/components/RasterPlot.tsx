"use client";

import { useEffect, useRef } from "react";
import type { SNNTickResult } from "@/lib/snn/types";

/**
 * スパイクラスタープロット (Canvas)
 * X 軸: 時間 (ステップ)、Y 軸: ニューロン番号
 * 色: 入力=青, 興奮性=緑, 抑制性=赤, 出力=黄
 */

const DOT_R = 1.5;
const HISTORY_STEPS = 500;

const GROUP_COLORS = {
  input: "#60a5fa",
  exc:   "#4ade80",
  inh:   "#f87171",
  out:   "#fbbf24",
} as const;

interface Props {
  tickResults: SNNTickResult[];
  width?: number;
  height?: number;
}

export default function RasterPlot({ tickResults, width = 580, height = 180 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, width, height);

    if (tickResults.length === 0) return;

    const last = tickResults[tickResults.length - 1];
    const { nIn, nExc, nInh, nOut, nTotal } = last;

    // 全 tick の spike を収集
    const allSpikes: { step: number; neuron: number }[] = [];
    let totalSteps = 0;
    for (const tr of tickResults) {
      const s = tr.stepsPerTick;
      const n = tr.nTotal;
      for (let step = 0; step < s; step++) {
        const base = step * n;
        for (let ni = 0; ni < n; ni++) {
          if (tr.spikeHistory[base + ni]) {
            allSpikes.push({ step: totalSteps + step, neuron: ni });
          }
        }
      }
      totalSteps += s;
    }

    const startStep = Math.max(0, totalSteps - HISTORY_STEPS);
    const visibleSteps = Math.min(totalSteps, HISTORY_STEPS);
    const xScale = width / visibleSteps;
    const yScale = height / nTotal;

    for (const { step, neuron } of allSpikes) {
      if (step < startStep) continue;
      const x = (step - startStep) * xScale;
      const y = (neuron + 0.5) * yScale;

      let color: string;
      if (neuron < nIn) {
        color = GROUP_COLORS.input;
      } else if (neuron < nIn + nExc) {
        color = GROUP_COLORS.exc;
      } else if (neuron < nIn + nExc + nInh) {
        color = GROUP_COLORS.inh;
      } else {
        color = GROUP_COLORS.out;
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, DOT_R, 0, Math.PI * 2);
      ctx.fill();
    }

    // グループ境界線
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (const y of [nIn * yScale, (nIn + nExc) * yScale, (nIn + nExc + nInh) * yScale]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // グループラベル
    ctx.font = "8px monospace";
    const labels = [
      { y: nIn / 2, label: "IN", color: GROUP_COLORS.input },
      { y: nIn + nExc / 2, label: "EXC", color: GROUP_COLORS.exc },
      { y: nIn + nExc + nInh / 2, label: "INH", color: GROUP_COLORS.inh },
      { y: nIn + nExc + nInh + nOut / 2, label: "OUT", color: GROUP_COLORS.out },
    ];
    for (const { y, label, color } of labels) {
      ctx.fillStyle = color;
      ctx.fillText(label, 2, y * yScale + 3);
    }
  }, [tickResults, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", width: "100%", borderRadius: "4px" }}
    />
  );
}
