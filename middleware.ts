// /middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Public routes — NEVER block these.
 *  - "/" (landing)
 *  - "/auth" (signin/signup)
 *  - "/auth/callback" (Google bounces here; must be public!)
 *  - Next.js internals and static assets
 */
const PUBLIC_PATHS = new Set<string>([
  "/",
  "/auth",
  "/auth/callback",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/fonts")
  ) {
    return true;
  }
  return false;
}

/**
 * Auth detection:
 * - If you're using @supabase/auth-helpers-nextjs, a cookie like sb-<ref>-auth-token exists.
 * - If you're using plain supabase-js (localStorage), we also set a soft cookie "ra_session=1" on sign-in/callback.
 */
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

  // Always allow public routes (especially /auth/callback)
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // If user is authenticated (via either cookie), allow access
  if (hasSupabaseCookie(req) || hasSoftCookie(req)) {
    // Optional nicety: if they hit /auth while authed, bounce them inside
    if (pathname === "/auth") {
      const url = req.nextUrl.clone();
      url.pathname = "/builder";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Not authed → send to /auth (preserve intended target)
  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  url.search = ""; // reset first
  url.searchParams.set("mode", "signin");
  url.searchParams.set("from", pathname + (search || ""));
  return NextResponse.redirect(url);
}

/**
 * Apply to everything; public paths are allowed by isPublic().
 */
export const config = {
  matcher: ["/:path*"],
};
