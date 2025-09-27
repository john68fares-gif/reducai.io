// pages/auth/callback.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

function setRASessionCookie(on: boolean) {
  try {
    // 14 days; Secure for Vercel (HTTPS)
    document.cookie = on
      ? `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`
      : `ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure`;
  } catch {}
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      // Exchange ?code= (OAuth or magic-link) → Supabase session
      const { data, error } = await supabase.auth.exchangeCodeForSession(
        window.location.href
      );

      if (error) {
        // fall back to home with an error flag
        router.replace('/?auth=error');
        return;
      }

      setRASessionCookie(Boolean(data.session));

      // send them back where they started, or to /builder
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from') || '/builder';
      router.replace(from);
    })();
  }, [router]);

  return null;
}
