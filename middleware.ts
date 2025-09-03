// /middleware.ts
// Disabled auth gating: Supabase JS stores session in localStorage (not cookies),
// so the server (middleware) can't see your login. This was causing loops.
// We keep only basic passthrough here so landing and auth work cleanly.

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Public routes & static assets always pass through.
const PUBLIC_PREFIXES = ["/", "/auth", "/favicon.ico", "/robots.txt", "/sitemap.xml", "/_next", "/static", "/images", "/fonts"];

// If you later switch to @supabase/auth-helpers-nextjs (which sets server cookies),
// you can re-enable gating here safely.
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Minimal matcher so this middleware is effectively a no-op for the whole site.
export const config = {
  matcher: ["/:path*"],
};
