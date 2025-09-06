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

/* Map a simple section title chip like your screenshots */
const TITLES: Record<string, string> = {
  "/builder": "Builds",
  "/improve": "Tuning",
  "/voice-agent": "Voice Agents",
  "/launch": "Launchpad",
  "/phone-numbers": "Phone Numbers",
  "/apikeys": "API Keys",
  "/support": "Help",
};

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

  const sectionTitle = useMemo(() => {
    const entry = Object.keys(TITLES).find((key) => pathname === key || pathname.startsWith(`${key}/`));
    return entry ? TITLES[entry] : "";
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
          {/* GRID uses the CSS var set by Sidebar to remove ghost space */}
          <div
            className="min-h-screen grid"
            style={{ gridTemplateColumns: "var(--sidebar-w,260px) 1fr" }}
          >
            <aside className="sidebar">
              <Sidebar />
            </aside>

            <main className="min-w-0 px-6 lg:px-10 py-8">
              {/* small top “tag” like your screenshots */}
              {sectionTitle && (
                <div
                  className="inline-flex items-center gap-2 px-3 h-7 rounded-full mb-6 text-sm"
                  style={{
                    background: "color-mix(in oklab, var(--brand) 15%, var(--panel))",
                    border: "1px solid var(--border)",
                    boxShadow: "0 4px 16px rgba(0,0,0,.25)",
                    color: "var(--text)",
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: "var(--brand)" }} />
                  {sectionTitle}
                </div>
              )}
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
