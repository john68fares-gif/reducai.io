// components/layout/BuilderShell.tsx
'use client';

import { PropsWithChildren, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '../ui/Sidebar';

export default function BuilderShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const onLanding = pathname === '/';

  // make sure CSS var exists so padding syncs with sidebar
  useEffect(() => {
    if (!document.documentElement.style.getPropertyValue('--sidebar-w')) {
      document.documentElement.style.setProperty('--sidebar-w', '260px');
    }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0b0c10', color: '#ffffff' }}>
      {!onLanding && <Sidebar />}
      <main
        style={{
          paddingLeft: onLanding ? 0 : 'var(--sidebar-w, 260px)',
          paddingRight: 20,
          paddingTop: 20,
          paddingBottom: 20,
          transition: 'padding-left 220ms ease',
        }}
      >
        {children}
      </main>
    </div>
  );
}
