// pages/phone-numbers.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Load the client component only on the client
const PhoneNumbersSection = dynamic(
  () => import('../components/phone-numbers/PhoneNumbersSection'),
  { ssr: false }
);

export default function PhoneNumbersPage() {
  return (
    <>
      <Head>
        <title>Phone Numbers • ReducAI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <PhoneNumbersSection />
        </div>
      </main>
    </>
  );
}
