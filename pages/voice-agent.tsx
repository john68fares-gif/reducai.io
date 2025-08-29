// pages/voice-agent.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Load the client component only on the client (avoids SSR hiccups)
const VoiceAgentSection = dynamic(
  () => import('../components/voice/VoiceAgentSection'),
  { ssr: false }
);

export default function VoiceAgentPage() {
  return (
    <>
      <Head>
        <title>Voice Agent • ReducAI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <VoiceAgentSection />
        </div>
      </main>
    </>
  );
}
