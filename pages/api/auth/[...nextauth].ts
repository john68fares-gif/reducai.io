import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const ADMIN_SET = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
)

export const authOptions: NextAuthOptions = {
  providers: [ GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! }) ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.email) (token as any).isAdmin = ADMIN_SET.has(user.email.toLowerCase())
      return token
    },
    async session({ session, token }) {
      // @ts-ignore
      session.user.isAdmin = (token as any).isAdmin === true
      return session
    },
  },
}
export default NextAuth(authOptions)
