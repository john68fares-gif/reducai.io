// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';

// keep relative imports to avoid alias issues
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

      {/* Use the CSS var --sidebar-w so padding follows collapsed/expanded state */}
      <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
        {!onLanding && <Sidebar />}
        <main
          // when on landing, no sidebar padding; otherwise follow --sidebar-w
          style={{
            paddingLeft: onLanding ? 0 : 'var(--sidebar-w, 260px)',
            paddingRight: 20,
            paddingTop: 20,
            paddingBottom: 20,
            transition: 'padding-left 220ms ease',
          }}
        >
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
