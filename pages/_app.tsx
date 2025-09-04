// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '../components/ui/Sidebar';
import AuthGate from '../components/auth/AuthGate';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const hideSidebar = router.pathname === '/' || router.pathname.startsWith('/auth');

  return (
    <SessionProvider session={session}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
        {!hideSidebar && <Sidebar />}
        <main
          style={{
            marginLeft: hideSidebar ? 0 : 'var(--sidebar-w, 260px)',
            transition: 'margin-left 220ms ease',
            padding: 20,
          }}
        >
          <AuthGate>
            <Component {...pageProps} />
          </AuthGate>
        </main>
      </div>
    </SessionProvider>
  );
}
