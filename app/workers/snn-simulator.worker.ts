/**
 * SNN シミュレーター Web Worker
 *
 * Main → Worker:
 *   { type: "features", bundle }   → tick を実行し SNNTickResult を返す
 *   { type: "config", config }     → ネットワーク設定を更新
 *   { type: "reset" }              → 状態をリセット
 *   { type: "learning", enabled }  → STDP ON/OFF
 */
import { SNNNetwork } from "@/lib/snn/network";
import { DEFAULT_SNN_CONFIG } from "@/lib/snn/config";
import type { SNNWorkerIn } from "@/lib/snn/types";

const network = new SNNNetwork(DEFAULT_SNN_CONFIG);

self.onmessage = (event: MessageEvent<SNNWorkerIn>) => {
  const msg = event.data;

  switch (msg.type) {
    case "features": {
      const result = network.tick(msg.bundle);
      // Transferable で zero-copy 転送
      const transferables: Transferable[] = [
        result.spikeHistory.buffer,
        result.vm.buffer,
        result.wIn.buffer,
        result.wOut.buffer,
      ];
      self.postMessage(result, { transfer: transferables });
      break;
    }

    case "config": {
      network.reconfigure(msg.config);
      break;
    }

    case "reset": {
      network.reset();
      break;
    }

    case "learning": {
      network.learningEnabled = msg.enabled;
      break;
    }
  }
};

export {};
