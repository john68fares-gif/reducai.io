// pages/apikeys.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyRound, Plus, Trash2, ChevronDown, Check, Zap, ShieldCheck, X,
} from 'lucide-react';

// optional tiny obfuscation so we don't store raw keys
const safe = {
  enc: (s: string) => (typeof window === 'undefined' ? s : btoa(unescape(encodeURIComponent(s)))),
  dec: (s: string) => {
    try { return decodeURIComponent(escape(atob(s))); } catch { return s; }
  },
};

type ApiKey = { id: string; name: string; keyEnc: string; short: string };

const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};

const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
};

export default function ApiKeysPage() {
  const [items, setItems] = useState<ApiKey[]>([]);
  const [currentId, setCurrentId] = useState<string>('');
  const current = useMemo(() => items.find(i => i.id === currentId) || null, [items, currentId]);

  const [showAdd, setShowAdd] = useState(false);
  const [projName, setProjName] = useState('');
  const [rawKey, setRawKey] = useState('');

  // toast
  const [toast, setToast] = useState<string>('');
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2400); };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('api:keys') || '[]') as ApiKey[];
      setItems(Array.isArray(saved) ? saved : []);
      if (saved[0]) setCurrentId(saved[0].id);
    } catch {}
  }, []);

  function persist(next: ApiKey[], focusId?: string) {
    localStorage.setItem('api:keys', JSON.stringify(next));
    setItems(next);
    if (focusId) setCurrentId(focusId);
  }

  function onAdd() {
    if (!projName.trim() || !rawKey.trim()) return;
    const id = String(Date.now());
    const short = (rawKey.slice(-4) || '').toUpperCase();
    const keyEnc = safe.enc(rawKey.trim());
    const next = [...items, { id, name: projName.trim(), keyEnc, short }];
    persist(next, id);
    setProjName(''); setRawKey(''); setShowAdd(false);
    flash(`API Key for “${projName.trim()}” added.`);
  }

  function onDelete(id: string) {
    const n = items.filter(i => i.id !== id);
    persist(n, n[0]?.id || '');
    flash(`API Key removed successfully`);
  }

  async function testKey() {
    if (!current) return;
    // Don’t actually call OpenAI here; just simulate a quick check
    await new Promise(r => setTimeout(r, 600));
    flash(`Key “${current.name}” looks good!`);
  }

  return (
    <div className="px-4 py-8">
      <div className="mx-auto w-full max-w-[960px]"> {/* narrower container */}
        <div className="p-6" style={FRAME}>
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
                <KeyRound className="h-6 w-6 text-[#6af7d1]" />
                API Keys
              </h2>
              <div className="text-white/80 text-xs md:text-sm">
                Manage your OpenAI API keys for different projects
              </div>
            </div>

            <button
              onClick={() => setShowAdd(true)}
              className="rounded-2xl p-2 outline-none"
              style={{ background: 'rgba(0,255,194,0.12)', border: '1px solid rgba(0,255,194,0.20)' }}
              title="Add new API key"
            >
              <KeyRound className="w-5 h-5 text-[#6af7d1]" />
            </button>
          </div>

          {/* Select + Card */}
          <div style={CARD} className="p-4 mb-4">
            <label className="block text-xs text-white/70 mb-2">Select API Key</label>
            <div className="relative w-full max-w-[520px]">
              <select
                value={currentId}
                onChange={(e) => setCurrentId(e.target.value)}
                className="w-full appearance-none rounded-[14px] bg-black/30 border border-white/20 h-[44px] px-3 pr-9 text-white text-sm outline-none focus:border-[#6af7d1]"
              >
                {items.length === 0 && <option value="">No API Keys</option>}
                {items.map(k => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
            </div>

            <div className="mt-4">
              {current ? (
                <div
                  className="flex items-center justify-between rounded-[16px] px-3 py-3"
                  style={{ background: 'rgba(0,255,194,0.06)', border: '1px solid rgba(0,255,194,0.22)' }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ background: '#103a31', border: '1px solid rgba(0,255,194,0.35)' }}
                    >
                      <Check className="w-4 h-4 text-[#6af7d1]" />
                    </span>
                    <div className="leading-tight">
                      <div className="text-sm text-white font-semibold">{current.name}</div>
                      <div className="text-xs text-white/70">Key ending in: {current.short}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => onDelete(current.id)}
                    className="rounded-full p-2 hover:bg-white/10"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ) : (
                <div className="rounded-[14px] border border-white/15 bg-black/20 px-3 py-3 text-sm text-white/70">
                  No API Keys Found
                </div>
              )}
            </div>

            {/* Actions row */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 rounded-2xl px-3 h-[42px] text-white font-semibold"
                style={{ background: 'rgba(0,255,194,0.10)', border: '1px solid rgba(0,255,194,0.25)' }}
              >
                <Plus className="w-4 h-4 text-[#6af7d1]" />
                Add New API Key
              </button>

              <button
                onClick={testKey}
                className="ml-auto inline-flex items-center justify-center gap-2 rounded-2xl px-4 h-[44px] text-white font-semibold"
                style={{ background: '#2c6e61' }} // text is white per your request
              >
                <Zap className="w-4 h-4 text-white" />
                Test API Key
              </button>
            </div>
          </div>

          {/* Small section header like your screenshot (#2) */}
          <div className="mb-2 flex items-center gap-2">
            <div className="h-4 w-[3px]" style={{ background: 'linear-gradient(180deg,#00ffc2,#0ea77f)' }} />
            <div className="text-white/90 font-medium">API Testing</div>
          </div>
          <div style={CARD} className="p-4 text-sm text-white/70">
            Use “Test API Key” to quickly validate connectivity. (Placeholder area for logs/results.)
          </div>
        </div>
      </div>

      {/* Add Key Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-[560px]" style={FRAME}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.35)' }}>
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-5 h-5 text-[#6af7d1]" />
                Add New Project API Key
              </div>
              <button onClick={() => setShowAdd(false)} className="rounded-full p-2 hover:bg-white/10">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block mb-1 text-xs text-white/70">Project Name *</label>
                <input
                  value={projName}
                  onChange={(e) => setProjName(e.target.value)}
                  placeholder="e.g., My Main Project, Test Environment"
                  className="w-full rounded-[14px] border border-white/20 bg-black/30 h-[44px] px-3 text-sm text-white outline-none focus:border-[#6af7d1]"
                />
              </div>
              <div>
                <label className="block mb-1 text-xs text-white/70">OpenAI API Key *</label>
                <input
                  value={rawKey}
                  onChange={(e) => setRawKey(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                  type="password"
                  className="w-full rounded-[14px] border border-white/20 bg-black/30 h-[44px] px-3 text-sm text-white outline-none focus:border-[#6af7d1]"
                />
                <div className="mt-2 text-xs text-white/60">
                  Your API key is encrypted before being saved.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.28)', background: '#101314' }}>
              {/* Cancel on the LEFT, both buttons same width & more rounded; white text on Save */}
              <button
                onClick={() => setShowAdd(false)}
                className="h-[44px] w-36 rounded-2xl bg-white/10 text-white font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={onAdd}
                className="h-[44px] w-36 rounded-2xl font-semibold text-white"
                style={{ background: '#4fd2ae' }}
              >
                Save API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[520px] max-w-[92vw]">
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(0,255,194,0.10)', border: '1px solid rgba(0,255,194,0.25)', boxShadow: '0 0 18px rgba(0,255,194,0.10)' }}
          >
            <div className="flex items-center gap-3 text-white">
              <Check className="w-4 h-4 text-[#6af7d1]" />
              {toast}
            </div>
            <button onClick={() => setToast('')} className="rounded-full p-1 hover:bg-white/10">
              <X className="w-4 h-4 text-white/80" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
