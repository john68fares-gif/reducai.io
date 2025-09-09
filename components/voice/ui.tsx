// components/voice/ui.tsx
'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Sparkles, X } from 'lucide-react';

/* =============================================================================
   THEME TOKENS (shared)
============================================================================= */
export const SCOPE = 'va-scope';
export const ACCENT = '#10b981';
export const ACCENT_HOVER = '#0ea371';
export const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

/* =============================================================================
   HOOKS
============================================================================= */
export function useAppSidebarWidth(
  scopeRef: React.RefObject<HTMLDivElement>,
  fallbackCollapsed: boolean
) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const setVar = (w: number) =>
      scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);

    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;

    let target = findSidebar();
    if (!target) {
      setVar(fallbackCollapsed ? 72 : 248);
      return;
    }

    // Initial read
    setVar(target.getBoundingClientRect().width);

    const ro = new ResizeObserver(() =>
      setVar(target!.getBoundingClientRect().width)
    );
    ro.observe(target);

    const mo = new MutationObserver(() =>
      setVar(target!.getBoundingClientRect().width)
    );
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });

    const onTransitionEnd = () => setVar(target!.getBoundingClientRect().width);
    target.addEventListener('transitionend', onTransitionEnd);

    return () => {
      ro.disconnect();
      mo.disconnect();
      target.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [scopeRef, fallbackCollapsed]);
}

/* =============================================================================
   ATOMS
============================================================================= */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="col-span-12 rounded-xl relative"
      style={{
        background: 'var(--va-card)',
        border: '1px solid var(--va-border)',
        boxShadow: 'var(--va-shadow)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[22%] -left-[22%] w-[70%] h-[70%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="px-5 pb-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
   SELECT (minimal portal-less dropdown)
============================================================================= */
export type Item = { value: string; label: string; icon?: React.ReactNode };

export function Select({
  value,
  items,
  onChange,
  placeholder,
  leftIcon,
}: {
  value: string;
  items: Item[];
  onChange: (v: string) => void;
  placeholder?: string;
  leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement | null>(null);
  const pop = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => {
      if (btn.current?.contains(e.target as Node) || pop.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [open]);

  const filtered = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = items.find((i) => i.value === value) || null;

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
        style={{
          background: 'var(--va-input-bg)',
          color: 'var(--text)',
          border: '1px solid var(--va-input-border)',
          boxShadow: 'var(--va-input-shadow)',
        }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? (
          <span className="flex items-center gap-2 min-w-0">
            {sel.icon}
            <span className="truncate">{sel.label}</span>
          </span>
        ) : (
          <span className="opacity-70">{placeholder || 'Select…'}</span>
        )}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={pop}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mt-2 p-3 rounded-xl"
            style={{
              background: 'var(--va-menu-bg)',
              border: '1px solid var(--va-menu-border)',
              boxShadow: 'var(--va-shadow-lg)',
            }}
          >
            <div
              className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg"
              style={{
                background: 'var(--va-input-bg)',
                border: '1px solid var(--va-input-border)',
                boxShadow: 'var(--va-input-shadow)',
              }}
            >
              <Sparkles className="w-4 h-4 icon" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter…"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)' }}
              />
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map((it) => (
                <button
                  key={it.value}
                  onClick={() => {
                    onChange(it.value);
                    setOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(16,185,129,.10)';
                    (e.currentTarget as HTMLButtonElement).style.border =
                      '1px solid rgba(16,185,129,.35)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                  }}
                >
                  {it.icon}
                  {it.label}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  No matches.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =============================================================================
   DELETE MODAL
============================================================================= */
export function DeleteModal({
  open,
  name,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,.55)' }}
    >
      <motion.div
        initial={{ y: 10, opacity: 0.9, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        className="w-full max-w-md rounded-2xl"
        style={{ background: 'var(--va-card)', border: '1px solid var(--va-border)', boxShadow: 'var(--va-shadow-lg)' }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--va-border)' }}
        >
          <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Delete Assistant
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:opacity-80">
            <X className="w-4 h-4 icon" />
          </button>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          Are you sure you want to delete{' '}
          <span style={{ color: 'var(--text)' }}>“{name}”</span>? This cannot be undone.
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn--ghost">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn--danger">
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =============================================================================
   STYLE BLOCK (scoped)
============================================================================= */
export function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  --accent:${ACCENT};
  --bg:#0b0c10;
  --text:#eef2f5;
  --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:#0f1315;
  --va-topbar:#0e1214;
  --va-sidebar:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
  --va-chip:rgba(255,255,255,.03);
  --va-border:rgba(255,255,255,.10);
  --va-input-bg:rgba(255,255,255,.03);
  --va-input-border:rgba(255,255,255,.14);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  --va-menu-bg:#101314;
  --va-menu-border:rgba(255,255,255,.16);
  --va-shadow:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.4);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
  --va-shadow-side:8px 0 28px rgba(0,0,0,.42);
  --va-rail-w:360px;
}
:root:not([data-theme="dark"]) .${SCOPE}{
  --bg:#f7f9fb;
  --text:#101316;
  --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
  --va-card:#ffffff;
  --va-topbar:#ffffff;
  --va-sidebar:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
  --va-chip:#ffffff;
  --va-border:rgba(0,0,0,.10);
  --va-input-bg:#ffffff;
  --va-input-border:rgba(0,0,0,.12);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.85);
  --va-menu-bg:#ffffff;
  --va-menu-border:rgba(0,0,0,.10);
  --va-shadow:0 28px 70px rgba(0,0,0,.12), 0 12px 28px rgba(0,0,0,.08);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.16), 0 22px 54px rgba(0,0,0,.10);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.10);
  --va-shadow-side:8px 0 26px rgba(0,0,0,.08);
}

/* main */
.${SCOPE} .va-main{ max-width: none !important; }
.${SCOPE} .icon{ color: var(--accent); }

/* unified button sizing + style parity */
.${SCOPE} .btn{
  display:inline-flex; align-items:center; gap:.5rem;
  border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1;
  border:1px solid var(--va-border);
}
.${SCOPE} .btn--green{
  background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW};
  transition:transform .04s ease, background .18s ease;
}
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{
  background:var(--va-card); color:var(--text);
  box-shadow:var(--va-shadow-sm);
}
.${SCOPE} .btn--danger{
  background:rgba(220,38,38,.12); color:#fca5a5;
  box-shadow:0 10px 24px rgba(220,38,38,.15);
  border-color:rgba(220,38,38,.35);
}

/* sliders */
.${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
.${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
.${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }

/* no transitions on left so Safari/iPad won't jitter during sidebar animation */
.${SCOPE} aside{ transition:none !important; }

@media (max-width: 1180px){
  .${SCOPE}{ --va-rail-w: 320px; }
}
`}</style>
  );
}
