// middleware.ts — no-op, matches no routes
import { NextResponse } from 'next/server';

export const config = {
  // match nothing on purpose
  matcher: ['/__never_match__'],
};

export default function middleware() {
  return NextResponse.next();
}
