export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-bg)",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "360px" }}>
        <div style={{ marginBottom: "32px", textAlign: "center" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Plato Event Proof Lab
          </h1>
          <p style={{ color: "var(--color-text-muted)", fontSize: "12px", marginTop: "4px" }}>
            プライバシー優先のイベント設計証明基盤
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
