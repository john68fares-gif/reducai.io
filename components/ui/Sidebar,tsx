// components/ui/Sidebar.tsx
import Link from 'next/link';
import { useRouter } from 'next/router';

const nav = [
  { href: '/',            label: 'Home' },
  { href: '/builder',     label: 'Builder' },
  { href: '/voice-agent', label: 'Voice Agent' },
  { href: '/webhook-xml', label: 'Webhook XML' },
];

export default function Sidebar() {
  const { pathname } = useRouter();

  return (
    <aside
      style={{
        position: 'fixed',
        insetInlineStart: 0,
        top: 0,
        bottom: 0,
        width: 260,
        padding: '16px 14px',
        borderRight: '1px solid #223',
        background: '#0b0c10',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 12, opacity: 0.9 }}>reduc.ai</div>
      <nav style={{ display: 'grid', gap: 8 }}>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: 10,
                textDecoration: 'none',
                color: '#e9f5f0',
                background: active ? 'rgba(0,255,194,0.12)' : 'transparent',
                border: active
                  ? '1px solid rgba(106,247,209,0.35)'
                  : '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
