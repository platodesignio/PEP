"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import FeedbackButton from "./FeedbackButton";
import { useLocale } from "./LocaleProvider";

interface Props {
  role?: string;
  runId?: string;
}

export default function Header({ role, runId }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const { locale, t, toggle } = useLocale();

  const navItems = [
    { href: "/dashboard", label: t.nav.dashboard },
    { href: "/analytics",  label: t.nav.analytics  },
    { href: "/snn",        label: t.nav.neural      },
    { href: "/settings",   label: t.nav.settings    },
    { href: "/export",     label: t.nav.export      },
    { href: "/account",    label: t.nav.account     },
  ];

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
        <span
          style={{
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "-0.01em",
            marginRight: "8px",
          }}
        >
          PEP
        </span>

        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              fontSize: "12px",
              textDecoration: "none",
              color: pathname.startsWith(item.href)
                ? "var(--color-text)"
                : "var(--color-text-muted)",
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
              color: pathname.startsWith("/admin")
                ? "var(--color-text)"
                : "var(--color-text-muted)",
              fontWeight: pathname.startsWith("/admin") ? 600 : 400,
            }}
          >
            {t.nav.admin}
          </Link>
        )}
      </nav>

      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        {/* 言語切り替えボタン */}
        <button
          onClick={toggle}
          title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
          style={{
            fontSize: "11px",
            padding: "3px 8px",
            fontFamily: "monospace",
            letterSpacing: "0.04em",
            minWidth: "34px",
          }}
        >
          {locale === "ja" ? "EN" : "JA"}
        </button>

        <FeedbackButton runId={runId ?? "no-session"} />

        <button
          onClick={logout}
          disabled={loggingOut}
          style={{ fontSize: "11px", padding: "4px 10px" }}
        >
          {loggingOut ? "..." : t.header.logout}
        </button>
      </div>
    </header>
  );
}
