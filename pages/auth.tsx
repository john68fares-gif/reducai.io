// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { supabase } from '../lib/supabase-client';

export default function AuthPage() {
  const router = useRouter();
  const { mode: qMode, from: qFrom } = router.query as { mode?: string; from?: string };

  const mode = (qMode === 'signin' ? 'signin' : 'signup') as 'signin' | 'signup';
  const [tab, setTab] = useState<'signin' | 'signup'>(mode);
  useEffect(() => setTab(mode), [mode]);

  const from = qFrom || '/builder'; // where to go after auth
  const callbackSignup = `${typeof window !== 'undefined' ? window.location.origin : ''}${from}?onboard=1&mode=signup`;
  const callbackSignin = `${typeof window !== 'undefined' ? window.location.origin : ''}${from}?mode=signin`;

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const goHome = () => router.replace('/');

  const handleGoogle = async () => {
    const cb = tab === 'signup' ? callbackSignup : callbackSignin;
    await signIn('google', { callbackUrl: cb });
  };

  // Email Magic Link with Supabase (works for both sign-in & sign-up)
  const handleEmail = async () => {
    if (!email) return;
    setErrorMsg(null);
    setSending(true);
    try {
      const redirectTo = `${window.location.origin}${from}${tab === 'signup' ? '?onboard=1&mode=signup' : '?mode=signin'}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Head>
        <title>{tab === 'signup' ? 'Sign up' : 'Sign in'} – Reduc AI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={STYLES.page}>
        {/* background grid + glow */}
        <div style={STYLES.grid} />
        <div style={{ ...STYLES.glow, top: -220, left: -180 }} />
        <div style={{ ...STYLES.glow, bottom: -260, right: -180 }} />

        <header style={STYLES.nav}>
          <div style={STYLES.brand} onClick={goHome}>
            <span style={STYLES.logoDot} />
            <span>reduc.ai</span>
          </div>
          <div />
        </header>

        <section style={STYLES.centerWrap}>
          <div style={STYLES.card}>
            {/* tabs */}
            <div style={STYLES.tabRow}>
              <button
                onClick={() => setTab('signin')}
                style={{ ...STYLES.tabBtn, ...(tab === 'signin' ? STYLES.tabActive : {}) }}
              >
                Sign in
              </button>
              <button
                onClick={() => setTab('signup')}
                style={{ ...STYLES.tabBtn, ...(tab === 'signup' ? STYLES.tabActive : {}) }}
              >
                Sign up
              </button>
            </div>

            {/* google */}
            <button onClick={handleGoogle} style={STYLES.googleBtn}>
              Continue with Google
            </button>

            {/* separator */}
            <div style={STYLES.sepWrap}>
              <div style={STYLES.sepLine} />
              <span style={STYLES.sepText}>or</span>
              <div style={STYLES.sepLine} />
            </div>

            {/* email */}
            <label style={STYLES.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={STYLES.input}
            />
            <button onClick={handleEmail} style={STYLES.primaryBtn} disabled={sending || !email}>
              {sending ? 'Sending…' : tab === 'signup' ? 'Send magic link to sign up' : 'Send magic link to sign in'}
            </button>

            {sent && (
              <div style={STYLES.note}>
                Check your email for a {tab === 'signup' ? 'sign-up' : 'sign-in'} link. After confirming,
                you’ll be redirected to <code>{from}</code>.
              </div>
            )}
            {errorMsg && <div style={STYLES.error}>{errorMsg}</div>}

            {/* small note */}
            <div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
              By continuing, you agree to our Terms & Privacy.
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

/* ------------------------------- styles -------------------------------- */
const STYLES: Record<string, React.CSSProperties> = {
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
    animation: 'gridShift 20s linear infinite',
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
  nav: {
    maxWidth: 1120,
    margin: '0 auto',
    padding: '22px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontWeight: 800,
    letterSpacing: 0.3,
    cursor: 'pointer',
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: '#6af7d1',
    boxShadow: '0 0 16px rgba(106,247,209,.8)',
  },
  centerWrap: {
    maxWidth: 520,
    margin: '40px auto 0',
    padding: '0 20px',
  },
  card: {
    position: 'relative',
    padding: 24,
    borderRadius: 20,
    background: 'rgba(13,15,17,.92)',
    border: '1px solid rgba(106,247,209,.25)',
    boxShadow: 'inset 0 0 22px rgba(0,0,0,.28), 0 0 28px rgba(106,247,209,.08)',
  },
  tabRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 16,
  },
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
  sepWrap: {
    margin: '14px 0',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sepLine: { flex: 1, height: 1, background: 'rgba(255,255,255,.15)' },
  sepText: { fontSize: 12, opacity: 0.75 },
  label: { fontSize: 13, marginTop: 6, marginBottom: 6, opacity: 0.85 },
  input: {
    width: '100%',
    borderRadius: 10,
    background: '#101314',
    color: '#fff',
    border: '1px solid #13312b',
    padding: '12px 14px',
    outline: 'none',
    marginBottom: 10,
  },
  primaryBtn: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    fontWeight: 800,
    background: '#00ffc2',
    color: '#001018',
    boxShadow: '0 0 18px rgba(106,247,209,.35)',
    cursor: 'pointer',
  },
  note: {
    marginTop: 10,
    fontSize: 13,
    opacity: 0.85,
  },
  error: {
    marginTop: 10,
    fontSize: 13,
    color: '#ff7a7a',
  },
};
