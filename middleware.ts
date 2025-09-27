// middleware.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Public, no-auth pages */
const PUBLIC = new Set<string>([
  '/',
  '/auth/callback',     // Supabase OAuth callback
  '/post-auth',         // land here after OAuth; we branch to Stripe or /builder
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
    p.startsWith('/api')      // <-- IMPORTANT: don't run middleware on API routes
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

  // Public routes are open (with special /post-auth logic)
  if (PUBLIC.has(pathname)) {
    if (pathname === '/post-auth') {
      if (!authed) {
        const back = req.nextUrl.clone();
        back.pathname = '/';
        back.search = '?signin=1';
        return NextResponse.redirect(back);
      }

      // Ask our API if user exists / subscribed
      const url = new URL('/api/user-status', req.url);
      const resp = await fetch(url.toString(), {
        headers: { cookie: req.headers.get('cookie') || '' }
      });

      // If API fails, fail open to /builder (avoid loops)
      if (!resp.ok) {
        const go = req.nextUrl.clone();
        go.pathname = '/builder';
        go.search = '';
        return NextResponse.redirect(go);
      }

      const data = (await resp.json()) as {
        hasAccount: boolean;
        hasSubscription: boolean;
        paymentLink?: string | null;
      };

      // Existing user OR already subscribed -> app
      if (data.hasAccount || data.hasSubscription) {
        const go = req.nextUrl.clone();
        go.pathname = '/builder';
        go.search = '';
        return NextResponse.redirect(go);
      }

      // New user -> Stripe Payment Link (must be set somewhere)
      const paymentLink =
        data.paymentLink ||
        process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK ||
        '';

      if (paymentLink) {
        // Absolute external link is fine here
        return NextResponse.redirect(paymentLink);
      }

      // No link configured -> pricing (don’t trap the user)
      const fallback = req.nextUrl.clone();
      fallback.pathname = '/pricing';
      fallback.search = '';
      return NextResponse.redirect(fallback);
    }

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
