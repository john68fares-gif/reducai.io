// FILE: components/ui/StyledSelect.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Lock, Search } from 'lucide-react';

export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  note?: string;
  iconLeft?: React.ReactNode;
};

export type StyledSelectProps = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
  menuTop?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  buttonHeight?: number; // default 40
};

const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

export default function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  leftIcon,
  menuTop,
  disabled,
  className,
  buttonHeight = 40,
}: StyledSelectProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  const computeMenuPos = () => {
    if (!btnRef.current) return null;
    const r = btnRef.current.getBoundingClientRect();
    // Prefer to keep inside viewport if possible
    const left = Math.min(Math.max(8, r.left), Math.max(8, (window.innerWidth || 0) - r.width - 8));
    const top = Math.min(r.bottom + 8, (window.innerHeight || 0) - 8);
    return { left, top, width: r.width };
  };

  const positionMenu = () => setMenuPos(computeMenuPos());

  useLayoutEffect(() => {
    if (open) positionMenu();
  }, [open]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;

    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    let raf = 0;
    const onScroll = () => {
      if (!open) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(positionMenu);
    };
    const onResize = () => positionMenu();

    window.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, true);

    // focus the search after mount
    setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      window.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className={className || 'relative'}
      style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (disabled) return;
          setOpen(v => !v);
        }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] text-sm outline-none transition"
        style={{
          height: buttonHeight,
          background: 'var(--vs-input-bg, var(--panel-bg))',
          border: '1px solid var(--vs-input-border, var(--border-weak))',
          color: 'var(--text)',
        }}
        aria-disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && IS_CLIENT
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100020] p-2"
              style={{
                left: menuPos?.left ?? 0,
                top: menuPos?.top ?? 0,
                width: menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280),
                background: 'var(--vs-menu-bg, var(--panel-bg))',
                border: '1px solid var(--vs-menu-border, var(--border-weak))',
                borderRadius: 10,
                boxShadow: '0 24px 64px rgba(0,0,0,.18)',
              }}
            >
              {menuTop ? <div className="mb-2">{menuTop}</div> : null}

              <div
                className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[8px]"
                style={{
                  background: 'var(--vs-input-bg, var(--panel-bg))',
                  border: '1px solid var(--vs-input-border, var(--border-weak))',
                  color: 'var(--text)',
                }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
              </div>

              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {filtered.map(o => (
                  <button
                    key={o.value}
                    disabled={!!o.disabled}
                    onClick={() => {
                      if (o.disabled) return;
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="w-full text-left text-sm px-2.5 py-2 rounded-[8px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                    style={{
                      color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                      background: 'transparent',
                      border: '1px solid transparent',
                      cursor: o.disabled ? 'not-allowed' : 'pointer',
                    }}
                    onMouseEnter={e => {
                      if (o.disabled) return;
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = 'rgba(0,255,194,0.08)';
                      el.style.border = '1px solid rgba(0,255,194,0.25)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = 'transparent';
                      el.style.border = '1px solid transparent';
                    }}
                  >
                    {o.disabled ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <span className="inline-flex items-center justify-center w-3.5 h-3.5">
                        {o.iconLeft || (
                          <Check
                            className="w-3.5 h-3.5"
                            style={{ opacity: o.value === value ? 1 : 0 }}
                          />
                        )}
                      </span>
                    )}
                    <span className="truncate">{o.label}</span>
                    <span />
                  </button>
                ))}

                {filtered.length === 0 && (
                  <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No matches.
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
