import Head from 'next/head';
import dynamic from 'next/dynamic';
import ContentWrapper from '@/components/layout/ContentWrapper';

const PhoneNumbersSection = dynamic(
  () => import('../components/phone-numbers/PhoneNumbersSection'),
  { ssr: false }
);

export default function PhoneNumbersPage() {
  return (
    <>
      <Head><title>Phone Numbers • ReducAI</title></Head>
      <ContentWrapper>
        <PhoneNumbersSection />
      </ContentWrapper>
    </>
  );
}
