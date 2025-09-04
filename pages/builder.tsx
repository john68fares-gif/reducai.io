import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase-client';

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
    let unsub: { data?: { subscription?: { unsubscribe?: () => void } } } | null = null;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace(`/auth?mode=signin&from=${encodeURIComponent('/builder')}`);
        setChecking(false);
        return;
      }
      setAuthed(true);
      setChecking(false);

      unsub = supabase.auth.onAuthStateChange((_e, sess) => {
        if (!sess) {
          router.replace(`/auth?mode=signin&from=${encodeURIComponent('/builder')}`);
        } else {
          setAuthed(true);
        }
      });
    })();

    return () => {
      unsub?.data?.subscription?.unsubscribe?.();
    };
  }, [router]);

  if (checking) {
    return (
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
          <span className="inline-block w-6 h-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
          <span>Checking session…</span>
        </div>
      </div>
    );
  }

  if (!authed) return null;

  return (
    <main
      className="min-h-screen"
      style={{ marginLeft: 'var(--sidebar-w, 260px)', padding: '24px' }}
    >
      <BuilderDashboard />
    </main>
  );
}
