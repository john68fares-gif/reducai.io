import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import OnboardingOverlay from '../../components/ui/OnboardingOverlay';

export default function BuilderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const userId = (session?.user as any)?.id || '';
  const mode = (router.query.mode as 'signup'|'signin') || 'signup';
  const onboard = router.query.onboard === '1';
  const [open, setOpen] = useState(false);

  // Require auth
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status]);

  // Open overlay only for first-time signup (per-user) or when ?onboard=1
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return;
    const done = localStorage.getItem(`user:${userId}:profile:completed`) === '1';
    if (onboard || (!done && mode === 'signup')) setOpen(true);
  }, [status, userId, onboard, mode]);

  function handleDone() {
    setOpen(false);
    // Clean URL so refresh doesn’t reopen overlay
    const q = { ...router.query }; delete q.onboard; delete q.mode;
    router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
  }

  return (
    <>
      {/* === Your existing Builder UI goes here === */}

      <OnboardingOverlay open={open} mode={mode} userId={userId} onDone={handleDone} />
    </>
  );
}
