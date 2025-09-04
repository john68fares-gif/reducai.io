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
    () =>
      PUBLIC_ROUTES.some(
        (base) => pathname === base || pathname.startsWith(`${base}/`)
      ),
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
          router.replace(
            `/auth?mode=signin&from=${encodeURIComponent(router.asPath || '/')}`
          );
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
          router.replace(
            `/auth?mode=signin&from=${encodeURIComponent(router.asPath || '/')}`
          );
        }
      }
      setChecking(false);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, [router, isPublic]);

  if (isPublic) return <Component {...pageProps} />;

  if (checking) {
    return (
      <div
        className="min-h-screen grid place-items-center text-white"
        style={{ background: BG }}
      >
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
      {/* Sidebar */}
      <Sidebar />

      {/* Main content fills everything beside sidebar */}
      <main
        className="fixed top-0 right-0 bottom-0 min-h-screen"
        style={{
          left: 'var(--sidebar-w, 260px)', // fills from sidebar edge to screen edge
          background: 'rgba(15,18,20,0.95)', // subtle overlay
          borderLeft: '1px solid rgba(255,255,255,0.06)', // faint divider
          boxShadow: 'inset 0 0 35px rgba(0,255,194,0.04)', // subtle glow inside
          padding: '24px',
          overflowY: 'auto', // scroll content if needed
        }}
      >
        <Component {...pageProps} />
      </main>
    </div>
  );
}

function setRASessionCookie() {
  try {
    document.cookie = `ra_session=1; Path=/; Max-Age=${
      60 * 60 * 24 * 14
    }; SameSite=Lax; Secure`;
  } catch {}
}
function clearRASessionCookie() {
  try {
    document.cookie = 'ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure';
  } catch {}
}
