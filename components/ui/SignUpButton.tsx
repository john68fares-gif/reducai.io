import { signIn } from 'next-auth/react';

export default function SignUpButton({
  label = 'Sign up with Google',
}: { label?: string }) {
  return (
    <button
      onClick={() =>
        signIn('google', { callbackUrl: '/builder?step=1&onboard=1&mode=signup' })
      }
      style={{
        display: 'inline-block',
        padding: '12px 16px',
        borderRadius: 12,
        fontWeight: 900,
        background: '#00ffc2',
        color: '#001018',
        boxShadow: '0 0 26px rgba(106,247,209,.45)',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
