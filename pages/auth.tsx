// pages/auth.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-white/70 pl-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="mt-1 w-full px-3 py-2 rounded-[10px] bg-[#101314] text-white/95 border border-white/15 outline-none focus:border-[#00ffc2]"
      />
    </label>
  );
}

function LoadingOverlay({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-[12px]" style={{ background: 'rgba(16,19,20,0.92)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-[#00ffc2] animate-spin" />
        <div className="text-white/90 text-sm">{text}</div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const router = useRouter();
  const query = useMemo(
    () => new URLSearchParams((router.asPath.split('?')[1] ?? '')),
    [router.asPath]
  );

  const startMode = (query.get('mode') === 'signin' ? 'signin' : 'signup') as
    | 'signin'
    | 'signup';
  const from = query.get('from') || '/builder';

  const [mode, setMode] = useState<'signin' | 'signup'>(startMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(''); // optional—store later in onboarding if you want
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onGoogle = async () => {
    try {
      setBusy(true);
      setErr(null);
      setMsg(null);
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?from=${
        mode === 'signup'
          ? encodeURIComponent('/builder?mode=signup&onboard=1')
          : encodeURIComponent('/builder')
      }`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
      // Supabase will redirect; show loading until the browser navigates
      setMsg('Redirecting to Google…');
    } catch (e: any) {
      setErr(e?.message || 'Google sign-in failed. Is the Google provider enabled in Supabase?');
    } finally {
      setBusy(false); // page will leave anyway; safe
    }
  };

  const onEmail = async () => {
    try {
      setBusy(true);
      setErr(null);
      setMsg(null);
      if (!email || !password) throw new Error('Email and password are required.');

      if (mode === 'signup') {
        const origin = window.location.origin;
        const redirectTo = `${origin}/auth/callback?from=${encodeURIComponent(
          '/builder?mode=signup&onboard=1'
        )}`;

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;

        setMsg('Check your inbox. Click the verification link to finish creating your account.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        setMsg('Signing you in…');
        // small delay feels natural, then go
        setTimeout(() => router.push('/builder'), 400);
        return;
      }
    } catch (e: any) {
      setErr(e?.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-start justify-center pt-20 px-4"
      style={{ background: '#0b0c10', color: 'white' }}
    >
      {busy && <LoadingOverlay text="Please wait…" />}

      <div
        className="w-full max-w-md rounded-[16px] p-6"
        style={{
          background: 'rgba(16,19,20,0.88)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}
      >
        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-[10px] border transition ${
              mode === 'signin'
                ? 'bg-[#00ffc2] text-black border-[#00ffc2]'
                : 'border-white/15 hover:bg-white/5'
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-[10px] border transition ${
              mode === 'signup'
                ? 'bg-[#00ffc2] text-black border-[#00ffc2]'
                : 'border-white/15 hover:bg-white/5'
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
          <Field
            label="Phone (optional)"
            type="tel"
            value={phone}
            onChange={setPhone}
            autoComplete="tel"
          />

          <button
            onClick={onEmail}
            disabled={busy}
            className="w-full py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 disabled:opacity-60"
          >
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <div className="relative my-2 text-center text-white/50 text-xs select-none">OR</div>

          <button
            disabled={busy}
            onClick={onGoogle}
            className="w-full py-2 rounded-[10px] border border-white/15 hover:bg-white/5 disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="text-center text-xs text-white/60 mt-2">
            {mode === 'signup'
              ? 'Verify your email to continue.'
              : 'You must sign in to continue.'}
          </div>

          {msg && <div className="text-[#6af7d1] text-sm mt-2">{msg}</div>}
          {err && <div className="text-[#ff7a7a] text-sm mt-2">{err}</div>}
        </div>
      </div>
    </div>
  );
}
