import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import OnboardingOverlay from '../../components/ui/OnboardingOverlay';
import { readText, readJSON, writeJSON } from '../../lib/userStorage';

type Bot = { id: string; name: string; /* ...your fields... */ };

export default function BuilderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const userId = useMemo(() => (session?.user as any)?.id || '', [session]);
  const mode = (router.query.mode as 'signup'|'signin') || 'signup';
  const onboard = router.query.onboard === '1';

  const [open, setOpen] = useState(false);
  const [bots, setBots] = useState<Bot[]>([]);

  // Require auth (client guard; middleware should also protect)
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);

  // Load this user's bots once authenticated
  useEffect(() => {
    if (!userId) return;
    const stored = readJSON<Bot[]>(userId, 'bots', []);
    setBots(stored);
  }, [userId]);

  // Decide whether to show overlay (per-user)
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    const completed = readText(userId, 'profile:completed') === '1';
    if (onboard || (!completed && mode === 'signup')) setOpen(true);
  }, [status, userId, onboard, mode]);

  function handleDone() {
    setOpen(false);
    const q = { ...router.query }; delete q.onboard; delete q.mode;
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
  }

  // Save bots for THIS user (namespaced)
  function saveBots(next: Bot[]) {
    if (!userId) return;
    setBots(next);
    writeJSON(userId, 'bots', next);
    // OPTIONAL: also send to server so Admin can see
    // fetch('/api/bots/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ bots: next })});
  }

  return (
    <>
      {/* ===== Your existing Builder UI ===== */}
      <div style={{ color:'#fff' }}>
        <h1 className="text-2xl font-bold">Builder</h1>
        <p className="text-white/70 text-sm">Start building your agent.</p>

        {/* Example: create a bot */}
        <button
          onClick={() => saveBots([...bots, { id: crypto.randomUUID(), name: `Bot #${bots.length+1}` }])}
          className="mt-4 h-10 px-4 rounded-lg"
          style={{ background:'#00ffc2', color:'#001018' }}
        >
          + New bot
        </button>

        <ul className="mt-4 text-sm text-white/80">
          {bots.map(b => <li key={b.id}>• {b.name}</li>)}
        </ul>
      </div>

      {/* Welcome overlay floats above Builder */}
      <OnboardingOverlay open={open} mode={mode} userId={userId} onDone={handleDone} />
    </>
  );
}
