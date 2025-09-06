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

/* ------------------------ routes ------------------------ */
const PUBLIC_ROUTES = ["/", "/auth", "/auth/callback"];

/* Title pulled from the route (matches your sidebar sections) */
const TITLES: Record<string, string> = {
  "/builder": "Builder Dashboard",
  "/improve": "Tuning",
  "/voice-agent": "Voice Studio",
  "/launch": "Launchpad",
  "/phone-numbers": "Numbers",
  "/apikeys": "API Keys",
  "/support": "Help",
};

/* ---------------------- tiny top rail ---------------------- */
/** Fixed bar that sits at the ABSOLUTE TOP of the page and visually
 *  *touches* the sidebar. It uses your CSS variables for light/dark. */
const RAIL_H = 72;

function TopRail({ title }: { title: string }) {
  useEffect(() => {
    try {
      document.documentElement.style.setProperty("--rail-h", `${RAIL_H}px`);
    } catch {}
  }, []);

  if (!title) return null;

  return (
    <>
      <div
        className="z-[1000] backdrop-blur-[2px]"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: RAIL_H,
          display: "flex",
          alignItems: "center",
          // this padding-left makes the header start exactly where the sidebar ends
          paddingLeft: "calc(var(--sidebar-w, 260px) + 18px)",
          paddingRight: 18,
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--panel) 95%, transparent) 0%, var(--panel) 100%)",
          borderBottom: "1px solid var(--border)",
          boxShadow:
            "0 12px 30px rgba(0,0,0,.28), 0 0 0 1px color-mix(in oklab, var(--border) 60%, transparent)",
        }}
      >
        <div
          className="inline-flex items-center gap-2 rounded-full px-12 py-2.5"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--brand) 18%, transparent) 0%, transparent 100%)",
            border:
              "1px solid color-mix(in oklab, var(--brand) 35%, var(--border))",
            boxShadow:
              "0 10px 24px color-mix(in oklab, var(--brand) 24%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--brand) 10%, transparent)",
            color: "var(--text)",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: "var(--brand)",
              boxShadow:
                "0 0 0 4px color-mix(in oklab, var(--brand) 15%, transparent)",
            }}
          />
          <span className="font-semibold" style={{ letterSpacing: ".2px" }}>
            {title}
          </span>
        </div>
      </div>

      {/* spacer so page content never hides under the fixed rail */}
      <div aria-hidden style={{ height: RAIL_H }} />
    </>
  );
}

/* ---------------------- main app ---------------------- */
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

  const sectionTitle = useMemo(() => {
    const hit = Object.keys(TITLES).find(
      (key) => pathname === key || pathname.startsWith(`${key}/`)
    );
    return hit ? TITLES[hit] : "";
  }, [pathname]);

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
        <div
          className="min-h-screen grid place-items-center"
          style={{ background: "var(--bg)", color: "var(--text)" }}
        >
          <div className="flex items-center gap-3">
            <span
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{
                borderColor:
                  "color-mix(in oklab, var(--text) 40%, transparent)",
                borderTopColor: "var(--brand)",
              }}
            />
            <span>Checking session…</span>
          </div>
        </div>
      ) : !authed ? null : (
        <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
          {/* 2-col layout: sidebar + content */}
          <div
            className="min-h-screen grid"
            style={{ gridTemplateColumns: "var(--sidebar-w,260px) 1fr" }}
          >
            <aside className="sidebar">
              <Sidebar />
            </aside>

            <main className="min-w-0 px-6 lg:px-10 py-8">
              {/* ABSOLUTE TOP RAIL (touches sidebar). It renders here + spacer so content sits below it. */}
              <TopRail title={sectionTitle} />

              {/* Your page component */}
              <Component {...pageProps} />
            </main>
          </div>
        </div>
      )}
    </ThemeProvider>
  );
}

/* ---------------------- cookie helpers ---------------------- */
function setRASessionCookie() {
  try {
    document.cookie = `ra_session=1; Path=/; Max-Age=${
      60 * 60 * 24 * 14
    }; SameSite=Lax; Secure`;
  } catch {}
}
function clearRASessionCookie() {
  try {
    document.cookie = "ra_session=; Path=/; Max-Age=0; SameSite=Lax; Secure";
  } catch {}
}
