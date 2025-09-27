// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ✅ Allow the landing page and other marketing pages without auth
const PUBLIC = new Set<string>([
  '/',                 // ← put root back
  '/auth',             // if you still keep a dedicated page
  '/auth/callback',
  '/pricing',
  '/contact',
  '/privacy',
  '/terms'
]);

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
  if (c.get('ra_session')?.value === '1') return true; // your custom session flag
  const hasSb =
    c.get('sb-access-token') ||
    c.get('sb-refresh-token') ||
    c.getAll().some((x) => x.name.startsWith('sb-'));
  return Boolean(hasSb);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow static assets
  if (isAsset(pathname)) return NextResponse.next();

  const authed = isAuthed(req);

  // If authed and visiting "/", send them to the app
  if (pathname === '/' && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/builder';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ✅ Public routes are allowed for everyone
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // Everything else requires auth
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth'; // or keep `/` if you only use the overlay
    url.search = `?mode=signin&from=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // still protect everything except common asset paths
  matcher: ['/((?!_next/|favicon|images/|fonts/|static/).*)'],
};
