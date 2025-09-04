// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css'; // ⬅️ restore your Tailwind/global styles
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase-client';

/**
 * Keeps a server-visible cookie in sync with Supabase auth so protected routes work,
 * but does not touch your page styles.
 */
export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Keep ra_session in sync on any auth change
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setRASessionCookie();
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearRASessionCookie();
      }
    });

    // Initial sync on page load/refresh
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setRASessionCookie();
      else clearRASessionCookie();
    })();

    return () => sub.data.subscription.unsubscribe();
  }, []);

  return <Component {...pageProps} />;
}

function setRASessionCookie() {
  // 14 days; server-visible so middleware/SSR can see logged-in state
  document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;
}
function clearRASessionCookie() {
  document.cookie = 'ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure';
}
