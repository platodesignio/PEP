"use client";

import { useState, FormEvent } from "react";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const meta = JSON.stringify({
        url: window.location.href,
        userAgent: navigator.userAgent.slice(0, 200),
        timestamp: new Date().toISOString(),
      });
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          runId: "no-session",
          metaJson: meta,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "送信に失敗しました");
        return;
      }
      setSent(true);
      setMessage("");
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>フィードバック</h2>
      {sent ? (
        <div className="card" style={{ textAlign: "center", padding: "32px" }}>
          <p style={{ color: "var(--color-success)", marginBottom: "8px" }}>送信しました。ありがとうございます。</p>
          <button onClick={() => setSent(false)}>別のフィードバックを送る</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="fb-message">メッセージ</label>
            <textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="問題・改善案・感想を教えてください"
              rows={6}
              required
            />
          </div>
          <p className="muted" style={{ marginBottom: "12px" }}>
            送信時にURL・ブラウザ情報・タイムスタンプが自動的に添付されます。
            個人情報は添付されません。
          </p>
          {error && <p className="error-text" style={{ marginBottom: "12px" }}>{error}</p>}
          <button data-variant="primary" type="submit" disabled={sending}>
            {sending ? "送信中..." : "送信"}
          </button>
        </form>
      )}
    </div>
  );
}
