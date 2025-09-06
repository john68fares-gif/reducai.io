// components/builder/HeaderRail.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { createPortal } from 'react-dom';

/**
 * ABSOLUTE TOP HEADER — touches the sidebar
 * -------------------------------------------------
 * - Renders into <body> so it can’t be “trapped” in the middle.
 * - Stretches FULL width (left:0; right:0), then pads itself from the
 *   sidebar using calc(var(--sidebar-w) + padding). This guarantees it
 *   visually *touches* the sidebar edge, even while collapsing.
 * - Uses theme tokens (light/dark) you already have.
 * - Spacer below keeps page content from hiding under it.
 *
 * If you still don’t see it, the temporary DEBUG outline will make it obvious.
 * You can remove the outline after verifying.
 */

const RAIL_H = 72; // a bit taller so you can clearly see it

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
  const [mounted, setMounted] = useState(false);

  const title = useMemo(() => {
    const found = TITLE_MAP.find((x) => x.test(pathname));
    return found?.title ?? 'Dashboard';
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    document.documentElement.style.setProperty('--rail-h', `${RAIL_H}px`);
  }, []);

  const header = (
    <div
      className="z-[1000] backdrop-blur-[2px]"
      // FULL-WIDTH fixed bar at the VERY top, then we push content to the right
      // by padding-left = sidebar width + 18px.
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: RAIL_H,
        display: 'flex',
        alignItems: 'center',
        // 👇 this makes the header visually “touch” the sidebar while respecting its width
        paddingLeft: 'calc(var(--sidebar-w, 260px) + 18px)',
        paddingRight: 18,
        background:
          'linear-gradient(180deg, color-mix(in oklab, var(--panel) 95%, transparent) 0%, var(--panel) 100%)',
        borderBottom: '1px solid var(--border)',
        boxShadow:
          '0 12px 30px rgba(0,0,0,.28), 0 0 0 1px color-mix(in oklab, var(--border) 60%, transparent)',
        // DEBUG: outline so you can’t miss it (remove after you confirm)
        outline: '1px dashed color-mix(in oklab, var(--brand) 55%, var(--border))',
        outlineOffset: -1,
      }}
    >
      {/* Left pill title */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-12 py-2.5"
        style={{
          background:
            'linear-gradient(180deg, color-mix(in oklab, var(--brand) 18%, transparent) 0%, transparent 100%)',
          border: '1px solid color-mix(in oklab, var(--brand) 35%, var(--border))',
          boxShadow:
            '0 10px 24px color-mix(in oklab, var(--brand) 24%, transparent), inset 0 0 0 1px color-mix(in oklab, var(--brand) 10%, transparent)',
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

      {/* Right-side slot (empty for now) */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }} />
    </div>
  );

  return (
    <>
      {/* Spacer so content starts BELOW the fixed rail */}
      <div aria-hidden style={{ height: RAIL_H }} />
      {/* Render the actual header on <body> so it's ALWAYS at the very top */}
      {mounted ? createPortal(header, document.body) : null}
    </>
  );
}
