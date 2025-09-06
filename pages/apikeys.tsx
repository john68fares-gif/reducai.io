// pages/api-keys.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import {
  KeyRound,
  Plus,
  Trash2,
  ShieldCheck,
  Loader2,
  X,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { scopedStorage } from '@/utils/scoped-storage';

/* ------------------------------ Types / keys ------------------------------ */
type StoredKey = {
  id: string;
  name: string;
  keyTail: string;        // last 4 chars only (for display / dedupe)
  org?: string | null;    // if OpenAI returns an org header / id
  createdAt: number;
};

const STORE_KEY = 'apiKeys';            // per-user via scopedStorage()
const SELECTED_KEY = 'apiKeys:selected'; // per-user via scopedStorage()

/* ------------------------------ Design tokens ----------------------------- */
const FRAME_STYLE: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 24,
  boxShadow:
    '0 1px 0 rgba(0,0,0,0.08), 0 8px 22px rgba(0,0,0,0.12), 0 0 180px 30px rgba(0,255,194,0.06)',
};
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  boxShadow: 'var(--shadow-card)',
};

const BTN_GREEN = '#2bbf9c';
const BTN_GREEN_HOVER = '#25b191';
const BTN_GREEN_DARK = '#1fa584';

/* -------------------------------- Helpers -------------------------------- */
const isBrowser = typeof window !== 'undefined';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const tail4 = (s: string) => (s || '').slice(-4).toUpperCase();
const looksLikeOpenAI = (s: string) => /^sk-[-_A-Za-z0-9]{20,}$/.test(s.trim());

