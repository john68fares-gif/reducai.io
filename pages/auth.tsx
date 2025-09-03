// pages/auth.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

export default function AuthPage() {
  const router = useRouter();
  const modeQuery = (router.query.mode === 'signin' ? 'signin' : 'signup') as 'signin' | 'signup';
  const from = (router.query.from as string) || '/builder';

  const [mode, setMode] = useState<'signin' | 'signup'>(modeQuery);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const go = (url: string) => router.push(url);

  const onGoogle = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${from === '/builder'
            ? '/builder?mode=signup&onboard=1'
            : from}`,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
      setMsg('Redirecting to Google…');
    } catch (e: any) {
      setErr(e?.message || 'Google sign-in failed. Is the provider enabled in Supabase?');
    } finally {
      setBusy(false);
    }
  };

  const onEmail = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (!email || !password) throw new Error('Email and password are required.');
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // If email confirmation is ON, user must confirm via email.
        // Send them to builder with onboarding when session becomes active.
        setMsg('Check your email to confirm your account. After confirming, you’ll be redirected.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        go('/builder'); // returning user
        return;
      }
    } catch (e: any) {
      setErr(e?.message || 'Auth failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center pt-24 px-4"
         style={{ background: '#0b0c10', color: 'white' }}>
      <div className="w-full max-w-md rounded-[16px] p-6"
           style={{ background: 'rgba(16,19,20,0.88)', boxShadow: '0 0 24px rgba(0,0,0,0.35)' }}>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 py-2 rounded-[10px] border ${mode==='signin' ? 'bg-[#00ffc2] text-black border-[#00ffc2]' : 'border-white/20'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 rounded-[10px] border ${mode==='signup' ? 'bg-[#00ffc2] text-black border-[#00ffc2]' : 'border-white/20'}`}
          >
            Sign up
          </button>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] bg-[#101314] border border-white/15 outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] bg-[#101314] border border-white/15 outline-none"
          />
          <button
            disabled={busy}
            onClick={onEmail}
            className="w-full py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 disabled:opacity-60"
          >
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          <div className="relative my-3 text-center text-white/60 text-sm">
            <span>or</span>
          </div>

          <button
            disabled={busy}
            onClick={onGoogle}
            className="w-full py-2 rounded-[10px] border border-white/20 hover:bg-white/10 disabled:opacity-60"
          >
            Continue with Google
          </button>

          <div className="text-center text-xs text-white/60 mt-2">
            {mode === 'signup' ? 'You must sign up to continue.' : 'You must sign in to continue.'}
          </div>

          {msg && <div className="text-[#6af7d1] text-sm mt-2">{msg}</div>}
          {err && <div className="text-[#ff7a7a] text-sm mt-2">{err}</div>}
        </div>
      </div>
    </div>
  );
}
