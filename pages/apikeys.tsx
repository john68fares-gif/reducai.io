// pages/apikeys.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyRound, Plus, Trash2, ChevronDown, CheckCircle2, Zap, X, Lock
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types + LocalStorage helpers                                       */
/* ------------------------------------------------------------------ */
type KeyRecord = {
  id: string;
  name: string;
  key: string;      // stored locally in-browser (no server)
  createdAt: number;
};

const LS_KEYS = 'apiKeys:v1';
const LS_ACTIVE = 'apiKeys:activeId';

function loadKeys(): KeyRecord[] {
  try {
    const raw = localStorage.getItem(LS_KEYS);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveKeys(list: KeyRecord[]) {
  try { localStorage.setItem(LS_KEYS, JSON.stringify(list)); } catch {}
}
function loadActiveId(): string | null {
  try { return localStorage.getItem(LS_ACTIVE); } catch { return null; }
}
function saveActiveId(id: string) {
  try { localStorage.setItem(LS_ACTIVE, id); } catch {}
}
const last4 = (k: string) => (k || '').slice(-4).toUpperCase();

/* ------------------------------------------------------------------ */
/*  Look & feel (consistent with your Voice/Prompt UI)                 */
/* ------------------------------------------------------------------ */
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
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
function GreenButton({
  children, onClick, disabled, className
}: { children: React.ReactNode; onClick?: ()=>void; disabled?: boolean; className?: string; }) {
  const [hover, setHover] = useState(false);
  const bg = disabled ? '#2e6f63' : (hover ? BTN_GREEN_HOVER : BTN_GREEN);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      className={`inline-flex items-center justify-center gap-2 px-4 h-[46px] rounded-[14px] font-semibold select-none disabled:cursor-not-allowed ${className||''}`}
      style={{ background: bg, color: '#0b0c10', boxShadow: disabled ? 'none' : '0 1px 0 rgba(0,0,0,0.18)' }}
    >
      {children}
    </button>
  );
}

function Toast({ text, onClose }: { text: string; onClose: ()=>void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-2xl flex items-center gap-3"
         style={{ background:'rgba(0,120,90,0.18)', border:'1px solid rgba(0,255,194,0.35)', boxShadow:'0 0 22px rgba(0,255,194,0.10)' }}>
      <CheckCircle2 className="w-5 h-5 text-[#6af7d1]" />
      <div className="text-sm text-white">{text}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */
function AddKeyModal({
  open, onClose, onSave
}: {
  open: boolean;
  onClose: ()=>void;
  onSave: (name: string, key: string)=>void;
}) {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const nameRef = useRef<HTMLInputElement|null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(()=>nameRef.current?.focus(), 50);
    } else {
      setName(''); setKey('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.45)' }}>
      <div className="w-full max-w-[560px] rounded-[22px] overflow-hidden" style={CARD}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'#143d36', border:'1px solid rgba(0,255,194,0.28)' }}>
              <KeyRound className="w-5 h-5 text-[#6af7d1]" />
            </div>
            <div className="text-white font-semibold">Add New Project API Key</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="text-xs text-white/70 mb-1">Project Name <span className="text-red-400">*</span></div>
            <input
              ref={nameRef}
              value={name}
              onChange={(e)=>setName(e.target.value)}
              placeholder="e.g. My Main Project, Test Environment"
              className="w-full rounded-[12px] bg-black/30 border border-white/20 px-3 py-2.5 outline-none text-white focus:border-[#6af7d1]"
            />
          </div>
          <div>
            <div className="text-xs text-white/70 mb-1">OpenAI API Key <span className="text-red-400">*</span></div>
            <input
              value={key}
              onChange={(e)=>setKey(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
              type="password"
              className="w-full rounded-[12px] bg-black/30 border border-white/20 px-3 py-2.5 outline-none text-white focus:border-[#6af7d1]"
            />
            <div className="mt-2 text-xs text-white/60 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" /> Your API key is stored in your browser (localStorage).
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/15 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-[40px] rounded-[12px] text-white bg-white/10 hover:bg-white/15">Cancel</button>
          <GreenButton
            onClick={() => { if (name.trim() && key.trim()) { onSave(name.trim(), key.trim()); onClose(); } }}
          >
            <KeyRound className="w-4 h-4" /> Save API Key
          </GreenButton>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function ApiKeysPage() {
  const [list, setList] = useState<KeyRecord[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [openSelect, setOpenSelect] = useState(false);

  useEffect(() => {
    const l = loadKeys();
    const a = loadActiveId();
    setList(l);
    if (a && l.some(k => k.id === a)) setActiveId(a);
    else if (l[0]) setActiveId(l[0].id);
  }, []);

  const active = useMemo(() => list.find(k => k.id === activeId) || null, [list, activeId]);

  function addKey(name: string, key: string) {
    const rec: KeyRecord = { id: String(Date.now()), name, key, createdAt: Date.now() };
    const next = [...list, rec];
    setList(next); saveKeys(next);
    setActiveId(rec.id); saveActiveId(rec.id);
    setToast(`API Key saved for “${name}”.`);
  }

  function removeActive() {
    if (!active) return;
    const next = list.filter(k => k.id !== active.id);
    setList(next); saveKeys(next);
    const nextActive = next[0]?.id || null;
    setActiveId(nextActive);
    if (nextActive) saveActiveId(nextActive); else localStorage.removeItem(LS_ACTIVE);
    setToast(`API Key for “${active.name}” removed successfully`);
  }

  function testKey() {
    if (!active) return;
    // Browser calls to OpenAI are typically blocked by CORS.
    // So we do a quick local sanity check and show a toast.
    const ok = /^sk-[A-Za-z0-9]{20,}$/.test(active.key);
    setToast(ok ? 'API key looks valid (format check).' : 'Key format doesn’t look right.');
  }

  return (
    <div className="p-6 md:p-8" style={{ ...FRAME, maxWidth: 980, margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <KeyRound className="h-6 w-6 text-[#6af7d1]" />
            API Keys
          </h2>
          <div className="text-white/80 text-xs md:text-sm">Manage your OpenAI API keys for different projects</div>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{ background:'#143d36', border:'1px solid rgba(0,255,194,0.28)' }}>
          <KeyRound className="w-5 h-5 text-[#6af7d1]" />
        </div>
      </div>

      {/* Select */}
      <div style={CARD} className="p-5 mb-5">
        <div className="text-sm text-white/85 mb-2">Select API Key</div>
        {/* custom dropdown but lightweight */}
        <div className="relative w-full max-w-xl">
          <button
            type="button"
            onClick={() => setOpenSelect(v=>!v)}
            className="w-full flex items-center justify-between gap-3 px-3 h-[44px] rounded-[14px] text-sm outline-none transition"
            style={{ background:'rgba(0,0,0,0.30)', border:'1px solid rgba(255,255,255,0.20)', color:'white' }}
          >
            <span className="truncate flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#6af7d1]" />
              {active ? active.name : 'No API Keys'}
              {active && <span className="text-white/60 ml-2">{last4(active.key)}</span>}
            </span>
            <ChevronDown className="w-4 h-4 opacity-80" />
          </button>

          {openSelect && (
            <div
              className="absolute z-[999] mt-2 w-full rounded-[14px] p-2"
              style={{ ...CARD, boxShadow:'0 0 18px rgba(0,0,0,0.35)' }}
            >
              {list.map((k) => {
                const isActive = k.id === activeId;
                return (
                  <button
                    key={k.id}
                    onClick={() => { setActiveId(k.id); saveActiveId(k.id); setOpenSelect(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left text-white hover:bg-white/5"
                    style={{ border: isActive ? '1px solid rgba(0,255,194,0.35)' : '1px solid transparent' }}
                  >
                    <KeyRound className="w-4 h-4 text-[#6af7d1]" />
                    <span className="flex-1 truncate">{k.name}</span>
                    <span className="text-white/60">{last4(k.key)}</span>
                    {isActive && <CheckCircle2 className="w-4 h-4 text-[#6af7d1]" />}
                  </button>
                );
              })}
              {list.length === 0 && (
                <div className="px-3 py-2 text-sm text-white/70">No API keys yet.</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Active card */}
      <div style={CARD} className="p-5 mb-5">
        {active ? (
          <div className="flex items-start md:items-center gap-3 md:gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                 style={{ background:'#143d36', border:'1px solid rgba(0,255,194,0.28)' }}>
              <CheckCircle2 className="w-5 h-5 text-[#6af7d1]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold">{active.name}</div>
              <div className="text-white/70 text-sm">Key ending in: {last4(active.key)}</div>
            </div>
            <button
              onClick={removeActive}
              className="p-2 rounded-lg hover:bg-red-500/15 border border-red-400/40"
              aria-label="Delete"
              title="Delete this key"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ) : (
          <div className="text-white/80">No API Keys Found</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={()=>setAdding(true)}
          className="inline-flex items-center gap-2 px-4 h-[46px] rounded-[14px] font-semibold text-white"
          style={{ background:'rgba(0,0,0,0.35)', border:'1px solid rgba(255,255,255,0.20)' }}
        >
          <Plus className="w-4 h-4 text-white" /> Add New API Key
        </button>

        <GreenButton onClick={testKey} disabled={!active} className="flex-1 md:flex-none md:w-[320px]">
          <Zap className="w-4 h-4" /> Test API Key
        </GreenButton>
      </div>

      {/* Modals & toasts */}
      <AddKeyModal open={adding} onClose={()=>setAdding(false)} onSave={addKey} />
      {toast && <Toast text={toast} onClose={()=>setToast(null)} />}
    </div>
  );
}
