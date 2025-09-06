// components/builder/HeaderRail.tsx
'use client';

import { usePathname } from 'next/navigation';
import React from 'react';

const SECTION_TITLES: Record<string, string> = {
  '/builder': 'Builder Dashboard',
  '/improve': 'Tuning',
  '/voice-agent': 'Voice Studio',
  '/launch': 'Launchpad',
  '/phone-numbers': 'Phone Numbers',
  '/apikeys': 'API Keys',
  '/support': 'Help',
};

function deriveTitle(pathname: string | null): string {
  if (!pathname) return 'Dashboard';
  // exact match first
  if (SECTION_TITLES[pathname]) return SECTION_TITLES[pathname];

  // longest-prefix match (e.g., /builder/xyz)
  const hit = Object.keys(SECTION_TITLES)
    .sort((a, b) => b.length - a.length)
    .find((k) => pathname.startsWith(k));
  if (hit) return SECTION_TITLES[hit];

  // fallback: prettify last segment
  const seg = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  return seg
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function HeaderRail({ title }: { title?: string }) {
  const pathname = usePathname();
  const text = title ?? deriveTitle(pathname);

  return (
    <div
      className="sticky top-0 z-30 h-[56px] flex items-center"
      style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div
        className="ml-4 sm:ml-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold select-none"
        style={{
          color: 'var(--text)',
          background: 'rgba(0,255,194,.12)',
          border: '1px solid var(--brand-weak)',
          boxShadow: 'inset 0 0 12px rgba(0,0,0,.06)',
        }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: 'var(--brand)' }}
        />
        {text}
      </div>
    </div>
  );
}
