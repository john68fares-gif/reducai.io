// pages/_app.tsx
import type { AppProps } from "next/app";
import Head from "next/head";
import "@/styles/globals.css";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/lib/supabase-client";
import Sidebar from "@/components/ui/Sidebar";

import { ThemeProvider } from "@/components/providers/ThemeProvider";
import GlobalRouteLoader from "@/components/ui/GlobalRouteLoader";

const PUBLIC_ROUTES = ["/", "/auth", "/auth/callback"];

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

  // --- AUTH: unchanged ---
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setRASessionCookie();
        setAuthed(true);
      } else if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        clearRASessionCookie();
        setAuthed(false);
        if (!isPublic) {
          router.replace(
            `/auth?mode=signin&from=${encodeURIComponent(
              router.asPath || "/"
            )}`
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
            `/auth?mode=signin&from=${encodeURIComponent(
              router.asPath || "/"
            )}`
          );
        }
      }
      setChecking(false);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, [router, isPublic]);
  // --- END AUTH ---

  return (
    <ThemeProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      {/* Global page loader overlay */}
      <GlobalRouteLoader />

      {isPublic ? (
        // Wrap public pages so they inherit theme tokens and avoid any stray dark bg
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          <Component {...pageProps} />
        </div>
      ) : checking ? (
        // Replace Tailwind color classes with CSS tokens to prevent the “dark halo”
        <div
          className="min-h-screen grid place-items-center"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{
                borderColor: "color-mix(in oklab, var(--text) 40%, transparent)",
                borderTopColor: "var(--brand)",
              }}
            />
            <span>Checking session…</span>
          </div>
        </div>
      ) : !authed ? null : (
        // App shell uses theme variables; sidebar styles come from your .sidebar tokens in globals.css
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          <div className="grid grid-cols-[260px_1fr] min-h-screen">
            <aside className="sidebar">
              <Sidebar />
            </aside>
            <main className="min-w-0 px-6 lg:px-10 py-8">
              <Component {...pageProps} />
            </main>
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}

function setRASessionCookie() {
  try {
    document.cookie = `ra_session=1; Path=/; Max-Age=${60 * 60 * 24 * 14}; SameSite=Lax; Secure`;
  } catch {}
}
function clearRASessionCookie() {
  try {
    document.cookie = "ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure";
  } catch {}
}
