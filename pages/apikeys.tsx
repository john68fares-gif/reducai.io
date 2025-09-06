// pages/api-keys.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  KeyRound, Plus, ChevronDown, Trash2, CheckCircle2, Zap, X, Key as KeyIcon, ShieldCheck,
} from 'lucide-react';
import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

/* =============================== Storage keys =============================== */
type StoredKey = { id: string; name: string; key: string; createdAt: number };
const KEYS_KEY = 'apiKeys.v1';
const SELECTED_KEY = 'apiKeys.selectedId';

/* ================================ UI tokens ================================= */
const FRAME: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  // stronger separation from background
  boxShadow: '0 28px 80px rgba(0,0,0,0.35), var(--shadow-soft)',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 20,
  // nice card lift
  boxShadow: '0 22px 60px rgba(0,0,0,0.28), var(--shadow-card)',
};
const BTN = { background: 'var(--brand)', color: '#fff' as const };

/* =============================== Inline select ============================== */
type Opt = { value: string; label: string; sub?: string };

function InlineSelect({
  id, value, onChange, options, placeholder = 'No API Keys',
}: { id?: string; value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string }) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const sel = useMemo(() => options.find((o) => o.value === value) || null, [options, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 8, left: r.left, width: r.width });
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
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-black/5 transition"
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

/* ================================== Modal ================================== */
function AddKeyModal({
  open, onClose, onSave, busy,
}: { open: boolean; onClose: () => void; onSave: (name: string, key: string) => void; busy: boolean }) {
  const [name, setName] = useState('');
  const [val, setVal] = useState('');

  useEffect(() => { if (open) { setName(''); setVal(''); } }, [open]);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.62)' }}
    >
      <div
        className="w-full animate-in fade-in-50 zoom-in-95"
        style={{
          ...FRAME,
          maxWidth: 620,               // narrower
          maxHeight: '92vh',           // taller
          overflow: 'hidden',
          boxShadow: '0 28px 110px rgba(0,0,0,0.5)',
        }}
      >
        {/* header */}
        <div className="flex items-center justify-between px-7 py-6 rounded-t-[30px]" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow" style={{ background: 'var(--brand-weak)' }}>
              <KeyIcon className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="min-w-0">
              <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>Add New Project API Key</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Provide a project name and your OpenAI API key. Your key is stored per account.
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:opacity-70 transition">
            <X className="w-5 h-5" style={{ color: 'var(--text)' }} />
          </button>
        </div>

        {/* body */}
        <div className="p-7 space-y-5">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Project Name <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Main Project, Test Environment"
              className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none focus:ring-2"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
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
              className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none focus:ring-2"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
            />
            <div className="mt-2 text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
              <ShieldCheck className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              Your key is stored in this browser, scoped to your signed-in account.
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-7 pb-7 flex gap-3">
          <button
            onClick={onClose}
            className="w-full h-[46px] rounded-[18px] font-semibold transition hover:opacity-85"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { if (name.trim() && val.trim() && !busy) onSave(name.trim(), val.trim()); }}
            className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 transition hover:brightness-95 disabled:opacity-60"
            style={BTN}
            disabled={busy || !name.trim() || !val.trim()}
          >
            {busy ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                Save API Key
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================================== Toast ================================== */
function Toast({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2300); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 left-0 right-0 z-[9997] flex justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl animate-in fade-in slide-in-from-bottom-2"
        style={{ ...CARD, border: '1px solid var(--brand)', background: 'var(--panel)', color: 'var(--text)' }}
      >
        <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
        <div className="text-sm">{text}</div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:opacity-70">
          <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  );
}

