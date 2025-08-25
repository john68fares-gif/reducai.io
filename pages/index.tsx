// pages/index.tsx
export default function Home() {
  return (
    <main style={{padding:24,fontFamily:'system-ui',color:'#fff',background:'#0d0f11',minHeight:'100vh'}}>
      <h1 style={{margin:0}}>✅ Vercel is up</h1>
      <p style={{opacity:.9}}>Webhook: <code>/api/voice/twilio/incoming</code></p>
    </main>
  );
}
