// components/layout/PageShell.tsx
'use client';

import { PropsWithChildren, useEffect } from 'react';
import Sidebar from '../ui/Sidebar';

export default function PageShell({ children }: PropsWithChildren) {
  useEffect(() => {
    if (!document.documentElement.style.getPropertyValue('--sidebar-w')) {
      document.documentElement.style.setProperty('--sidebar-w', '260px');
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main
        className="flex-1 min-h-screen px-6 py-6"
        style={{
          marginLeft: 'var(--sidebar-w, 260px)',
          transition: 'margin-left 0.5s ease',
        }}
      >
        <div
          className="w-full h-full rounded-2xl"
          style={{
            border: '1px solid rgba(0,255,194,0.08)',
            boxShadow:
              '0 0 30px rgba(0,255,194,0.08), inset 0 0 20px rgba(0,0,0,0.35)',
            padding: '24px',
            minHeight: 'calc(100vh - 48px)', // full height minus padding
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}

