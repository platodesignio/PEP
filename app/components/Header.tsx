"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import FeedbackButton from "./FeedbackButton";

const navItems = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/analytics", label: "分析" },
  { href: "/settings", label: "設定" },
  { href: "/export", label: "エクスポート" },
  { href: "/account", label: "アカウント" },
];

interface Props {
  role?: string;
  runId?: string;
}

export default function Header({ role, runId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--color-border)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "48px",
        position: "sticky",
        top: 0,
        background: "var(--color-bg)",
        zIndex: 100,
      }}
    >
      <nav style={{ display: "flex", gap: "16px", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "-0.01em", marginRight: "8px" }}>
          PEP
        </span>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontSize: "12px",
              textDecoration: "none",
              color: pathname.startsWith(item.href) ? "var(--color-text)" : "var(--color-text-muted)",
              fontWeight: pathname.startsWith(item.href) ? 600 : 400,
            }}
          >
            {item.label}
          </Link>
        ))}
        {role === "ADMIN" && (
          <Link
            href="/admin"
            style={{
              fontSize: "12px",
              textDecoration: "none",
              color: pathname.startsWith("/admin") ? "var(--color-text)" : "var(--color-text-muted)",
              fontWeight: pathname.startsWith("/admin") ? 600 : 400,
            }}
          >
            管理
          </Link>
        )}
      </nav>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <FeedbackButton runId={runId ?? "no-session"} />
        <button
          onClick={logout}
          disabled={loggingOut}
          style={{ fontSize: "11px", padding: "4px 10px" }}
        >
          {loggingOut ? "..." : "ログアウト"}
        </button>
      </div>
    </header>
  );
}
