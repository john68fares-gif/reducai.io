// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '../styles/globals.css'; // ← use relative import to avoid alias issues
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';
import Sidebar from '../components/ui/Sidebar';

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

  // Mobile drawer for sidebar (expandable)
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    // Close drawer on route change
    const off = router.events.on?.('routeChangeStart', () => setDrawerOpen(false));
    return () => {
      // next/router types: off may be undefined in older versions
      try {
        // @ts-ignore
        router.events.off?.('routeChangeStart', off);
      } catch {}
    };
  }, [router.events]);

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
      const {
        data: { session },
      } = await supabase.auth.getSession();
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

  return (
    <div className="min-h-screen w-full text-white" style={{ background: BG }}>
      {/* Mobile top bar trigger (md:hidden) */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0b0c10]/95 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <button
          aria-label="Open navigation"
          onClick={() => setDrawerOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 active:scale-[0.98]"
        >
          <span className="i-[menu]" />
          <span className="text-sm">Menu</span>
        </button>
        {/* You can put a tiny page title or logo on the right if you want */}
      </div>

      {/* Layout row: responsive, non-fixed sidebar + content with a constant gutter */}
      <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Sidebar column */}
          <aside
            className="
              hidden md:block shrink-0
              w-[clamp(220px,20vw,300px)]
            "
          >
            {/* No sticky -> it scrolls with content and feels 'attached' but not touching */}
            <Sidebar />
          </aside>

          {/* Main content column (always fills remaining width) */}
          <main className="flex-1 min-w-0">
            <Component {...pageProps} />
          </main>
        </div>
      </div>

      {/* Mobile drawer (expandable sidebar) */}
      <div
        className={`
          md:hidden fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px]
          transform transition-transform duration-300
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          bg-[#0b0c10]
          border-r border-white/10
        `}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-sm opacity-80">Navigation</div>
          <button
            aria-label="Close navigation"
            onClick={() => setDrawerOpen(false)}
            className="rounded-md p-2 hover:bg-white/5"
          >
            ✕
          </button>
        </div>
        <div className="p-3">
          <Sidebar />
        </div>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <button
          aria-label="Close navigation overlay"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50"
        />
      )}
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
