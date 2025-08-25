// pages/index.tsx
import Link from 'next/link';

export default function Home() {
  const card: React.CSSProperties = {
    maxWidth: 720,
    margin: '40px auto',
    padding: 24,
    border: '1px solid #2b2f36',
    borderRadius: 14,
    background: '#0d0f11',
    boxShadow: '0 6px 20px rgba(0,0,0,.25)',
    color: '#fff',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial'
  };
  const btn: React.CSSProperties = {
    display: 'inline-block',
    padding: '12px 16px',
    borderRadius: 10,
    fontWeight: 700,
    textDecoration: 'none',
    color: '#001018',
    background: '#00ffc2',
    marginRight: 12
  };
  const btn2: React.CSSProperties = { ...btn, background: '#0bd', color: '#001018' };

  return (
    <main style={{minHeight:'100vh', background:'#0b0c10', padding: 24}}>
      <div style={card}>
        <h1 style={{marginTop:0}}>✅ Vercel is up</h1>
        <p style={{opacity:.85, marginBottom:20}}>
          Start here. These links let you attach a number and test the Twilio webhook.
        </p>

        {/* Go build / attach the agent */}
        <Link href="/voice-agent" style={btn}>Open Voice Agent</Link>

        {/* Quick test of your webhook */}
        <Link href="/api/voice/twilio/incoming" style={btn2}>
          Test Twilio Webhook (XML)
        </Link>

        <div style={{marginTop:22, opacity:.8}}>
          Webhook path for Twilio “A CALL COMES IN”: <code>/api/voice/twilio/incoming</code>
        </div>
        <div style={{marginTop:6, opacity:.7}}>
          If you can’t click the link, go directly: <code>/voice-agent</code>
        </div>
      </div>
    </main>
  );
}
