// pages/auth/callback.tsx
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase-client';

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('Finalizing sign-in…');

  useEffect(() => {
    (async () => {
      try {
        // If this was an OAuth or PKCE flow, exchange code for a session
        await supabase.auth.exchangeCodeForSession(window.location.href).catch(() => {});
      } catch {}
      const next = localStorage.getItem('postAuthRedirect') || '/builder';
      setStatus('Redirecting…');
      setTimeout(() => router.replace(next), 600);
    })();
  }, [router]);

  return (
    <>
      <Head><title>Finishing up…</title></Head>
      <div className="min-h-screen grid place-items-center font-movatif" style={{ background:'#0b0c10', color:'#fff' }}>
        <div className="px-6 py-4 rounded-lg" style={{ background:'rgba(16,19,20,0.9)', border:'1px solid rgba(255,255,255,0.2)' }}>
          {status}
        </div>
      </div>
    </>
  );
}
