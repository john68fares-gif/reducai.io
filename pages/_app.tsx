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

/** Section titles (used in the top rail) */
const TITLES: Record<string, string> = {
  "/builder": "Builder Dashboard",
  "/improve": "Tuning",
  "/voice-agent": "Voice Studio",
  "/launch": "Launchpad",
  "/phone-numbers": "Phone Numbers",
  "/apikeys": "API Keys",
  "/support": "Help",
};

/** Optional: section accent glows (emerald by default) */
const ACCENTS: Record<string, string> = {
  "/builder": "var(--brand)",        // emerald
  "/improve": "#9b8cff",             // purple
  "/voice-agent": "#7bd1ff",         // cyan
  "/launch": "#ffd68a",              // amber
  "/phone-numbers": "#6af7d1",       // mint
  "/apikeys": "var(--brand)",        // emerald
  "/support": "#ff9db1",             // pink
};

const RAIL_H = 56; // px — header height

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
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setRASessionCookie();
        setAuthed(true);
      } else if (event === "SIGNED_OUT" || event === "USER_DELETED") {
        clearRASessionCookie();
        setAuthed(false);
        if (!isPublic) {
          router.replace(`/auth?mode=signin&from=${encodeURIComponent(router.asPath || "/")}`);
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
          router.replace(`/auth?mode=signin&from=${encodeURIComponent(router.asPath || "/")}`);
        }
      }
      setChecking(false);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, [router, isPublic]);

  // compute section title + accent from current route
  const { sectionTitle, accent } = useMemo(() => {
    const key =
      Object.keys(TITLES).find((k) => pathname === k || pathname.startsWith(`${k}/`)) || "/builder";
    return {
      sectionTitle: TITLES[key],
      accent: ACCENTS[key] || "var(--brand)",
    };
  }, [pathname]);

  // expose rail height as a CSS var (useful if anything else needs it)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--rail-h", `${RAIL_H}px`);
    }
  }, []);

  return (
    <ThemeProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      <GlobalRouteLoader />

      {isPublic ? (
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          <Component {...pageProps} />
        </div>
      ) : checking ? (
        <div className="min-h-screen grid place-items-center" style={{ background: "var(--bg)", color: "var(--text)" }}>
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
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          {/* Layout grid: sidebar + content */}
          <div
            className="min-h-screen grid"
            style={{ gridTemplateColumns: "var(--sidebar-w,260px) 1fr" }}
          >
            <aside className="sidebar">
              <Sidebar />
            </aside>

            <div className="min-w-0 relative">
              {/* ===== TOP RAIL (from right edge of sidebar to right edge of page) ===== */}
              <div
                className="z-40 flex items-center px-6 font-movatif"
                style={{
                  position: "fixed",
                  top: 0,
                  left: "var(--sidebar-w, 260px)",            // start exactly at sidebar edge
                  width: "calc(100% - var(--sidebar-w,260px))",
                  height: RAIL_H,
                  background: "var(--panel)",                  // same surface vibe as API Keys/Numbers
                  borderBottom: "1px solid var(--border)",
                  // soft depth + subtle accent glow like your reference
                  boxShadow:
                    `0 10px 26px rgba(0,0,0,.32),
                     0 0 0 1px color-mix(in oklab, var(--border) 60%, transparent),
                     0 0 60px 0 color-mix(in oklab, ${accent} 14%, transparent)`,
                }}
              >
                {/* page title (no rounded container, just text) */}
                <span
                  className="text-lg font-semibold tracking-wide"
                  style={{ color: "var(--text)" }}
                >
                  {sectionTitle}
                </span>
              </div>

              {/* spacer so page content sits below the fixed rail */}
              <div style={{ height: RAIL_H }} />

              {/* page content */}
              <main className="min-w-0 px-6 lg:px-10 py-8">
                <Component {...pageProps} />
              </main>
            </div>
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}

/* -------- cookie helpers (unchanged auth) -------- */
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
