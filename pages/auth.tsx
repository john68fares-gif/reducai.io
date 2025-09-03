// /pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

type Mode = 'signin' | 'signup';
const ACCENT = '#21e8c7';

export default function AuthPage() {
  const router = useRouter();
  const queryMode = (router.query.mode === 'signup' ? 'signup' : 'signin') as Mode;
  const from = useMemo(
    () => (typeof router.query.from === 'string' ? router.query.from : '/builder'),
    [router.query.from]
  );

  const [mode, setMode] = useState<Mode>(queryMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // signup-only
  const [username, setUsername] = useState('');
  const [heardAbout, setHeardAbout] = useState('');
  // UX
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'checking' | 'contacting' | 'finalizing'>('idle');
  const [msg, setMsg] = useState<string | null>(typeof router.query.msg === 'string' ? router.query.msg : null);
  const [err, setErr] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    setMode(queryMode);
    setErr(null); setMsg(null); setVerifySent(false); setPhase('idle');
  }, [queryMode]);

  // If already signed in, bounce to "from"
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace(from || '/builder');
        return;
      }
      unsub = supabase.auth.onAuthStateChange((_e, sess) => {
        if (sess) router.replace(from || '/builder');
      });
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, [from, router]);

  const switchMode = (m: Mode) => {
    router.replace({ pathname: '/auth', query: { mode: m, from } }, undefined, { shallow: true });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);

    if (!email || !password) return setErr('Please fill your email and password.');
    if (mode === 'signup' && (!username || username.trim().length < 3))
      return setErr('Choose a username (3+ characters).');

    try {
      setBusy(true); setPhase('checking'); await delay(250);

      if (mode === 'signin') {
        setPhase('contacting');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setPhase('finalizing'); await delay(350);
        localStorage.setItem('postAuthRedirect', from);
        router.replace(from);
      } else {
        setPhase('contacting');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username,
              preferred_username: username,
              user_name: username,
              heard_about: heardAbout || 'unspecified',
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`,
          },
        });
        if (error) throw error;

        setPhase('finalizing'); await delay(350);

        if (!data.session) {
          setVerifySent(true);
          setMsg('Account created! Verify your email, then sign in.');
          return;
        }
        localStorage.setItem('postAuthRedirect', `${from}?onboard=1&mode=signup`);
        router.replace(`${from}?onboard=1&mode=signup`);
      }
    } catch (e: any) {
      const m = (e?.message || '').toLowerCase();
      if (m.includes('invalid login credentials')) setErr('Wrong email or password.');
      else if (m.includes('email not confirmed')) setErr('Email not verified yet. Check your inbox.');
      else if (m.includes('already registered')) setErr('This email is already registered. Try signing in.');
      else setErr(e?.message || 'Something went wrong.');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      setErr(null); setBusy(true); setPhase('contacting');
      localStorage.setItem('postAuthRedirect', mode === 'signup' ? `${from}?onboard=1&mode=signup` : from);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || 'Could not open Google right now.');
      setBusy(false); setPhase('idle');
    }
  }

  return (
    <>
      <Head><title>{mode === 'signup' ? 'Sign up' : 'Sign in'} · Reduc.ai</title></Head>

      <div className="page">
        {/* glows */}
        <div className="glow glow-1" />
        <div className="glow glow-2" />

        <div className="wrap">
          {/* LEFT: Auth card (shifted left, bigger) */}
          <section className="card auth-card appear">
            {/* tabs */}
            <div className="tabs">
              <button
                className={`tab ${mode === 'signin' ? 'active' : ''}`}
                disabled={busy}
                onClick={() => switchMode('signin')}
              >Sign in</button>
              <button
                className={`tab ${mode === 'signup' ? 'active' : ''}`}
                disabled={busy}
                onClick={() => switchMode('signup')}
              >Sign up</button>
            </div>

            {verifySent ? (
              <div className="verify">
                <h2>Check your email</h2>
                <p>We sent a verification link to <b>{email}</b>. After verifying, come back here to sign in.</p>
                <button className="ghost" onClick={() => setVerifySent(false)}>Use a different email</button>
              </div>
            ) : (
              <form className="form" onSubmit={handleSubmit}>
                {mode === 'signup' && (
                  <div className="row">
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      className="input"
                    />
                    <select
                      value={heardAbout}
                      onChange={(e) => setHeardAbout(e.target.value)}
                      className="input"
                    >
                      <option value="">Where did you hear about us?</option>
                      <option value="twitter
