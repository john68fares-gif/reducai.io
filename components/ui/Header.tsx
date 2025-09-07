// components/builder/HeaderRail.tsx
'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

/** Taller header */
const RAIL_H = 88;

type TitleEntry = {
  test: (p: string) => boolean;
  title: string;
  subtitle: string;
};

const TITLE_MAP: TitleEntry[] = [
  { test: (p) => p === '/' || p.startsWith('/builder'), title: 'Builder Dashboard', subtitle: 'Create, configure, and manage your AIs' },
  { test: (p) => p.startsWith('/improve'),             title: 'Tuning',            subtitle: 'Experiment with prompts and iterate safely' },
  { test: (p) => p.startsWith('/voice-agent'),         title: 'Voice Studio',      subtitle: 'Design and preview voice experiences' },
  { test: (p) => p.startsWith('/launch'),              title: 'Launchpad',         subtitle: 'Deploy, embed, and connect channels' },
  { test: (p) => p.startsWith('/phone-numbers'),       title: 'Phone Numbers',     subtitle: 'Provision numbers and configure routing' },
  { test: (p) => p.startsWith('/apikeys'),             title: 'API Keys',          subtitle: 'Manage provider credentials securely' },
  { test: (p) => p.startsWith('/support'),             title: 'Help',              subtitle: 'Docs, tips, and troubleshooting' },
];

export default function HeaderRail() {
  const pathname = usePathname() || '/';

  const { title, subtitle } = useMemo(() => {
    const found = TITLE_MAP.find((x) => x.test(pathname));
    return {
      title: found?.title ?? 'Dashboard',
      subtitle: found?.subtitle ?? 'Overview and quick actions',
    };
  }, [pathname]);

  // expose height to layouts so content offsets under fixed header
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--rail-h', `${RAIL_H}px`);
  }

  return (
    <>
      {/* FIXED HEADER (same surface/border/shadow as your cards) */}
      <div
        className="z-[50] font-movatif"
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--sidebar-w, 260px)',
          width: 'calc(100% - var(--sidebar-w, 260px))',
          height: RAIL_H,
          background: 'var(--card)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {/* subtle brand glow like other sections */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[36%] -left-[22%] w-[60%] h-[120%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* CONTENT (thinner fonts, taller stack, no extra width) */}
        <div className="relative h-full flex items-center px-6">
          <div className="min-w-0">
            {/* thinner title: font-medium, tight leading; truncate so it won’t widen */}
            <div
              className="text-[24px] leading-tight font-medium tracking-tight truncate"
              style={{ color: 'var(--text)', maxWidth: 'min(860px, 100%)' }}
              title={title}
            >
              {title}
            </div>

            {/* subtitle adds vertical length; muted; single-line ellipsis */}
            <div
              className="mt-1 text-sm leading-6 whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ color: 'var(--text-muted)', maxWidth: 'min(860px, 100%)' }}
              title={subtitle}
            >
              {subtitle}
            </div>
          </div>
        </div>
      </div>

      {/* spacer so page content sits below the fixed header */}
      <div style={{ height: RAIL_H }} />
    </>
  );
}
