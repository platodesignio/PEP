import {
  MultiFeatureBaseline,
  SlidingWindowBaseline,
} from "./baseline";
import type {
  FeatureBundle,
  DetectedEvent,
  DetectedIntervention,
  DetectionConfig,
  InterventionKind,
  EventType,
} from "./types";

interface CooldownState {
  lastFiredAt: number;
}

interface MotionAlternationState {
  recentDeltas: number[];
  lastMotion: number;
}

interface NoiseSpikeState {
  recentSpikes: number[];
}

interface InputIrregularState {
  recentStops: number[];
}

export class EventDetector {
  private baseline: MultiFeatureBaseline;
  private silenceGapBaseline: SlidingWindowBaseline;
  private cooldowns: Map<EventType, CooldownState>;
  private interventionCooldown: number;
  private interventionCount: number;
  private motionAlt: MotionAlternationState;
  private noiseSpike: NoiseSpikeState;
  private inputIrr: InputIrregularState;
  private prevAudioEnergy: number | null;
  private prevMotion: number | null;
  private lastInputTime: number;
  private sampleCount: number;

  constructor(private config: DetectionConfig) {
    const ws = config.baseline.windowSamples;
    this.baseline = new MultiFeatureBaseline(ws);
    this.silenceGapBaseline = new SlidingWindowBaseline(ws);
    this.cooldowns = new Map();
    this.interventionCooldown = 0;
    this.interventionCount = 0;
    this.motionAlt = { recentDeltas: [], lastMotion: 0 };
    this.noiseSpike = { recentSpikes: [] };
    this.inputIrr = { recentStops: [] };
    this.prevAudioEnergy = null;
    this.prevMotion = null;
    this.lastInputTime = Date.now();
    this.sampleCount = 0;
  }

  process(bundle: FeatureBundle): {
    events: DetectedEvent[];
    interventions: DetectedIntervention[];
  } {
    this.sampleCount++;
    this.updateBaselines(bundle);

    const minSamples = this.config.baseline.minSamplesBeforeDetection;
    if (this.sampleCount < minSamples) {
      return { events: [], interventions: [] };
    }

    const events: DetectedEvent[] = [];
    const interventions: DetectedIntervention[] = [];

    const fc = this.detectFocusCollapse(bundle);
    if (fc) {
      events.push(fc);
      const iv = this.maybeIntervene("FOCUS_COLLAPSE", bundle.timestamp, fc.confidence);
      if (iv) interventions.push(iv);
    }

    const ct = this.detectConversationTurn(bundle);
    if (ct) {
      events.push(ct);
      const iv = this.maybeIntervene("CONVERSATION_TURN", bundle.timestamp, ct.confidence);
      if (iv) interventions.push(iv);
    }

    const ma = this.detectMotionAnomaly(bundle);
    if (ma) {
      events.push(ma);
      const iv = this.maybeIntervene("MOTION_ANOMALY", bundle.timestamp, ma.confidence);
      if (iv) interventions.push(iv);
    }

    return { events, interventions };
  }

