export type Locale = "ja" | "en";

// ─── 翻訳辞書 ────────────────────────────────────────────────────────────────
export const translations = {
  ja: {
    nav: {
      dashboard: "ダッシュボード",
      analytics: "分析",
      neural:    "ニューラル",
      settings:  "設定",
      export:    "エクスポート",
      account:   "アカウント",
      admin:     "管理",
    },
    header: {
      logout:    "ログアウト",
    },
    snn: {
      title:           "ニューラル SNN シミュレーター",
      start:           "開始",
      stop:            "停止",
      learningOn:      "学習: 🟢 ON",
      learningOff:     "学習: ⚫ OFF",
      rasterPlot:      "スパイクラスター",
      weightHeatmap:   "重み行列ヒートマップ (W_in | W_out)",
      vmTrace:         "膜電位 Vm トレース（出力 3 ニューロン）",
      networkGraph:    "ネットワーク接続図",
      params:          "パラメータ調整",
      eventLog:        "イベントログ",
      eventsCount:     "件",
      waiting:         "イベント待機中...",
      startToRecord:   "「開始」するとイベントが記録されます",
      focusCollapse:   "集中崩壊",
      conversationTurn:"会話転換",
      motionAnomaly:   "動作異常",
    },
    params: {
      nHiddenExc:        "興奮性ニューロン数",
      nHiddenInh:        "抑制性ニューロン数",
      tauMExcMs:         "τ_m (興奮)",
      vThreshExcMv:      "V_th (興奮)",
      rMaxHz:            "r_max (Poisson)",
      aPlus:             "STDP A+",
      aMinus:            "STDP A−",
      outputThresholdHz: "検出閾値",
    },
  },

  en: {
    nav: {
      dashboard: "Dashboard",
      analytics: "Analytics",
      neural:    "Neural",
      settings:  "Settings",
      export:    "Export",
      account:   "Account",
      admin:     "Admin",
    },
    header: {
      logout:    "Logout",
    },
    snn: {
      title:           "Neural SNN Simulator",
      start:           "Start",
      stop:            "Stop",
      learningOn:      "Learn: 🟢 ON",
      learningOff:     "Learn: ⚫ OFF",
      rasterPlot:      "Spike Raster",
      weightHeatmap:   "Weight Heatmap (W_in | W_out)",
      vmTrace:         "Membrane Potential Vm (3 output neurons)",
      networkGraph:    "Network Graph",
      params:          "Parameters",
      eventLog:        "Event Log",
      eventsCount:     " events",
      waiting:         "Waiting for events...",
      startToRecord:   "Press \"Start\" to begin recording events",
      focusCollapse:   "Focus Collapse",
      conversationTurn:"Conversation Turn",
      motionAnomaly:   "Motion Anomaly",
    },
    params: {
      nHiddenExc:        "Excitatory neurons",
      nHiddenInh:        "Inhibitory neurons",
      tauMExcMs:         "τ_m (exc)",
      vThreshExcMv:      "V_th (exc)",
      rMaxHz:            "r_max (Poisson)",
      aPlus:             "STDP A+",
      aMinus:            "STDP A−",
      outputThresholdHz: "Detection threshold",
    },
  },
} as const;

export type T = (typeof translations)[Locale];
