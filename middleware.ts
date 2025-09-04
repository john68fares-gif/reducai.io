// middleware.ts  (place at project root)
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Only these paths are public. EVERYTHING else requires a valid Supabase auth cookie.
const PUBLIC = new Set<string>(['/auth', '/auth/callback']);

// Allow Next internals & static assets
function isAsset(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/api/public')
  );
}

// Detect if any Supabase auth cookie exists (covers both cookie names/styles Supabase uses)
function hasSupabaseAuthCookie(req: NextRequest) {
  const cookies = req.cookies.getAll();
  // common cookie names used by Supabase
  const names = new Set([
    'sb-access-token',
    'sb-refresh-token',
  ]);
  // some deployments prefix cookies with "sb-" + ref; also catch any "sb-" auth cookie
  return cookies.some(
    (c) => names.has(c.name) || c.name.startsWith('sb-')
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Skip internals/assets
  if (isAsset(pathname)) return NextResponse.next();

  // Public routes
  if (PUBLIC.has(pathname)) return NextResponse.next();

  // Everything else requires Supabase auth cookie
  const authed = hasSupabaseAuthCookie(req);
  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = `?mode=signin&from=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Apply to every route except Next internals/assets (handled above)
export const config = {
  matcher: ['/((?!_next/|favicon|images/|fonts/|static/).*)'],
};
