"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登録に失敗しました");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">メールアドレス</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <div className="field">
        <label htmlFor="password">パスワード</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <p className="muted" style={{ marginTop: "4px" }}>
          10文字以上 大小英字 数字 記号を含めてください
        </p>
      </div>
      <div
        className="card"
        style={{ marginBottom: "16px", fontSize: "11px", color: "var(--color-text-muted)" }}
      >
        生データ（音声・映像・入力内容）はデフォルトでは保存されません。
        保存されるのは低次特徴量とイベントメタデータのみです。
        詳細はプライバシー設計を設定画面で確認できます。
      </div>
      {error && <p className="error-text" style={{ marginBottom: "12px" }}>{error}</p>}
      <button data-variant="primary" type="submit" disabled={loading} style={{ width: "100%" }}>
        {loading ? "登録中..." : "アカウントを作成"}
      </button>
      <p style={{ marginTop: "16px", textAlign: "center", fontSize: "12px" }}>
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login">ログイン</Link>
      </p>
    </form>
  );
}
