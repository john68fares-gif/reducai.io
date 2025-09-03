// /components/HeaderAuth.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

const ACCENT = '#00ffc2';

export default function HeaderAuth({ from = '/builder' }: { from?: string }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }> | null>(null);

  const accountName = useMemo(() => accounts?.[0]?.name || 'Workspace', [accounts]);

  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      // Light fetch to hydrate
      try {
        const r = await fetch('/api/me');
        const j = await r.json();
        if (j.ok) {
          setSession(j.session);
          setProfile(j.profile);
          setAccounts(j.accounts);
        }
      } catch {}

      unsub = supabase.auth.onAuthStateChange((_e, sess) => {
        setSession(sess);
        // refetch info when state changes
        fetch('/api/me').then(r => r.json()).then(j => {
          if (j.ok) {
            setProfile(j.profile);
            setAccounts(j.accounts);
          }
        });
      });
      setReady(true);
    })();

    return () => {
      if (unsub?.data?.subscription?.unsubscribe) {
        unsub.data.subscription.unsubscribe();
      }
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center gap-3">
        <span className="inline-block w-4 h-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/auth?mode=signin&from=${encodeURIComponent(from)}`}
          className="px-3 py-2 rounded-[10px] border border-white/20 text-white/90 hover:border-white/40 transition"
        >
          Sign in
        </Link>
        <Link
          href={`/auth?mode=signup&from=${encodeURIComponent(from)}`}
          className="px-3 py-2 rounded-[10px] font-bold"
          style={{ background: ACCENT, color: '#000' }}
        >
          Create account
        </Link>
      </div>
    );
  }

  const avatar = profile?.avatar_url as string | undefined;
  const name = profile?.full_name || profile?.username || 'You';

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <div className="text-white/90 text-sm font-semibold">{name}</div>
        <div className="text-white/50 text-xs">{accountName}</div>
      </div>
      <div className="w-8 h-8 rounded-full overflow-hidden border border-white/20 bg-white/10">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-white/70">👤</div>
        )}
      </div>
    </div>
  );
}
