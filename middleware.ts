// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Public, no-auth pages */
const PUBLIC = new Set<string>([
  '/',
  '/auth/callback',   // Supabase OAuth callback
  '/post-auth',       // land here after OAuth; client finishes auth
  '/pricing',
  '/contact',
  '/privacy',
  '/terms'
]);

/** Asset/API paths (always allowed) */
function isBypassedPath(p: string) {
  return (
    p.startsWith('/_next') ||
    p.startsWith('/favicon') ||
    p.startsWith('/images') ||
    p.startsWith('/fonts') ||
    p.startsWith('/static') ||
    p.startsWith('/api')      // do NOT run middleware on API routes
  );
}

/** Basic “am I signed in” check using Supabase cookies */
function isAuthed(req: NextRequest) {
  const c = req.cookies;
  if (c.get('ra_session')?.value === '1') return true; // your own flag if set in _app
  const hasSb =
    c.get('sb-access-token') ||
    c.get('sb-refresh-token') ||
    c.getAll().some(x => x.name.startsWith('sb-'));
  return Boolean(hasSb);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always bypass assets & API
  if (isBypassedPath(pathname)) return NextResponse.next();

  const authed = isAuthed(req);

  // If user is signed in and visits "/", send them to the app
  if (pathname === '/' && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/builder';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Public routes are open — and /post-auth must always pass through
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

  // Auth-only pages allowed
  return NextResponse.next();
}

export const config = {
  // Exclude _next assets, static, AND api from middleware
  matcher: ['/((?!_next/|favicon|images/|fonts/|static/|api/).*)'],
};