/* ================================== Screen ================================== */
function ApiKeysScreen() {
  const [list, setList] = useState<StoredKey[] | null>(null); // null = loading
  const [selected, setSelected] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | undefined>(undefined);

  // Initial hydrate (per-user) + migrate legacy keys
  useEffect(() => {
    (async () => {
      await migrateLegacyKeysToUser();
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      const keys = await ss.getJSON<StoredKey[]>(KEYS_KEY, []);
      setList(keys);

      const sel = await ss.getJSON<string>(SELECTED_KEY, '');
      if (sel && keys.find((k) => k.id === sel)) setSelected(sel);
      else if (keys[0]) setSelected(keys[0].id);
    })();
  }, []);

  // Persist selected id
  useEffect(() => {
    (async () => {
      if (list === null) return;
      const ss = await scopedStorage();
      if (selected) await ss.setJSON(SELECTED_KEY, selected);
      else await ss.remove(SELECTED_KEY);
    })();
  }, [selected, list]);

  const opts: Opt[] = useMemo(
    () =>
      (list || []).map((k) => {
        const tail = (k.key || '').slice(-4).toUpperCase();
        return { value: k.id, label: k.name, sub: tail || undefined };
      }),
    [list]
  );

  const selectedKey = (list || []).find((k) => k.id === selected) || null;

  async function addKey(name: string, key: string) {
    setSaving(true);
    const next: StoredKey = { id: String(Date.now()), name, key, createdAt: Date.now() };
    const updated = [next, ...(list || [])];
    const ss = await scopedStorage();
    await ss.setJSON(KEYS_KEY, updated);
    setList(updated);
    setSelected(next.id);
    setShowAdd(false);
    setSaving(false);
    setToast(`API Key “${name}” saved`);
  }

  async function removeKey(id: string) {
    if (!list) return;
    const updated = list.filter((k) => k.id !== id);
    const ss = await scopedStorage();
    await ss.setJSON(KEYS_KEY, updated);
    setList(updated);
    if (selected === id) setSelected(updated[0]?.id || '');
    const removedName = list.find((k) => k.id === id)?.name || 'project';
    setToast(`API Key for “${removedName}” removed`);
  }

  function testKey() {
    const ok = !!selectedKey?.key;
    setToast(ok ? 'API Key looks set. You can now use it in your flows.' : 'No API Key selected.');
  }

  /* ------------------------------ Loading state ------------------------------ */
  if (list === null) {
    return (
      <div className="px-6 py-12" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="mx-auto w-full max-w-[980px] p-6" style={FRAME}>
          <div className="h-6 w-40 rounded-lg animate-pulse" style={{ background: 'var(--ring)' }} />
          <div className="mt-6 grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--ring)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* --------------------------------- Render --------------------------------- */
  return (
    <div className="px-6 py-10" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="mx-auto w-full max-w-[980px] relative" style={{ ...FRAME }}>
        {/* header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold">API Keys</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Manage your OpenAI API keys for different projects
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow" style={{ background: 'var(--brand-weak)' }}>
            <KeyRound className="w-5 h-5" style={{ color: 'var(--brand)' }} />
          </div>
        </div>

        <div className="px-6 pb-8 space-y-5">
          {list.length === 0 ? (
            /* ---------------------------- Empty state box ---------------------------- */
            <div className="relative">
              <div className="mx-auto w-full max-w-[820px] p-10 text-center relative overflow-hidden rounded-[20px]"
                   style={{ ...CARD }}>
                {/* Interior subtle border for that inset look */}
                <div className="absolute inset-0 rounded-[20px] pointer-events-none"
                     style={{ boxShadow: 'inset 0 0 0 1px var(--border)' }} />
                {/* Bottom glow to separate from background */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-[70%] h-16 blur-2xl opacity-70 pointer-events-none"
                     style={{ background: 'radial-gradient(60% 100% at 50% 0%, var(--brand-weak), transparent 70%)' }} />
                <div className="mx-auto w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center mb-4"
                     style={{ borderColor: 'var(--brand-weak)' }}>
                  <KeyRound className="w-7 h-7" style={{ color: 'var(--brand)' }} />
                </div>
                <div className="text-lg font-semibold mb-1">No API Keys Found</div>
                <div className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                  Add your first API key to get started
                </div>
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-2 px-5 h-[44px] rounded-[16px] font-semibold transition hover:brightness-95"
                  style={BTN}
                >
                  <Plus className="w-4 h-4" /> Add New API Key
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Select */}
              <div style={CARD} className="p-4">
                <label className="block text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Select API Key</label>
                <InlineSelect id="apikey-select" value={selected} onChange={setSelected} options={opts} placeholder="No API Keys" />
              </div>

              {/* Selected card */}
              <div style={CARD} className="p-4">
                {selectedKey ? (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow" style={{ background: 'var(--brand-weak)' }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{selectedKey.name}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Key ending in: {(selectedKey.key || '').slice(-4).toUpperCase()}
                      </div>
                    </div>
                    <button onClick={() => removeKey(selectedKey.id)} className="p-2 rounded-lg hover:bg-black/5 transition" aria-label="Delete">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-muted)' }}>No API Keys Found</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setShowAdd(true)}
                  className="inline-flex items-center gap-2 px-4 h-[44px] rounded-[14px] font-semibold transition hover:-translate-y-[1px]"
                  style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-soft)' }}
                >
                  <Plus className="w-4 h-4" />
                  Add New API Key
                </button>

                <button
                  onClick={testKey}
                  className="flex-1 h-[44px] rounded-[18px] font-semibold flex items-center justify-center gap-2 transition hover:brightness-95"
                  style={BTN}
                >
                  <Zap className="w-4 h-4" />
                  Test API Key
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <AddKeyModal open={showAdd} onClose={() => setShowAdd(false)} onSave={addKey} busy={saving} />
      {toast && <Toast text={toast} onClose={() => setToast(undefined)} />}
    </div>
  );
}

/* Disable SSR to keep all storage strictly client-side */
export default dynamic(() => Promise.resolve(ApiKeysScreen), { ssr: false });
