// FILE: pages/subaccounts.tsx
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Render the section only on the client (no SSR) to prevent build/runtime mismatches
const SubaccountTranscripts = dynamic(
  () => import('@/components/voice/SubaccountTranscripts'),
  { ssr: false, loading: () => <div className="p-6 text-sm opacity-70">Loading…</div> }
);

export default function SubaccountsPage() {
  return (
    <>
      <Head>
        <title>Subaccounts • Transcripts</title>
      </Head>
      <div className="w-full min-h-screen" style={{ background: 'var(--bg)' }}>
        <SubaccountTranscripts />
      </div>
    </>
  );
}
