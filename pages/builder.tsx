import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase-client';
import ContentWrapper from '@/components/layout/ContentWrapper';

const BuilderDashboard = dynamic(
  async () => {
    const mod = await import('@/components/builder/BuilderDashboard');
    return mod.default || mod;
  },
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          minHeight: '100vh',
          padding: 32,
          color: 'white',
          background: '#0b0c10',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="inline-block w-5 h-5 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          <span>Loading Builder…</span>
        </div>
      </div>
    ),
  }
);

export default function BuilderPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`/auth?mode=signin&from=${encodeURIComponent('/builder')}`);
        setChecking(false);
        return;
      }
      setAuthed(true);
      setChecking(false);
    })();
  }, [router]);

  if (checking) return <div>Checking session…</div>;
  if (!authed) return null;

  return (
    <ContentWrapper>
      <BuilderDashboard />
    </ContentWrapper>
  );
}
