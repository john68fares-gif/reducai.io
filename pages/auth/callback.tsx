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
        // Case 1: OAuth code-style (?code=...)
        const code = url.searchParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
          router.replace(from);
          return;
        }

        // Case 2: Fragment tokens (#access_token=...&refresh_token=...)
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

        // Fallback: nothing to exchange, just go "from".
        router.replace(from);
      } catch (e) {
        // If anything goes wrong, send to builder; you can log or show a message if you want
        router.replace('/builder');
      }
    };
    run();
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: '#0b0c10', color: 'white' }}
    >
      <div className="text-white/80">Completing sign-in…</div>
    </div>
  );
}
