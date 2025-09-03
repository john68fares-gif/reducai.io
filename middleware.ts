// /middleware.ts
// Gate **the whole site** behind auth (except landing + auth pages).
// Works with Supabase OAuth AND email/password by checking either:
// 1) Supabase cookie: sb-<PROJECT_REF>-auth-token   (if present)
// 2) Our soft cookie:  ra_session=1                  (set by your auth pages after login)
//
// NOTE: Make sure your auth flows set `document.cookie = "ra_session=1; Path=/; Max-Age=1209600; Secure; SameSite=Lax"`
// after a successful sign-in/sign-up (and clear it on sign-out). Your Google callback
// file should also set this cookie after `exchangeCodeForSession(...)`.

import { NextResponse, type NextRequest } from "next/server";

// Public routes (everything else requires auth)
const PUBLIC = new Set<string>([
  "/",                // landing page stays public
  "/auth",
  "/auth/callback",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublic(path: string) {
  if (PUBLIC.has(path)) return true;

  // Static & Next internals
  if (
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/images") ||
    path.startsWith("/fonts")
  ) return true;

  return false;
}

function hasSupabaseCookie(req: NextRequest) {
  for (const c of req.cookies.getAll()) {
    if (/^sb-[a-zA-Z0-9]+-auth-token$/.test(c.name) && c.value && c.value !== "null") {
      return true;
    }
  }
  return false;
}

function hasSoftCookie(req: NextRequest) {
  const c = req.cookies.get("ra_session");
  return !!(c && c.value === "1");
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow public pages
  if (isPublic(pathname)) return NextResponse.next();

  // Allow if we detect either Supabase cookie or our soft cookie
  if (hasSupabaseCookie(req) || hasSoftCookie(req)) {
    return NextResponse.next();
  }

  // Otherwise, force Sign in
  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  url.search = "";
  url.searchParams.set("mode", "signin");
  url.searchParams.set("from", pathname + (search || ""));
  return NextResponse.redirect(url);
}

// Run on all routes (including API) — static files are skipped by isPublic()
export const config = {
  matcher: ["/:path*"],
};
