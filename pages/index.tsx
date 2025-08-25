// pages/index.tsx
import Link from "next/link";

export default function Home() {
  const card: React.CSSProperties = {
    maxWidth: 820,
    margin: "40px auto",
    padding: 24,
    border: "1px solid #2b2f36",
    borderRadius: 14,
    background: "#0d0f11",
    boxShadow: "0 6px 20px rgba(0,0,0,.25)",
    color: "#fff",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  };
  const btn: React.CSSProperties = {
    display: "inline-block",
    padding: "12px 16px",
    borderRadius: 10,
    fontWeight: 700,
    textDecoration: "none",
    color: "#001018",
    marginRight: 12,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c10", padding: 24 }}>
      <div style={card}>
        <h1 style={{ marginTop: 0 }}>Reduc.ai — Welcome</h1>
        <p style={{ opacity: 0.9, marginBottom: 18 }}>
          Choose where you want to go:
        </p>

        {/* Open the internal app (dashboard menu) */}
        <Link href="/app" style={{ ...btn, background: "#00ffc2" }}>
          Open App
        </Link>

        {/* Go straight to Voice Agent attach page */}
        <Link href="/voice-agent" style={{ ...btn, background: "#0bd" }}>
          Voice Agent
        </Link>

        {/* Quick check that Twilio webhook is reachable */}
        <Link
          href="/api/voice/twilio/incoming"
          style={{ ...btn, background: "#ffea00" }}
        >
          Test Twilio Webhook (XML)
        </Link>

        <div style={{ marginTop: 22, opacity: 0.8 }}>
          Webhook for Twilio “A CALL COMES IN”:
          <code style={{ marginLeft: 6 }}>/api/voice/twilio/incoming</code>
        </div>
      </div>
    </main>
  );
}
