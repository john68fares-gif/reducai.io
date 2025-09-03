// pages/auth/callback.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase-client';

function parseHash(hash: string) {
  const out: Record<string, string> = {};
  new URLSearchParams(hash.replace(/^#/, '')).forEach((v, k) => (out[k] = v));
  return out;
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const url = new URL(window.location.href);
      const from = url.searchParams.get('from') || '/builder';
      try {
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
          router.replace(from);
          return;
        }
        const frag = parseHash(url.hash || '');
        if (frag.access_token && frag.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: frag.access_token,
            refresh_token: frag.refresh_token,
          } as any);
          if (error) throw error;
          router.replace(from);
          return;
        }
        router.replace(from);
      } catch {
        router.replace('/builder');
      }
    };
    run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0b0c10', color: 'white' }}>
      <div className="flex items-center gap-3 px-4 py-3 rounded-[12px]" style={{ background: 'rgba(16,19,20,0.92)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-[#00ffc2] animate-spin" />
        <div className="text-white/90 text-sm">Completing sign-in…</div>
      </div>
    </div>
  );
}
