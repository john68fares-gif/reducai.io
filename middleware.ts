// middleware.ts (safe, edge-friendly)
import { NextRequest, NextResponse } from 'next/server';

// Only protect the builder area
export const config = { matcher: ['/builder/:path*'] };

export default function middleware(req: NextRequest) {
  try {
    const url = req.nextUrl.clone();

    // Accept either Supabase *or* NextAuth cookies (if you used either before)
    const supabaseAccess =
      req.cookies.get('sb-access-token')?.value ||
      req.cookies.get('supabase-auth-token')?.value; // depending on your helper setup

    const nextAuthAccess =
      req.cookies.get('__Secure-next-auth.session-token')?.value ||
      req.cookies.get('next-auth.session-token')?.value;

    const hasSession = Boolean(supabaseAccess || nextAuthAccess);

    // No session? send to /auth (keep the original destination in ?from=)
    if (!hasSession) {
      url.pathname = '/auth';
      url.searchParams.set('mode', 'signin');
      url.searchParams.set('from', req.nextUrl.pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }

    // Authenticated → proceed
    return NextResponse.next();
  } catch {
    // NEVER crash middleware – just let the request through
    return NextResponse.next();
  }
}
