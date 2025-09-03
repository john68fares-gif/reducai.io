// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const initialMode = (router.query.mode === 'signin' ? 'signin' : 'signup') as Mode;
  const [mode, setMode] = useState<Mode>(initialMode);
  const from = useMemo(() => (typeof router.query.from === 'string' ? router.query.from : '/builder'), [router.query]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [org, setOrg] = useState(''); // optional org field you asked for
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.mode === 'signin' || router.query.mode === 'signup') {
      setMode(router.query.mode as Mode);
    }
  }, [router.query.mode]);

  // If already signed in, bounce to builder
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/builder');
      }
    });
  }, [router]);

  const handleGoogle = async () => {
    try {
      setBusy(true);
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}${from || '/builder'}${mode === 'signup' ? '?onboard=1&mode=signup' : '?mode=signin'}`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Redirect happens via OAuth; nothing else to do here.
    } catch (e: any) {
      setMsg(e?.message || 'Google sign-in failed.');
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { organization: org || null } },
        });
        if (error) throw error;
        router.replace(`${from || '/builder'}?onboard=1&mode=signup`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(`${from || '/builder'}?mode=signin`);
      }
    } catch (e: any) {
      setMsg(e?.message || 'Authentication failed.');
      setBusy(false);
    }
  };

  const card = {
    background: 'rgba(16,19,20,0.95)',
    border: '1px solid rgba(106,247,209,0.25)',
    boxShadow: '0 0 30px rgba(0,0,0,0.35)',
    borderRadius: 16,
  } as const;

  const primary = {
    background: '#00ffc2',
    color: '#0b0c10',
  } as const;

  const tab = (active: boolean) =>
    ({
      padding: '10px 18px',
      borderRadius: 12,
      fontWeight: 700,
      border: '1px solid rgba(106,247,209,0.25)',
      background: active ? '#00ffc2' : 'transparent',
      color: active ? '#0b0c10' : '#fff',
      cursor: 'pointer',
    } as const);

  return (
    <>
      <Head>
        <title>{mode === 'signup' ? 'Sign up' : 'Sign in'} – Reduc AI</title>
      </Head>
      <div
        style={{
          minHeight: '100vh',
          background: '#0b0c10',
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          padding: '40px 16px',
        }}
      >
        <div style={{ ...card, width: 420, maxWidth: '100%', padding: 20 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 14 }}>
            <button style={tab(mode === 'signin')} onClick={() => setMode('signin')} disabled={busy}>
              Sign in
            </button>
            <button style={tab(mode === 'signup')} onClick={() => setMode('signup')} disabled={busy}>
              Sign up
            </button>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={busy}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.04)',
              color: 'white',
              fontWeight: 700,
            }}
          >
            Continue with Google
          </button>

          <div style={{ textAlign: 'center', fontSize: 12, opacity: 0.8, marginTop: 8 }}>
            You must {mode === 'signup' ? 'sign up' : 'sign in'} to continue.
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '16px 0' }}>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', flex: 1 }} />
            <div style={{ fontSize: 12, opacity: 0.6 }}>or with email</div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', flex: 1 }} />
          </div>

          <form onSubmit={handleEmail}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Organization</label>
                <input
                  value={org}
                  onChange={(e) => setOrg(e.target.value)}
                  placeholder="Your organization"
                  style={inputStyle}
                />
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={inputStyle}
                required
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                required
              />
            </div>

            {msg && (
              <div style={{ marginBottom: 10, color: '#ff9db1', fontSize: 13 }}>
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 12,
                fontWeight: 800,
                border: 'none',
                ...(primary as any),
                opacity: busy ? 0.7 : 1,
              }}
            >
              {mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 12px',
  borderRadius: 10,
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.15)',
  color: 'white',
  outline: 'none',
};
