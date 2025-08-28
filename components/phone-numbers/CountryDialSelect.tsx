// components/phone-numbers/CountryDialSelect.tsx
'use client';

import React, {
  useEffect, useMemo, useRef, useState, useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js';
import metadata from 'libphonenumber-js/metadata.min.json';
import { Search, ChevronDown } from 'lucide-react';

type Option = { iso2: string; name: string; dial: string };

export default function CountryDialSelect({
  value,
  onChange,
  label = 'Country',
  id,
}: {
  value?: string; // ISO2 like 'US'
  onChange: (iso2: string, dial: string) => void;
  label?: string;
  id?: string;
}) {
  /* ---------- data ---------- */
  const [locale, setLocale] = useState('en');
  useEffect(() => { try { setLocale(navigator.language || 'en'); } catch {} }, []);

  const options: Option[] = useMemo(() => {
    const regions = getCountries(metadata as any) as string[];
    const dn = new Intl.DisplayNames([locale], { type: 'region' });
    return regions
      .map((iso2) => ({
        iso2,
        name: dn.of(iso2) || iso2,
        dial: getCountryCallingCode(iso2 as any, metadata as any),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [locale]);

  const selectedIso = value && options.find((o) => o.iso2 === value) ? value : 'US';
  const selected = options.find((o) => o.iso2 === selectedIso)!;

  /* ---------- combobox state ---------- */
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.iso2 === selectedIso)),
  );

  const listRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // holds the very first character typed while the button has focus
  const seedKeyRef = useRef<string | null>(null);

  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const typeAhead = useRef<{ buf: string; t: number }>({ buf: '', t: 0 });

  /* ---------- ranking & filtering ---------- */
  function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function scoreOption(o: Option, qRaw: string): number {
    if (!qRaw) return 1;
    const q = qRaw.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');
    const name = o.name.toLowerCase();
    const iso = o.iso2.toLowerCase();
    const dialDigits = o.dial;

    if (name === q) return 100;
    if (name.startsWith(q)) return 90;
    if (new RegExp(`\\b${escapeRegExp(q)}`).test(name)) return 80;
    if (name.includes(q)) return 70;

    if (iso.startsWith(q)) return 65;

    if (qDigits) {
      if (dialDigits.startsWith(qDigits)) return 60;
      if (dialDigits.includes(qDigits)) return 50;
      if (`+${dialDigits}`.startsWith(qRaw.replace(/\s+/g, ''))) return 60;
    }
    return 0;
  }

  const filtered: Option[] = useMemo(() => {
    const rows = options
      .map((o) => ({ o, s: scoreOption(o, query) }))
      .filter((r) => r.s > 0 || !query);
    rows.sort((a, b) => (b.s - a.s) || a.o.name.localeCompare(b.o.name));
    return rows.map((r) => r.o);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setActiveIdx(0);
    setTimeout(() => scrollActiveIntoView(0), 0);
  }, [open, query]);

  /* ---------- helpers ---------- */
  function flagEmoji(iso2: string) {
    return iso2
      .toUpperCase()
      .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  }
  function selectAt(i: number) {
    const o = filtered[i];
    if (!o) return;
    onChange(o.iso2, o.dial);
    setQuery('');
    setOpen(false);
    buttonRef.current?.focus();
  }
  function scrollActiveIntoView(i: number) {
    const container = listRef.current;
    const item = container?.querySelector<HTMLButtonElement>(`[data-idx="${i}"]`);
    if (container && item) {
      const cTop = container.scrollTop;
      const cBot = cTop + container.clientHeight;
      const iTop = item.offsetTop;
      const iBot = iTop + item.offsetHeight;
      if (iTop < cTop) container.scrollTop = iTop - 8;
      else if (iBot > cBot) container.scrollTop = iBot - container.clientHeight + 8;
    }
  }

  /* ---------- placement (portal above content) ---------- */
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = buttonRef.current?.getBoundingClientRect();
      if (!r) return;
      const viewH = window.innerHeight;
      const openUp = r.bottom + 320 > viewH; // ~dropdown height
      setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
    };
    update();
    const handle = () => update();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [open]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        portalRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  /* ---------- keyboard (single-letter seed; no duplicates) ---------- */
  function focusSearchAndApplySeed() {
    requestAnimationFrame(() => {
      const input = searchRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      if (seedKeyRef.current) {
        // set exactly one character; do NOT simulate typing
        setQuery(seedKeyRef.current);
        seedKeyRef.current = null;
      }
    });
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen(true);
      focusSearchAndApplySeed();
      return;
    }
    if (/^[a-zA-Z0-9+ ]$/.test(e.key)) {
      // capture the first key and consume the event so it can't be typed again
      e.preventDefault();
      e.stopPropagation();
      seedKeyRef.current = e.key;
      setOpen(true);
      focusSearchAndApplySeed();
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); const i = Math.min(filtered.length - 1, activeIdx + 1); setActiveIdx(i); scrollActiveIntoView(i); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const i = Math.max(0, activeIdx - 1); setActiveIdx(i); scrollActiveIntoView(i); }
    else if (e.key === 'Enter') { e.preventDefault(); selectAt(activeIdx); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); buttonRef.current?.focus(); }
    else if (/^[a-zA-Z0-9+ ]$/.test(e.key)) {
      const now = Date.now();
      if (now - typeAhead.current.t > 700) typeAhead.current.buf = '';
      typeAhead.current.t = now;
      typeAhead.current.buf += e.key.toLowerCase();
      setQuery(typeAhead.current.buf);
      setActiveIdx(0);
      setTimeout(() => scrollActiveIntoView(0), 0);
    }
  }

  /* ---------- styles ---------- */
  const CARD: React.CSSProperties = {
    background: '#101314',
    border: '1px solid rgba(255,255,255,0.30)',
    borderRadius: 20,
    boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
  };

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1 block text-xs text-white/70">{label}</label>

      {/* trigger button */}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => { setOpen(v => !v); setTimeout(() => searchRef.current?.focus(), 0); }}
        onKeyDown={onButtonKeyDown}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[14px] text-sm outline-none transition"
        style={{ background: 'rgba(0,0,0,0.30)', border: '1px solid rgba(255,255,255,0.20)' }}
      >
        <span className="flex items-center gap-2 truncate">
          <span className="text-[18px]">
            {selected.iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))}
          </span>
          <span className="truncate">{selected.name}</span>
          <span className="text-white/60 shrink-0">(+{selected.dial})</span>
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {/* portal dropdown */}
      {open && rect && createPortal(
        <div
          ref={portalRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="fixed z-[9999] p-3"
          style={{
            ...CARD,
            top: rect.openUp ? rect.top - 8 : rect.top + 8,
            left: rect.left,
            width: rect.width,
            transform: rect.openUp ? 'translateY(-100%)' : 'none',
          }}
        >
          {/* search */}
          <div
            className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
            style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            <Search className="w-4 h-4 text-white/70" />
            <input
              ref={searchRef}
              id={`${id || 'country'}-search`}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
              placeholder="Type country or +code…"
              className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/60"
            />
          </div>

          {/* list */}
          <div ref={listRef} className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {filtered.map((o, i) => {
              const active = i === activeIdx;
              const selectedRow = o.iso2 === selectedIso;
              return (
                <button
                  key={o.iso2}
                  data-idx={i}
                  role="option"
                  aria-selected={selectedRow}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => selectAt(i)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition"
                  style={{
                    background: active ? 'rgba(0,255,194,0.10)' : 'transparent',
                    border: active ? '1px solid rgba(0,255,194,0.35)' : '1px solid transparent',
                  }}
                >
                  <span className="text-[18px]">
                    {o.iso2.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)))}
                  </span>
                  <span className="flex-1 truncate">{o.name}</span>
                  <span className="text-white/60 shrink-0">(+{o.dial})</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-white/70">No matches.</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
