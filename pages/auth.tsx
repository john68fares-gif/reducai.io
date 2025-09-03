// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';
import { Shield, CheckCircle, Lock, Sparkles } from 'lucide-react';

type Mode = 'signin' | 'signup';

const ACCENT = '#00ffc2';

export default function AuthPage() {
const router = useRouter();
const qMode = (router.query.mode === 'signin' ? 'signin' : 'signup') as Mode;
const from = typeof router.query.from === 'string' ? router.query.from : '/builder';

const \[mode, setMode] = useState<Mode>(qMode);
const \[email, setEmail] = useState('');
const \[password, setPassword] = useState('');
const \[fullName, setFullName] = useState('');
const \[phone, setPhone] = useState('');
const \[loading, setLoading] = useState(false);
const \[msg, setMsg] = useState\<string | null>(null);
const \[err, setErr] = useState\<string | null>(null);
const \[showResend, setShowResend] = useState(false);
const \[resent, setResent] = useState(false);

useEffect(() => {
setMode(qMode);
setErr(null);
setMsg(null);
setShowResend(false);
setResent(false);
}, \[qMode]);

const switchMode = (m: Mode) => {
setMode(m);
setErr(null);
setMsg(null);
setShowResend(false);
setResent(false);
router.replace({ pathname: '/auth', query: { mode: m, from } }, undefined, { shallow: true });
};

const handleGoogle = async () => {
try {
setLoading(true);
setErr(null);
setMsg('Opening Google…');

```
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
```

};

const handleSubmit = async (e: React.FormEvent) => {
e.preventDefault();
setErr(null);
setMsg(null);
setShowResend(false);
setResent(false);

```
if (!email || !password || (mode === 'signup' && !fullName)) {
  setErr('Please fill all required fields.');
  return;
}

setLoading(true);

try {
  if (mode === 'signup') {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;

    if (!data.session) {
      setMsg('Account created! Check your email to verify your address, then come back to sign in.');
      setLoading(false);
      setShowResend(true);
      return;
    }

    localStorage.setItem('postAuthRedirect', `${from}?onboard=1&mode=signup`);
    setMsg('Setting up your account…');
    await delay(600);
    router.replace(`${from}?onboard=1&mode=signup`);
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const m = (error.message || '').toLowerCase();
      if (m.includes('email not confirmed')) {
        setErr('Email not verified yet. Please check your inbox.');
        setShowResend(true);
      } else if (m.includes('invalid login credentials')) {
        setErr('Wrong email or password.');
      } else {
        setErr(error.message);
      }
      setLoading(false);
      return;
    }

    localStorage.setItem('postAuthRedirect', from);
    setMsg('Signing you in…');
    await delay(600);
    router.replace(from);
  }
} catch (e: any) {
  const m = e?.message || 'Something went wrong.';
  if (m.toLowerCase().includes('user already registered')) {
    setErr('This email is already registered. Try signing in.');
    setShowResend(true);
  } else {
    setErr(m);
  }
} finally {
  setLoading(false);
}
```

};

// NEW: forgot password
const handleForgot = async () => {
setErr(null);
setMsg(null);
if (!email) {
setErr('Enter your email first, then click “Forgot password”.');
return;
}
try {
setLoading(true);
const { error } = await supabase.auth.resetPasswordForEmail(email, {
redirectTo: `${window.location.origin}/reset`,
});
if (error) throw error;
setMsg('Password reset email sent. Check your inbox.');
} catch (e: any) {
setErr(e?.message || 'Could not send reset email.');
} finally {
setLoading(false);
}
};

return (
<> <Head> <title>{mode === 'signin' ? 'Sign in' : 'Sign up'} — Reduc AI</title> </Head>

```
  <div className="min-h-screen font-movatif" style={{ background: '#0b0c10', color: '#fff' }}>
    <div
      className="fixed inset-0 -z-10 opacity-70"
      style={{
        background:
          'radial-gradient(600px 300px at 20% 15%, rgba(106,247,209,0.12), transparent 60%), radial-gradient(500px 250px at 85% 85%, rgba(106,247,209,0.08), transparent 60%)',
      }}
    />
    <div className="mx-auto max-w-6xl px-5 py-12">
      <div className="grid gap-10 md:grid-cols-2 items-center">
        <div className="hidden md:block">
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(16,19,20,0.88)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(106,247,209,0.08)',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Sparkles size={20} style={{ color: ACCENT }} />
              <h1 className="text-xl font-semibold">Welcome to Reduc.ai</h1>
            </div>
            <p className="text-white/80 mb-6">
              Create your account to build and manage AI agents. Your data is encrypted
              and we never share it with third parties.
            </p>
            <ul className="space-y-3 text-white/85">
              <li className="flex items-center gap-2">
                <CheckCircle size={18} style={{ color: ACCENT }} /> Email & password or Google
              </li>
              <li className="flex items-center gap-2">
                <Shield size={18} style={{ color: ACCENT }} /> Secure sessions by Supabase Auth
              </li>
              <li className="flex items-center gap-2">
                <Lock size={18} style={{ color: ACCENT }} /> Granular control & easy sign-out
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            className="w-full max-w-[520px] p-6 rounded-2xl"
            style={{
              background: 'rgba(13,15,17,0.92)',
              border: '2px dashed rgba(106,247,209,0.32)',
              boxShadow:
                '0 30px 80px rgba(0,0,0,0.50), 0 0 26px rgba(106,247,209,0.18), inset 0 0 18px rgba(0,0,0,0.25)',
            }}
          >
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => switchMode('signin')}
                className="flex-1 py-2 rounded-xl font-semibold transition"
                style={{
                  background: mode === 'signin' ? ACCENT : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  boxShadow: mode === 'signin' ? '0 0 10px rgba(106,247,209,0.28)' : 'none',
                }}
                disabled={loading}
              >
                Sign in
              </button>
              <button
                onClick={() => switchMode('signup')}
                className="flex-1 py-2 rounded-xl font-semibold transition"
                style={{
                  background: mode === 'signup' ? ACCENT : 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  boxShadow: mode === 'signup' ? '0 0 10px rgba(106,247,209,0.28)' : 'none',
                }}
                disabled={loading}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {mode === 'signup' && (
                <>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-xl bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone (optional)"
                    className="w-full rounded-xl bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
                  />
                </>
              )}

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full rounded-xl bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'Create a password' : 'Password'}
                className="w-full rounded-xl bg-[#101314] text-white text-sm border border-[#13312b] px-4 py-3 outline-none focus:border-[#00ffc2]"
              />

              <button
                type="submit"
                disabled={loading}
                className="mt-1 py-3 rounded-xl font-semibold transition disabled:opacity-60"
                style={{ background: ACCENT, color: '#fff', boxShadow: '0 0 14px rgba(106,247,209,0.28)' }}
              >
                {loading
                  ? mode === 'signup'
                    ? 'Creating account…'
                    : 'Signing in…'
                  : mode === 'signup'
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>

            {/* Forgot password (only on sign in) */}
            {mode === 'signin' && (
              <div className="mt-3 text-right">
                <button
                  onClick={handleForgot}
                  disabled={loading}
                  className="text-xs underline decoration-white/40 hover:decoration-white"
                  style={{ color: '#fff', opacity: 0.9 }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 my-4 text-white/40 text-xs">
              <div className="flex-1 h-px bg-white/10" />
              <span>or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-3 rounded-xl border text-sm transition disabled:opacity-60"
              style={{
                borderColor: 'rgba(255,255,255,0.2)',
                background: 'rgba(16,19,20,0.88)',
                color: '#fff',
              }}
            >
              Continue with Google
            </button>

            {(msg || err) && (
              <div
                className="mt-4 rounded-xl p-3 text-sm"
                style={{ background: 'rgba(16,19,20,0.88)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {msg && <div className="text-white/90">{msg}</div>}
                {err && <div className="text-[#ff9aa2]">{err}</div>}
              </div>
            )}

            {showResend && (
              <div className="mt-3 text-xs text-white/70 flex items-center justify-between">
                <span>Didn’t get the verification email?</span>
                <button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      setErr(null);
                      setMsg(null);
                      const { error } = await supabase.auth.resend({
                        type: 'signup',
                        email,
                        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                      });
                      if (error) throw error;
                      setResent(true);
                      setMsg('Verification email re-sent. Check your inbox.');
                    } catch (e: any) {
                      setErr(e?.message || 'Could not resend verification right now.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading || !email || resent}
                  className="px-3 py-1 rounded-lg border"
                  style={{
                    borderColor: 'rgba(255,255,255,0.25)',
                    background: 'rgba(16,19,20,0.88)',
                    color: '#fff',
                  }}
                >
                  {resent ? 'Sent ✓' : 'Resend'}
                </button>
              </div>
            )}

            <div className="mt-3 text-xs text-white/50">
              You must {mode === 'signup' ? 'sign up' : 'sign in'} to continue.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</>
```

);
}

function delay(ms: number) {
return new Promise((r) => setTimeout(r, ms));
}
