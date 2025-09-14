'use client';
import Head from 'next/head';
import VoiceAgentSection from '@/components/voice/VoiceAgentSection';

export default function VoiceAgentPage() {
  return (
    <>
      <Head>
        <title>Voice Agent • reduc.ai</title>
      </Head>
      <VoiceAgentSection />
    </>
  );
}
