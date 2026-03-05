"use client";

import { useEffect, useRef } from "react";

/**
 * ネットワーク接続図 (Canvas)
 * 入力→隠れ→出力の接続グラフ。
 * エッジの太さ ∝ 重み絶対値。スパイク時にノードが白く発光。
 */

const NODE_COLORS = {
  in:  "#60a5fa",
  exc: "#4ade80",
  inh: "#f87171",
  out: "#fbbf24",
} as const;

const W_THRESHOLD = 0.15;

function groupX(
  group: "in" | "exc" | "inh" | "out",
  w: number
): number {
  const margins = { in: 42, exc: w * 0.32, inh: w * 0.56, out: w - 42 };
  return margins[group];
}

function nodeY(idx: number, count: number, h: number): number {
  const margin = 20;
  const spacing = (h - margin * 2) / Math.max(count - 1, 1);
  return margin + idx * spacing;
}

interface Props {
  nIn: number;
  nExc: number;
  nInh: number;
  nOut: number;
  lastSpikes: Uint8Array | null;
  vm: Float32Array | null;
  wIn: Float32Array;
  wOut: Float32Array;
  width?: number;
  height?: number;
}

const OUT_LABELS = ["FC", "CT", "MA"];

export default function NetworkGraph({
  nIn,
  nExc,
  nInh,
  nOut,
  lastSpikes,
  vm,
  wIn,
  wOut,
  width = 580,
  height = 180,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // TypeScript narrows ctx to non-null here, but nested functions need an alias
    const c: CanvasRenderingContext2D = ctx;

    c.fillStyle = "#0f172a";
    c.fillRect(0, 0, width, height);

    const nHid = nExc + nInh;

    // ── エッジ描画 ───────────────────────────────────────────────────────────

    // W_in: 入力→隠れ
    for (let i = 0; i < nIn; i++) {
      for (let j = 0; j < nHid; j++) {
        const w = wIn[i * nHid + j] ?? 0;
        if (Math.abs(w) < W_THRESHOLD) continue;
        const x1 = groupX("in", width);
        const y1 = nodeY(i, nIn, height);
        const g = j < nExc ? "exc" : "inh";
        const jIdx = j < nExc ? j : j - nExc;
        const cnt = j < nExc ? nExc : nInh;
        const x2 = groupX(g, width);
        const y2 = nodeY(jIdx, cnt, height);
        const alpha = Math.min(0.7, Math.abs(w) * 0.8);
        c.strokeStyle = `rgba(96,165,250,${alpha})`;
        c.lineWidth = Math.min(2, Math.abs(w) * 1.5);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
      }
    }

    // W_out: 興奮性隠れ→出力
    for (let j = 0; j < nExc; j++) {
      for (let k = 0; k < nOut; k++) {
        const w = wOut[j * nOut + k] ?? 0;
        if (w < W_THRESHOLD) continue;
        const x1 = groupX("exc", width);
        const y1 = nodeY(j, nExc, height);
        const x2 = groupX("out", width);
        const y2 = nodeY(k, nOut, height);
        const alpha = Math.min(0.7, w * 0.8);
        c.strokeStyle = `rgba(251,191,36,${alpha})`;
        c.lineWidth = Math.min(2, w * 1.5);
        c.beginPath();
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
      }
    }

    // ── ノード描画 ───────────────────────────────────────────────────────────
    const maxCount = Math.max(nIn, nExc, nInh, nOut);
    const nodeR = Math.max(3, Math.min(6, (height - 40) / maxCount / 2));

    function drawNode(
      group: "in" | "exc" | "inh" | "out",
      idx: number,
      count: number,
      spiked: boolean,
      vmVal?: number
    ) {
      const x = groupX(group, width);
      const y = nodeY(idx, count, height);

      // VM によるグロー
      if (!spiked && vmVal !== undefined) {
        const t = Math.max(0, Math.min(1, (vmVal - (-80)) / 35));
        if (t > 0.1) {
          c.beginPath();
          c.arc(x, y, nodeR + 4, 0, Math.PI * 2);
          c.fillStyle = `rgba(255,255,255,${t * 0.15})`;
          c.fill();
        }
      }

      c.beginPath();
      c.arc(x, y, spiked ? nodeR + 2.5 : nodeR, 0, Math.PI * 2);
      c.fillStyle = spiked ? "#ffffff" : NODE_COLORS[group];
      c.fill();
    }

    for (let i = 0; i < nIn; i++) {
      drawNode("in", i, nIn, lastSpikes ? lastSpikes[i] === 1 : false);
    }
    for (let j = 0; j < nExc; j++) {
      const ni = nIn + j;
      drawNode("exc", j, nExc,
        lastSpikes ? lastSpikes[ni] === 1 : false,
        vm ? vm[ni] : undefined
      );
    }
    for (let j = 0; j < nInh; j++) {
      const ni = nIn + nExc + j;
      drawNode("inh", j, nInh,
        lastSpikes ? lastSpikes[ni] === 1 : false,
        vm ? vm[ni] : undefined
      );
    }
    for (let k = 0; k < nOut; k++) {
      const ni = nIn + nExc + nInh + k;
      const spiked = lastSpikes ? lastSpikes[ni] === 1 : false;
      drawNode("out", k, nOut, spiked, vm ? vm[ni] : undefined);
      // 出力ラベル
      const x = groupX("out", width);
      const y = nodeY(k, nOut, height);
      c.fillStyle = spiked ? "#ffffff" : "rgba(255,255,255,0.6)";
      c.font = "8px monospace";
      c.fillText(OUT_LABELS[k], x + nodeR + 3, y + 3);
    }

    // ── グループラベル ────────────────────────────────────────────────────────
    const topY = 10;
    const groupDefs: Array<["in" | "exc" | "inh" | "out", string]> = [
      ["in",  "入力"],
      ["exc", "興奮"],
      ["inh", "抑制"],
      ["out", "出力"],
    ];
    for (const [grp, label] of groupDefs) {
      c.fillStyle = NODE_COLORS[grp];
      c.font = "8px monospace";
      c.fillText(label, groupX(grp, width) - 10, topY);
    }
  }, [nIn, nExc, nInh, nOut, lastSpikes, vm, wIn, wOut, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block", width: "100%", borderRadius: "4px" }}
    />
  );
}
