// /pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import { Sparkles, CheckCircle2, Shield, Lock } from 'lucide-react';

type Mode = 'signin' | 'signup';

const ACCENT = '#25f0c9'; // softer mint
const ACCENT_DARK = '#0bd2ae';

export default function AuthPage() {
  const router = useRouter();
  const queryMode = (router.query.mode === 'signup' ? 'signup' : 'signin') as Mode;
  const from = useMemo(() => (typeof router.query.from === 'string' ? router.query.from : '/builder'), [router.query.from]);

  const [mode, setMode] = useState<Mode>(queryMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Sign-up extras
  const [username, setUsername] = useState('');
  const [heardAbout, setHeardAbout] = useState('');

  // UX
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<'idle'|'precheck'|'contacting'|'finalizing'>('idle');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    setMode(queryMode);
    setErr(null);
    setMsg(null);
    setVerifySent(false);
    setStep('idle');
  }, [queryMode]);

  // If already signed in, bounce to from
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

    if (mode === 'signup' && (!username || username.trim().length < 3)) {
      setErr('Choose a username with at least 3 characters.');
      return;
    }
    if (!email || !password) {
      setErr('Please fill in your email and password.');
      return;
    }

    try {
      setBusy(true);
      setStep('precheck');
      await delay(300);

      if (mode === 'signin') {
        setStep('contacting');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setStep('finalizing');
        await delay(400);
        localStorage.setItem('postAuthRedirect', from);
        router.replace(from);
      } else {
        setStep('contacting');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // send everything we need for the DB trigger + analytics
            data: {
              full_name: username,           // so your default account gets this name
              preferred_username: username,
              user_name: username,
              heard_about: heardAbout || 'unspecified',
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from)}`,
          },
        });
        if (error) throw error;

        // If email confirmation is on, user won't have a session yet.
        if (!data.session) {
          setStep('finalizing');
          await delay(400);
          setVerifySent(true);
          setMsg('Account created! Check your email to verify, then sign in.');
          return;
        }

        // In case auto-confirm is enabled:
        setStep('finalizing');
        await delay(400);
        localStorage.setItem('postAuthRedirect', `${from}?onboard=1&mode=signup`);
        router.replace(`${from}?onboard=1&mode=signup`);
      }
    } catch (e: any) {
      const m = (e?.message || '').toLowerCase();
      if (m.includes('invalid login credentials')) {
        setErr('Wrong email or password.');
      } else if (m.includes('email not confirmed')) {
        setErr('Email not verified yet. Please check your inbox.');
      } else if (m.includes('already registered')) {
        setErr('Email already registered. Try signing in.');
      } else {
        setErr(e?.message || 'Something went wrong.');
      }
      setStep('idle');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      setErr(null);
      setBusy(true);
      setStep('contacting');
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
      setBusy(false);
      setStep('idle');
    }
  }

  return (
    <>
      <Head>
        <title>{mode === 'signup' ? 'Sign up' : 'Sign in'} — Reduc.ai</title>
      </Head>

      <div className="min-h-screen" style={{ background: '#0b0c10', color: '#fff' }}>
        {/* subtle glows */}
        <div
          className="fixed inset-0 -z-10"
          style={{
            background:
              'radial-gradient(700px 360px at 15% 12%, rgba(37,240,201,0.12), transparent 60%), radial-gradient(620px 320px at 92% 86%, rgba(37,240,201,0.08), transparent 60%)',
          }}
        />

        {/* two-column, shifted left */}
        <div className="mx-auto max-w-6xl px-5 py-14 grid gap-10 md:grid-cols-[1.2fr_1fr]">
          {/* LEFT: the form (shifted left by grid) */}
          <div className="order-2 md:order-1">
            <div
              className="w-full max-w-[560px] rounded-2xl p-6 md:p-7"
              style={{
                marginLeft: 0,
                background: 'rgba(14,16,18,0.96)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 30px 80px rgba(0,0,0,0.50), 0 0 30px rgba(37,240,201,0.10)',
              }}
            >
              {/* Tabs */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => switchMode('signin')}
                  className="flex-1 py-2 rounded-xl font-semibold transition"
                  style={{
                    background: mode === 'signin' ? ACCENT : 'rgba(255,255,255,0.06)',
                    color: mode === 'signin' ? '#0b0c10' : 'rgba(255,255,255,0.92)',
                    boxShadow: mode === 'signin' ? '0 0 10px rgba(37,240,201,0.18)' : 'none',
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
                    boxShadow: mode === 'signup' ? '0 0 10px rgba(37,240,201,0.18)' : 'none',
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
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Username"
                          className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#25f0c9]"
                        />
                        <select
                          value={heardAbout}
                          onChange={(e) => setHeardAbout(e.target.value)}
                          className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#25f0c9]"
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
                    </>
                  )}

                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#25f0c9]"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
                    className="w-full rounded-xl bg-[#0f1213] text-white text-sm border border-[#173a32] px-4 py-3 outline-none focus:border-[#25f0c9]"
                  />

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-1 py-3 rounded-xl font-semibold transition disabled:opacity-60"
                    style={{
                      background: ACCENT,
                      color: '#0b0c10',
                      boxShadow: '0 0 10px rgba(37,240,201,0.16)',
                    }}
                  >
                    {busy
                      ? step === 'precheck'
                        ? 'Checking…'
                        : step === 'contacting'
                          ? (mode === 'signup' ? 'Creating your account…' : 'Signing you in…')
                          : step === 'finalizing'
                            ? 'Finalizing…'
                            : mode === 'signup'
                              ? 'Create account'
                              : 'Sign in'
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
                    className="w-full py-3 rounded-xl border text-sm transition disabled:opacity-60"
                    style={{
                      borderColor: 'rgba(255,255,255,0.18)',
                      background: 'rgba(16,19,20,0.88)',
                      color: '#fff',
                    }}
                  >
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
          </div>

          {/* RIGHT: Welcome / trust */}
          <div className="order-1 md:order-2">
            <div
              className="rounded-2xl p-6 md:p-7"
              style={{
                background: 'rgba(16,19,20,0.88)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 24px 70px rgba(0,0,0,0.45), 0 0 26px rgba(37,240,201,0.08)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} style={{ color: ACCENT }} />
                <h2 className="text-lg md:text-xl font-semibold">Welcome to Reduc.ai</h2>
              </div>
              <p className="text-white/80 mb-5">
                Create your account to build and manage AI agents. Your data is encrypted and never shared.
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
          </div>
        </div>
      </div>
    </>
  );
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
