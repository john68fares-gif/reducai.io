// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '../components/ui/Sidebar';
import '../styles/globals.css';

const HIDE_SIDEBAR = new Set(['/', '/login', '/welcome']);

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const { pathname } = useRouter();
  const hide = HIDE_SIDEBAR.has(pathname);

  return (
    <>
      <Head><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Reduc AI</title></Head>
      <SessionProvider session={session}>
        <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#fff' }}>
          {!hide && <Sidebar />}
          <main style={{ marginLeft: hide ? 0 : 'var(--sidebar-w, 260px)', transition: 'margin-left 220ms ease', padding: 20 }}>
            <Component {...pageProps} />
          </main>
        </div>
      </SessionProvider>
    </>
  );
}
