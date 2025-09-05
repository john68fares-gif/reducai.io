// pages/account.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

export default function AccountPage() {
  const [email, setEmail] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email || '');
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      setName(data?.full_name || user.user_metadata?.name || '');
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('profiles')
        .upsert({ id: user.id, full_name: name, updated_at: new Date().toISOString() });
      setMessage('Saved!');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 1500);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white">
      <div className="max-w-[880px] mx-auto px-6 pt-10 pb-24">
        <h1 className="text-2xl md:text-3xl font-semibold mb-6">Account Settings</h1>

        {!loaded ? (
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
            <span>Loading profile…</span>
          </div>
        ) : (
          <div
            className="rounded-2xl p-6"
            style={{
              background: 'rgba(15,18,20,0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35), 0 12px 28px rgba(0,0,0,0.35)',
            }}
          >
            <div className="mb-5">
              <label className="block text-sm text-white/70 mb-1">Email</label>
              <input
                value={email}
                readOnly
                className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3 text-[15px] opacity-80"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-white/70 mb-1">Full name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-4 py-3 text-[15px] outline-none focus:border-[#00ffc2]"
              />
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-white font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {message && <span className="ml-3 text-white/70">{message}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
