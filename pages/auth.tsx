// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { supabase } from '../lib/supabaseClient';

export default function AuthPage() {
  const router = useRouter();
  const modeParam = (router.query.mode as string) || 'signup'; // 'signup' | 'signin'
  const from = (router.query.from as string) || '/builder';
  const [tab, setTab] = useState<'signup' | 'signin'>(modeParam === 'signin' ? 'signin' : 'signup');

  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // if already authenticated via Supabase, bounce to from=…
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace(from);
      }
    });
  }, [from, router]);

  const go = (isSignup: boolean) => {
    const q = new URLSearchParams();
    if (isSignup) q.set('onboard', '1');
    q.set('mode', isSignup ? 'signup' : 'signin');
    return `${from}?${q.toString()}`;
  };

  const handleGoogle = async (isSignup: boolean) => {
    // Use your existing NextAuth Google provider
    await signIn('google', { callbackUrl: go(isSignup) });
  };

  const sendEmailCode = async () => {
    setErr(null); setMsg(null);
    if (!email) return setErr('Enter your email');
    try {
      setLoading(true);
      // shouldCreateUser=true for Sign up; false for Sign in
      const shouldCreateUser = tab === 'signup';
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser,
          // optional: redirect for magic-link (still works with OTP)
          emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}${go(tab === 'signup')}` : undefined,
        },
      });
      if (error) throw error;
      setCodeSent(true);
      setMsg('We emailed you a 6-digit code. Enter it below.');
    } catch (e: any) {
      setErr(e?.message || 'Could not send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setErr(null); setMsg(null);
    if (!email || !code) return setErr('Enter the code we sent.');
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email', // 6-digit email OTP
      });
      if (error) throw error;
      // success
      router.replace(go(tab === 'signup'));
    } catch (e: any) {
      setErr(e?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.tabs}>
          <button
            onClick={() => setTab('signup')}
            style={{ ...styles.tab, ...(tab === 'signup' ? styles.tabActive : {}) }}
          >
            Sign up
          </button>
          <button
            onClick={() => setTab('signin')}
            style={{ ...styles.tab, ...(tab === 'signin' ? styles.tabActive : {}) }}
          >
            Log in
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Google */}
          <button
            onClick={() => handleGoogle(tab === 'signup')}
            style={styles.googleBtn}
          >
            Continue with Google
          </button>

          {/* Divider */}
          <div style={styles.divider}>
            <span style={{ background: '#0b0c10', padding: '0 8px', color: 'rgba(255,255,255,.7)' }}>or</span>
          </div>

          {/* Email OTP */}
          {!codeSent ? (
            <>
              <label style={styles.label}>Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={styles.input}
                type="email"
              />
              <button onClick={sendEmailCode} style={styles.primaryBtn} disabled={loading}>
                {loading ? 'Sending…' : (tab === 'signup' ? 'Sign up with Email' : 'Log in with Email')}
              </button>
            </>
          ) : (
            <>
              <label style={styles.label}>Enter 6-digit code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••"
                maxLength={6}
                style={styles.input}
                inputMode="numeric"
              />
              <button onClick={verifyCode} style={styles.primaryBtn} disabled={loading}>
                {loading ? 'Verifying…' : 'Continue'}
              </button>
              <button onClick={() => { setCodeSent(false); setCode(''); }} style={styles.linkBtn}>
                Resend or change email
              </button>
            </>
          )}

          {msg && <div style={{ marginTop: 10, color: '#6af7d1' }}>{msg}</div>}
          {err && <div style={{ marginTop: 10, color: '#ff8f8f' }}>{err}</div>}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0b0c10',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'Manrope, Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
    color: '#fff',
    padding: 20,
  },
  card: {
    width: 560,
    maxWidth: '95vw',
    borderRadius: 20,
    background: 'rgba(16,19,20,.92)',
    border: '1px solid rgba(106,247,209,.25)',
    boxShadow: 'inset 0 0 22px rgba(0,0,0,.28), 0 0 28px rgba(106,247,209,.08)',
  },
  tabs: {
    display: 'flex',
    gap: 6,
    padding: 8,
    borderBottom: '1px solid rgba(255,255,255,.15)',
  },
  tab: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 10,
    fontWeight: 800,
    background: 'transparent',
    border: '1px solid rgba(255,255,255,.15)',
    color: 'rgba(255,255,255,.85)',
    cursor: 'pointer',
  },
  tabActive: {
    background: '#00ffc2',
    color: '#001018',
    boxShadow: '0 0 14px rgba(106,247,209,.35)',
    border: '1px solid rgba(0,0,0,0)',
  },
  googleBtn: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'rgba(0,0,0,.2)',
    border: '2px solid rgba(255,255,255,.15)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
  divider: {
    display: 'grid',
    alignItems: 'center',
    gridTemplateColumns: '1fr auto 1fr',
    gap: 10,
    margin: '14px 0',
    color: 'rgba(255,255,255,.5)',
  },
  label: { fontSize: 13, opacity: .8, display: 'block', marginTop: 6, marginBottom: 6 },
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 12,
    background: '#101314',
    border: '1px solid rgba(255,255,255,.18)',
    color: '#fff',
    outline: 'none',
  },
  primaryBtn: {
    width: '100%',
    marginTop: 12,
    padding: '12px 16px',
    borderRadius: 12,
    fontWeight: 800,
    background: '#00ffc2',
    color: '#001018',
    boxShadow: '0 0 18px rgba(106,247,209,.35)',
    cursor: 'pointer',
  },
  linkBtn: {
    marginTop: 10,
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,.75)',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
};
