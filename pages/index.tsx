// /pages/index.tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import HeaderAuth from '@/components/HeaderAuth';

const ACCENT = '#00ffc2';

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  async function handleCreateClick() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) router.push('/builder');
    else router.push('/auth?mode=signup&from=/builder');
  }

  return (
    <>
      <Head>
        <title>Reduc.ai — Build AI agents</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen" style={{ background: '#0b0c10', color: '#fff' }}>
        <header className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-white/90 font-bold tracking-tight text-lg">reduc.ai</Link>
          <HeaderAuth from="/builder" />
        </header>

        <main className="max-w-7xl mx-auto px-6 pt-16 pb-24">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Launch sales & support AI agents in minutes.
            </h1>
            <p className="text-white/70 mt-4 text-lg">
              Connect your site, set the rules, ship the agent.
            </p>

            <div className="mt-8 flex gap-3">
              <button
                onClick={handleCreateClick}
                className="px-5 py-3 rounded-xl font-bold"
                style={{ background: ACCENT, color: '#000', boxShadow: '0 0 22px rgba(0,255,194,0.18)' }}
              >
                Create a Build
              </button>

              <Link
                href={session ? '/builder' : '/auth?mode=signin&from=/builder'}
                className="px-5 py-3 rounded-xl border border-white/20 text-white/90 hover:border-white/40 transition"
              >
                {session ? 'Go to Builder' : 'Sign in'}
              </Link>
            </div>

            <p className="text-white/50 text-sm mt-3">You’ll be asked to sign in if you’re not already.</p>
          </div>
        </main>
      </div>
    </>
  );
}
