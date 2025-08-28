// pages/phone-numbers.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';
import React from 'react';

// Lazy-load the heavy UI (no SSR to avoid window/localStorage issues)
const PhoneNumbersSection = dynamic(
  () => import('../components/phone-numbers/PhoneNumbersSection'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#0b0c10] text-white flex items-center justify-center">
        <div className="text-white/70 text-sm tracking-wide">
          Loading Phone Numbers…
        </div>
      </div>
    ),
  }
);

export default function PhoneNumbersPage() {
  return (
    <>
      <Head>
        <title>Phone Numbers • Reduc AI</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen bg-[#0b0c10] text-white">
        {/* optional: a consistent page container */}
        <div className="mx-auto w-full max-w-7xl px-6 md:px-8 py-10">
          <PhoneNumbersSection />
        </div>
      </main>
    </>
  );
}
