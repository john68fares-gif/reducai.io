// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider, useSession } from 'next-auth/react'; // ⬅️ new
import Sidebar from '../components/ui/Sidebar';
import '../styles/globals.css';
import { useEffect } from 'react';

// --- tiny helper to namespace localStorage by userId/email ---
function ensureUserBucket(session: any) {
  const email = session?.user?.email || '';
  const name = session?.user?.name || '';
  const picture = session?.user?.image || '';
  const userId = session?.user?.id || email || ''; // we’ll inject id in auth callback
  if (!userId) return;

  // a stable key for the user profile + their stuff
  const PROFILE_KEY = `user:${userId}:profile`;
  const BO TS_KEY    = `user:${userId}:bots`; // your builder can store bots here

  try {
    const existing = localStorage.getItem(PROFILE_KEY);
    if (!existing) {
      localStorage.setItem(
        PROFILE_KEY,
        JSON.stringify({ id: userId, email, name, picture, createdAt: Date.now() })
      );
    }
    // Initialize empty bots list if none yet (your existing builder can read/write this)
    if (!localStorage.getItem(BOTS_KEY)) {
      localStorage.setItem(BOTS_KEY, JSON.stringify([]));
    }

    // OPTIONAL: migrate any old global bots (if you previously used a single key)
    const OLD = localStorage.getItem('builder:chatbots');
    if (OLD && !localStorage.getItem(BOTS_KEY)) {
      localStorage.setItem(BOTS_KEY, OLD);
      // localStorage.removeItem('builder:chatbots'); // uncomment if you want to move, not copy
    }
  } catch {}
}

// Global watcher: when session becomes available, ensure user bucket exists
function UserBootstrapper() {
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.user) ensureUserBucket(session);
  }, [session?.user]);
  return null;
}

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const onLanding = router.pathname === '/';

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      <SessionProvider session={session}>
        <UserBootstrapper />
        <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
          {!onLanding && <Sidebar />}
          <main
            style={{
              marginLeft: onLanding ? 0 : 'var(--sidebar-w, 260px)',
              transition: 'margin-left 220ms ease',
              padding: 20,
            }}
          >
            <Component {...pageProps} />
          </main>
        </div>
      </SessionProvider>
    </>
  );
}
