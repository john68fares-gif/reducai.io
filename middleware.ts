// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Public route checks */
function isPublic(pathname: string) {
  if (pathname === '/') return false; // home stays guarded (handled separately)
  return (
    pathname === '/auth' ||
    pathname === '/sign-in' ||
    pathname === '/sign-up' ||
    pathname.startsWith('/auth/') // e.g. /auth/callback, /auth/verify, etc.
  );
}

/** Static assets? */
function isAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/static') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  );
}

/** API? (never run middleware auth on API routes) */
function isApi(pathname: string) {
  return pathname.startsWith('/api');
}

/** Supabase / app session check */
function isAuthed(req: NextRequest) {
  const c = req.cookies;
  if (c.get('ra_session')?.value === '1') return true;
  const hasSb =
    c.get('sb-access-token') ||
    c.get('sb-refresh-token') ||
    c.getAll().some((x) => x.name.startsWith('sb-'));
  return Boolean(hasSb);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow assets & API
  if (isAsset(pathname) || isApi(pathname)) {
    return NextResponse.next();
  }

  const authed = isAuthed(req);

  // Redirect authed users from "/" → "/builder"
  if (pathname === '/' && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/builder';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Public routes are always allowed (sign-in/up, auth flows, etc.)
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires auth
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = `?mode=signin&from=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/**
 * Important: exclude API + assets in the matcher so we don't even enter middleware for them.
 * (This is faster and avoids edge-case redirects on fetches.)
 */
export const config = {
  matcher: [
    // run on everything EXCEPT _next, assets, and api
    '/((?!_next/|favicon|images/|fonts/|static/|api/).*)',
  ],
};
