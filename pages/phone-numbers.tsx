import Head from 'next/head';
import dynamic from 'next/dynamic';

const PhoneNumbersSection = dynamic(
  () => import('../components/phone-numbers/PhoneNumbersSection'),
  { ssr: false }
);

export default function PhoneNumbersPage() {
  return (
    <>
      <Head>
        <title>Phone Numbers • ReducAI</title>
      </Head>
      <div className="w-full h-full">
        <PhoneNumbersSection />
      </div>
    </>
  );
}

