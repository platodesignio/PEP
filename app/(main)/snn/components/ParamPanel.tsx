"use client";

import type { SNNConfig } from "@/lib/snn/types";
import { useLocale } from "@/app/components/LocaleProvider";

interface SliderDef {
  key: keyof SNNConfig;
  labelKey: keyof ReturnType<typeof useLocale>["t"]["params"];
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const SLIDERS: SliderDef[] = [
  { key: "nHiddenExc",        labelKey: "nHiddenExc",        min: 4,     max: 32,   step: 4              },
  { key: "nHiddenInh",        labelKey: "nHiddenInh",        min: 1,     max: 8,    step: 1              },
  { key: "tauMExcMs",         labelKey: "tauMExcMs",         min: 5,     max: 50,   step: 5,  unit: "ms" },
  { key: "vThreshExcMv",      labelKey: "vThreshExcMv",      min: -60,   max: -44,  step: 1,  unit: "mV" },
  { key: "rMaxHz",            labelKey: "rMaxHz",            min: 20,    max: 200,  step: 10, unit: "Hz" },
  { key: "aPlus",             labelKey: "aPlus",             min: 0.001, max: 0.05, step: 0.001          },
  { key: "aMinus",            labelKey: "aMinus",            min: 0.001, max: 0.05, step: 0.001          },
  { key: "outputThresholdHz", labelKey: "outputThresholdHz", min: 10,    max: 80,   step: 5,  unit: "Hz" },
];

interface Props {
  config: SNNConfig;
  onChange: (cfg: SNNConfig) => void;
}

export default function ParamPanel({ config, onChange }: Props) {
  const { t } = useLocale();

  function update(key: keyof SNNConfig, value: number) {
    onChange({ ...config, [key]: value });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        gap: "10px 20px",
      }}
    >
      {SLIDERS.map((s) => {
        const val = config[s.key] as number;
        return (
          <label key={s.key} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
              <span style={{ color: "var(--color-text-muted)" }}>{t.params[s.labelKey]}</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600, fontSize: "11px" }}>
                {Number.isInteger(s.step) ? val : val.toFixed(3)}
                {s.unit ?? ""}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={val}
              style={{ width: "100%", accentColor: "var(--color-accent, #6366f1)" }}
              onChange={(e) => update(s.key, parseFloat(e.target.value))}
            />
          </label>
        );
      })}
    </div>
  );
}
