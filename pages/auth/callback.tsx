// pages/auth/callback.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // let Supabase finalize the session in the browser
      const { data: { session } } = await supabase.auth.getSession();

      const from = (router.query.from as string) || '/builder';
      if (session) {
        // your _app.tsx will also set the ra_session cookie via onAuthStateChange
        router.replace(from);
      } else {
        // no session yet (e.g., user opened link on different device) → go to /auth
        router.replace(`/auth?mode=signin&from=${encodeURIComponent(from)}`);
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <div>Finishing sign-in…</div>
    </div>
  );
}
