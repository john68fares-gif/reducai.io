// pages/voice-agent.tsx
import React, { useState } from "react";

export default function VoiceAgent() {
  const [agentId, setAgentId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function attach() {
    setMsg("Attaching…");
    try {
      const res = await fetch("/api/telephony/attach-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, phoneNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.ok) setMsg(`✅ Attached to ${data?.data?.number || phoneNumber}`);
      else setMsg(`❌ ${data?.error || "Attach failed"}`);
    } catch (e: any) {
      setMsg(`❌ ${e?.message || "Network error"}`);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#0b0c10", color: "#fff", padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Voice Agent</h1>
      <p style={{ opacity: 0.9 }}>
        Twilio webhook for “A CALL COMES IN”: <code>/api/voice/twilio/incoming</code>
      </p>

      <div style={{ display: "grid", gap: 10, maxWidth: 520, marginTop: 16 }}>
        <input
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          placeholder="agentId"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #2b2f36", background: "#111319", color: "#fff" }}
        />
        <input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="+316…"
          style={{ padding: 10, borderRadius: 8, border: "1px solid #2b2f36", background: "#111319", color: "#fff" }}
        />
        <button
          onClick={attach}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #2b2f36", background: "#00ffc2", color: "#001018", fontWeight: 700 }}
        >
          Attach Number
        </button>
        {msg && <div style={{ marginTop: 6, opacity: 0.9 }}>{msg}</div>}
      </div>
    </main>
  );
}
