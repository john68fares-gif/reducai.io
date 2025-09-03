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
        // If a session already exists (e.g., restored), just finish.
        const pre = await supabase.auth.getSession();
        if (pre.data.session) return finish();

        // Must have an OAuth "code" to exchange.
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (!code) return fail('No auth code in callback. Please sign in again.');

        // Exchange code -> session (PKCE)
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) return fail(error.message || 'Could not complete sign-in.');

        // Double-check session and set a soft cookie so middleware/SSR can see "logged in"
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return fail('Signed in, but no session found. Please try again.');

        // Soft cookie for 14 days (server-readable). Clears on signout elsewhere.
        document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;

        return finish();
      } catch (e: any) {
        return fail(e?.message || 'Something went wrong.');
      }
    })();

    function finish() {
      // Priority: localStorage set before OAuth, else ?from=, else /builder
      let to = '/builder';
      try {
        const stored = localStorage.getItem('postAuthRedirect');
        if (stored) {
          to = stored;
          localStorage.removeItem('postAuthRedirect');
        } else if (typeof router.query.from === 'string' && router.query.from) {
          to = router.query.from as string;
        }
      } catch {}
      router.replace(to);
    }

    function fail(reason: string) {
      setMsg(reason);
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
      <div style={{
        minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: '#0b0c10', color: '#fff'
      }}>
        <div style={{
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(0,0,0,0.35)',
          borderRadius: 14, padding: '12px 16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)'
        }}>
          <span className="spin" style={{
            display: 'inline-block', width: 16, height: 16, marginRight: 8,
            borderRadius: '50%', border: '2px solid rgba(255,255,255,0.7)',
            borderTopColor: 'transparent', verticalAlign: 'middle',
            animation: 'spin 0.9s linear infinite'
          }}/>
          <span>{msg}</span>
        </div>
      </div>
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }
      `}</style>
    </>
  );
}
