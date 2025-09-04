// middleware.ts  — place at project root
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Public pages: no auth required, no sidebar
const PUBLIC = new Set<string>(['/', '/auth', '/auth/callback']);

function isAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/static')
  );
}

// Accept either your client flag cookie OR Supabase auth cookies
function isAuthed(req: NextRequest) {
  const c = req.cookies;
  // Your client-set, server-visible flag (set in _app.tsx / auth flow)
  if (c.get('ra_session')?.value === '1') return true;

  // Supabase cookies (if you ever switch to server helpers/cookies)
  const hasSb =
    c.get('sb-access-token') ||
    c.get('sb-refresh-token') ||
    // some deployments prefix with "sb-<project-ref>-auth-token"
    c.getAll().some((x) => x.name.startsWith('sb-'));
  return Boolean(hasSb);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Always allow assets
  if (isAsset(pathname)) return NextResponse.next();

  // Always allow public routes
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // Everything else requires auth
  if (!isAuthed(req)) {
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
