// /pages/_app.tsx
import type { AppProps } from 'next/app';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';

/**
 * Why this fixes Google sign-in bouncing:
 * - Supabase JS stores the auth session in localStorage (client-only).
 * - Your middleware/SSR can't see localStorage, so it assumed you're logged out and
 *   kept redirecting you back to /auth after Google returned.
 * - Here we subscribe to Supabase auth events globally and set a SOFT, server-visible
 *   cookie `ra_session=1` on SIGNED_IN, and clear it on SIGNED_OUT.
 * - Your middleware should treat presence of `ra_session=1` as "authenticated".
 *
 * Make sure your /middleware.ts checks for either:
 *   - /^sb-.*-auth-token$/ cookie  OR
 *   - ra_session=1
 */

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // 14 days, server-readable
        document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;
      } else if (event === 'SIGNED_OUT') {
        // clear cookie so middleware blocks again
        document.cookie = 'ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure';
      }
    });

    // On first load, if a session already exists, ensure cookie is present.
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;
      }
    })();

    return () => sub.data.subscription.unsubscribe();
  }, []);

  return <Component {...pageProps} />;
}
