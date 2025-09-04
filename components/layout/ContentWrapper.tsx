// components/layout/ContentWrapper.tsx
import { PropsWithChildren } from 'react';

export default function ContentWrapper({ children }: PropsWithChildren) {
  return (
    <main
      className="min-h-screen"
      style={{
        marginLeft: 'var(--sidebar-w, 260px)', // start after sidebar
        padding: '24px',
        background: 'rgba(15,18,20,0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 0 35px rgba(0,255,194,0.04)',
      }}
    >
      <div
        style={{
          maxWidth: '1600px',
          margin: '0 auto',
          padding: '12px',
        }}
      >
        {children}
      </div>
    </main>
  );
}
