import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/** Public, no-auth pages */
const PUBLIC = new Set<string>([
  '/',
  '/auth/callback',   // Supabase OAuth callback
  '/post-auth',       // <-- land here after OAuth (we’ll branch to Stripe or /builder)
  '/pricing',
  '/contact',
  '/privacy',
  '/terms'
]);

/** Asset paths (always allowed) */
function isAsset(p: string) {
  return (
    p.startsWith('/_next') ||
    p.startsWith('/favicon') ||
    p.startsWith('/images') ||
    p.startsWith('/fonts') ||
    p.startsWith('/static')
  );
}

/** Basic “am I signed in” check using Supabase cookies */
function isAuthed(req: NextRequest) {
  const c = req.cookies;
  if (c.get('ra_session')?.value === '1') return true; // your own session flag if you set one
  const hasSb =
    c.get('sb-access-token') ||
    c.get('sb-refresh-token') ||
    c.getAll().some(x => x.name.startsWith('sb-'));
  return Boolean(hasSb);
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow assets
  if (isAsset(pathname)) return NextResponse.next();

  // Public routes are open
  if (PUBLIC.has(pathname)) {
    // Special handler: /post-auth decides Stripe vs /builder
    if (pathname === '/post-auth') {
      if (!isAuthed(req)) {
        // Not signed in? Go home and open your overlay
        const back = req.nextUrl.clone();
        back.pathname = '/';
        back.search = '?signin=1';
        return NextResponse.redirect(back);
      }

      // Ask our API if user already exists / is subscribed
      const url = new URL('/api/user-status', req.url);
      const resp = await fetch(url.toString(), {
        headers: { cookie: req.headers.get('cookie') || '' }
      });

      // If the API fails for any reason, fail open to /builder (never loop)
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

      // New user -> Stripe Payment Link (must be set)
      const paymentLink =
        data.paymentLink ||
        process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || // e.g. https://buy.stripe.com/xxxxxx
        '';

      if (paymentLink) {
        return NextResponse.redirect(paymentLink);
      }

      // If no payment link configured, at least don’t trap them
      const fallback = req.nextUrl.clone();
      fallback.pathname = '/pricing';
      return NextResponse.redirect(fallback);
    }

    // Other public paths just pass through
    return NextResponse.next();
  }

  // Everything else requires auth
  if (!isAuthed(req)) {
    const back = req.nextUrl.clone();
    back.pathname = '/';
    back.search = '?signin=1';
    return NextResponse.redirect(back);
  }

  // Auth-only pages allowed
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/|favicon|images/|fonts/|static/).*)'],
};
