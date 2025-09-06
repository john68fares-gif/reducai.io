// components/builder/HeaderRail.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';

/**
 * ABSOLUTE TOP HEADER (PORTALED TO <body>)
 * -------------------------------------------------
 * - Renders into document.body via a portal so it is NEVER trapped
 *   by any transformed/animated parent (that was causing it to sit
 *   in the middle of the page).
 * - Fixed at the very top of the viewport, from the sidebar’s edge
 *   to the right side. Uses your CSS tokens for light/dark.
 * - Ships a spacer div so page content starts below it.
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
  const step = useSearchParams()?.get('step'); // kept if you need later
  const [mounted, setMounted] = useState(false);

  const title = useMemo(() => {
    const found = TITLE_MAP.find((x) => x.test(pathname));
    return found?.title ?? 'Dashboard';
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    // expose height for layouts that want to read it
    document.documentElement.style.setProperty('--rail-h', `${RAIL_H}px`);
  }, []);

  const header = (
    <div
      className="z-[1000] backdrop-blur-[2px]"
      style={{
        position: 'fixed',
        top: 0,
        left: 'var(--sidebar-w, 260px)', // snaps to your fixed sidebar
        right: 0,                        // stretch to right edge
        height: RAIL_H,
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        background:
          'linear-gradient(180deg, color-mix(in oklab, var(--panel) 92%, transparent) 0%, var(--panel) 100%)',
        borderBottom: '1px solid var(--border)',
        boxShadow:
          '0 10px 28px rgba(0,0,0,.25), 0 0 0 1px color-mix(in oklab, var(--border) 60%, transparent)',
        // guard against any accidental parent effects (just in case)
        transform: 'none',
        willChange: 'auto',
        pointerEvents: 'auto',
      }}
    >
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
        <span className="font-semibold" style={{ color: 'var(--text)', letterSpacing: '.2px' }}>
          {title}
        </span>
      </div>

      {/* right slot (empty for now) */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }} />
    </div>
  );

  return (
    <>
      {/* Spacer so content starts BELOW the fixed rail */}
      <div aria-hidden style={{ height: RAIL_H }} />
      {/* Render the actual header at the VERY TOP of the page */}
      {mounted ? createPortal(header, document.body) : null}
    </>
  );
}
