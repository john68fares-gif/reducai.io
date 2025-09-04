// /pages/index.tsx
import Head from 'next/head';
import { useRouter } from 'next/router';

const ACCENT = '#6af7d1';

export default function Home() {
  const router = useRouter();

  function goSignIn() {
    router.push('/auth?mode=signin&from=%2Fbuilder');
  }

  return (
    <>
      <Head>
        <title>Reduc.ai — Build AI agents</title>
        <meta name="description" content="Build and manage AI agents with Reduc.ai" />
      </Head>

      <main style={page}>
        <div className="glow glow1" />
        <div className="glow glow2" />

        <section style={hero}>
          <h1 style={h1}>Build your agent in minutes</h1>
          <p style={sub}>
            Production-ready tools. Clean onboarding. Secure by Supabase Auth.
          </p>

          {/* ONE BUTTON ONLY — always opens /auth */}
          <button onClick={goSignIn} style={primary}>
            Sign in to start
          </button>
        </section>
      </main>

      <style jsx global>{`
        html, body { margin: 0; background: #0b0c10; color: #fff; }
      `}</style>
      <style jsx>{`
        .glow { position: fixed; border-radius: 9999px; pointer-events: none; filter: blur(24px); }
        .glow1 { width: 720px; height: 720px; left: -180px; top: -160px; background: radial-gradient(circle, rgba(106,247,209,0.10), transparent 60%); }
        .glow2 { width: 620px; height: 620px; right: -200px; bottom: -180px; background: radial-gradient(circle, rgba(106,247,209,0.08), transparent 65%); }
      `}</style>
    </>
  );
}

/* ==== inline styles ==== */
const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0b0c10',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  padding: '72px 24px',
};

const hero: React.CSSProperties = {
  width: '100%',
  maxWidth: 960,
  textAlign: 'left',
};

const h1: React.CSSProperties = {
  margin: 0,
  fontSize: 44,
  letterSpacing: '-0.02em',
  fontWeight: 900,
};

const sub: React.CSSProperties = {
  margin: '14px 0 28px',
  opacity: 0.86,
  fontSize: 18,
};

const primary: React.CSSProperties = {
  padding: '12px 18px',
  borderRadius: 14,
  background: ACCENT,
  color: '#000',
  fontWeight: 900,
  border: '1px solid rgba(106,247,209,0.45)',
  boxShadow: '0 0 10px rgba(106,247,209,0.18)',
  cursor: 'pointer',
};
