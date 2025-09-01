// components/layout/BuilderShell.tsx
'use client';

import React from 'react';
import BuilderSidebar from './BuilderSidebar';

export default function BuilderShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white flex">
      <BuilderSidebar />
      {/* Content area grows; add responsive padding to match the rest of your app */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
