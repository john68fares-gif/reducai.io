import type { NextApiRequest, NextApiResponse } from 'next'
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, account, user }) {
      if (account) token.provider = account.provider
      if (user) {
        token.name = user.name ?? token.name
        token.email = user.email ?? token.email
        // @ts-ignore
        token.picture = (user as any).image ?? (token as any).picture
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.name = token.name as string | null
        session.user.email = token.email as string | null
        // @ts-ignore
        session.user.image = (token as any).picture as string | null
        // @ts-ignore
        session.user.provider = token.provider as string | undefined
      }
      return session
    },
  },
}

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions)
}
