// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Public, no-auth pages */
const PUBLIC = new Set<string>([
  '/',
  '/auth/callback',
  '/post-auth',      // <-- must be fully public so PKCE exchange can happen on the page
  '/pricing',
  '/contact',
  '/privacy',
  '/terms',
]);

/** Bypass assets & API */
function isBypassedPath(p: string) {
  return (
    p.startsWith('/_next') ||
    p.startsWith('/favicon') ||
    p.startsWith('/images') ||
    p.startsWith('/fonts') ||
    p.startsWith('/static') ||
    p.startsWith('/api')           // never run middleware on API routes
  );
}

/** Very light “am I signed in” check (Supabase cookies or our hint cookie) */
function isAuthed(req: NextRequest) {
  const c = req.cookies;
  if (c.get('ra_session')?.value === '1') return true;
  const hasSb =
    c.get('sb-access-token') ||
    c.get('sb-refresh-token') ||
    c.getAll().some(x => x.name.startsWith('sb-'));
  return Boolean(hasSb);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always bypass static and API
  if (isBypassedPath(pathname)) return NextResponse.next();

  const authed = isAuthed(req);

  // Let /post-auth run even when NOT authed so the code exchange can complete
  if (pathname === '/post-auth') {
    return NextResponse.next();
  }

  // If already signed in and they hit the landing page, send to the app
  if (pathname === '/' && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/builder';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // All other public routes are open
  if (PUBLIC.has(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires auth
  if (!authed) {
    const back = req.nextUrl.clone();
    back.pathname = '/';
    back.search = '?signin=1';
    return NextResponse.redirect(back);
  }

  return NextResponse.next();
}

export const config = {
  // Exclude static and API from middleware
  matcher: ['/((?!_next/|favicon|images/|fonts/|static/|api/).*)'],
};
