// pages/voice-agent.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Render the section only on the client (no SSR) to prevent build/runtime mismatches
const VoiceAgentSection = dynamic(
  () => import('@/components/voice/VoiceAgentSection'),
  { ssr: false, loading: () => <div className="p-6 text-sm opacity-70">Loading…</div> }
);

export default function VoiceAgentPage() {
  return (
    <>
      <Head>
        <title>Voice Agent • reduc.ai</title>
      </Head>
      <div className="w-full min-h-screen" style={{ background: 'var(--bg)' }}>
        <VoiceAgentSection />
      </div>
    </>
  );
}
