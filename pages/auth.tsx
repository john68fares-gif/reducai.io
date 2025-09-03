// /pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import { Sparkles, Shield, CheckCircle2, Lock } from 'lucide-react';

type Mode = 'signin' | 'signup';
const ACCENT = '#00ffc2';

export default function AuthPage() {
  const router = useRouter();
  const queryMode = (router.query.mode === 'signup' ? 'signup' : 'signin') as Mode;
  const from = useMemo(() => (typeof router.query.from === 'string' ? router.query.from : '/builder'), [router.query.from]);

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
              full_name: username,              // for your DB trigger (account name)
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
          <div className="absolute -top-28 -left-24 w-[720px] h-[720px] rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(0,255,194,0.13), transparent 60%)', filter: 'blur(22px)' }} />
          <div className="absolute -bottom-40 -right-24 w-[620px] h-[620px] rounded-full"
               style={{ background: 'radial-gradient(circle, rgba(0,255,194,0.09), transparent 65%)', filter: 'blur(24px)' }} />
        </div>

        {/* Layout: form left, welcome right */}
        <div className="mx-auto max-w-7xl px-5 py-14 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          {/* LEFT — Auth card */}
          <section className="order-
