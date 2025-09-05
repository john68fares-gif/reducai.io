// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import Sidebar from '@/components/ui/Sidebar';

const BG = '#0b0c10';
const SECTION_BG = '#101314'; // the “section” color you use inside pages
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
   * Layout note:
   * - Full-bleed SECTION_BG layer sits behind the whole grid (so it extends under the sidebar).
   * - Main content remains centered and never touches the sidebar via the inner max-width container.
   * - No logic changed.
   */
  return (
    <div className="relative min-h-screen w-full text-white" style={{ background: BG }}>
      {/* full-bleed “section” background under everything (including the sidebar) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: SECTION_BG }}
      />

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
        </aside>

        {/* Main content */}
        <main className="min-w-0 px-4 sm:px-6 lg:px-8 py-8">
          {/* center the inner content so cards don’t touch the sidebar */}
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
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
