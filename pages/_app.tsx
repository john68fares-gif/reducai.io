// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '../styles/globals.css';               // <- relative (no @)
import Sidebar from '../components/ui/Sidebar'; // <- relative (no @)

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>

      <div className="min-h-screen bg-[#0b0c10] text-white">
        <Sidebar />
        <main className="pl-[260px]">
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
