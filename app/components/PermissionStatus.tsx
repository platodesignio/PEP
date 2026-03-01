"use client";

interface PermissionState {
  microphone: "granted" | "denied" | "prompt" | "unavailable";
  camera: "granted" | "denied" | "prompt" | "unavailable";
  keyboard: "active" | "unavailable";
  mouse: "active" | "unavailable";
}

interface Props {
  permissions: PermissionState;
}

const labels: Record<string, string> = {
  granted: "取得中",
  denied: "拒否済",
  prompt: "未許可",
  unavailable: "利用不可",
  active: "取得中",
};

const colors: Record<string, string> = {
  granted: "var(--color-success)",
  active: "var(--color-success)",
  denied: "var(--color-danger)",
  unavailable: "var(--color-text-muted)",
  prompt: "var(--color-warning)",
};

export default function PermissionStatus({ permissions }: Props) {
  const items: Array<{ key: string; label: string; state: string }> = [
    { key: "mic", label: "マイク", state: permissions.microphone },
    { key: "cam", label: "カメラ", state: permissions.camera },
    { key: "kb", label: "キーボード", state: permissions.keyboard },
    { key: "ms", label: "マウス", state: permissions.mouse },
  ];

  const hasIssue =
    permissions.microphone === "denied" ||
    permissions.camera === "denied" ||
    permissions.microphone === "unavailable";

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {items.map((item) => (
          <span
            key={item.key}
            style={{ fontSize: "11px", color: colors[item.state] ?? "var(--color-text-muted)" }}
          >
            {item.label}: {labels[item.state] ?? item.state}
          </span>
        ))}
      </div>
      {hasIssue && (
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text-muted)",
            marginTop: "4px",
          }}
        >
          取得できなかった特徴量はスキップされます。取得できた特徴量のみでイベント判定を行います。
        </p>
      )}
    </div>
  );
}
