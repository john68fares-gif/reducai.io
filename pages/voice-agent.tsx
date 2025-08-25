import { useState } from 'react';

export default function VoiceAgentPage() {
  const [agentId, setAgentId] = useState('agent_default');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function attach() {
    setLoading(true);
    setMsg('');
    try {
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, phoneNumber }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || 'Attach failed');
      setMsg(`✅ Attached: ${j.phoneNumber}. Incoming webhook: ${window.location.origin}/api/voice/twilio/incoming`);
    } catch (e: any) {
      setMsg(`❌ ${e?.message || 'Failed'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{padding:24,fontFamily:'system-ui',color:'#fff',background:'#0d0f11',minHeight:'100vh'}}>
      <h1 style={{marginTop:0}}>Voice Agent</h1>
      <div style={{display:'grid',gap:12,maxWidth:520}}>
        <label>
          <div style={{opacity:.8, marginBottom:4}}>Agent ID</div>
          <input
            value={agentId}
            onChange={(e)=>setAgentId(e.target.value)}
            placeholder="agent_default"
            style={{width:'100%',padding:10,borderRadius:8,border:'1px solid #2b2f36',background:'#111319',color:'#fff'}}
          />
        </label>
        <label>
          <div style={{opacity:.8, marginBottom:4}}>Twilio Phone Number (E.164)</div>
          <input
            value={phoneNumber}
            onChange={(e)=>setPhoneNumber(e.target.value)}
            placeholder="+12025550123"
            style={{width:'100%',padding:10,borderRadius:8,border:'1px solid #2b2f36',background:'#111319',color:'#fff'}}
          />
        </label>
        <button
          onClick={attach}
          disabled={!phoneNumber || loading}
          style={{
            padding:'10px 14px',
            background: loading ? '#2b6' : '#0bd',
            border:'none',
            borderRadius:10,
            color:'#001018',
            fontWeight:700,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Attaching…' : 'Attach Number'}
        </button>
        {msg && <div style={{whiteSpace:'pre-wrap',opacity:.95}}>{msg}</div>}
        <div style={{marginTop:8,opacity:.7}}>
          Webhook (set in Twilio “A CALL COMES IN”): <code>/api/voice/twilio/incoming</code>
        </div>
      </div>
    </main>
  );
}
