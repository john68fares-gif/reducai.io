// components/builder/HeaderRail.tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

const RAIL_H = 56;

const TITLE_MAP: Array<{ test: (p: string) => boolean; title: string }> = [
  { test: (p) => p === '/' || p.startsWith('/builder'), title: 'Builder Dashboard' },
  { test: (p) => p.startsWith('/improve'),             title: 'Tuning' },
  { test: (p) => p.startsWith('/voice-agent'),         title: 'Voice Studio' },
  { test: (p) => p.startsWith('/launch'),              title: 'Launchpad' },
  { test: (p) => p.startsWith('/phone-numbers'),       title: 'Phone Numbers' },
  { test: (p) => p.startsWith('/apikeys'),             title: 'API Keys' },
  { test: (p) => p.startsWith('/support'),             title: 'Help' },
];

export default function HeaderRail() {
  const pathname = usePathname() || '/';

  const title = useMemo(() => {
    const found = TITLE_MAP.find((x) => x.test(pathname));
    return found?.title ?? 'Dashboard';
  }, [pathname]);

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--rail-h', `${RAIL_H}px`);
  }

  return (
    <>
      {/* FULL-WIDTH RAIL */}
      <div
        className="z-[50] flex items-center px-6 font-movatif"
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--sidebar-w, 260px)',   // start at sidebar edge
          width: 'calc(100% - var(--sidebar-w, 260px))',
          height: RAIL_H,
          background: 'var(--panel)',
          borderBottom: '1px solid var(--border)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
        }}
      >
        <span
          className="text-lg font-semibold tracking-wide"
          style={{ color: 'var(--text)' }}
        >
          {title}
        </span>
      </div>

      {/* SPACER so content sits below the fixed rail */}
      <div style={{ height: RAIL_H }} />
    </>
  );
}
