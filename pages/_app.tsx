// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';

// ❌ was "@/components/ui/Sidebar"
import Sidebar from '../components/ui/Sidebar';
// ❌ was "@/styles/globals.css"
import '../styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      {/* No Tailwind here; use inline styles so it works in your setup */}
      <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
        <Sidebar />
        {/* Sidebar is 260px fixed; actually pad the main content by 260px */}
        <main style={{ paddingLeft: 260, paddingRight: 20, paddingTop: 20, paddingBottom: 20 }}>
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
