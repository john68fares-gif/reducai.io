// /pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ACCENT = '#00ffc2';

export default function AuthPage() {
  const router = useRouter();
  const modeQ = (router.query.mode as string) || 'signin';
  const [mode, setMode] = useState<'signin' | 'signup'>(modeQ === 'signup' ? 'signup' : 'signin');
  const from = useMemo(() => (router.query.from as string) || '/builder', [router.query.from]);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [verifySent, setVerifySent] = useState(false);

  useEffect(() => {
    setMode(modeQ === 'signup' ? 'signup' : 'signin');
  }, [modeQ]);

  const go = (url: string) => router.replace(url);
  const card =
    'w-[92vw] max-w-[440px] rounded-[20px] border-2 border-[rgba(106,247,209,0.32)] shadow-[0_0_30px_rgba(0,0,0,0.45)] bg-[rgba(13,15,17,0.92)] p-6';
  const input =
    'w-full rounded-[14px] bg-[#101314] border border-[#13312b] text-white/95 px-4 py-3 outline-none focus:border-[#00ffc2] placeholder:text-white/40';
  const btn =
    'w-full rounded-[14px] font-semibold py-3 transition active:scale-[0.995] disabled:opacity-50 disabled:cursor-not-allowed';
  const tab =
    'flex-1 py-2 rounded-[12px] text-sm font-semibold transition';
  const hr = 'h-px bg-white/10 my-4';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) go(from || '/builder');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?from=${encodeURIComponent(from || '/builder')}`,
            data: displayName
              ? { full_name: displayName, preferred_username: displayName }
              : undefined
          },
        });
        if (error) throw error;
        setVerifySent(true);
      }
    } catch (e: any) {
      setErr(e?.message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    try {
      setErr(null);
      setBusy(true);
      try {
        localStorage.setItem('auth:from', from || '/builder');
      } catch {}
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message ?? 'Unable to start Google sign-in.');
      setBusy(false);
    }
  }

  return (
    <>
      <Head>
        <title>{mode === 'signup' ? 'Sign up' : 'Sign in'} · Reduc.ai</title>
      </Head>

      <div
        className="min-h-screen w-full flex items-center justify-center"
        style={{ background: '#0b0c10', color: '#fff' }}
      >
        <div className={card} style={{ boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)' }}>
          {/* Tabs */}
          <div className="flex gap-2 mb-5 bg-black/20 rounded-[12px] p-1 border border-white/10">
            <button
              className={tab}
              style={{
                background: mode === 'signin' ? ACCENT : 'transparent',
                color: mode === 'signin' ? '#000' : 'rgba(255,255,255,0.9)',
              }}
              onClick={() => router.push(`/auth?mode=signin&from=${encodeURIComponent(from)}`)}
            >
              Sign in
            </button>
            <button
              className={tab}
              style={{
                background: mode === 'signup' ? ACCENT : 'transparent',
                color: mode === 'signup' ? '#000' : 'rgba(255,255,255,0.9)',
              }}
              onClick={() => router.push(`/auth?mode=signup&from=${encodeURIComponent(from)}`)}
            >
              Sign up
            </button>
          </div>

          {/* Content */}
          {verifySent ? (
            <div className="space-y-4 text-white/90">
              <h2 className="text-xl font-semibold">Check your email</h2>
              <p className="text-white/70">
                We sent a verification link to <span className="text-white">{email}</span>. Open it to finish creating
                your account, then we’ll bring you back to your workspace.
              </p>
              <div className={hr} />
              <button
                className={btn}
                style={{ background: '#111415', border: '1px solid rgba(255,255,255,0.2)' }}
                onClick={() => setVerifySent(false)}
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <input
                  type="text"
                  placeholder="Display name (optional)"
                  className={input}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              )}

              <input
                required
                type="email"
                placeholder="Email address"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                required
                type="password"
                placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {err && (
                <div className="text-[#ff7a7a] text-sm bg-[#ff7a7a14] border border-[#ff7a7a55] rounded-[12px] px-3 py-2">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className={btn}
                style={{ background: ACCENT, color: '#000', boxShadow: '0 0 16px rgba(106,247,209,0.22)' }}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> {mode === 'signup' ? 'Creating account…' : 'Signing in…'}
                  </span>
                ) : mode === 'signup' ? (
                  'Create account'
                ) : (
                  'Sign in'
                )}
              </button>

              <div className="relative">
                <div className={hr} />
                <div className="absolute left-1/2 -translate-x-1/2 -top-3 text-xs text-white/50 bg-[rgba(13,15,17,0.92)] px-2">
                  or
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleGoogle}
                className={btn}
                style={{
                  background: '#111415',
                  border: '1px solid rgba(255,255,255,0.25)',
                  color: 'rgba(255,255,255,0.95)',
                }}
              >
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner /> Working…
                  </span>
                ) : (
                  'Continue with Google'
                )}
              </button>

              <p className="text-[11px] text-white/50 text-center pt-1">You must sign in to continue.</p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin"
      aria-hidden
    />
  );
}
