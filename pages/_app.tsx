// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import Sidebar from '@/components/ui/Sidebar';

const BG = '#0b0c10';
const PUBLIC_ROUTES = ['/auth', '/auth/callback']; // everything else requires auth

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
    // Sync cookie for SSR/middleware
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

  // Public pages render without shell
  if (isPublic) return <Component {...pageProps} />;

  // Loader while checking auth
  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          background: BG,
        }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-block w-6 h-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          <span>Checking session…</span>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  return (
    <Shell>
      <Component {...pageProps} />
    </Shell>
  );
}

/* ------------------------------ Shell ------------------------------ */
/** Flex layout with CSS var --sbw for sidebar width.
 * We measure the actual Sidebar DOM width with ResizeObserver,
 * so when it collapses/expands, main area grows/shrinks automatically.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const sbRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sbRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    // set a sensible default once
    setSidebarWidthVar(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setSidebarWidthVar(w);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="min-h-screen w-full text-white" style={{ background: BG }}>
      {/* mobile stack; desktop flex */}
      <div
        className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 flex gap-6"
        style={
          {
            // fallback width; will be overridden by ResizeObserver
            ['--sbw' as any]: '280px',
          } as React.CSSProperties
        }
      >
        {/* Sidebar */}
        <div
          ref={sbRef}
          className="hidden md:block"
          style={{
            flex: '0 0 var(--sbw)', // <- key: fixed to the measured width
            minWidth: 0,
          }}
        >
          <div className="sticky top-6">
            <Sidebar />
          </div>
        </div>

        {/* Main grows to consume the remaining space */}
        <main
          className="flex-1 min-w-0"
          // nice consistent inner layout
          style={{
            // nothing needed; flex:1 makes it expand when sidebar shrinks
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

function setSidebarWidthVar(width: number) {
  // clamp between 48px (icon rail) and 420px (max expanded)
  const w = Math.max(48, Math.min(420, Math.round(width)));
  document.documentElement.style.setProperty('--sbw', `${w}px`);
}

/* ----------------------- cookie helpers (SSR) ----------------------- */
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
