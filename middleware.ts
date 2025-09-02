import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token, req }) => {
      if (!token) return false
      const p = req.nextUrl.pathname
      // @ts-ignore
      const isAdmin = token.isAdmin === true
      if (p.startsWith('/admin')) return isAdmin
      return true
    }
  }
})

export const config = {
  matcher: ['/builder/:path*', '/improve/:path*', '/voice-agent', '/dashboard', '/admin/:path*'],
}
