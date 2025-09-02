// components/SignInButton.tsx
import Link from 'next/link';

export default function SignInButton({
  label = 'Sign in',
  href = '/login',
}: { label?: string; href?: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: 12,
        textDecoration: 'none',
        fontWeight: 700,
        border: '2px solid rgba(255,255,255,.15)',
        background: 'rgba(0,0,0,.25)',
        color: '#fff',
      }}
    >
      {label}
    </Link>
  );
}
