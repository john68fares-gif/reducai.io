// middleware.ts  — put at project root
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// PUBLIC pages (no auth required, no sidebar):
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

// Detect Supabase auth cookies (covers standard names + sb- prefixed)
function hasSupabaseAuthCookie(req: NextRequest) {
  const cookies = req.cookies.getAll();
  return cookies.some(
    (c) =>
      c.name === 'sb-access-token' ||
      c.name === 'sb-refresh-token' ||
      c.name.startsWith('sb-') // e.g. sb-project-ref-auth-token
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow Next internals and static assets
  if (isAsset(pathname)) return NextResponse.next();

  // Allow public routes (/, /auth, /auth/callback)
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // Everything else requires Supabase auth
  if (!hasSupabaseAuthCookie(req)) {
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
