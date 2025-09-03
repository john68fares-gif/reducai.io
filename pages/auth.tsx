// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

export default function AuthPage() {
  const router = useRouter();
  const { mode: qMode, from: qFrom } = router.query as { mode?: string; from?: string };

  // default: we’re on “signup” and will return to /builder
  const mode = useMemo<'signin' | 'signup'>(() => (qMode === 'signin' ? 'signin' : 'signup'), [qMode]);
  const returnTo = useMemo(() => (qFrom && qFrom.startsWith('/') ? qFrom : '/builder'), [qFrom]);

  const [tab, setTab] = useState<'signin' | 'signup'>(mode);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, skip this page
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        router.replace('/builder');
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  // When auth state changes (after OAuth), route correctly
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // new vs returning
        const isSignup = tab === 'signup';
        const url =
          isSignup
            ? `${returnTo}?onboard=1&mode=signup`
            : `${returnTo}?mode=signin`;
        router.replace(url);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, tab, returnTo]);

  const continueWithGoogle = async () => {
    try {
      setError(null);
      setWorking(true);

      // Where we want to land after Supabase returns control
      const callback =
        typeof window !== 'undefined'
          ? `${window.location.origin}${returnTo}${
              tab === 'signup' ? '?onboard=1&mode=signup' : '?mode=signin'
            }`
          : returnTo;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callback,
          queryParams: {
            // optional but helps keep Google screen light
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      // Supabase will redirect; no further code runs here.
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? 'Auth failed');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 40px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: 420,
          maxWidth: '92vw',
          borderRadius: 16,
          border: '1px solid rgba(106,247,209,0.25)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
          background: 'rgba(13,15,17,0.9)',
          padding: 16,
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setTab('signin')}
            aria-pressed={tab === 'signin'}
            style={{
              height: 40,
              borderRadius: 10,
              border: '1px solid rgba(106,247,209,0.25)',
              background: tab === 'signin' ? '#00ffc2' : 'transparent',
              color: tab === 'signin' ? '#0b0c10' : '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            aria-pressed={tab === 'signup'}
            style={{
              height: 40,
              borderRadius: 10,
              border: '1px solid rgba(106,247,209,0.25)',
              background: tab === 'signup' ? '#00ffc2' : 'transparent',
              color: tab === 'signup' ? '#0b0c10' : '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Sign up
          </button>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={continueWithGoogle}
          disabled={working}
          style={{
            width: '100%',
            height: 44,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.18)',
            background: '#111417',
            color: '#fff',
            fontWeight: 700,
            cursor: working ? 'not-allowed' : 'pointer',
          }}
        >
          Continue with Google
        </button>

        <div style={{ textAlign: 'center', fontSize: 12, color: '#93a2a8', marginTop: 8 }}>
          {tab === 'signup'
            ? 'You must sign up to continue.'
            : 'Sign in to continue.'}
        </div>

        {error && (
          <div style={{ color: '#ff8080', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
