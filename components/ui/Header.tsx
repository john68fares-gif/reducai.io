// components/builder/HeaderRail.tsx
'use client';

import { useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Fixed top header that spans from the sidebar to the right edge.
 * - Always sits at the VERY TOP of the page (position: fixed; top: 0).
 * - Pulls a friendly title from the current route (matches your sidebar names).
 * - Works in light + dark via your CSS variables.
 * - Includes its own spacer so content never hides under it.
 *
 * Drop it as the FIRST element inside each page (you already do in BuilderDashboard).
 */

const RAIL_H = 64; // px

const TITLE_MAP: Array<{ test: (p: string) => boolean; title: string }> = [
  { test: (p) => p === '/' || p.startsWith('/builder'), title: 'Builder Dashboard' },
  { test: (p) => p.startsWith('/improve'),             title: 'Tuning' },
  { test: (p) => p.startsWith('/voice-agent'),         title: 'Voice Studio' },
  { test: (p) => p.startsWith('/launch'),              title: 'Launchpad' },
  { test: (p) => p.startsWith('/phone-numbers'),       title: 'Numbers' },
  { test: (p) => p.startsWith('/apikeys'),             title: 'API Keys' },
  { test: (p) => p.startsWith('/support'),             title: 'Help' },
];

export default function HeaderRail() {
  const pathname = usePathname() || '/';
  const step = useSearchParams()?.get('step');

  const title = useMemo(() => {
    const found = TITLE_MAP.find((x) => x.test(pathname));
    // If you're inside the builder wizard steps, keep the same "Builder Dashboard" title
    // (you asked the step name to live inside StepProgress, not up here).
    return found?.title ?? 'Dashboard';
  }, [pathname]);

  // Expose height var so the rest of the app can read it if needed
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--rail-h', `${RAIL_H}px`);
  }

  return (
    <>
      {/* FIXED RAIL AT VERY TOP */}
      <div
        className="z-[60] backdrop-blur-[2px]"
        style={{
          position: 'fixed',
          top: 0,
          left: 'var(--sidebar-w, 260px)',
          width: 'calc(100vw - var(--sidebar-w, 260px))',
          height: RAIL_H,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          // light/dark surfaces – same vibe as API Keys / Numbers
          background:
            'linear-gradient(180deg, color-mix(in oklab, var(--panel) 94%, transparent) 0%, var(--panel) 100%)',
          borderBottom: '1px solid var(--border)',
          boxShadow:
            '0 10px 30px rgba(0,0,0,.25), 0 0 0 1px color-mix(in oklab, var(--border) 60%, transparent)',
        }}
      >
        {/* Left cap glow (subtle emerald like your sections) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 1px transparent',
          }}
        />
        {/* Title pill */}
        <div
          className="inline-flex items-center gap-2 rounded-full px-10 py-2"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in oklab, var(--brand) 18%, transparent) 0%, transparent 100%)',
            border: '1px solid color-mix(in oklab, var(--brand) 35%, var(--border))',
            boxShadow: '0 8px 22px color-mix(in oklab, var(--brand) 20%, transparent)',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: 'var(--brand)',
              boxShadow: '0 0 0 4px color-mix(in oklab, var(--brand) 15%, transparent)',
            }}
          />
          <span
            className="font-semibold"
            style={{ color: 'var(--text)', letterSpacing: '.2px' }}
          >
            {title}
          </span>
        </div>

        {/* (Optional) right-side slot – keep empty for now */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }} />
      </div>

      {/* SPACER so content starts BELOW the fixed rail */}
      <div aria-hidden style={{ height: RAIL_H }} />
    </>
  );
}