  private updateBaselines(bundle: FeatureBundle): void {
    const now = bundle.timestamp;

    if (bundle.audio) {
      this.baseline.push("rms", bundle.audio.rms);
      this.baseline.push("zcr", bundle.audio.zcr);
      this.baseline.push("spectralCentroid", bundle.audio.spectralCentroid);
      this.baseline.push("spectralFlatness", bundle.audio.spectralFlatness);
      this.baseline.push("shortTimeChangeRate", bundle.audio.shortTimeChangeRate);

      if (this.prevAudioEnergy !== null) {
        const gap = bundle.audio.rms < 0.005 ? (now - this.prevAudioEnergy) / 1000 : 0;
        if (gap > 0.3) this.silenceGapBaseline.push(gap);
      }
      if (bundle.audio.rms >= 0.005) this.prevAudioEnergy = now;
    }

    if (bundle.video) {
      if (this.prevMotion !== null) {
        const delta = Math.abs(bundle.video.motionQuantity - this.prevMotion);
        this.motionAlt.recentDeltas.push(delta);
        if (this.motionAlt.recentDeltas.length > 50) this.motionAlt.recentDeltas.shift();
      }
      this.prevMotion = bundle.video.motionQuantity;
      this.baseline.push("motionQuantity", bundle.video.motionQuantity);
      this.baseline.push("motionSpatialVariance", bundle.video.motionSpatialVariance);
    }

    if (bundle.input) {
      this.baseline.push("keyIntervalVariance", bundle.input.keyIntervalVariance);
      this.baseline.push("mouseVelocityVariance", bundle.input.mouseVelocityVariance);
      this.baseline.push("clickRate", bundle.input.clickRate);

      if (bundle.input.pauseDuration > 3) {
        this.inputIrr.recentStops.push(now);
        if (this.inputIrr.recentStops.length > 20) this.inputIrr.recentStops.shift();
      }
    }

    if (bundle.audio && bundle.audio.zcr > 0.3) {
      this.noiseSpike.recentSpikes.push(now);
      if (this.noiseSpike.recentSpikes.length > 20) this.noiseSpike.recentSpikes.shift();
    }
  }

  private detectFocusCollapse(bundle: FeatureBundle): DetectedEvent | null {
    if (!bundle.input) return null;
    const cfg = this.config.focusCollapse;
    if (this.isCoolingDown("FOCUS_COLLAPSE", bundle.timestamp)) return null;

    const ivDev = this.baseline.deviation("keyIntervalVariance", bundle.input.keyIntervalVariance);
    const mvDev = this.baseline.deviation("mouseVelocityVariance", bundle.input.mouseVelocityVariance);
    const pauseTriggered = bundle.input.pauseDuration >= cfg.pauseDurationThresholdSec;

    const conditions = [
      ivDev >= cfg.inputVarianceDeviationThreshold,
      pauseTriggered,
      mvDev >= cfg.mouseDwellDeviationThreshold,
    ].filter(Boolean).length;

    if (conditions < cfg.minConcurrentConditions) return null;

    const confidence = Math.min(1, conditions / 3 + ivDev / 10);
    const deviation = Math.max(ivDev, mvDev);

    this.setCooldown("FOCUS_COLLAPSE", bundle.timestamp, cfg.cooldownSec);

    return {
      type: "FOCUS_COLLAPSE",
      t0: bundle.timestamp - 2000,
      t1: bundle.timestamp,
      confidence: Math.min(1, confidence),
      baselineDeviation: deviation,
      featuresSummary: {
        keyIntervalVariance: bundle.input.keyIntervalVariance,
        mouseVelocityVariance: bundle.input.mouseVelocityVariance,
        pauseDuration: bundle.input.pauseDuration,
      },
      baselineSummary: {
        keyIntervalVariance_dev: ivDev,
        mouseVelocityVariance_dev: mvDev,
      },
    };
  }

  private detectConversationTurn(bundle: FeatureBundle): DetectedEvent | null {
    if (!bundle.audio) return null;
    const cfg = this.config.conversationTurn;
    if (this.isCoolingDown("CONVERSATION_TURN", bundle.timestamp)) return null;

    const silenceEst = this.silenceGapBaseline.getEstimate();
    if (silenceEst.n < 5) return null;

    const currentSilence = bundle.audio.rms < 0.005 ? 999 : 0;
    const silDev = currentSilence > 0 ? this.silenceGapBaseline.deviation(currentSilence) : 0;
    const centDev = this.baseline.deviation("spectralCentroid", bundle.audio.spectralCentroid);
    const changeDev = this.baseline.deviation("shortTimeChangeRate", bundle.audio.shortTimeChangeRate);

    const conditions = [
      silDev >= cfg.silenceGapDeviationThreshold,
      centDev >= cfg.spectralChangeDeviationThreshold,
      changeDev >= cfg.energyVarianceDeviationThreshold,
    ].filter(Boolean).length;

    if (conditions < 2) return null;

    const confidence = Math.min(1, conditions / 3 + silDev / 10);
    this.setCooldown("CONVERSATION_TURN", bundle.timestamp, cfg.cooldownSec);

    return {
      type: "CONVERSATION_TURN",
      t0: bundle.timestamp - 1000,
      t1: bundle.timestamp,
      confidence: Math.min(1, confidence),
      baselineDeviation: Math.max(silDev, centDev, changeDev),
      featuresSummary: {
        rms: bundle.audio.rms,
        spectralCentroid: bundle.audio.spectralCentroid,
        shortTimeChangeRate: bundle.audio.shortTimeChangeRate,
      },
      baselineSummary: {
        silDev,
        centDev,
        changeDev,
      },
    };
  }

