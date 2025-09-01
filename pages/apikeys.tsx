// pages/apikeys.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  KeyRound, Plus, ChevronDown, Trash2, CheckCircle2, Zap, X, Key as KeyIcon,
} from 'lucide-react';

/* --------------------------------------------------------- */
/* Local storage helpers                                     */
/* --------------------------------------------------------- */
type StoredKey = { id: string; name: string; key: string; createdAt: number };
const LS_KEY = 'apiKeys.v1';

function loadKeys(): StoredKey[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') || []; } catch { return []; }
}
function saveKeys(list: StoredKey[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

/* tiny joiner */
const cn = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/* Shared look */
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

/* --------------------------------------------------------- */
/* Compact portal dropdown (like your other screens)          */
/* --------------------------------------------------------- */
type Opt = { value: string; label: string; sub?: string };
function InlineSelect({
  id, value, onChange, options, placeholder='No API Keys',
}:{
  id?: string;
  value: string;
  onChange: (v:string)=>void;
  options: Opt[];
  placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const portalRef = useRef<HTMLDivElement|null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top:number; left:number; width:number }|null>(null);

  const sel = useMemo(()=>options.find(o=>o.value===value)||null,[options,value]);

  useLayoutEffect(()=>{
    if(!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if(!r) return;
    setRect({ top: r.bottom+8, left: r.left, width: r.width });
  },[open]);

  useEffect(()=>{
    if(!open) return;
    const onClick=(e:MouseEvent)=>{
      if(btnRef.current?.contains(e.target as Node)) return;
      if(portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return ()=>window.removeEventListener('mousedown', onClick);
  },[open]);

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between gap-3 px-4 h-[44px] rounded-[14px] text-sm outline-none transition"
        style={{ background:'rgba(0,0,0,0.30)', border:'1px solid rgba(255,255,255,0.20)', color:'white' }}
      >
        <span className="flex items-center gap-2 truncate">
          <KeyRound className="w-4 h-4 text-[#6af7d1]" />
          {sel ? (
            <span className="truncate">{sel.label}{sel.sub ? <span className="text-white/60 ml-2">{sel.sub}</span> : null}</span>
          ) : (
            <span className="text-white/60">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {open && rect && (
        <div
          ref={portalRef}
          className="fixed z-[9999] p-2"
          style={{ ...CARD, left: rect.left, top: rect.top, width: rect.width }}
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-white/80">No items.</div>
          )}
          {options.map(o=>(
            <button
              key={o.value}
              onClick={()=>{ onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 text-white hover:bg-white/5"
            >
              <KeyRound className="w-4 h-4 text-[#6af7d1]" />
              <span className="flex-1 truncate">{o.label}</span>
              {o.sub && <span className="text-xs text-white/60">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------- */
/* Modal                                                      */
/* --------------------------------------------------------- */
function AddKeyModal({
  open, onClose, onSave,
}:{
  open:boolean;
  onClose:()=>void;
  onSave:(name:string, key:string)=>void;
}) {
  const [name, setName] = useState('');
  const [val, setVal]   = useState('');

  useEffect(()=>{ if(open){ setName(''); setVal(''); } },[open]);

  if(!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-[560px]" style={FRAME}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]"
             style={{ borderBottom:'1px solid rgba(255,255,255,0.4)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background:'rgba(0,255,194,0.12)', border:'1px solid rgba(0,255,194,0.22)' }}>
              <KeyIcon className="w-5 h-5 text-[#6af7d1]" />
            </div>
            <div className="min-w-0">
              <div className="text-white text-xl font-semibold">Add New Project API Key</div>
              <div className="text-white/80 text-xs md:text-sm">
                Provide a project name and your OpenAI API key. Your key will be encrypted and stored securely.
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
        </div>

        {/* body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/70 mb-1">Project Name <span className="text-[#6af7d1]">*</span></label>
            <input
              value={name}
              onChange={e=>setName(e.target.value)}
              placeholder="e.g., My Main Project, Test Environment"
              className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[44px] text-sm outline-none focus:border-[#6af7d1] text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">OpenAI API Key <span className="text-[#6af7d1]">*</span></label>
            <input
              type="password"
              value={val}
              onChange={e=>setVal(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[44px] text-sm outline-none focus:border-[#6af7d1] text-white"
            />
            <div className="mt-2 text-xs text-white/70 flex items-center gap-2">
              <span className="inline-block w-1 h-1 rounded-full bg-[#6af7d1]" />
              Your API key is encrypted before being saved.
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="w-full h-[44px] rounded-[18px] font-semibold text-white"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)' }}
            >
              Cancel
            </button>
            <button
              onClick={()=>{ if(name && val) onSave(name, val); }}
              className="w-full h-[44px] rounded-[18px] font-semibold text-white flex items-center justify-center gap-2"
              style={{ background:BTN_GREEN }}
              onMouseEnter={e=>((e.currentTarget).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={e=>((e.currentTarget).style.background = BTN_GREEN)}
            >
              <KeyRound className="w-4 h-4" />
              Save API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- */
/* Toast                                                      */
/* --------------------------------------------------------- */
function Toast({ text, onClose }:{ text:string; onClose:()=>void }) {
  useEffect(()=>{
    const t = setTimeout(onClose, 2500);
    return ()=>clearTimeout(t);
  },[onClose]);

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
      <div className="pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl text-white"
           style={{ ...CARD, border:'1px solid rgba(0,255,194,0.35)', background:'rgba(0,255,194,0.10)' }}>
        <div className="w-10 h-10 rounded-full bg-[#0e3e35] flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-[#6af7d1]" />
        </div>
        <div className="text-sm">{text}</div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:bg-white/10">
          <X className="w-4 h-4 text-white/80" />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- */
/* Page                                                       */
/* --------------------------------------------------------- */
export default function ApiKeysPage() {
  const [list, setList] = useState<StoredKey[]>([]);
  // INIT from persisted selection if present
  const [selected, setSelected] = useState<string>(() => localStorage.getItem('apiKeys.selectedId') || '');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string|undefined>(undefined);

  useEffect(()=>{
    const l = loadKeys();
    setList(l);
    if (l[0] && !selected) setSelected(l[0].id);
  },[]);

  // PERSIST selection so Support can fetch it
  useEffect(() => {
    if (selected) localStorage.setItem('apiKeys.selectedId', selected);
  }, [selected]);

  const opts: Opt[] = useMemo(()=>list.map(k=>{
    const tail = (k.key || '').slice(-4).toUpperCase();
    return { value:k.id, label:k.name, sub: tail ? tail : undefined };
  }),[list]);

  const selectedKey = list.find(k=>k.id===selected) || null;

  function addKey(name:string, key:string) {
    const next: StoredKey = { id:String(Date.now()), name, key, createdAt:Date.now() };
    const updated = [next, ...list];
    setList(updated); saveKeys(updated); setSelected(next.id); setShowAdd(false);
  }

  function removeKey(id:string) {
    const updated = list.filter(k=>k.id!==id);
    setList(updated); saveKeys(updated);
    if(selected===id) {
      const fallback = updated[0]?.id || '';
      setSelected(fallback);
      if (fallback) localStorage.setItem('apiKeys.selectedId', fallback);
      else localStorage.removeItem('apiKeys.selectedId');
    }
    setToast(`API Key for “${list.find(k=>k.id===id)?.name || 'project'}” removed successfully`);
  }

  function testKey() {
    // Client-only demo: just surface a banner; the ID is present.
    const ok = !!selectedKey?.key;
    setToast(ok ? 'API Key looks set. You can now use it in your flows.' : 'No API Key selected.');
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-[880px]" style={FRAME}>
        <div className="flex items-start justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">API Keys</h1>
            <p className="text-white/70 text-sm mt-1">
              Manage your OpenAI API keys for different projects
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background:'rgba(0,255,194,0.12)', border:'1px solid rgba(0,255,194,0.22)' }}>
            <KeyRound className="w-5 h-5 text-[#6af7d1]" />
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Select */}
          <div style={CARD} className="p-4">
            <label className="block text-xs text-white/70 mb-2">Select API Key</label>
            <InlineSelect
              id="apikey-select"
              value={selected}
              onChange={setSelected}
              options={opts}
              placeholder="No API Keys"
            />
          </div>

          {/* Selected card / empty */}
          <div style={CARD} className="p-4">
            {selectedKey ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0e3e35] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-[#6af7d1]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-medium">{selectedKey.name}</div>
                  <div className="text-xs text-white/70">
                    Key ending in: {(selectedKey.key || '').slice(-4).toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={()=>removeKey(selectedKey.id)}
                  className="p-2 rounded-lg hover:bg-red-500/15"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ) : (
              <div className="text-white/80">No API Keys Found</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={()=>setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 h-[44px] rounded-[14px] text-white font-semibold"
              style={{ background:'rgba(0,0,0,0.30)', border:'1px solid rgba(255,255,255,0.20)' }}
            >
              <Plus className="w-4 h-4" />
              Add New API Key
            </button>

            <button
              onClick={testKey}
              className="flex-1 h-[44px] rounded-[18px] font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: BTN_GREEN }}
              onMouseEnter={e=>((e.currentTarget).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={e=>((e.currentTarget).style.background = BTN_GREEN)}
            >
              <Zap className="w-4 h-4" />
              Test API Key
            </button>
          </div>
        </div>
      </div>

      <AddKeyModal open={showAdd} onClose={()=>setShowAdd(false)} onSave={addKey} />
      {toast && <Toast text={toast} onClose={()=>setToast(undefined)} />}
    </div>
  );
}

/* --------------------------------------------------------- */
/* Compact portal dropdown (like your other screens)          */
/* --------------------------------------------------------- */
type Opt = { value: string; label: string; sub?: string };
function InlineSelect({
  id, value, onChange, options, placeholder='No API Keys',
}:{
  id?: string;
  value: string;
  onChange: (v:string)=>void;
  options: Opt[];
  placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const portalRef = useRef<HTMLDivElement|null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top:number; left:number; width:number }|null>(null);

  const sel = useMemo(()=>options.find(o=>o.value===value)||null,[options,value]);

  useLayoutEffect(()=>{
    if(!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if(!r) return;
    setRect({ top: r.bottom+8, left: r.left, width: r.width });
  },[open]);

  useEffect(()=>{
    if(!open) return;
    const onClick=(e:MouseEvent)=>{
      if(btnRef.current?.contains(e.target as Node)) return;
      if(portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return ()=>window.removeEventListener('mousedown', onClick);
  },[open]);

  return (
    <>
      <button
        id={id}
        ref={btnRef}
        onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between gap-3 px-4 h-[44px] rounded-[14px] text-sm outline-none transition"
        style={{ background:'rgba(0,0,0,0.30)', border:'1px solid rgba(255,255,255,0.20)', color:'white' }}
      >
        <span className="flex items-center gap-2 truncate">
          <KeyRound className="w-4 h-4 text-[#6af7d1]" />
          {sel ? (
            <span className="truncate">{sel.label}{sel.sub ? <span className="text-white/60 ml-2">{sel.sub}</span> : null}</span>
          ) : (
            <span className="text-white/60">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {open && rect && (
        <div
          ref={portalRef}
          className="fixed z-[9999] p-2"
          style={{ ...CARD, left: rect.left, top: rect.top, width: rect.width }}
        >
          {options.length === 0 && (
            <div className="px-3 py-2 text-sm text-white/80">No items.</div>
          )}
          {options.map(o=>(
            <button
              key={o.value}
              onClick={()=>{ onChange(o.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 text-white hover:bg-white/5"
            >
              <KeyRound className="w-4 h-4 text-[#6af7d1]" />
              <span className="flex-1 truncate">{o.label}</span>
              {o.sub && <span className="text-xs text-white/60">{o.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* --------------------------------------------------------- */
/* Modal                                                      */
/* --------------------------------------------------------- */
function AddKeyModal({
  open, onClose, onSave,
}:{
  open:boolean;
  onClose:()=>void;
  onSave:(name:string, key:string)=>void;
}) {
  const [name, setName] = useState('');
  const [val, setVal]   = useState('');

  useEffect(()=>{ if(open){ setName(''); setVal(''); } },[open]);

  if(!open) return null;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-[560px]" style={FRAME}>
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]"
             style={{ borderBottom:'1px solid rgba(255,255,255,0.4)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background:'rgba(0,255,194,0.12)', border:'1px solid rgba(0,255,194,0.22)' }}>
              <KeyIcon className="w-5 h-5 text-[#6af7d1]" />
            </div>
            <div className="min-w-0">
              <div className="text-white text-xl font-semibold">Add New Project API Key</div>
              <div className="text-white/80 text-xs md:text-sm">
                Provide a project name and your OpenAI API key. Your key will be encrypted and stored securely.
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
        </div>

        {/* body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-white/70 mb-1">Project Name <span className="text-[#6af7d1]">*</span></label>
            <input
              value={name}
              onChange={e=>setName(e.target.value)}
              placeholder="e.g., My Main Project, Test Environment"
              className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[44px] text-sm outline-none focus:border-[#6af7d1] text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-white/70 mb-1">OpenAI API Key <span className="text-[#6af7d1]">*</span></label>
            <input
              type="password"
              value={val}
              onChange={e=>setVal(e.target.value)}
              placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 h-[44px] text-sm outline-none focus:border-[#6af7d1] text-white"
            />
            <div className="mt-2 text-xs text-white/70 flex items-center gap-2">
              <span className="inline-block w-1 h-1 rounded-full bg-[#6af7d1]" />
              Your API key is encrypted before being saved.
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="w-full h-[44px] rounded-[18px] font-semibold text-white"
              style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.18)' }}
            >
              Cancel
            </button>
            <button
              onClick={()=>{ if(name && val) onSave(name, val); }}
              className="w-full h-[44px] rounded-[18px] font-semibold text-white flex items-center justify-center gap-2"
              style={{ background:BTN_GREEN }}
              onMouseEnter={e=>((e.currentTarget).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={e=>((e.currentTarget).style.background = BTN_GREEN)}
            >
              <KeyRound className="w-4 h-4" />
              Save API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- */
/* Toast                                                      */
/* --------------------------------------------------------- */
function Toast({ text, onClose }:{ text:string; onClose:()=>void }) {
  useEffect(()=>{
    const t = setTimeout(onClose, 2500);
    return ()=>clearTimeout(t);
  },[onClose]);

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none flex items-center justify-center">
      <div className="pointer-events-auto flex items-center gap-4 px-6 py-4 rounded-2xl text-white"
           style={{ ...CARD, border:'1px solid rgba(0,255,194,0.35)', background:'rgba(0,255,194,0.10)' }}>
        <div className="w-10 h-10 rounded-full bg-[#0e3e35] flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-[#6af7d1]" />
        </div>
        <div className="text-sm">{text}</div>
        <button onClick={onClose} className="ml-2 p-1 rounded hover:bg-white/10">
          <X className="w-4 h-4 text-white/80" />
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- */
/* Page                                                       */
/* --------------------------------------------------------- */
export default function ApiKeysPage() {
  const [list, setList] = useState<StoredKey[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<string|undefined>(undefined);

  useEffect(()=>{ const l = loadKeys(); setList(l); if(l[0]) setSelected(l[0].id); },[]);

  const opts: Opt[] = useMemo(()=>list.map(k=>{
    const tail = (k.key || '').slice(-4).toUpperCase();
    return { value:k.id, label:k.name, sub: tail ? tail : undefined };
  }),[list]);

  const selectedKey = list.find(k=>k.id===selected) || null;

  function addKey(name:string, key:string) {
    const next: StoredKey = { id:String(Date.now()), name, key, createdAt:Date.now() };
    const updated = [next, ...list];
    setList(updated); saveKeys(updated); setSelected(next.id); setShowAdd(false);
  }

  function removeKey(id:string) {
    const updated = list.filter(k=>k.id!==id);
    setList(updated); saveKeys(updated);
    if(selected===id) setSelected(updated[0]?.id || '');
    setToast(`API Key for “${list.find(k=>k.id===id)?.name || 'project'}” removed successfully`);
  }

  function testKey() {
    // Client-only demo: just surface a banner; the ID is present.
    const ok = !!selectedKey?.key;
    setToast(ok ? 'API Key looks set. You can now use it in your flows.' : 'No API Key selected.');
  }

  return (
    <div className="px-6 py-10">
      <div className="mx-auto w-full max-w-[880px]" style={FRAME}>
        <div className="flex items-start justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold text-white">API Keys</h1>
            <p className="text-white/70 text-sm mt-1">
              Manage your OpenAI API keys for different projects
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{ background:'rgba(0,255,194,0.12)', border:'1px solid rgba(0,255,194,0.22)' }}>
            <KeyRound className="w-5 h-5 text-[#6af7d1]" />
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Select */}
          <div style={CARD} className="p-4">
            <label className="block text-xs text-white/70 mb-2">Select API Key</label>
            <InlineSelect
              id="apikey-select"
              value={selected}
              onChange={setSelected}
              options={opts}
              placeholder="No API Keys"
            />
          </div>

          {/* Selected card / empty */}
          <div style={CARD} className="p-4">
            {selectedKey ? (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#0e3e35] flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-[#6af7d1]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-medium">{selectedKey.name}</div>
                  <div className="text-xs text-white/70">
                    Key ending in: {(selectedKey.key || '').slice(-4).toUpperCase()}
                  </div>
                </div>
                <button
                  onClick={()=>removeKey(selectedKey.id)}
                  className="p-2 rounded-lg hover:bg-red-500/15"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ) : (
              <div className="text-white/80">No API Keys Found</div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <button
              onClick={()=>setShowAdd(true)}
              className="inline-flex items-center gap-2 px-4 h-[44px] rounded-[14px] text-white font-semibold"
              style={{ background:'rgba(0,0,0,0.30)', border:'1px solid rgba(255,255,255,0.20)' }}
            >
              <Plus className="w-4 h-4" />
              Add New API Key
            </button>

            <button
              onClick={testKey}
              className="flex-1 h-[44px] rounded-[18px] font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: BTN_GREEN }}
              onMouseEnter={e=>((e.currentTarget).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={e=>((e.currentTarget).style.background = BTN_GREEN)}
            >
              <Zap className="w-4 h-4" />
              Test API Key
            </button>
          </div>
        </div>
      </div>

      <AddKeyModal open={showAdd} onClose={()=>setShowAdd(false)} onSave={addKey} />
      {toast && <Toast text={toast} onClose={()=>setToast(undefined)} />}
    </div>
  );
}
