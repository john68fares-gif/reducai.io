// /pages/index.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

/**
 * Safe landing:
 * - NO server hooks, no useSession. Client-only check so it can't crash prerender.
 * - CTA decides destination:
 *      signed in  -> /builder
 *      signed out -> /auth?mode=signin&from=/builder
 * - If you want a "Get started" link elsewhere, use the same handleCreateBuild() logic.
 */

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAuthed, setIsAuthed] = useState(false);

  // Client-side session check (no SSR/localStorage issues)
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthed(!!session);
      setChecking(false);

      // Keep in sync if they sign in/out while staying on landing
      unsub = supabase.auth.onAuthStateChange((_e, sess) => {
        setIsAuthed(!!sess);
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  async function handleCreateBuild() {
    // decide destination at click time
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push('/builder');
    } else {
      router.push('/auth?mode=signin&from=%2Fbuilder');
    }
  }

  return (
    <>
      <Head>
        <title>Reduc.ai — Build AI agents</title>
        <meta name="description" content="Build and manage AI agents with Reduc.ai" />
      </Head>

      <main style={page}>
        {/* hero */}
        <section style={hero}>
          <h1 style={h1}>Build your agent in minutes</h1>
          <p style={sub}>
            Production-ready tools. Clean onboarding. Secure by Supabase Auth.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleCreateBuild} style={primary}>
              {checking ? 'Checking…' : isAuthed ? 'Open Builder' : 'Create a build'}
            </button>
            <a href="#features" style={ghost}>Learn more</a>
          </div>
        </section>

        {/* simple features to fill page a bit */}
        <section id="features" style={features}>
          <div style={card}><b>Secure auth</b><p>Google or email, backed by Supabase.</p></div>
          <div style={card}><b>Fast builder</b><p>Compose, test, and ship quickly.</p></div>
          <div style={card}><b>Clean UX</b><p>Smooth loaders, soft shadows, no noise.</p></div>
        </section>
      </main>

      {/* minimal global look so this page can stand alone */}
      <style jsx global>{`
        html, body { margin: 0; background: #0b0c10; color: #fff; }
      `}</style>
    </>
  );
}

/* ==== inline styles (kept lightweight, matches your dark theme) ==== */
const ACCENT = '#6af7d1';

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0b0c10',
  color: '#fff',
};

const hero: React.CSSProperties = {
  maxWidth: 980,
  margin: '0 auto',
  padding: '80px 24px 40px',
  textAlign: 'left',
};

const h1: React.CSSProperties = {
  margin: 0,
  fontSize: 44,
  letterSpacing: '-0.02em',
  fontWeight: 900,
};

const sub: React.CSSProperties = {
  margin: '14px 0 24px',
  opacity: 0.85,
  fontSize: 18,
};

const primary: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 14,
  background: ACCENT,
  color: '#000',
  fontWeight: 900,
  border: '1px solid rgba(106,247,209,0.45)',
  boxShadow: '0 0 10px rgba(106,247,209,0.18)',
  cursor: 'pointer',
};

const ghost: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 14,
  background: 'rgba(0,0,0,0.25)',
  color: 'rgba(255,255,255,0.95)',
  border: '1px solid rgba(255,255,255,0.20)',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const features: React.CSSProperties = {
  maxWidth: 1100,
  margin: '10px auto 80px',
  padding: '0 24px',
  display: 'grid',
  gap: 16,
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
};

const card: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  borderRadius: 20,
  padding: 16,
  boxShadow: '0 18px 60px rgba(0,0,0,0.50), inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
};
