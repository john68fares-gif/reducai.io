// components/voice/atoms.tsx
'use client';
import React from 'react';

export const BTN_GREEN = '#59d9b3';
export const BTN_GREEN_HOVER = '#54cfa9';
export const BTN_DISABLED = '#2e6f63';

export const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};

export function GreenButton({
  children, onClick, disabled, className,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  const can = !disabled;
  return (
    <button
      onClick={onClick}
      disabled={!can}
      className={`inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed ${className||''}`}
      style={{
        background: can ? BTN_GREEN : BTN_DISABLED,
        color: '#fff',
        boxShadow: can ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
        filter: can ? 'none' : 'saturate(85%) opacity(0.9)',
      }}
      onMouseEnter={(e) => { if (can) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
      onMouseLeave={(e) => { if (can) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}
    >{children}</button>
  );
}
