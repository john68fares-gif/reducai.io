// /pages/welcome.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

export default function WelcomePage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'ready' | 'redirecting'>('checking');

  useEffect(() => {
    let unsub: any;

    (async () => {
      // client-side session check (avoids SSR/localStorage problems)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus('redirecting');
        router.replace(`/auth?mode=signin&from=${encodeURIComponent('/welcome')}`);
        return;
      }

      setStatus('ready');

      // If they sign out while here, kick them to auth
      unsub = supabase.auth.onAuthStateChange((_e, s) => {
        if (!s) {
          setStatus('redirecting');
          router.replace(`/auth?mode=signin&from=${encodeURIComponent('/welcome')}`);
        }
      });
    })();

    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, [router]);

  if (status !== 'ready') {
    return (
      <>
        <Head><title>Loading… · Reduc.ai</title></Head>
        <div style={page}>
          <div style={card}>
            <span style={spinner} aria-hidden />
            <span> {status === 'checking' ? 'Checking session…' : 'Redirecting…'} </span>
          </div>
        </div>
      </>
    );
  }

  // --- Authenticated content below ---
  return (
    <>
      <Head><title>Welcome · Reduc.ai</title></Head>
      <main style={page}>
        <div style={container}>
          <div style={panel}>
            <h1 style={h1}>Welcome 👋</h1>
            <p style={p}>You’re signed in. Continue your onboarding or head to your builder.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button
                onClick={() => router.push('/builder?onboard=1')}
                style={primary}
              >
                Continue setup
              </button>
              <button
                onClick={() => router.push('/builder')}
                style={ghost}
              >
                Open Builder
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// Force this page to be server-rendered at request time (no static prerender),
// so Next won't try to run client hooks during build.
export async function getServerSideProps() {
  return { props: {} };
}

// --- inline styles (kept minimal and consistent with your dark UI) ---
const ACCENT = '#6af7d1';

const page: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0b0c10',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  padding: 24,
};

const container: React.CSSProperties = {
  width: '100%',
  maxWidth: 920,
  padding: 16,
};

const panel: React.CSSProperties = {
  borderRadius: 22,
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: '0 18px 60px rgba(0,0,0,0.50), inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  padding: '24px 22px',
};

const h1: React.CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' };
const p: React.CSSProperties = { opacity: 0.85, marginTop: 8 };

const primary: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 14,
  background: ACCENT,
  color: '#000',
  fontWeight: 800,
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
  cursor: 'pointer',
};

const card: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(16,19,20,0.88)',
  borderRadius: 16,
  padding: '14px 18px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
};

const spinner: React.CSSProperties = {
  width: 18, height: 18, borderRadius: 999,
  border: '2px solid rgba(255,255,255,0.7)',
  borderTopColor: 'transparent',
  display: 'inline-block',
  animation: 'spin 0.9s linear infinite',
};

// Keyframes for spinner (global)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
  document.head.appendChild(style);
}
