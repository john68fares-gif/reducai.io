// pages/api/auth/[...nextauth].ts
import type { NextApiRequest, NextApiResponse } from 'next'
import NextAuth, { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import crypto from 'crypto' // Node stdlib

function hashEmail(email?: string | null) {
  if (!email) return '';
  return crypto.createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 24);
}

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
      // first time
      if (user?.email && !token.sub) {
        token.sub = hashEmail(user.email); // stable id in token.sub
      }
      if (account) token.provider = account.provider;
      // copy basic profile once (kept minimal)
      if (user) {
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        // @ts-ignore
        token.picture = (user as any).image ?? (token as any).picture;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        // expose id to client
        // @ts-ignore
        session.user.id = (token.sub as string) || '';
        session.user.name = (token.name as string) ?? null;
        session.user.email = (token.email as string) ?? null;
        // @ts-ignore
        session.user.image = (token as any).picture as string | null;
        // @ts-ignore
        session.user.provider = token.provider as string | undefined;
      }
      return session;
    },
  },
}

export default function auth(req: NextApiRequest, res: NextApiResponse) {
  return NextAuth(req, res, authOptions)
}
