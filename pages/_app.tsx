// pages/_app.tsx
import type { AppProps } from 'next/app';
import Head from 'next/head';
import '@/styles/globals.css'; // keep this path if your CSS is at /styles/globals.css

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>reduc.ai</title>
      </Head>

      {/* Render the page */}
      <Component {...pageProps} />
    </>
  );
}
