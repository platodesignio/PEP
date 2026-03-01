"use client";

import { useState, FormEvent } from "react";

interface Props {
  runId: string;
  sessionId?: string;
}

export default function FeedbackButton({ runId, sessionId }: Props) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const meta = JSON.stringify({
        url: window.location.href,
        userAgent: navigator.userAgent.slice(0, 200),
        timestamp: new Date().toISOString(),
      });
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), runId, sessionId, metaJson: meta }),
      });
      setSent(true);
      setTimeout(() => {
        setOpen(false);
        setSent(false);
        setMessage("");
      }, 2000);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{ fontSize: "11px", padding: "4px 10px" }}
        title="フィードバックを送る"
      >
        フィードバック
      </button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            className="card"
            style={{ width: "400px", padding: "24px" }}
          >
            <h3 style={{ marginBottom: "12px", fontSize: "14px" }}>フィードバック</h3>
            {sent ? (
              <p style={{ color: "var(--color-success)" }}>送信しました。ありがとうございます。</p>
            ) : (
              <form onSubmit={submit}>
                <div className="field">
                  <label htmlFor="feedback-msg">メッセージ</label>
                  <textarea
                    id="feedback-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="問題や改善案を教えてください"
                    rows={4}
                    required
                  />
                </div>
                <p className="muted" style={{ marginBottom: "12px" }}>
                  送信時にrunId・セッション状態・ブラウザ情報が自動的に添付されます
                </p>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button data-variant="primary" type="submit" disabled={sending}>
                    {sending ? "送信中..." : "送信"}
                  </button>
                  <button type="button" onClick={() => setOpen(false)}>
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
