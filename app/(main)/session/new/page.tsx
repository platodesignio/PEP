"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSessionPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSession() {
    setCreating(true);
    setError(null);
    try {
      const deviceInfoJson = JSON.stringify({
        userAgent: navigator.userAgent.slice(0, 200),
        platform: navigator.platform,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
      });

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceInfoJson }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "セッション作成に失敗しました");
        return;
      }

      const data = await res.json();
      router.push(`/session/${data.runId}/live`);
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>新規セッション</h2>

      <div className="card section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>プライバシー設計</h3>
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", lineHeight: "1.8" }}>
          このアプリは以下のデータのみ保存します。
          音声・映像・入力内容の生データはデフォルトでは保存しません。
          保存するのは低次特徴量系列（RMSエネルギー・動き量・入力リズムなど）と
          イベントメタデータと介入評価のみです。
          全フレーム解析・全録画・全録音は禁止されています。
        </p>
      </div>

      <div className="card section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>センサーアクセス</h3>
        <p style={{ fontSize: "12px", color: "var(--color-text-muted)", marginBottom: "12px" }}>
          セッション開始時にマイク・カメラへのアクセス許可を求めます。
          許可しなくてもアプリは動作しますが、取得できなかった特徴量は
          イベント判定に使用されません。何が計測されているかは常に画面上で確認できます。
        </p>
      </div>

      {error && <p className="error-text" style={{ marginBottom: "12px" }}>{error}</p>}

      <button data-variant="primary" onClick={startSession} disabled={creating}>
        {creating ? "準備中..." : "セッションを開始する"}
      </button>
    </div>
  );
}
