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

  // ↪ responsive+expandable sidebar states
  const [collapsed, setCollapsed] = useState(false);  // desktop collapse
  const [mobileOpen, setMobileOpen] = useState(false); // mobile drawer

  // set initial collapse based on screen size
  useEffect(() => {
    try {
      const mq = window.matchMedia('(max-width: 1280px)');
      setCollapsed(mq.matches); // start collapsed on <=1280px
      const handler = (e: MediaQueryListEvent) => setCollapsed(e.matches);
      mq.addEventListener?.('change', handler);
      return () => mq.removeEventListener?.('change', handler);
    } catch {}
  }, []);

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

  return (
    <div className="min-h-screen w-full text-white overflow-x-hidden" style={{ background: BG }}>
      {/* Mobile top bar (menu button) */}
      <div className="md:hidden flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="px-3 py-2 rounded-lg border border-white/15 active:scale-95 transition"
        >
          Menu
        </button>
      </div>

      <div className="flex gap-6 px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        {/* --- Desktop Sidebar (expandable) --- */}
        <aside
          className={[
            'hidden md:block shrink-0 transition-[width] duration-300 ease-out',
            collapsed ? 'w-[68px]' : 'w-[clamp(220px,18vw,320px)]',
          ].join(' ')}
        >
          <div className="sticky top-6">
            <Sidebar />
          </div>

          {/* Collapse/Expand toggle (floats under the sidebar) */}
          <div className="mt-4 flex justify-end pr-1">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-md border border-white/15 px-2 py-1 text-xs opacity-80 hover:opacity-100 transition"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? '›' : '‹'}
            </button>
          </div>
        </aside>

        {/* --- Mobile Drawer Sidebar --- */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-50 md:hidden"
            aria-modal="true"
            role="dialog"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <div className="absolute left-0 top-0 h-full w-[82vw] max-w-[340px] bg-[#0d1011] border-r border-white/10 shadow-2xl animate-[slideIn_.25s_ease-out]">
              <div className="p-4 flex items-center justify-between border-b border-white/10">
                <div className="text-sm opacity-80">Navigation</div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md border border-white/15 px-2 py-1 text-xs opacity-80 hover:opacity-100 transition"
                >
                  Close
                </button>
              </div>
              <div className="p-3">
                <Sidebar />
              </div>
            </div>
          </div>
        )}

        {/* Main content (centered & never touching sidebar) */}
        <main className="flex-1 min-w-0">
          <div className="max-w-screen-2xl mx-auto w-full">
            <Component {...pageProps} />
          </div>
        </main>
      </div>

      {/* keyframes for the drawer */}
      <style jsx global>{`
        @keyframes slideIn {
          from { transform: translateX(-12%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ---------- cookie helpers ---------- */
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
