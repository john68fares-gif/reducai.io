// /middleware.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * PUBLIC ROUTES
 * - Allow the landing page ("/")
 * - Allow the auth screens
 * - Allow static/Next internals
 */
const PUBLIC_PATHS = new Set<string>([
  "/",               // 👈 show landing
  "/auth",
  "/auth/callback",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;

  // Static files & Next internals
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
 * Supabase sets a cookie like: sb-<PROJECT_REF>-auth-token
 * If it exists and is non-empty, consider the user authenticated.
 */
function hasSupabaseSession(req: NextRequest) {
  for (const c of req.cookies.getAll()) {
    if (/^sb-[a-zA-Z0-9]+-auth-token$/.test(c.name) && c.value && c.value !== "null") {
      return true;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Let public routes through
  if (isPublic(pathname)) return NextResponse.next();

  // Allow if we detect a Supabase session cookie
  if (hasSupabaseSession(req)) return NextResponse.next();

  // Otherwise, redirect to /auth (preserve where they tried to go)
  const url = req.nextUrl.clone();
  url.pathname = "/auth";
  url.search = ""; // reset first
  url.searchParams.set("mode", "signin");
  // keep original path + query to return after login
  url.searchParams.set("from", pathname + (search || ""));
  return NextResponse.redirect(url);
}

/**
 * Match all routes that don't look like static files,
 * plus API routes (you can narrow this if you have public APIs).
 */
export const config = {
  matcher: [
    // All routes without a file extension
    "/((?!.*\\..*).*)",
    // API routes too (adjust if you have public APIs)
    "/api/:path*",
  ],
};
