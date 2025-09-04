'use client';
import Head from 'next/head';
import VoiceAgentSection from '@/components/voice/VoiceAgentSection';
import ContentWrapper from '@/components/layout/ContentWrapper';

export default function VoiceAgentPage() {
  return (
    <>
      <Head><title>Voice Agent • reduc.ai</title></Head>
      <ContentWrapper>
        <VoiceAgentSection />
      </ContentWrapper>
    </>
  );
}
