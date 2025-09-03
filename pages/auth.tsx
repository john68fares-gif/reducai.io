// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const qMode = (router.query.mode === 'signin' ? 'signin' : 'signup') as Mode;
  const from = typeof router.query.from === 'string' ? router.query.from : '/builder';

  const [mode, setMode] = useState<Mode>(qMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setMode(qMode);
  }, [qMode]);

  const title = mode === 'signin' ? 'Sign in' : 'Sign up';

  const accent = '#00ffc2';
  const cardStyle: React.CSSProperties = {
    background: 'rgba(13,15,17,0.9)',
    border: '2px dashed rgba(106,247,209,0.30)',
    boxShadow: 'inset 0 0 18px rgba(0,0,0,0.25), 0 0 18px rgba(106,247,209,0.05)',
    borderRadius: 10,
  };

  const switchMode = (m: Mode) => {
    setErr(null);
    setMsg(null);
    setMode(m);
    // keep the `from` page intact
    router.replace({ pathname: '/auth', query: { mode: m, from } }, undefined, { shallow: true });
  };

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setErr(null);
      setMsg('Opening Google…');

      // keep post-auth redirect in localStorage so callback can read it
      localStorage.setItem(
        'postAuthRedirect',
        mode === 'signup' ? `${from}?onboard=1&mode=signup` : from
      );

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (e: any) {
      setErr(e?.message || 'Failed to open Google');
      setLoading(false);
      setMsg(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);

    if (!email || !password || (mode === 'signup' && !fullName)) {
      setErr('Please fill all required fields.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        // Password sign-up (no email wait). If your project requires email confirmation,
        // Supabase will return a user with email_confirmed=false; we’ll still show a success
        // message and nudge them, but this avoids the “feels like a scam” magic-link loop.
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, phone },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;

        // If confirmation is required, user/session can be null here.
        if (!data.session) {
          setMsg('Account created. Check your email to verify, then come back.');
          setLoading(false);
          return;
        }
        // session is present (email confirmation disabled) → go on
        localStorage.setItem('postAuthRedirect', `${from}?onboard=1&mode=signup`);
        setMsg('Setting up your account…');
        await smallDelay();
        router.replace(`${from}?onboard=1&mode=signup`);
        return;
      } else {
        // Sign in (checks if user exists — won’t create a new account)
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        localStorage.setItem('postAuthRedirect', from);
        setMsg('Signing you in…');
        await smallDelay();
        router.replace(from);
        return;
      }
    } catch (e: any) {
      const m = e?.message || 'Something went wrong.';
      if (m.toLowerCase().includes('invalid login credentials')) {
        setErr('Wrong email or password.');
      } else if (m.toLowerCase().includes('user already registered')) {
        setErr('This email is already registered. Try signing in.');
      } else {
        setErr(m);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{title} — Reduc AI</title>
      </Head>

      <div className="min-h-screen w-full font-movatif"
           style={{ background: '#0b0c10', color: '#fff', display: 'grid', placeItems: 'center', padding: '40px 16px' }}>
        <div className="w-full max-w-[520px] p-6" style={cardStyle}>
          {/* Tabs */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => switchMode('signin')}
              className="flex-1 py-2 rounded-[8px] font-semibold transition"
              style={{
                background: mode === 'signin' ? accent : 'rgba(255,255,255,0.06)',
                color: mode === 'signin' ? '#000' : '#fff'
              }}
              disabled={loading}
            >
              Sign in
            </button>
            <button
              onClick={() => switchMode('signup')}
              className="flex-1 py-2 rounded-[8px] font-semibold transition"
              style={{
                background: mode === 'signup' ? accent : 'rgba(255,255,255,0.06)',
                color: mode === 'signup' ? '#000' : '#fff'
              }}
              disabled={loading}
            >
              Sign up
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {mode === 'signup' && (
              <>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-md bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full rounded-md bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
                />
              </>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-md bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
              className="w-full rounded-md bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
            />

            <button
              type="submit"
              disabled={loading}
              className="mt-1 py-3 rounded-[8px] font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] transition disabled:opacity-60"
              style={{ background: accent, color: '#000' }}
            >
              {loading ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in')}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4 text-white/40 text-xs">
            <div className="flex-1 h-px bg-white/10" />
            <span>or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 rounded-[8px] border text-sm transition disabled:opacity-60"
            style={{ borderColor: 'rgba(255,255,255,0.2)', background: 'rgba(16,19,20,0.88)' }}
          >
            Continue with Google
          </button>

          {/* Messages */}
          {(msg || err) && (
            <div className="mt-4 rounded-md p-3 text-sm"
                 style={{ background: 'rgba(16,19,20,0.88)', border: '1px solid rgba(255,255,255,0.2)' }}>
              {msg && <div className="text-white/90">{msg}</div>}
              {err && <div className="text-[#ff7a7a]">{err}</div>}
            </div>
          )}

          {/* Tiny helper */}
          <div className="mt-3 text-xs text-white/50">
            You must {mode === 'signup' ? 'sign up' : 'sign in'} to continue.
          </div>
        </div>
      </div>
    </>
  );
}

function smallDelay(ms = 650) {
  return new Promise((r) => setTimeout(r, ms));
}
