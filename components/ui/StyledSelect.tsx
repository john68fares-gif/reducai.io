// FILE: components/ui/StyledSelect.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Lock, Search } from 'lucide-react';

/**
 * Compact, portal-based select with:
 * - Search filter
 * - Disabled options
 * - Custom left icon for trigger
 * - Optional menu header (menuTop)
 * - Keyboard navigation (↑ ↓ Enter Esc)
 *
 * Styles are neutral and rely on CSS variables used in your app:
 *   --vs-menu-bg, --vs-menu-border, --vs-input-bg, --vs-input-border,
 *   --text, --text-muted
 */

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  note?: string;
  iconLeft?: React.ReactNode;
};

export type StyledSelectProps = {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
  menuTop?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
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
  style,
}: StyledSelectProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hoverIdx, setHoverIdx] = useState<number>(-1);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const current = options.find((o) => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const computeMenuPos = () => {
    if (!btnRef.current) return null;
    const r = btnRef.current.getBoundingClientRect();
    return { left: r.left, top: r.bottom + 8, width: r.width };
  };
  const positionMenu = () => setMenuPos(computeMenuPos());

  useLayoutEffect(() => {
    if (open) positionMenu();
  }, [open]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;

    const handleDocumentMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    let raf = 0;
    const handleScroll = () => {
      if (!open) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(positionMenu);
    };
    const handleResize = () => positionMenu();

    window.addEventListener('mousedown', handleDocumentMouseDown);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mousedown', handleDocumentMouseDown);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      cancelAnimationFrame(raf);
    };
  }, [open]);

  // keyboard nav inside the menu
  useEffect(() => {
    if (!open) return;
    const enabled = filtered.filter((o) => !o.disabled);
    if (!enabled.length) { setHoverIdx(-1); return; }
    // default to current value, else first item
    const idx = Math.max(
      0,
      enabled.findIndex((o) => o.value === value)
    );
    setHoverIdx(idx);
  }, [open, filtered, value]);

  const move = (dir: 1 | -1) => {
    const enabled = filtered.filter((o) => !o.disabled);
    if (!enabled.length) return;
    let i = hoverIdx;
    if (i < 0) i = 0;
    i = (i + dir + enabled.length) % enabled.length;
    setHoverIdx(i);
    const el = menuRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${i}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  };

  const commitHover = () => {
    const enabled = filtered.filter((o) => !o.disabled);
    if (!enabled.length) return;
    const opt = enabled[Math.max(0, hoverIdx)];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((v) => !v);
      setTimeout(() => searchRef.current?.focus(), 0);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); commitHover(); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'Tab') { setOpen(false); }
  };

  return (
    <div ref={wrapRef} className={['relative', className].filter(Boolean).join(' ')} style={disabled ? { opacity: .6, pointerEvents: 'none', ...style } : style}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (disabled) return; setOpen(v => !v); setTimeout(() => searchRef.current?.focus(), 0); }}
        onKeyDown={onTriggerKeyDown}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] text-sm outline-none transition"
        style={{
          height: 'var(--control-h, 40px)',
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          color: 'var(--text)'
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && IS_CLIENT ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100020] p-2"
          style={{
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background: 'var(--vs-menu-bg)',
            border: '1px solid var(--vs-menu-border)',
            borderRadius: 10,
            boxShadow: '0 24px 64px rgba(0,0,0,.18)'
          }}
          role="listbox"
          aria-activedescendant={hoverIdx >= 0 ? `opt-${hoverIdx}` : undefined}
          onKeyDown={onMenuKeyDown}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[8px]"
            style={{ background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', color: 'var(--text)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color: 'var(--text)' }}
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filtered.map((o, i) => {
              const disabledOpt = !!o.disabled;
              const isSelected = o.value === value;
              // compute visible index among enabled for data-idx
              // (for keyboard commit & scroll)
              let visibleIdx = -1;
              if (!o.disabled) {
                visibleIdx = filtered.filter(x => !x.disabled).findIndex(x => x.value === o.value);
              }
              const hoveredEnabled = !disabledOpt && visibleIdx === hoverIdx;

              return (
                <button
                  key={o.value}
                  id={visibleIdx >= 0 ? `opt-${visibleIdx}` : undefined}
                  data-idx={visibleIdx >= 0 ? visibleIdx : undefined}
                  disabled={disabledOpt}
                  onClick={() => { if (disabledOpt) return; onChange(o.value); setOpen(false); }}
                  className="w-full text-left text-sm px-2.5 py-2 rounded-[8px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                  style={{
                    color: disabledOpt ? 'var(--text-muted)' : 'var(--text)',
                    background: hoveredEnabled ? 'rgba(0,255,194,0.08)' : 'transparent',
                    border: hoveredEnabled ? '1px solid rgba(0,255,194,0.25)' : '1px solid transparent',
                    cursor: disabledOpt ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={() => { if (!disabledOpt && visibleIdx >= 0) setHoverIdx(visibleIdx); }}
                >
                  {disabledOpt ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <span className="inline-flex items-center justify-center w-3.5 h-3.5">
                      {o.iconLeft || <Check className="w-3.5 h-3.5" style={{ opacity: isSelected ? 1 : 0 }} />}
                    </span>
                  )}
                  <span className="truncate">{o.label}</span>
                  <span className="text-[11px] opacity-60">{o.note || ''}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No matches.</div>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
