// pages/auth/callback.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

function setRaCookie(on: boolean) {
  // Simple session flag the middleware already understands
  // Path=/ so it’s visible everywhere; 30 days
  if (on) document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  else document.cookie = `ra_session=; Path=/; Max-Age=0; SameSite=Lax`;
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Supabase PKCE: exchange ?code= for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(window.location.href);
      if (error) {
        // fallback to landing with an error
        router.replace('/?auth=error');
        return;
      }
      // We have a session on the client → set a cookie the middleware can see
      setRaCookie(Boolean(data.session));

      // send them where they were headed
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from') || '/builder';
      router.replace(from);
    })();
  }, [router]);

  return null;
}
