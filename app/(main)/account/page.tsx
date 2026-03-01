"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface UserInfo {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    fetch("/api/user").then((r) => r.json()).then(setUser);
  }, []);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwLoading(true);
    setPwMsg(null);
    const res = await fetch("/api/user", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    setPwMsg(res.ok ? "パスワードを変更しました" : (data.error ?? "変更に失敗しました"));
    if (res.ok) { setCurrentPw(""); setNewPw(""); }
    setPwLoading(false);
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== "DELETE_MY_ACCOUNT") {
      setDeleteMsg("確認文字列が正しくありません");
      return;
    }
    setDeleteLoading(true);
    setDeleteMsg(null);
    const res = await fetch("/api/user/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: deletePw, confirm: deleteConfirm }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push("/login");
    } else {
      setDeleteMsg(data.error ?? "削除に失敗しました");
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: "480px" }}>
      <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "24px" }}>アカウント</h2>

      {user && (
        <div className="card section">
          <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>アカウント情報</h3>
          <table style={{ fontSize: "12px", width: "100%" }}>
            <tbody>
              <tr><td className="muted" style={{ paddingRight: "16px" }}>メール</td><td>{user.email}</td></tr>
              <tr><td className="muted">ロール</td><td>{user.role}</td></tr>
              <tr><td className="muted">登録日</td><td>{new Date(user.createdAt).toLocaleDateString("ja-JP")}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>パスワード変更</h3>
        <form onSubmit={changePassword}>
          <div className="field">
            <label htmlFor="current-pw">現在のパスワード</label>
            <input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="new-pw">新しいパスワード</label>
            <input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
            <p className="muted" style={{ marginTop: "4px" }}>10文字以上 大小英字 数字 記号を含めてください</p>
          </div>
          {pwMsg && <p style={{ fontSize: "12px", marginBottom: "8px", color: pwMsg.includes("変更") ? "var(--color-success)" : "var(--color-danger)" }}>{pwMsg}</p>}
          <button data-variant="primary" type="submit" disabled={pwLoading}>変更する</button>
        </form>
      </div>

      <div className="section">
        <h3 style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "var(--color-danger)" }}>
          アカウントとデータの完全削除
        </h3>
        <div className="card" style={{ borderColor: "var(--color-danger)" }}>
          <p style={{ fontSize: "12px", marginBottom: "12px" }}>
            削除するとすべてのセッション・イベント・介入データ・特徴量系列が物理削除されます。
            この操作は取り消せません。削除前にエクスポートページからデータを保存してください。
          </p>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} style={{ fontSize: "12px", color: "var(--color-danger)", borderColor: "var(--color-danger)" }}>
              削除フォームを表示
            </button>
          ) : (
            <form onSubmit={deleteAccount}>
              <div className="field">
                <label htmlFor="delete-pw">パスワード確認</label>
                <input id="delete-pw" type="password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="delete-confirm">確認文字列を入力: DELETE_MY_ACCOUNT</label>
                <input
                  id="delete-confirm"
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  required
                  placeholder="DELETE_MY_ACCOUNT"
                />
              </div>
              {deleteMsg && <p className="error-text" style={{ marginBottom: "8px" }}>{deleteMsg}</p>}
              <button data-variant="danger" type="submit" disabled={deleteLoading}>
                {deleteLoading ? "削除中..." : "アカウントとすべてのデータを削除する"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
