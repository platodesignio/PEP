import { EventDetector } from "@/lib/event/detector";
import type { WorkerInMessage, WorkerOutMessage, DetectionConfig } from "@/lib/event/types";
import { getDefaultDetectionConfig } from "@/lib/event/definitions";

let detector: EventDetector | null = null;
let config: DetectionConfig = getDefaultDetectionConfig();

self.onmessage = (event: MessageEvent<WorkerInMessage>) => {
  const msg = event.data;

  if (msg.type === "features") {
    if (!detector) {
      detector = new EventDetector(config);
    }

    if (msg.config && msg.config.version !== config.version) {
      config = msg.config;
      detector.updateConfig(config);
    }

    const { events, interventions } = detector.process(msg.bundle);

    for (const e of events) {
      const out: WorkerOutMessage = { type: "event", event: e };
      self.postMessage(out);
    }

    for (const iv of interventions) {
      const out: WorkerOutMessage = { type: "intervention", intervention: iv };
      self.postMessage(out);
    }
  }
};

export {};
