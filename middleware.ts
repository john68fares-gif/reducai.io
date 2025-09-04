// /middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = new Set<string>([
  '/',                  // landing
  '/auth',              // sign in/up
  '/auth/callback',     // google oauth return
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

function isPublic(path: string) {
  if (PUBLIC.has(path)) return true;
  if (path.startsWith('/_next') || path.startsWith('/static') || path.startsWith('/images') || path.startsWith('/fonts')) {
    return true;
  }
  return false;
}

function hasSupabaseCookie(req: NextRequest) {
  for (const c of req.cookies.getAll()) {
    if (/^sb-[a-zA-Z0-9]+-auth-token$/.test(c.name) && c.value && c.value !== 'null') return true;
  }
  return false;
}
function hasSoftCookie(req: NextRequest) {
  return req.cookies.get('ra_session')?.value === '1';
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow public routes (especially /auth & /auth/callback)
  if (isPublic(pathname)) return NextResponse.next();

  const authed = hasSupabaseCookie(req) || hasSoftCookie(req);
  if (authed) {
    // IMPORTANT: do NOT force /auth -> /builder here.
    // Just allow the request; users can still visit /auth if they want.
    return NextResponse.next();
  }

  // Not authed -> require sign-in
  const url = req.nextUrl.clone();
  url.pathname = '/auth';
  url.search = '';
  url.searchParams.set('mode', 'signin');
  url.searchParams.set('from', pathname + (search || ''));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/:path*'],
};
