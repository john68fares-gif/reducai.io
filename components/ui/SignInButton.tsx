import { signIn } from 'next-auth/react';

export default function SignInButton({
  label = 'Sign in',
}: { label?: string }) {
  return (
    <button
      onClick={() =>
        signIn('google', { callbackUrl: '/builder?step=1&mode=signin' })
      }
      style={{
        display: 'inline-block',
        padding: '12px 16px',
        borderRadius: 12,
        fontWeight: 700,
        border: '2px solid rgba(255,255,255,.15)',
        background: 'rgba(0,0,0,.2)',
        color: '#fff',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
