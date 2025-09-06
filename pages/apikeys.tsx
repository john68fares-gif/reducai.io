// pages/api-keys.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  KeyRound,
  Plus,
  Trash2,
  CheckCircle2,
  X,
  ChevronDown,
  Zap,
  Key as KeyIcon,
  ShieldCheck,
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ----------------------------- Types & constants ---------------------------- */
type StoredKey = { id: string; name: string; key: string; createdAt: number };

const BTN = {
  GREEN: 'var(--brand)',
  GREEN_HOVER: 'rgba(0,255,194,0.92)',
};
const SKEYS = {
  LIST: 'apiKeys',              // <-- Step2 reads this
  SELECTED: 'apiKeys:selectedId'
};

/* ------------------------------ Frame helpers ------------------------------ */
const FRAME: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  boxShadow: 'var(--shadow-card)',
};

/* ------------------------------ Inline Select ------------------------------ */
type Opt = { value: string; label: string; sub?: string };

function InlineSelect({
  id, value, onChange, options, placeholder = 'No API Keys',
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const sel = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect({ top: r.bottom + 8, left: r.left, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 h-[46px] rounded-[14px] text-sm outline-none transition-all hover:-translate-y-[1px]"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
      >
        <span className="flex items-center gap-2 truncate">
          <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          {sel ? (
            <span className="truncate">
              {sel.label}
              {sel.sub ? <span style={{ color: 'var(--text-muted)' }} className="ml-2">{sel.sub}</span> : null}
            </span>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && (
        <div
          ref={portalRef}
          className="fixed z-[9999] p-2 animate-in fade-in slide-in-from-top-2"
          style={{ ...CARD, left: rect.left, top: rect.top, width: rect.width }}
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-muted)' }}>No items.</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 transition hover:opacity-80"
              style={{ color: 'var(--text)' }}
            >
              <KeyRound className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.sub && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------------------------- Modal ---------------------------------- */
function AddKeyModal({
  open, onClose, onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, key: string) => void;
}) {
  const [name, setName] = useState('');
  const [val, setVal] = useState('');

  useEffect(() => { if (open) { setName(''); setVal(''); } }, [open]);
  if (!open) return null;

  const canSave = name.trim().length > 0 && val.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-[560px] animate-in fade-in zoom-in-95" style={FRAME}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
              <KeyIcon className="w-5 h-5" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold" style={{ color: 'var(--text)' }}>Add New Project API Key</div>
              <div className="text-xs md:text-sm" style={{ color: 'var(--text-muted)' }}>
                Keys are saved per account (scoped storage).
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:opacity-70">
            <X className="w-5 h-5" style={{ color: 'var(--text)' }} />
          </button>
        </div>

        {/* body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Project Name <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Main Project"
              className="w-full rounded-[14px] border px-3 h-[44px] text-sm outline-none"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              OpenAI API Key <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              type="password"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-[14px] border px-3 h-[44px] text-sm outline-none"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              This never leaves your browser; it’s stored under <code>user:&lt;uid&gt;:{SKEYS.LIST}</code>.
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="w-full h-[44px] rounded-[18px] font-semibold transition"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (canSave) onSave(name.trim(), val.trim()); }}
            className="w-full h-[44px] rounded-[18px] font-semibold flex items-center justify-center gap-2 transition"
            style={{ background: canSave ? BTN.GREEN : 'rgba(0,0,0,0.25)', color: '#fff', opacity: canSave ? 1 : 0.6 }}
            onMouseEnter={(e) => { if (canSave) (e.currentTarget as HTMLButtonElement).style.background = BTN.GREEN_HOVER; }}
            onMouseLeave={(e) => { if (canSave) (e.currentTarget as HTMLButtonElement).style.background = BTN.GREEN; }}
          >
            <KeyRound className="w-4 h-4" />
            Save API Key
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------- Toast ---------------------------------- */
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
      <div
        className="pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl animate-in fade-in"
        style={{ ...CARD, border: '1px solid var(--brand)', background: 'var(--panel)', color: 'var(--text)' }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
          <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        </div>
        <div className="text-sm">{text}</div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:opacity-70">
          <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------- Page ----------------------------------- */
function ApiKeysScreen() {
  const [list, setList] = useState<StoredKey[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // Load per-user keys + previously chosen id
  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      const l = await ss.getJSON<StoredKey[]>(SKEYS.LIST, []);
      setList(Array.isArray(l) ? l : []);

      const saved = await ss.getJSON<string | null>(SKEYS.SELECTED, null);
      if (saved && (l || []).find(k => k.id === saved)) setSelected(saved);
      else if ((l || [])[0]) setSelected(l[0].id);

      setLoading(false);
    })();
  }, []);

  // Persist selected id per user
  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.setJSON(SKEYS.SELECTED, selected || '');
    })();
  }, [selected]);

  const opts: Opt[] = useMemo(
    () =>
      list.map((k) => {
        const tail = (k.key || '').slice(-4).toUpperCase();
        return { value: k.id, label: k.name, sub: tail || undefined };
      }),
    [list]
  );

  const selectedKey = list.find((k) => k.id === selected) || null;

  async function saveList(next: StoredKey[]) {
    const ss = await scopedStorage();
    await ss.setJSON(SKEYS.LIST, next);
    setList(next);
  }

  async function addKey(name: string, key: string) {
    const next: StoredKey = { id: String(Date.now()), name, key, createdAt: Date.now() };
    const updated = [next, ...list];
    await saveList(updated);
    setSelected(next.id);
    setShowAdd(false);
    setToast(`API Key “${name}” saved`);
  }

  async function removeKey(id: string) {
    const updated = list.filter((k) => k.id !== id);
    await saveList(updated);
    if (selected === id) {
      const fallback = updated[0]?.id || '';
      setSelected(fallback);
    }
    const removedName = list.find((k) => k.id === id)?.name || 'project';
    setToast(`API Key for “${removedName}” removed`);
  }

  async function copyKey(full: string) {
    try { await navigator.clipboard.writeText(full); setToast('API key copied to clipboard'); } catch {}
  }

  function testKey() {
    const ok = !!selectedKey?.key;
    setToast(ok ? 'API Key looks set. You can use it in Step 2.' : 'No API Key selected.');
  }

  return (
    <div className="min-h-screen w-full px-6 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto w-full max-w-[920px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Manage your OpenAI API keys. Stored per account (scoped).
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl grid place-items-center" style={{ background: 'var(--brand-weak)' }}>
            <KeyRound className="w-5 h-5" style={{ color: 'var(--brand)' }} />
          </div>
        </div>

        {/* Frame */}
        <div className="p-6 md:p-7" style={FRAME}>
          {/* Selector */}
          <div className="mb-6 p-4" style={CARD}>
            <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Select API Key</label>
            {loading ? (
              <div className="h-[46px] rounded-[14px] border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
            ) : (
              <InlineSelect
                id="apikey-select"
                value={selected}
                onChange={setSelected}
                options={opts}
                placeholder="No API Keys"
              />
            )}
          </div>

          {/* Selected card / empty */}
          <div className="mb-6 p-4" style={CARD}>
            {selectedKey ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
                  <ShieldCheck className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{selectedKey.name}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Key ending in: {(selectedKey.key || '').slice(-4).toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyKey(selectedKey.key)}
                    className="px-3 py-1.5 rounded-[10px] text-sm font-semibold transition hover:-translate-y-[1px]"
                    style={{ background: 'var(--brand)', color: '#0a0a0a', boxShadow: 'var(--shadow-soft)' }}
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => removeKey(selectedKey.id)}
                    className="p-2 rounded-lg hover:bg-[color:var(--brand-weak)] transition"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'crimson' }} />
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>No API Keys Found</div>
            )}
          </div>

          {/* List */}
          <div className="mb-6 p-4 space-y-3" style={CARD}>
            <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>All Keys</div>
            {loading ? (
              <div className="space-y-2">
                {[0,1,2].map(i => (
                  <div key={i} className="h-12 rounded-[12px] border animate-pulse" style={{ background: 'var(--card)', borderColor: 'var(--border)' }} />
                ))}
              </div>
            ) : list.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No keys yet. Add your first one below.
              </div>
            ) : (
              <ul className="space-y-2">
                {list.map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-[12px] transition-all hover:-translate-y-[1px]"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{k.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        • Ending in {(k.key || '').slice(-4).toUpperCase()} • {new Date(k.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelected(k.id); setToast(`Selected “${k.name}”`); }}
                        className="px-3 py-1.5 rounded-[10px] text-sm transition hover:-translate-y-[1px]"
                        style={{ background: 'var(--brand-weak)', color: 'var(--text)' }}
                      >
                        Select
                      </button>
                      <button
                        onClick={() => copyKey(k.key)}
                        className="px-3 py-1.5 rounded-[10px] text-sm font-semibold transition hover:-translate-y-[1px]"
                        style={{ background: 'var(--brand)', color: '#0a0a0a' }}
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => removeKey(k.id)}
                        className="p-2 rounded-lg hover:bg-[color:var(--brand-weak)] transition"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" style={{ color: 'crimson' }} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center justify-center gap-2 px-4 h-[44px] rounded-[14px] font-semibold transition hover:-translate-y-[1px]"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
            >
              <Plus className="w-4 h-4" />
              Add New API Key
            </button>

            <button
              onClick={testKey}
              className="flex-1 h-[44px] rounded-[18px] font-semibold flex items-center justify-center gap-2 transition hover:-translate-y-[1px]"
              style={{ background: BTN.GREEN, color: '#0a0a0a', boxShadow: 'var(--shadow-soft)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN.GREEN_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN.GREEN)}
            >
              <Zap className="w-4 h-4" />
              Test API Key
            </button>
          </div>
        </div>
      </div>

      <AddKeyModal open={showAdd} onClose={() => setShowAdd(false)} onSave={addKey} />
      {toast && <Toast text={toast} onClose={() => setToast(undefined)} />}
    </div>
  );
}

/* Export with SSR disabled so scoped local storage is safe */
export default dynamic(() => Promise.resolve(ApiKeysScreen), { ssr: false });
