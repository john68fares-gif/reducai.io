import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';

const CARD: React.CSSProperties = {
  background: 'rgba(13,15,17,.96)',
  border: '1px solid rgba(106,247,209,.28)',
  borderRadius: 20,
  boxShadow: '0 0 28px rgba(106,247,209,.10), inset 0 0 22px rgba(0,0,0,.28)',
};

const OPTIONS = [
  'YouTube', 'TikTok', 'Instagram', 'Twitter/X', 'Reddit', 'Google Search',
  'Friend/Referral', 'BuildMyAgent community', 'Other'
];

export default function Welcome() {
  const { data: session, status } = useSession();
  const [fullName, setFullName] = useState('');
  const [heardFrom, setHeardFrom] = useState(OPTIONS[0]);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch('/api/track/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, heardFrom }),
      });
      // Optionally store locally for later use
      try {
        const u = session?.user || {};
        localStorage.setItem('profile:completed', '1');
        localStorage.setItem('profile:data', JSON.stringify({ id: (u as any).id, fullName, email: u?.email, heardFrom }));
      } catch {}
      router.replace('/builder?step=1'); // go inside app
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen relative" style={{ background:'#0b0c10', color:'#fff' }}>
      {/* glow */}
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        <div style={{ position:'absolute', width:560, height:560, borderRadius:'50%',
          background:'radial-gradient(circle, rgba(106,247,209,.24), transparent)', filter:'blur(70px)', top:-140, left:-140 }} />
      </div>

      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .35 }}
          className="w-full max-w-lg p-6" style={CARD}
        >
          <h1 className="text-2xl font-bold">Finish signup</h1>
          <p className="text-white/70 text-sm mt-1">Just two quick details.</p>

          <form onSubmit={onSubmit} className="mt-6 grid gap-3">
            <label className="text-xs text-white/70">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Your name"
              className="h-11 rounded-xl bg-black/30 border border-white/20 px-3 outline-none focus:border-[#6af7d1]"
            />

            <label className="text-xs text-white/70 mt-2">How did you hear about us?</label>
            <select
              value={heardFrom}
              onChange={(e) => setHeardFrom(e.target.value)}
              className="h-11 rounded-xl bg-black/30 border border-white/20 px-3 outline-none focus:border-[#6af7d1]"
            >
              {OPTIONS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>

            <div className="mt-4 flex gap-10">
              <button
                type="submit"
                disabled={sending}
                className="h-11 px-5 rounded-xl font-semibold"
                style={{ background:'#00ffc2', color:'#001018' }}
              >
                {sending ? 'Saving…' : 'Continue'}
              </button>

              <button type="button" onClick={() => signOut({ callbackUrl: '/login' })}
                className="h-11 px-4 rounded-xl border border-white/20 bg-black/20">
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
