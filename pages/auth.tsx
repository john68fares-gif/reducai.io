// pages/auth.tsx
'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { useMemo } from 'react';

export default function AuthPage() {
  const router = useRouter();
  const mode = (router.query.mode === 'signin' ? 'signin' : 'signup') as 'signin' | 'signup';
  const from = (router.query.from as string) || '/builder';

  // Where to send the user after Google
  // - signup: show onboarding on /builder
  // - signin: skip onboarding
  const callbackUrl = useMemo(() => {
    const base = from || '/builder';
    return mode === 'signup'
      ? `${base}?onboard=1&mode=signup`
      : `${base}?mode=signin`;
  }, [mode, from]);

  const googleHref = `/api/auth/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <>
      <Head>
        <title>{mode === 'signup' ? 'Sign up' : 'Sign in'} – Reduc AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={S.page}>
        <div style={S.grid} />
        <div style={{ ...S.glow, top: -220, left: -180 }} />
        <div style={{ ...S.glow, bottom: -260, right: -180 }} />

        <section style={S.centerWrap}>
          <div style={S.card}>
            <div style={S.tabRow}>
              <button
                onClick={() =>
                  router.replace(`/auth?mode=signin&from=${encodeURIComponent(from)}`)
                }
                style={{ ...S.tabBtn, ...(mode === 'signin' ? S.tabActive : {}) }}
              >
                Sign in
              </button>
              <button
                onClick={() =>
                  router.replace(`/auth?mode=signup&from=${encodeURIComponent(from)}`)
                }
                style={{ ...S.tabBtn, ...(mode === 'signup' ? S.tabActive : {}) }}
              >
                Sign up
              </button>
            </div>

            {/* Anchor fallback + JS click = always works */}
            <a href={googleHref} style={{ textDecoration: 'none' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  signIn('google', { callbackUrl });
                }}
                style={S.googleBtn}
              >
                Continue with Google
              </button>
            </a>

            <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
              You must sign {mode === 'signup' ? 'up' : 'in'} to continue.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    position: 'relative',
    minHeight: '100vh',
    background: '#0b0c10',
    color: '#fff',
    overflow: 'hidden',
    fontFamily:
      'Manrope, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage:
      'repeating-linear-gradient(0deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 40px)',
    maskImage: 'radial-gradient(ellipse at 50% 0%, rgba(0,0,0,.9), transparent 65%)',
  } as React.CSSProperties,
  glow: {
    position: 'absolute',
    width: 560,
    height: 560,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(106,247,209,0.25), rgba(0,0,0,0))',
    filter: 'blur(60px)',
    pointerEvents: 'none',
  },
  centerWrap: {
    maxWidth: 520,
    margin: '80px auto 0',
    padding: '0 20px',
  },
  card: {
    padding: 24,
    borderRadius: 20,
    background: 'rgba(13,15,17,.92)',
    border: '1px solid rgba(106,247,209,.25)',
    boxShadow: 'inset 0 0 22px rgba(0,0,0,.28), 0 0 28px rgba(106,247,209,.08)',
  },
  tabRow: { display: 'flex', gap: 8, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 12,
    fontWeight: 800,
    border: '2px solid rgba(255,255,255,.15)',
    background: 'rgba(0,0,0,.2)',
    color: '#fff',
    cursor: 'pointer',
  },
  tabActive: {
    borderColor: '#00ffc2',
    boxShadow: '0 0 18px rgba(106,247,209,.35)',
    color: '#001018',
    background: '#00ffc2',
  },
  googleBtn: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    fontWeight: 800,
    background: '#fff',
    color: '#111',
    border: '2px solid rgba(255,255,255,.15)',
    cursor: 'pointer',
  },
};
