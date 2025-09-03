// /pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import { Sparkles, Shield, CheckCircle2, Lock } from 'lucide-react';

type Mode = 'signin' | 'signup';
const ACCENT = '#21e8c7'; // softer mint

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

  // signup-only fields
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
    setErr(null);
    setMsg(null);
    setVerifySent(false);
    setPhase('idle');
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
    setErr(null);
    setMsg(null);

    if (!email || !password) {
      setErr('Please fill your email and password.');
      return;
    }
    if (mode === 'signup' && (!username || username.trim().length < 3)) {
      setErr('Choose a username (3+ characters).');
      return;
    }

    try {
      setBusy(true);
      setPhase('checking');
      await delay(250);

      if (mode === 'signin') {
        setPhase('contacting');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setPhase('finalizing');
        localStorage.setItem('postAuthRedirect', from);
        await delay(350);
        router.replace(from);
      } else {
        setPhase('contacting');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: username,              // so your default account gets this name via trigger
              preferred_username: username,
              user_name: username,
              heard_about: heardAbout || 'unspecified',
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`,
          },
        });
        if (error) throw error;

        setPhase('finalizing');
        await delay(350);

        // Most setups require email verification = no session yet
        if (!data.session) {
          setVerifySent(true);
          setMsg('Account created! Verify your email, then sign in.');
          return;
        }

        // Auto-confirm case
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
      setErr(null);
      setBusy(true);
      setPhase('contacting');
      localStorage.setItem(
        'postAuthRedirect',
        mode === 'signup' ? `${from}?onboard=1&mode=signup` : from
      );
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
      setBusy(false);
      setPhase('idle');
    }
  }

  return (
    <>
      <Head>
        <title>{mode === 'signup' ? 'Sign up' : 'Sign in'} · Reduc.ai</title>
      </Head>

      <main className="min-h-screen font-movatif" style={{ background: '#0b0c10', color: '#fff' }}>
        {/* Background accents */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div
            className="absolute -top-28 -left-24 w-[720px] h-[720px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(33,232,199,0.12), transparent 60%)', filter: 'blur(22px)' }}
          />
          <div
            className="absolute -bottom-40 -right-24 w-[620px] h-[620px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(33,232,199,0.08), transparent 65%)', filter: 'blur(24px)' }}
          />
        </div>

        {/* Layout: form left, welcome right (bigger, left-aligned) */}
        <div className="mx-auto max-w-7xl px-6 py-14 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          {/* LEFT — Auth card */}
          <section className="order-2 lg:order-1">
            <div
              className="w-full max-w-[640px] rounded-2xl p-6 md:p-8"
              style={{
                marginLeft: 0,
                background: 'rgba(14,16,18,0.96)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.50), 0 0 26px rgba(33,232,199,0.10)',
              }}
            >
              {/* Tabs */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => switchMode('signin')}
                  className="flex-1 py-2 rounded-xl font-semibold transition"
                  style={{
                    background: mode === 'signin' ? ACCENT : 'rgba(255,255,255,0.06)',
                    color: mode === 'signin' ? '#0b0c10' : 'rgba(255,255,255,0.92)',
                    boxShadow: mode === 'signin' ? '0 0 8px rgba(33,232,199,0.18)' : 'none',
                  }}
                  disabled={busy}
                >
                  Sign in
                </button>
                <button
                  onClick={() => switchMode('signup')}
                  className="flex-1 py-2 rounded-xl font-semibold transition"
                  style={{
                    background: mode === 'signup' ? ACCENT : 'rgba(255,255,255,0.06)',
                    color: mode === 'signup' ? '#0b0c10' : 'rgba(255,255,255,0.92)',
                    boxShadow: mode === 'signup' ? '0 0 8px rgba(33,232,199,0.18)' : 'none',
                  }}
                  disabled={busy}
                >
                  Sign up
                </button>
              </div>

              {/* Form */}
              {verifySent ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold">Check your email</h2>
                  <p className="text-white/80">
                    We sent a verification link to <span className="text-white">{email}</span>. After verifying,
                    come back here to sign in.
                  </p>
                  <button
                    onClick={() => setVerifySent(false)}
                    className="mt-2 py-2 px-3 rounded-lg border"
                    style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                  {mode === 'signup' && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#21e8c7]"
                      />
                      <select
                        value={heardAbout}
                        onChange={(e) => setHeardAbout(e.target.value)}
                        className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#21e8c7]"
                      >
                        <option value="">Where did you hear about us?</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="tiktok">TikTok</option>
                        <option value="youtube">YouTube</option>
                        <option value="friend">Friend / Colleague</option>
                        <option value="search">Google Search</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  )}

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#21e8c7]"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
                    className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#21e8c7]"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-1 py-3 rounded-xl font-semibold transition disabled:opacity-60"
                    style={{
                      background: ACCENT,
                      color: '#0b0c10',
                      boxShadow: '0 0 8px rgba(33,232,199,0.16)',
                    }}
                  >
                    {busy
                      ? phase === 'checking'
                        ? 'Checking…'
                        : phase === 'contacting'
                          ? mode === 'signup' ? 'Creating your account…' : 'Signing you in…'
                          : 'Finalizing…'
                      : mode === 'signup'
                        ? 'Create account'
                        : 'Sign in'}
                  </button>

                  <div className="flex items-center gap-3 my-4 text-white/40 text-xs">
                    <div className="flex-1 h-px bg-white/10" />
                    <span>or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={busy}
                    className="w-full py-3 rounded-xl border text-sm transition disabled:opacity-60 flex items-center justify-center gap-3"
                    style={{
                      borderColor: 'rgba(255,255,255,0.18)',
                      background: 'rgba(16,19,20,0.88)',
                      color: '#fff',
                    }}
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>

                  {(msg || err) && (
                    <div
                      className="mt-3 rounded-xl p-3 text-sm"
                      style={{ background: 'rgba(16,19,20,0.88)', border: '1px solid rgba(255,255,255,0.18)' }}
                    >
                      {msg && <div className="text-white/90">{msg}</div>}
                      {err && <div className="text-[#ff9aa3]">{err}</div>}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-white/55">
                    You must {mode === 'signup' ? 'sign up' : 'sign in'} to continue.
                  </div>
                </form>
              )}
            </div>
          </section>

          {/* RIGHT — Welcome / trust (bigger, to the right) */}
          <aside className="order-1 lg:order-2">
            <div
              className="rounded-2xl p-6 md:p-8"
              style={{
                background: 'rgba(16,19,20,0.88)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.45), 0 0 22px rgba(33,232,199,0.08)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} style={{ color: ACCENT }} />
                <h2 className="text-lg md:text-xl font-semibold">Welcome to Reduc.ai</h2>
              </div>
              <p className="text-white/80 mb-5">
                Build and manage AI agents with clean onboarding and secure sessions.
              </p>

              <ul className="space-y-3 text-white/85">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={18} style={{ color: ACCENT }} />
                  Email + password or Google
                </li>
                <li className="flex items-center gap-2">
                  <Shield size={18} style={{ color: ACCENT }} />
                  Secure sessions with Supabase Auth
                </li>
                <li className="flex items-center gap-2">
                  <Lock size={18} style={{ color: ACCENT }} />
                  You control your data
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function GoogleMark() {
  // Simple, crisp Google "G"
  return (
    <svg width="18" height="18" viewBox="0 0 256 262" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fill="#4285F4" d="M255.88 133.5c0-10.9-.9-18.8-2.9-27.1H130.5v49.1h71.9c-1.5 12.3-9.6 30.9-27.6 43.4l-.3 2.1 40.1 31 2.8.3c25.8-23.8 38.4-58.8 38.4-98.9z"/>
      <path fill="#34A853" d="M130.5 261.1c36.7 0 67.5-12.1 89.9-32.8l-42.9-33.2c-11.5 8-27.1 13.6-47 13.6-35.9 0-66.3-23.8-77.2-56.6l-2 .2-42 32.5-.5 2c22.2 44.1 67.7 74.3 121.7 74.3z"/>
      <path fill="#FBBC05" d="M53.3 151.9c-2.9-8.3-4.6-17.2-4.6-26.4s1.7-18.1 4.6-26.4l-.1-1.8L10.7 64.3l-1.3.6C3.5 80.2 0 97.2 0 115.5s3.5 35.3 9.4 50.6l43.9-34.2z"/>
      <path fill="#EA4335" d="M130.5 50.5c25.5 0 42.7 11 52.6 20.2l38.4-37.5C198 12.1 167.2 0 130.5 0 76.5 0 31 30.2 9.4 64.9l43.9 34.2c10.9-32.8 41.3-48.6 77.2-48.6z"/>
    </svg>
  );
}
