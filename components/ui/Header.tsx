// components/builder/Header.tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

/** Taller rail */
const RAIL_H = 84;

const TITLE_MAP: Array<{
  test: (p: string) => boolean;
  title: string;
  subtitle: string;
}> = [
  { test: (p) => p === '/' || p.startsWith('/builder'), title: 'Builder Dashboard', subtitle: 'Create, configure, and manage your AIs' },
  { test: (p) => p.startsWith('/improve'),             title: 'Tuning',            subtitle: 'Test prompts, iterate, and refine behavior' },
  { test: (p) => p.startsWith('/voice-agent'),         title: 'Voice Studio',      subtitle: 'Build and preview voice experiences' },
  { test: (p) => p.startsWith('/launch'),              title: 'Launchpad',         subtitle: 'Embed, deploy, and connect channels' },
  { test: (p) => p.startsWith('/phone-numbers'),       title: 'Phone Numbers',     subtitle: 'Provision numbers and configure routing' },
  { test: (p) => p.startsWith('/apikeys'),             title: 'API Keys',          subtitle: 'Manage and secure provider credentials' },
  { test: (p) => p.startsWith('/support'),             title: 'Help',              subtitle: 'Docs, tips, and troubleshooting' },
];

export default function Header() {
  const pathname = usePathname() || '/';

  const { title, subtitle } = useMemo(() => {
    const found = TITLE_MAP.find((x) => x.test(pathname));
    return {
      title: found?.title ?? 'Dashboard',
      subtitle: found?.subtitle ?? 'Overview and quick actions',
    };
  }, [pathname]);

  // expose height var so pages can offset below the fixed header
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--rail-h', `${RAIL_H}px`);
  }

  return (
    <>
      {/* FIXED HEADER */}
      <div
        className="z-[50] font-movatif"
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--sidebar-w, 260px)',
          width: 'calc(100% - var(--sidebar-w, 260px))',
          height: RAIL_H,
          background: 'var(--card)',          // same surface as other cards
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',    // same shadow as cards
        }}
      >
        {/* subtle brand glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[36%] -left-[26%] w-[60%] h-[120%] rounded-full"
          style={{
            background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* content */}
        <div className="relative h-full flex items-center px-6">
          <div className="min-w-0">
            {/* thinner font (medium), tighter line-height, truncate to prevent widening */}
            <div
              className="text-[26px] leading-tight font-medium tracking-tight truncate"
              style={{ color: 'var(--text)' }}
              title={title}
            >
              {title}
            </div>

            {/* extra line to make the header taller without increasing width */}
            <div
              className="mt-1 text-sm leading-6 whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: 'var(--text-muted)', maxWidth: 'min(820px, 100%)' }}
              title={subtitle}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </div>

      {/* spacer so page content sits below header */}
      <div style={{ height: RAIL_H }} />
    </>
  );
}
