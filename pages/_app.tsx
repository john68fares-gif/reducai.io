// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import Sidebar from '@/components/ui/Sidebar';
import { initTheme } from '@/lib/theme'; // <-- ADD

const BG = 'var(--bg)'; // <-- use token (optional)

const PUBLIC_ROUTES = ['/', '/auth', '/auth/callback'];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const pathname = router.pathname;

  // THEME INIT (runs once, before anything renders)
  useEffect(() => { initTheme(); }, []); // <-- ADD

  const isPublic = useMemo(
    () => PUBLIC_ROUTES.some((base) => pathname === base || pathname.startsWith(`${base}/`)),
    [pathname]
  );

  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setRASessionCookie();
        setAuthed(true);
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearRASessionCookie();
        setAuthed(false);
        if (!isPublic) {
          router.replace(`/auth?mode=signin&from=${encodeURIComponent(router.asPath || '/')}`);
        }
      }
    });

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setRASessionCookie();
        setAuthed(true);
      } else {
        clearRASessionCookie();
        setAuthed(false);
        if (!isPublic) {
          router.replace(`/auth?mode=signin&from=${encodeURIComponent(router.asPath || '/')}`);
        }
      }
      setChecking(false);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, [router, isPublic]);

  if (isPublic) return <Component {...pageProps} />;

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center text-white" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          <span>Checking session…</span>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  return (
    <div className="min-h-screen w-full text-white" style={{ background: 'var(--bg)' }}>
      <div className="grid grid-cols-[72px_1fr] sm:grid-cols-[200px_1fr] md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr] gap-0">
        <aside className="relative">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <Sidebar />
          </div>
        </aside>
        <main className="min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          <Component {...pageProps} />
        </main>
      </div>
    </div>
  );
}

function setRASessionCookie() {
  try {
    document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;
  } catch {}
}
function clearRASessionCookie() {
  try {
    document.cookie = 'ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure';
  } catch {}
}
