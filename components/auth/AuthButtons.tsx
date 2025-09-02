// components/auth/AuthButtons.tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function AuthButtons({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState<'in' | 'up' | null>(null);

  const doSignIn = async () => {
    try { setBusy('in'); await signIn('google', { callbackUrl: '/builder?mode=signin' }); }
    finally { setBusy(null); }
  };

  const doSignUp = async () => {
    try { setBusy('up'); await signIn('google', { callbackUrl: '/builder?onboard=1&mode=signup' }); }
    finally { setBusy(null); }
  };

  const ghost: React.CSSProperties = {
    display: 'inline-block', padding: '10px 14px', borderRadius: 12, fontWeight: 700,
    border: '2px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.2)', color: '#fff',
    opacity: busy === 'in' ? .6 : 1, cursor: 'pointer'
  };
  const primary: React.CSSProperties = {
    display: 'inline-block', padding: '10px 14px', borderRadius: 12, fontWeight: 800,
    background: '#00ffc2', color: '#001018', boxShadow: '0 0 18px rgba(106,247,209,.35)',
    opacity: busy === 'up' ? .6 : 1, cursor: 'pointer'
  };

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <button onClick={doSignIn} style={ghost} disabled={!!busy}>Sign in</button>
        <button onClick={doSignUp} style={primary} disabled={!!busy}>Sign up</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <button onClick={doSignIn} style={ghost} disabled={!!busy}>Sign in</button>
      <button onClick={doSignUp} style={primary} disabled={!!busy}>Sign up</button>
    </div>
  );
}
