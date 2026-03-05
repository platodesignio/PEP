/**
 * Motion Processing Worker
 *
 * Receives raw accelerometer samples at ~50 Hz from the main thread,
 * aggregates them into 1-second windows, and returns MotionWindow + TCI.
 */

import type {
  MotionWorkerIn,
  MotionWorkerOut,
  RawMotionSample,
  HrvSnapshot,
  RespirationSnapshot,
  MotionWindow,
} from "@/lib/martial/types";
import { processWindow } from "@/lib/martial/motion";
import { computeTci } from "@/lib/martial/tanden";
import { evaluateRules } from "@/lib/martial/coaching";

let buffer: RawMotionSample[] = [];
let windowBuffer: MotionWindow[] = []; // last 30 seconds
let lastWindowT = 0;
let latestHrv: HrvSnapshot | null = null;
let latestResp: RespirationSnapshot | null = null;

self.onmessage = (event: MessageEvent<MotionWorkerIn>) => {
  const msg = event.data;

  if (msg.type === "reset") {
    buffer = [];
    windowBuffer = [];
    lastWindowT = 0;
    latestHrv = null;
    latestResp = null;
    return;
  }

  if (msg.type === "hrv") {
    latestHrv = msg.hrv;
    return;
  }

  if (msg.type === "respiration") {
    latestResp = msg.resp;
    return;
  }

  if (msg.type === "sample") {
    buffer.push(msg.sample);

    // Check if we have a full 1-second window
    const t = msg.sample.t;
    if (t - lastWindowT < 1.0) return; // not yet a full second

    // Process the window
    const windowSamples = buffer.filter(
      (s) => s.t >= lastWindowT && s.t < lastWindowT + 1.0
    );
    buffer = buffer.filter((s) => s.t >= lastWindowT + 1.0);
    lastWindowT = Math.floor(t);

    const window = processWindow(windowSamples, lastWindowT + 0.5);

    // Keep last 30 seconds of windows
    windowBuffer.push(window);
    if (windowBuffer.length > 30) windowBuffer.shift();

    const tci = computeTci(windowBuffer, window, latestHrv, latestResp);
    const coachHint = evaluateRules(tci, window) ?? undefined;

    const out: MotionWorkerOut = { type: "tick", window, tci, coachHint };
    self.postMessage(out);
  }
};
