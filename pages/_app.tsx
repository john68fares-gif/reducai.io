// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import Sidebar from '@/components/ui/Sidebar';

const BG = '#0b0c10';
const PUBLIC_ROUTES = ['/', '/auth', '/auth/callback'];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const pathname = router.pathname;

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
      <div className="min-h-screen grid place-items-center text-white" style={{ background: BG }}>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          <span>Checking session…</span>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  /**
   * Grid layout:
   * - col 1: sidebar with responsive fixed width (prevents the thin icon-only gutter on desktop)
   * - col 2: main content (fills remaining width), padded so content never touches the sidebar (“magnet” feel)
   */
  return (
    <div className="min-h-screen w-full text-white" style={{ background: BG }}>
      <div
        className="
          grid
          grid-cols-[72px_1fr]          /* xs: tiny rail */
          sm:grid-cols-[200px_1fr]      /* sm: compact sidebar */
          md:grid-cols-[220px_1fr]      /* md: normal */
          lg:grid-cols-[240px_1fr]      /* lg: wider */
          xl:grid-cols-[260px_1fr]
          gap-0
        "
      >
        {/* Sidebar (sticky, responsive width) */}
        <aside className="relative">
          <div className="sticky top-0 h-screen overflow-y-auto">
            <Sidebar />
          </div>
          {/* subtle separator so content feels distinct (style-only) */}
          <div className="pointer-events-none absolute top-0 right-0 h-full w-px bg-white/5" />
        </aside>

        {/* Main content (adds centered max-width wrapper; logic untouched) */}
        <main className="min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          <div className="mx-auto w-full max-w-[1200px]">
            <Component {...pageProps} />
          </div>
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
