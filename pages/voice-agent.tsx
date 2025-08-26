// pages/voice-agent.tsx
import dynamic from 'next/dynamic';

const VoiceAgentSection = dynamic(
  () => import('@/components/voice/VoiceAgentSection'),
  { ssr: false }
);

export default function VoiceAgentPage() {
  return (
    <div style={{ padding: 20 }}>
      <VoiceAgentSection />
    </div>
  );
}
