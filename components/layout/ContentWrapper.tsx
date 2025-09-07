// components/layout/ContentWrapper.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

type Props = { children: React.ReactNode };

/**
 * Full-bleed on /voice-agent to let the assistant rail touch the main sidebar + header.
 * Other routes keep the standard page padding.
 */
export default function ContentWrapper({ children }: Props) {
  const pathname = usePathname() || '';
  const isVoiceStudio = pathname.startsWith('/voice-agent');

  if (isVoiceStudio) {
    // No top/side padding so the Assistants rail can align flush
    return (
      <div className="w-full min-h-screen">
        {children}
      </div>
    );
  }

  // Default (unchanged for the rest of the app)
  return (
    <div className="w-full min-h-screen px-4 sm:px-6 lg:px-8 py-8">
      {children}
    </div>
  );
}
