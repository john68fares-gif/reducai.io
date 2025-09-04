// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import Sidebar from '@/components/ui/Sidebar';

const BG = '#0b0c10';
// Public pages (no sidebar, no auth required)
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

  // Public pages render bare (no sidebar)
  if (isPublic) return <Component {...pageProps} />;

  // Loader while deciding on private pages
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

  // ✅ Full-width flex shell: sidebar (fixed) + main (flex-1 expands)
  return (
    <div className="min-h-screen w-full text-white" style={{ background: BG }}>
      <div className="flex gap-6 px-4 sm:px-6 lg:px-8 py-8">
        {/* Sidebar column (does not grow) */}
        <aside className="hidden md:block shrink-0">
          <div className="sticky top-6">
            <Sidebar />
          </div>
        </aside>

        {/* Main content (always fills remaining width) */}
        <main className="flex-1 min-w-0">
          <Component {...pageProps} />
        </main>
      </div>
    </div>
  );
}

/* ---------- cookie helpers (server-visible for middleware/SSR) ---------- */
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
