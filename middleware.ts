import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/auth' }, // where to send unauthenticated users
});

// Protect only page routes; let /api (except next-auth) work freely
export const config = {
  matcher: [
    // everything except Next.js internals and files
    '/((?!api/auth|_next|favicon.ico|robots.txt|sitemap.xml|images|public|assets|static|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|txt)).*)',
  ],
};
