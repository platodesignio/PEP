import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Header from "@/app/components/Header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header role={session.role} />
      <main style={{ flex: 1, maxWidth: "1100px", width: "100%", margin: "0 auto", padding: "32px 24px" }}>
        <div style={{ marginBottom: "16px" }}>
          <span
            style={{
              fontSize: "11px",
              padding: "2px 8px",
              border: "1px solid currentColor",
              borderRadius: "12px",
              color: "var(--color-text-muted)",
            }}
          >
            管理者モード
          </span>
        </div>
        {children}
      </main>
    </div>
  );
}
