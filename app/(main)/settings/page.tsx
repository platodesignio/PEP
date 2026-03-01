"use client";

import { useEffect, useState, FormEvent } from "react";

interface ApiKey {
  id: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyProvider, setNewKeyProvider] = useState("openai");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [keyMsg, setKeyMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewSend, setPreviewSend] = useState(false);

  useEffect(() => {
    fetch("/api/apikeys").then((r) => r.json()).then((d) => setApiKeys(d.keys ?? []));
  }, []);

  async function addKey(e: FormEvent) {
    e.preventDefault();
    if (!previewSend) {
      setKeyMsg("送信内容を確認してください。プロバイダー: " + newKeyProvider + " に暗号化して保存します。確認したら「確認済み」チェックを入れて送信してください。");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/apikeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: newKeyProvider, key: newKeyValue }),
    });
    const data = await res.json();
    if (res.ok) {
      setApiKeys((prev) => [...prev.filter((k) => k.provider !== newKeyProvider), data]);
      setNewKeyValue("");
      setKeyMsg("登録しました");
      setPreviewSend(false);
    } else {
      setKeyMsg(data.error ?? "登録に失敗しました");
    }
    setLoading(false);
  }

  async function deleteKey(provider: string) {
    await fetch(`/api/apikeys?provider=${provider}`, { method: "DELETE" });
    setApiKeys((prev) => prev.filter((k) => k.provider !== provider));
  }

  return (
    <div style={{ maxWidth: "600px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>設定</h2>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>センサーアクセス</h3>
        <div className="card">
          <p className="muted">
            センサーへのアクセス許可は各セッション開始時にブラウザから求めます。
            マイクとカメラへのアクセスを拒否してもアプリは動作しますが
            取得できなかった特徴量はイベント判定に使用されません。
            現在取得されているデータは常にセッション画面の「センサー状態」で確認できます。
          </p>
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>外部AI連携 (オプション)</h3>
        <div className="card">
          <p className="muted" style={{ marginBottom: "12px" }}>
            AIによる要約とラベル提案はデフォルトで無効です。
            自分のAPIキーを登録した場合のみ動作します。
            送信するデータはイベント列・注釈・介入評価のみで生データは送りません。
            送信前にプレビューが表示されます。
          </p>
          {apiKeys.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "12px", marginBottom: "8px" }}>登録済みAPIキー</h4>
              {apiKeys.map((k) => (
                <div key={k.provider} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>{k.provider}</span>
                  <button
                    onClick={() => deleteKey(k.provider)}
                    style={{ fontSize: "11px", color: "var(--color-danger)", padding: "2px 6px" }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addKey}>
            <div className="field">
              <label htmlFor="key-provider">プロバイダー</label>
              <select id="key-provider" value={newKeyProvider} onChange={(e) => setNewKeyProvider(e.target.value)}>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="key-value">APIキー</label>
              <input
                id="key-value"
                type="password"
                value={newKeyValue}
                onChange={(e) => setNewKeyValue(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
            <div className="field" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="checkbox"
                id="preview-confirm"
                checked={previewSend}
                onChange={(e) => setPreviewSend(e.target.checked)}
                style={{ width: "auto" }}
              />
              <label htmlFor="preview-confirm" style={{ textTransform: "none", fontSize: "12px" }}>
                キーがサーバーで暗号化保存されることを確認しました
              </label>
            </div>
            {keyMsg && <p style={{ fontSize: "12px", marginBottom: "8px", color: "var(--color-text-muted)" }}>{keyMsg}</p>}
            <button data-variant="primary" type="submit" disabled={loading || !newKeyValue}>
              {loading ? "登録中..." : "登録"}
            </button>
          </form>
        </div>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>プライバシーポリシー</h3>
        <div className="card">
          <p className="muted">
            生データ（音声録音・映像録画・入力内容）はデフォルトで保存されません。
            保存されるのは低次特徴量系列とイベントメタデータと介入評価のみです。
            全フレーム解析・全録画・全録音は禁止されています。
            データはいつでもエクスポートまたは完全削除できます。
          </p>
        </div>
      </div>
    </div>
  );
}
