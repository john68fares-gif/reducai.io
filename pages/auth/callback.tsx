// pages/auth/callback.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // Supabase sets the session on load; when it exists, go where we came from.
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        let from = (router.query.from as string) || '/builder';
        try {
          from = localStorage.getItem('auth:from') || from;
          localStorage.removeItem('auth:from');
        } catch {}
        router.replace(from);
      }
    });

    // Safety net: if already signed in, bounce immediately
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        let from = (router.query.from as string) || '/builder';
        try {
          from = localStorage.getItem('auth:from') || from;
          localStorage.removeItem('auth:from');
        } catch {}
        router.replace(from);
      }
    });

    return () => sub.data.subscription.unsubscribe();
  }, [router]);

  return (
    <>
      <Head><title>Redirecting… · Reduc.ai</title></Head>
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0c10', color: '#fff' }}>
        <div className="rounded-[16px] px-6 py-4 border border-white/15 bg-black/30">
          <div className="flex items-center gap-3">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
            <span>Signing you in…</span>
          </div>
        </div>
      </div>
    </>
  );
}
