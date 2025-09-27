'use client';

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

type Status = 'exchanging' | 'checking' | 'redirecting' | 'error';

export default function PostAuth() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('exchanging');
  const [msg, setMsg] = useState<string>('Completing sign-in…');

  useEffect(() => {
    (async () => {
      try {
        // 1) Finish PKCE/URL-code exchange and set the session
        const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) throw error;

        setStatus('checking');
        setMsg('Checking your account…');

        // 2) Ask backend whether user already exists / subscribed
        const resp = await fetch('/api/user-status', { credentials: 'include' });

        // If that route isn’t implemented or fails, just go to builder (fail-open)
        if (!resp.ok) {
          setStatus('redirecting');
          setMsg('Taking you to your dashboard…');
          router.replace('/builder');
          return;
        }

        const payload = await resp.json() as {
          hasAccount: boolean;
          hasSubscription: boolean;
          paymentLink?: string | null;
        };

        // 3) Decide destination
        if (payload.hasAccount || payload.hasSubscription) {
          setStatus('redirecting');
          setMsg('Welcome back! Loading your dashboard…');
          router.replace('/builder');
          return;
        }

        const paymentLink =
          payload.paymentLink ||
          process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ||
          '';

        if (paymentLink) {
          setStatus('redirecting');
          setMsg('Almost done — opening payment…');
          window.location.replace(paymentLink);
          return;
        }

        // No payment link configured → pricing
        setStatus('redirecting');
        setMsg('Choose a plan to continue…');
        router.replace('/pricing');
      } catch (e: any) {
        console.error(e);
        setStatus('error');
        setMsg(e?.message || 'Sign-in failed. Please try again.');
      }
    })();
  }, [router]);

  return (
    <>
      <Head><title>Welcome • ReducAI</title></Head>
      <main className="min-h-screen grid place-items-center" style={{ background:'var(--bg)', color:'var(--text)' }}>
        <div className="card p-6 max-w-md w-[92%] text-center">
          <div className="text-2xl font-semibold mb-2">Welcome to ReducAI</div>
          <p style={{ color:'var(--muted)' }}>{msg}</p>
          {status === 'error' && (
            <div className="mt-4">
              <button
                className="btn"
                onClick={() => { window.location.href = '/'; }}
              >
                Back to homepage
              </button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
