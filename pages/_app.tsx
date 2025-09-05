// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';   // 👈 add
import Sidebar from '../components/ui/Sidebar';
import '../styles/globals.css';

export default function MyApp({
  Component,
  pageProps: { session, ...pageProps },            // 👈 pass session through
}: AppProps) {
  const router = useRouter();
  const onLanding = router.pathname === '/';

  return (
    <SessionProvider session={session}>             {/* 👈 wrap the app */}
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

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
  );
}
