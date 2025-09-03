// /pages/auth/callback.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

export default function AuthCallback() {
  const router = useRouter();
  const [msg, setMsg] = useState('Completing sign-in…');

  useEffect(() => {
    (async () => {
      try {
        // 1) Exchange the OAuth "code" in the URL for a real session cookie
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          setMsg(error.message || 'Could not complete sign-in.');
          return;
        }

        // 2) Decide where to go next
        let to = '/builder';
        try {
          const stored = localStorage.getItem('postAuthRedirect');
          if (stored) {
            to = stored;
            localStorage.removeItem('postAuthRedirect');
          } else if (typeof router.query.from === 'string' && router.query.from) {
            to = router.query.from as string;
          }
        } catch {
          // ignore storage errors
        }

        // 3) Final safety: ensure session exists, then redirect
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setMsg('Signed in, but session was not detected. Please try again.');
          return;
        }

        router.replace(to);
      } catch (e: any) {
        setMsg(e?.message || 'Something went wrong.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Head><title>Redirecting… · Reduc.ai</title></Head>
      <div className="min-h-screen grid place-items-center" style={{ background: '#0b0c10', color: '#fff' }}>
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
