import Head from 'next/head'
import { signIn, getSession } from 'next-auth/react'
import { LogIn } from 'lucide-react'
import React from 'react'

const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
}

export default function Login() {
  return (
    <>
      <Head><title>Login • ReducAI</title></Head>
      <main className="min-h-screen bg-[#0b0c10] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md p-6" style={FRAME}>
          <h1 className="text-2xl font-semibold">Welcome back</h1>
          <p className="text-white/70 text-sm mt-1">Sign in to continue</p>

          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="mt-6 w-full flex items-center justify-center gap-2 h-11 rounded-xl font-medium border border-white/20 bg-black/30 hover:bg-black/40 transition"
          >
            <LogIn className="w-4 h-4" />
            Continue with Google
          </button>
        </div>
      </main>
    </>
  )
}

export async function getServerSideProps(ctx: any) {
  const session = await getSession(ctx)
  if (session) return { redirect: { destination: '/', permanent: false } }
  return { props: {} }
}
