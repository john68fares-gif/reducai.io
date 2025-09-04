// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';
import Sidebar from '@/components/ui/Sidebar';

const BG = '#0b0c10';
// Public routes: NO sidebar, NO auth gating
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

  // 1) Public pages render bare (landing, auth, callback)
  if (isPublic) return <Component {...pageProps} />;

  // 2) Protected pages: loader while we decide
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

  // 3) Authenticated pages: wrap with flex shell using *measured* sidebar width
  return (
    <Shell>
      <Component {...pageProps} />
    </Shell>
  );
}

/* ------------------------------ Shell ------------------------------ */
/**
 * Flex row: [ Sidebar | Main ]
 * - Sidebar width is whatever your <Sidebar /> renders (expanded or collapsed).
 * - We measure it with ResizeObserver and set CSS var --sbw, used only to fix layout jitter on first paint.
 * - Main is flex:1 and expands ONLY when sidebar actually shrinks.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const sbWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = sbWrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;

    // Initialize CSS var to current width
    const apply = (w: number) => {
      const clamped = Math.max(44, Math.min(420, Math.round(w)));
      document.documentElement.style.setProperty('--sbw', `${clamped}px`);
    };
    apply(wrap.getBoundingClientRect().width);

    // Track width changes (expanded/collapsed)
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w =
          // borderBoxSize is most accurate when available
          (entry as any).borderBoxSize?.[0]?.inlineSize ??
          entry.contentRect?.width ??
          wrap.getBoundingClientRect().width;
        apply(w);
      }
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="min-h-screen text-white" style={{ background: BG }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-6">
          {/* Sidebar column: never grows or shrinks content; just has its own width */}
          <div ref={sbWrapRef} className="shrink-0">
            <div className="sticky top-6">
              <Sidebar />
            </div>
          </div>

          {/* Main: always takes remaining space. Smoothly adapts when sidebar collapses/expands */}
          <main
            className="flex-1 min-w-0"
            style={{
              transition: 'width 200ms ease, flex-basis 200ms ease', // pleasant resize when the sidebar animates
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Cookie helpers for SSR ----------------------- */
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