  private detectMotionAnomaly(bundle: FeatureBundle): DetectedEvent | null {
    if (!bundle.video) return null;
    const cfg = this.config.motionAnomaly;
    if (this.isCoolingDown("MOTION_ANOMALY", bundle.timestamp)) return null;

    const windowMs = cfg.motionAlternationWindowSec * 1000;
    const now = bundle.timestamp;

    const recentAlts = this.motionAlt.recentDeltas.filter(
      (_, i) => i > this.motionAlt.recentDeltas.length - cfg.motionAlternationCount * 2
    );
    const altCount = recentAlts.filter(
      (d) => this.baseline.deviation("motionQuantity", d) > 2
    ).length;

    const recentNoise = this.noiseSpike.recentSpikes.filter(
      (t) => now - t < windowMs
    ).length;

    const recentStops = this.inputIrr.recentStops.filter(
      (t) => now - t < windowMs
    ).length;

    const conditions = [
      altCount >= cfg.motionAlternationCount,
      recentNoise >= cfg.noiseSpikeCount,
      recentStops >= cfg.inputIrregularStopCount,
    ].filter(Boolean).length;

    if (conditions < 2) return null;

    const confidence = Math.min(1, conditions / 3 + altCount / 10);
    this.setCooldown("MOTION_ANOMALY", bundle.timestamp, cfg.cooldownSec);

    return {
      type: "MOTION_ANOMALY",
      t0: bundle.timestamp - 5000,
      t1: bundle.timestamp,
      confidence: Math.min(1, confidence),
      baselineDeviation: altCount,
      featuresSummary: {
        motionQuantity: bundle.video.motionQuantity,
        motionSpatialVariance: bundle.video.motionSpatialVariance,
        recentNoiseSpikeCount: recentNoise,
        recentInputStopCount: recentStops,
      },
      baselineSummary: {
        altCount,
        recentNoise,
        recentStops,
      },
    };
  }

  private maybeIntervene(
    eventType: EventType,
    timestamp: number,
    confidence: number
  ): DetectedIntervention | null {
    if (!this.config.interventions.enabled) return null;
    if (this.interventionCount >= this.config.interventions.maxPerSession) return null;
    if (timestamp - this.interventionCooldown < this.config.interventions.minIntervalSec * 1000)
      return null;
    if (confidence < 0.4) return null;

    const kinds: Record<EventType, InterventionKind> = {
      FOCUS_COLLAPSE: "BREATH_GUIDE",
      CONVERSATION_TURN: "UI_MICRO_CHANGE",
      MOTION_ANOMALY: "SCREEN_TIDY",
    };

    const kind = kinds[eventType];
    this.interventionCooldown = timestamp;
    this.interventionCount++;

    return {
      kind,
      firedAt: timestamp,
      reason: eventType,
      eventType,
    };
  }

  private isCoolingDown(type: EventType, now: number): boolean {
    const state = this.cooldowns.get(type);
    if (!state) return false;
    return now - state.lastFiredAt < 0;
  }

  private setCooldown(type: EventType, now: number, cooldownSec: number): void {
    this.cooldowns.set(type, { lastFiredAt: now + cooldownSec * 1000 });
  }

  updateConfig(config: DetectionConfig): void {
    this.config = config;
  }
}
