// /pages/_app.tsx
import type { AppProps } from 'next/app';
import { useEffect } from 'react';

/**
 * Why this version:
 * - Avoids client-side exceptions by dynamically importing your supabase client
 *   ONLY in the browser (no SSR/window issues).
 * - On SIGNED_IN / TOKEN_REFRESHED -> sets server-visible cookie ra_session=1
 * - On SIGNED_OUT / USER_DELETED -> clears the cookie
 * - Syncs cookie once on first load (refresh/back button)
 *
 * Keep middleware allowing /auth and /auth/callback, and treat presence of either:
 *   - sb-<project-ref>-auth-token  OR  ra_session=1
 * as authenticated.
 */

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    let unsub: { data?: { subscription?: { unsubscribe: () => void } } } | null = null;
    let cancelled = false;

    async function wireAuth() {
      try {
        // Only run in the browser
        if (typeof window === 'undefined') return;

        // Dynamic import prevents SSR-time crashes if the client references window
        const mod = await import('@/lib/supabase-client');
        if (cancelled) return;
        const supabase = (mod as any).supabase || mod.default || mod;

        // Keep cookie in sync on auth changes
        unsub = supabase.auth.onAuthStateChange((event: string) => {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            setRASessionCookie();
          } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
            clearRASessionCookie();
          }
        });

        // Initial sync (page refresh, etc.)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) setRASessionCookie();
        else clearRASessionCookie();
      } catch (err) {
        // Fail-safe: never crash the app wrapper
        // (You’ll still be able to sign in; middleware may just rely on Supabase cookie)
        // console.error('Auth wiring failed', err);
      }
    }

    wireAuth();
    return () => {
      cancelled = true;
      try { unsub?.data?.subscription?.unsubscribe?.(); } catch {}
    };
  }, []);

  return (
    <>
      {/* minimal global look to match your site without fighting page-level styles */}
      <style jsx global>{`
        html, body {
          background: #0b0c10;
          color: #fff;
          margin: 0;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        * { outline-color: #6af7d1; }
      `}</style>
      <Component {...pageProps} />
    </>
  );
}

function setRASessionCookie() {
  // 14 days – server-visible cookie so middleware/SSR sees you're logged in
  document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;
}
function clearRASessionCookie() {
  document.cookie = 'ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure';
}
