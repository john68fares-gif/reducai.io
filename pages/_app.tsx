// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';

import Sidebar from '../components/ui/Sidebar';
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const onLanding = router.pathname === '/';

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
        {!onLanding && <Sidebar />}

        {/* IMPORTANT: use marginLeft (not paddingLeft) so inner containers can stay centered */}
        <main
          style={{
            marginLeft: onLanding ? 0 : 'var(--sidebar-w, 260px)',  // space for the fixed sidebar
            transition: 'margin-left 220ms ease',
            padding: 20,                                            // normal page padding
          }}
        >
          {/* Your pages (which already use `max-w-… mx-auto`) will stay centered */}
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
