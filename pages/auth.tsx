// pages/auth.tsx
import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const router = useRouter();
  const initialMode = (router.query.mode === 'signin' ? 'signin' : 'signup') as Mode;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [loading, setLoading] = useState(false);
  const from = typeof router.query.from === 'string' ? router.query.from : '/builder';

  useEffect(() => {
    if (router.query.mode === 'signin' || router.query.mode === 'signup') {
      setMode(router.query.mode as Mode);
    }
  }, [router.query.mode]);

  const redirectTo = useMemo(() => {
    // After Google auth completes, Supabase will redirect back here:
    // We’ll land the user in /builder; on signup show the welcome overlay once.
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    params.set('mode', mode);
    if (mode === 'signup') params.set('onboard', '1');
    const sep = from.includes('?') ? '&' : '?';
    return `${base}${from}${sep}${params.toString()}`;
  }, [mode, from]);

  const continueWithGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          scopes: 'email profile openid',
          queryParams: {
            // makes the account chooser appear; works for both modes
            prompt: 'select_account',
          },
        },
      });
      if (error) {
        console.error('Supabase OAuth error:', error.message);
        alert(`Auth error: ${error.message}`);
        setLoading(false);
      }
      // On success, browser leaves this page to Google → Supabase → redirectTo
    } catch (e: any) {
      console.error(e);
      alert('Could not start Google sign-in.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>{mode === 'signin' ? 'Sign in' : 'Sign up'} – Reduc AI</title>
      </Head>

      <div
        style={{
          minHeight: 'calc(100vh - 40px)',
          display: 'grid',
          placeItems: 'center',
          background: '#0b0c10',
        }}
      >
        <div
          style={{
            width: 420,
            maxWidth: '90vw',
            borderRadius: 16,
            padding: 16,
            background: 'rgba(13,15,17,0.8)',
            boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06)',
          }}
        >
          {/* Tabs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              padding: 8,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              marginBottom: 12,
            }}
          >
            <button
              onClick={() => setMode('signin')}
              disabled={loading}
              style={{
                height: 40,
                borderRadius: 10,
                border: '1px solid rgba(106,247,209,0.35)',
                background: mode === 'signin' ? '#00ffc2' : 'transparent',
                color: mode === 'signin' ? '#000' : '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign in
            </button>
            <button
              onClick={() => setMode('signup')}
              disabled={loading}
              style={{
                height: 40,
                borderRadius: 10,
                border: '1px solid rgba(106,247,209,0.35)',
                background: mode === 'signup' ? '#00ffc2' : 'transparent',
                color: mode === 'signup' ? '#000' : '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Sign up
            </button>
          </div>

          {/* Google button */}
          <button
            onClick={continueWithGoogle}
            disabled={loading}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 10,
              border: '1px solid rgba(106,247,209,0.35)',
              background: '#101314',
              color: '#fff',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Opening Google…' : 'Continue with Google'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 10, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            {mode === 'signup' ? 'You must sign up to continue.' : 'You must sign in to continue.'}
          </div>
        </div>
      </div>
    </>
  );
}
