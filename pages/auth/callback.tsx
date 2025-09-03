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
        // 0) If we already have a session (e.g., restored by the browser), just go.
        const pre = await supabase.auth.getSession();
        if (pre.data.session) {
          return finishRedirect();
        }

        // 1) If no OAuth 'code' in URL, nothing to exchange. Bounce to /auth.
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (!code) {
          return failBack('No auth code found. Please sign in again.');
        }

        // 2) Try to exchange the code for a real session cookie.
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) {
          // Typical here: "both auth code and code verifier should be non-empty"
          // This happens when the PKCE verifier wasn't available (different origin, cleared storage, etc.)
          return failBack(error.message || 'Could not complete sign-in. Please try again.');
        }

        // 3) Confirm session, then redirect.
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          return failBack('Signed in, but no session found. Please try again.');
        }

        return finishRedirect();
      } catch (e: any) {
        return failBack(e?.message || 'Something went wrong. Please try again.');
      }
    })();

    // — helpers —
    function finishRedirect() {
      let to = '/builder';

      // prefer localStorage hint set before OAuth
      try {
        const stored = localStorage.getItem('postAuthRedirect');
        if (stored) {
          to = stored;
          localStorage.removeItem('postAuthRedirect');
        }
      } catch {} // ignore storage errors

      // otherwise use ?from=
      const qFrom = (router.query.from as string) || '';
      if (qFrom) to = qFrom;

      router.replace(to);
    }

    function failBack(reason: string) {
      const qFrom = (router.query.from as string) || '/builder';
      const url = new URL(window.location.origin + '/auth');
      url.searchParams.set('mode', 'signin');
      url.searchParams.set('from', qFrom);
      url.searchParams.set('msg', reason);
      router.replace(url.toString());
    }
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