/** Call OpenAI `/v1/models` to verify the key actually works. */
async function verifyOpenAIKey(apiKey: string): Promise<{ ok: boolean; org?: string | null; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      // Some deployments include org info in headers (not guaranteed)
      const org =
        res.headers.get('openai-organization') ||
        res.headers.get('x-openai-organization') ||
        null;
      return { ok: true, org };
    }
    const text = await res.text();
    return { ok: false, error: `OpenAI error ${res.status}: ${text}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

/* ------------------------------ Modal (Add) ------------------------------- */
function AddKeyModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, apiKey: string, org?: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [raw, setRaw] = useState('');
  const [checking, setChecking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setRaw('');
      setErr(null);
      setChecking(false);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = name.trim().length > 1 && looksLikeOpenAI(raw);

  async function handleSave() {
    if (!canSubmit || checking) return;
    setChecking(true);
    setErr(null);

    // Small UX delay so the spinner feels intentional
    await wait(250);

    // Validate with OpenAI
    const check = await verifyOpenAIKey(raw.trim());
    if (!check.ok) {
      setChecking(false);
      setErr(
        check.error ||
          'Could not validate this API key. Make sure it is active and belongs to your OpenAI account.',
      );
      return;
    }

    onSave(name.trim(), raw.trim(), check.org ?? null);
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(2px)' }}>
      <div
        className="w-full max-w-[680px] animate-[modalIn_180ms_ease-out]"
        style={{
          ...FRAME_STYLE,
          borderRadius: 28,
          boxShadow:
            '0 8px 32px rgba(0,0,0,0.28), 0 0 90px rgba(0,255,194,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5"
             style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl grid place-items-center"
                 style={{ background: 'var(--brand-weak)' }}>
              <KeyRound className="w-6 h-6" style={{ color: 'var(--brand)' }} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Add New Project API Key
              </h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Provide a project name and your OpenAI API key. It’s validated and stored per-account.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:opacity-80">
            <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              Project Name <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Main Project, Test Environment"
              className="w-full h-11 rounded-[14px] px-3 outline-none"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
              OpenAI API Key <span style={{ color: 'var(--brand)' }}>*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full h-11 rounded-[14px] pl-10 pr-3 outline-none"
                style={{
                  background: 'var(--card)',
                  border: `1px solid ${err ? 'crimson' : 'var(--border)'}`,
                  color: 'var(--text)',
                }}
              />
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="mt-2 text-xs flex items-center gap-2"
                 style={{ color: err ? 'crimson' : 'var(--text-muted)' }}>
              {err ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
              )}
              {err ? err : 'Your key is verified against OpenAI before being saved.'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="w-full h-11 rounded-[16px] font-semibold"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            disabled={!canSubmit || checking}
            onClick={handleSave}
            className="w-full h-11 rounded-[16px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: BTN_GREEN_DARK, color: '#fff' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_DARK)}
          >
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {checking ? 'Verifying…' : 'Save API Key'}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes modalIn { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </div>
  );
}

/* --------------------------------- Screen --------------------------------- */
function ApiKeysScreen() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<StoredKey[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [open, setOpen] = useState(false);

  // Load from scoped storage
  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      const saved = await ss.getJSON<StoredKey[]>(STORE_KEY, []);
      setList(Array.isArray(saved) ? saved : []);
      const sel = await ss.getJSON<string | null>(SELECTED_KEY, null);
      if (sel && saved.find((k) => k.id === sel)) setSelected(sel);
      setLoading(false);
    })();
  }, []);

  // Persist selection
  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      if (selected) await ss.setJSON(SELECTED_KEY, selected);
    })();
  }, [selected]);

  function addKey(name: string, apiKey: string, org?: string | null) {
    const tail = tail4(apiKey);
    // Prevent duplicates for this user (same tail + same org if present)
    if (list.some((k) => k.keyTail === tail && (k.org || null) === (org || null))) {
      alert('This API key (or an identical one) is already saved.');
      return;
    }
    const newKey: StoredKey = {
      id: String(Date.now()),
      name,
      keyTail: tail,
      org: org || null,
      createdAt: Date.now(),
    };
    (async () => {
      const ss = await scopedStorage();
      const next = [newKey, ...list];
      await ss.setJSON(STORE_KEY, next);
      setList(next);
      setSelected(newKey.id);
      setOpen(false);
    })();
  }

  function removeKey(id: string) {
    (async () => {
      const ss = await scopedStorage();
      const next = list.filter((k) => k.id !== id);
      await ss.setJSON(STORE_KEY, next);
      setList(next);
      if (selected === id) setSelected(next[0]?.id || '');
    })();
  }

  const selectedKey = useMemo(() => list.find((k) => k.id === selected) || null, [list, selected]);

  return (
    <>
      <Head><title>API Keys</title></Head>

      <div className="min-h-screen w-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* Header w/ single frame card */}
          <div className="mx-auto" style={FRAME_STYLE}>
            <div className="flex items-center justify-between px-6 py-5">
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold">API Keys</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Manage your OpenAI API keys for different projects
                </p>
              </div>
              <button
                onClick={() => setOpen(true)}
                className="w-10 h-10 rounded-2xl grid place-items-center"
                style={{ background: 'var(--brand-weak)' }}
                title="Add New API Key"
              >
                <KeyRound className="w-5 h-5" style={{ color: 'var(--brand)' }} />
              </button>
            </div>

            {/* Body card */}
            <div className="px-6 pb-6">
              <div style={{ ...CARD_STYLE, padding: '20px' }}>
                {/* Loading state */}
                {loading ? (
                  <div className="grid place-items-center py-16">
                    <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>
                      Loading your keys…
                    </div>
                  </div>
                ) : list.length === 0 ? (
                  // Empty state (single inner content, not another frame)
                  <div className="grid place-items-center text-center py-16 relative">
                    <div
                      className="absolute inset-x-10 bottom-4 h-28 blur-3xl rounded-full opacity-70"
                      style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,194,0.10), transparent 70%)' }}
                    />
                    <div className="w-14 h-14 rounded-full grid place-items-center mb-4 border border-dashed"
                         style={{ borderColor: 'var(--border)' }}>
                      <KeyRound className="w-6 h-6" style={{ color: 'var(--brand)' }} />
                    </div>
                    <div className="font-semibold">No API Keys Found</div>
                    <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      Add your first API key to get started
                    </div>
                    <button
                      onClick={() => setOpen(true)}
                      className="mt-5 inline-flex items-center gap-2 px-4 h-10 rounded-[16px] font-semibold"
                      style={{ background: BTN_GREEN, color: '#fff' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
                    >
                      <Plus className="w-4 h-4" />
                      Add New API Key
                    </button>
                  </div>
                ) : (
                  // List & selection
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {list.map((k) => (
                        <button
                          key={k.id}
                          onClick={() => setSelected(k.id)}
                          className={`text-left p-4 rounded-[14px] transition-all ${
                            selected === k.id ? 'ring-2' : 'ring-0'
                          } hover:-translate-y-[1px]`}
                          style={{
                            ...CARD_STYLE,
                            boxShadow: selected === k.id ? '0 0 0 2px var(--brand-weak) inset, var(--shadow-card)' : CARD_STYLE.boxShadow,
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl grid place-items-center"
                                 style={{ background: 'var(--brand-weak)' }}>
                              <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--brand)' }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{k.name}</div>
                              <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                Key ending in {k.keyTail}
                                {k.org ? ` • Org ${k.org}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeKey(k.id);
                              }}
                              className="p-2 rounded-md hover:opacity-80"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Selected summary */}
                    {selectedKey && (
                      <div className="p-4 rounded-[14px]" style={CARD_STYLE}>
                        <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          Selected: <span style={{ color: 'var(--text)' }}>{selectedKey.name}</span> (…{selectedKey.keyTail})
                          {selectedKey.org ? ` — Org ${selectedKey.org}` : ''}
                        </div>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => setOpen(true)}
                        className="inline-flex items-center gap-2 px-4 h-10 rounded-[16px] font-semibold"
                        style={{ background: BTN_GREEN_DARK, color: '#fff' }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_DARK)}
                      >
                        <Plus className="w-4 h-4" />
                        Add New API Key
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <AddKeyModal open={open} onClose={() => setOpen(false)} onSave={addKey} />
      </div>
    </>
  );
}

/* Export without SSR to keep storage purely client-side */
export default dynamic(() => Promise.resolve(ApiKeysScreen), { ssr: false });
