import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '../components/ui/Sidebar';
import '../styles/globals.css';

// Routes where sidebar should be hidden
const HIDE_SIDEBAR_ROUTES = new Set(['/', '/login']);

export default function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter();
  const hideSidebar = HIDE_SIDEBAR_ROUTES.has(router.pathname);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>
      <SessionProvider session={session}>
        <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
          {!hideSidebar && <Sidebar />}
          <main style={{ 
            marginLeft: hideSidebar ? 0 : 'var(--sidebar-w, 260px)', 
            transition: 'margin-left 220ms ease', 
            padding: 20 
          }}>
            <Component {...pageProps} />
          </main>
        </div>
      </SessionProvider>
    </>
  );
}
