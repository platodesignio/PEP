"use client";

import { useEffect, useState } from "react";

interface ExportJob {
  id: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

interface NewExport {
  id: string;
  downloadToken: string;
  expiresAt: string | null;
}

export default function ExportPage() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [creating, setCreating] = useState(false);
  const [latest, setLatest] = useState<NewExport | null>(null);

  useEffect(() => {
    fetch("/api/export")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs ?? []));
  }, []);

  async function createExport() {
    setCreating(true);
    const res = await fetch("/api/export", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setLatest(data);
      setJobs((prev) => [
        { id: data.id, status: "DONE", createdAt: new Date().toISOString(), expiresAt: data.expiresAt },
        ...prev,
      ]);
    }
    setCreating(false);
  }

  function downloadLink(token: string, format: "json" | "csv") {
    return `/api/export/download?token=${token}&format=${format}`;
  }

  return (
    <div style={{ maxWidth: "600px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>データエクスポート</h2>

      <div className="section">
        <div className="card" style={{ marginBottom: "16px" }}>
          <p className="muted" style={{ marginBottom: "12px" }}>
            全データをJSON/CSVでエクスポートできます。
            エクスポートにはeventSchemaVersionとdetectionConfigVersionが含まれ
            第三者による検証が可能な形式で出力されます。
            ダウンロードリンクは1時間で期限切れになります。
          </p>
          <button data-variant="primary" onClick={createExport} disabled={creating}>
            {creating ? "準備中..." : "エクスポートを作成"}
          </button>
        </div>

        {latest && (
          <div className="card" style={{ borderColor: "var(--color-success)", marginBottom: "16px" }}>
            <h4 style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px" }}>ダウンロード準備完了</h4>
            <p className="muted" style={{ marginBottom: "8px" }}>
              期限: {latest.expiresAt ? new Date(latest.expiresAt).toLocaleString("ja-JP") : "なし"}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <a href={downloadLink(latest.downloadToken, "json")} download>
                <button data-variant="primary">JSONダウンロード</button>
              </a>
              <a href={downloadLink(latest.downloadToken, "csv")} download>
                <button>CSVダウンロード (イベント)</button>
              </a>
            </div>
          </div>
        )}
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>エクスポート履歴</h3>
        {jobs.length === 0 ? (
          <p className="muted">エクスポート履歴はありません</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                className="card"
                style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", fontSize: "12px" }}
              >
                <span className="muted">{new Date(job.createdAt).toLocaleString("ja-JP")}</span>
                <span>{job.status}</span>
                {job.expiresAt && new Date(job.expiresAt) > new Date() ? (
                  <span style={{ color: "var(--color-success)" }}>有効</span>
                ) : (
                  <span className="muted">期限切れ</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
