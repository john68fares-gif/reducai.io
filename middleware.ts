// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Server-side gate for the entire site.
 * - Allows only /auth and /auth/callback without a session.
 * - Everything else requires the ra_session cookie (set to "1" after login).
 * - Redirects unauthenticated users to /auth?mode=signin&from=<original>
 *
 * NOTE: Keep your _app.tsx (or auth page) setting/clearing `ra_session` on
 * SIGNED_IN / SIGNED_OUT so middleware can read it server-side.
 */
const PUBLIC_PATHS = new Set<string>(['/auth', '/auth/callback']);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip Next.js internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts')
  ) {
    return NextResponse.next();
  }

  // Public pages (no sidebar, no auth required)
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // Require session for everything else
  const hasSession = req.cookies.get('ra_session')?.value === '1';
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = `?mode=signin&from=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Apply to all routes except Next internals and static assets.
 * (We explicitly allow /auth and /auth/callback in the middleware body.)
 */
export const config = {
  matcher: ['/((?!_next/|favicon|images/|fonts/).*)'],
};
