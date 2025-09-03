// /pages/auth/callback.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Signing you in…');

  useEffect(() => {
    (async () => {
      try {
        // 1) Exchange the OAuth "code" in the URL for a real session cookie.
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg(error.message || 'Could not complete sign-in.');
          return;
        }

        // 2) Figure out where to go next (from query or localStorage) and bounce.
        let from = (router.query.from as string) || '/builder';
        try {
          const stored = localStorage.getItem('auth:from');
          if (stored) {
            from = stored;
            localStorage.removeItem('auth:from');
          }
        } catch {}
        router.replace(from);
      } catch (e: any) {
        setMsg(e?.message || 'Something went wrong.');
      }
    })();
  }, [router]);

  return (
    <>
      <Head><title>Redirecting… · Reduc.ai</title></Head>
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0b0c10', color: '#fff' }}
      >
        <div className="rounded-[16px] px-6 py-4 border border-white/15 bg-black/30">
          <div className="flex items-center gap-3">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
            <span>{msg}</span>
          </div>
        </div>
      </div>
    </>
  );
}
