// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Public pages: no auth required
const PUBLIC = new Set<string>(['/auth', '/auth/callback']); // ← remove '/' from PUBLIC

function isAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/static')
  );
}

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

  // Always allow assets
  if (isAsset(pathname)) return NextResponse.next();

  const authed = isAuthed(req);

  // Redirect authed users away from "/" → "/builder"
  if (pathname === '/' && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/builder';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Public routes always allowed
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // Everything else requires auth
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = `?mode=signin&from=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|favicon|images/|fonts/|static/).*)'],
};
