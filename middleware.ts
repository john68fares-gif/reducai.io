// middleware.ts
import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/auth' }, // our custom auth page
});

export const config = {
  matcher: ['/builder/:path*'], // protect builder only
};
