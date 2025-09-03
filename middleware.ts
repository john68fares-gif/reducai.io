// /middleware.ts
import { NextRequest, NextResponse } from 'next/server';

// Public paths that never require auth
const PUBLIC_PATHS = [
  '/auth',
  '/auth/callback',
  '/favicon.ico',
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  // Allow Next.js internals & static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/api/public') // optional: any public APIs
  ) return true;
  return false;
}

function hasSupabaseAuthCookie(req: NextRequest) {
  // Supabase sets a cookie like: sb-<PROJECT_REF>-auth-token
  for (const c of req.cookies.getAll()) {
    if (/^sb-.*-auth-token$/.test(c.name) && c.value && c.value !== 'null') {
      return true;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();
  if (hasSupabaseAuthCookie(req)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/auth';
  url.searchParams.set('mode', 'signin');
  url.searchParams.set('from', pathname || '/builder');
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // All routes without a file extension
    '/((?!.*\\..*).*)',
    // API routes too (adjust if you have public APIs)
    '/api/:path*',
  ],
};
