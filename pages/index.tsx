// pages/index.tsx
import Link from "next/link";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b0c10", color: "#fff", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>🚀 WELCOME v3 — This is the NEW home</h1>
      <p style={{ opacity: 0.9 }}>If you still see “Vercel is up”, you’re on an old deployment URL or cached page.</p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Link href="/builder" style={{ padding: "10px 14px", background: "#00ffc2", borderRadius: 10, color: "#001018", fontWeight: 700, textDecoration: "none" }}>
          Open Builder
        </Link>
        <Link href="/voice-agent" style={{ padding: "10px 14px", background: "#0bd", borderRadius: 10, color: "#001018", fontWeight: 700, textDecoration: "none" }}>
          Voice Agent
        </Link>
        <Link href="/api/voice/twilio/incoming" style={{ padding: "10px 14px", background: "#ffea00", borderRadius: 10, color: "#001018", fontWeight: 700, textDecoration: "none" }}>
          Test Webhook (XML)
        </Link>
      </div>
    </main>
  );
}
