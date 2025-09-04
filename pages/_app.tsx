// /pages/_app.tsx
import type { AppProps } from 'next/app';
import '@/styles/globals.css';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { Bot as BotIcon, Grid2x2, Settings, LogOut } from 'lucide-react';

const ACCENT = '#6af7d1';
const BG = '#0b0c10';

// Only these routes are public. Everything else requires a session.
const PUBLIC_ROUTES = ['/auth', '/auth/callback'];

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
    // Keep ra_session in sync so middleware/SSR can read auth
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setRASessionCookie();
        setAuthed(true);
      } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        clearRASessionCookie();
        setAuthed(false);
        if (!isPublic) {
          // Bounce to auth, preserving where the user was
          router.replace(`/auth?mode=signin&from=${encodeURIComponent(router.asPath || '/')}`);
        }
      }
    });

    // Initial check on load
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

  // Public pages render bare (no shell)
  if (isPublic) {
    return <Component {...pageProps} />;
  }

  // Protected pages: show soft loader while deciding
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

  // If not authed (we probably just redirected), render nothing
  if (!authed) return null;

  // Authenticated: wrap in AppShell (sidebar everywhere inside)
  return (
    <AppShell>
      <Component {...pageProps} />
    </AppShell>
  );
}

/* -------------------------- App Shell (Sidebar) -------------------------- */

function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full text-white font-movatif" style={{ background: BG }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3">
          <div
            className="sticky top-6 rounded-[18px] p-4"
            style={{
              background: 'rgba(13,15,17,0.92)',
              border: `2px solid rgba(106,247,209,0.32)`,
              boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.18)', border: `2px solid rgba(106,247,209,0.35)` }}
              >
                <BotIcon className="w-4 h-4" style={{ color: ACCENT }} />
              </div>
              <div className="font-semibold">Reduc.ai</div>
            </div>

            <nav className="space-y-1">
              <SideLink href="/builder" label="Builds" icon={<Grid2x2 className="w-4 h-4" />} active={router.pathname.startsWith('/builder')} />
              <SideLink href="/settings" label="Settings" icon={<Settings className="w-4 h-4" />} disabled />
              {/* Add more sections here and they’ll render in the same shell */}
            </nav>

            <div className="mt-6 border-t border-white/10 pt-4">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  // Redirect happens from the onAuthStateChange above
                }}
                className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-[12px] text-sm border transition"
                style={{ background: 'rgba(16,19,20,0.88)', border: '1px solid rgba(255,255,255,0.25)' }}
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <section className="col-span-12 md:col-span-9 lg:col-span-9">
          {children}
        </section>
      </div>
    </div>
  );
}

function SideLink({
  href,
  icon,
  label,
  active,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const cls = 'w-full inline-flex items-center gap-2 px-3 py-2 rounded-[12px] text-sm transition';
  const style: React.CSSProperties = active
    ? { background: ACCENT, color: BG, fontWeight: 800, boxShadow: '0 0 10px rgba(106,247,209,0.18)' }
    : { background: 'rgba(16,19,20,0.88)', border: '1px solid rgba(255,255,255,0.20)', color: 'white' };

  if (disabled) {
    return (
      <div className={`${cls} opacity-50 cursor-not-allowed`} style={style}>
        {icon}
        {label}
      </div>
    );
  }

  return (
    <Link href={href} className={cls} style={style}>
      {icon}
      {label}
    </Link>
  );
}

/* ------------------------- cookie helpers for SSR ------------------------ */

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
