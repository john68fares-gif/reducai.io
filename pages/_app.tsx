import type { AppProps } from 'next/app';
import Head from 'next/head';
import Sidebar from '@/components/ui/Sidebar';
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reduc AI</title>
      </Head>
      <div className="app">
        <Sidebar />
        <main className="main">
          <Component {...pageProps} />
        </main>
      </div>
    </>
  );
}
