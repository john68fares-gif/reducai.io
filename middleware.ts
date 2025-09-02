import { withAuth } from 'next-auth/middleware';
export default withAuth({ pages: { signIn: '/login' } });
export const config = {
  matcher: ['/builder/:path*', '/improve/:path*', '/voice-agent', '/dashboard'],
};
