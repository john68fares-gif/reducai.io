import Head from 'next/head';
import { signIn, getSession } from 'next-auth/react';
import { motion } from 'framer-motion';

const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,.96)',
  border: '2px dashed rgba(106,247,209,.30)',
  borderRadius: 24,
  boxShadow: '0 0 40px rgba(0,0,0,.6)',
};

export default function Login() {
  return (
    <>
      <Head><title>Login • reduc.ai</title></Head>
      <main className="min-h-screen relative" style={{ background: '#0b0c10', color: '#fff' }}>
        {/* soft glows */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
          <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%',
            background:'radial-gradient(circle, rgba(106,247,209,.2), transparent)', filter:'blur(70px)', top:-120, left:-120 }} />
        </div>

        <div className="flex items-center justify-center min-h-screen p-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}
            className="w-full max-w-md p-6" style={FRAME}
          >
            <div className="text-center">
              <div className="inline-flex items-center gap-2 font-extrabold text-lg">
                <span style={{ width:10, height:10, borderRadius:999, background:'#6af7d1', boxShadow:'0 0 16px #6af7d1' }} />
                reduc.ai
              </div>
              <h1 className="text-2xl font-bold mt-2">Welcome</h1>
              <p className="text-white/70 text-sm">Sign in to continue</p>
            </div>

            <div className="mt-6 grid gap-3">
              <button
                onClick={() => signIn('google', { callbackUrl: '/welcome' })} // ⬅️ go to overlay
                className="w-full h-11 rounded-xl font-semibold border border-white/20 bg-black/30 hover:bg-black/40 transition inline-flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5h-1.6v-.1H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.1-5.1C33.2 6.4 28.8 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.6-4.5z"/></svg>
                Continue with Google
              </button>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps(ctx: any) {
  const session = await getSession(ctx);
  if (session) return { redirect: { destination: '/welcome', permanent: false } };
  return { props: {} };
}
