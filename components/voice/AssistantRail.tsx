// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';

/* Optional scoped storage (won't crash if missing) */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* Data types */
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };
const STORAGE_KEY = 'agents';

/* API Keys page green */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

/* ---------------------------- Local theme tokens --------------------------- */
function LocalTokens() {
  return (
    <style>{`
      .rail { width:312px; color:var(--text); }
      .rail .panel {
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 18px;
        box-shadow: var(--shadow-soft);
      }
      .thin { border:1px solid var(--border) }

      .input {
        height:34px; width:100%; border-radius:12px; padding:0 .7rem;
        background: var(--card); border:1px solid var(--border); color:var(--text);
        font-size:13px; outline:none; transition: box-shadow .16s ease, border-color .16s ease;
      }
      .input:focus {
        border-color: color-mix(in oklab, var(--brand) 40%, var(--border));
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 14%, transparent);
      }

      .btn {
        height:34px; padding:0 .8rem; border-radius:12px; display:inline-flex; align-items:center; gap:.5rem;
        background: var(--card); color: var(--text); border:1px solid var(--border); font-size:13px; font-weight:600;
        transition: transform .06s ease;
      }
      .btn:hover{ transform: translateY(-1px); }
      .btn-primary {
        background:${BTN_GREEN}; color:#fff; border:1px solid ${BTN_GREEN};
        box-shadow: 0 10px 24px rgba(16,185,129,.22);
      }
      .btn-primary:hover { background:${BTN_GREEN_HOVER}; }

      .item {
        display:flex; align-items:center; gap:10px;
        padding:10px 12px; border-radius:12px;
        background: var(--card); border:1px solid var(--border);
        transition: box-shadow .18s ease, transform .12s ease, border-color .18s ease;
      }
      .item:hover {
        transform: translateY(-1px);
        box-shadow: var(--shadow-card, 0 10px 22px rgba(0,0,0,.14)), inset 0 1px 0 rgba(255,255,255,.06);
        border-color: color-mix(in oklab, var(--brand) 22%, var(--border));
      }
      .item.active {
        box-shadow: var(--shadow-card), inset 0 1px 0 rgba(255,255,255,.08);
        border-color: color-mix(in oklab, var(--brand) 28%, var(--border));
      }

      .muted { color: var(--text-muted); }
      .ico { width:14px; height:14px; }
    `}</style>
  );
}

/* ------------------------------- Storage utils ------------------------------ */
async function loadAssistants(): Promise<AssistantLite[]> {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); const arr = await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []); if (Array.isArray(arr)) return normalize(arr); } } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return normalize(JSON.parse(raw)); } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}
function normalize(arr: AssistantLite[]): AssistantLite[] {
  return (arr||[]).map((x,i)=>({ id:String(x.id ?? `a_${i}`), name:String(x.name ?? `Assistant ${i+1}`), purpose:x.purpose ?? '', createdAt:x.createdAt ?? Date.now() }));
}

/* ------------------------------- Shared modals ------------------------------ */
function FrameHeader({
  icon, title, subtitle, onClose,
}: { icon: React.ReactNode; title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'var(--brand-weak)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold">{title}</div>
          {subtitle && <div className="text-sm muted">{subtitle}</div>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded hover:opacity-75"><X className="ico" /></button>
    </div>
  );
}

function ModalShell({ children }:{ children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,.60)' }}>
      <div className="panel w-full max-w-md overflow-hidden">{children}</div>
    </div>
  );
}

function ConfirmDeleteModal({ open, name, onClose, onConfirm }:{
  open:boolean; name?:string; onClose:()=>void; onConfirm:()=>void;
}) {
  if (!open) return null;
  return (
    <ModalShell>
      <FrameHeader
        icon={<AlertTriangle className="ico" style={{ color:'var(--brand)' }} />}
        title="Delete Assistant"
        subtitle="This action cannot be undone."
        onClose={onClose}
      />
      <div className="px-5 py-4 text-sm">
        Are you sure you want to delete <span className="font-semibold">“{name||'assistant'}”</span>?
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="btn flex-1" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary flex-1"
          onClick={onConfirm}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

function RenameModal({ open, initial, onClose, onSave }:{
  open:boolean; initial:string; onClose:()=>void; onSave:(v:string)=>void;
}) {
  const [val,setVal] = useState(initial);
  useEffect(()=>{ if(open) setVal(initial); },[open,initial]);
  const can = val.trim().length>0;
  if(!open) return null;
  return (
    <ModalShell>
      <FrameHeader
        icon={<Edit3 className="ico" style={{ color:'var(--brand)' }} />}
        title="Rename Assistant"
        onClose={onClose}
      />
      <div className="px-5 py-4">
        <label className="block text-xs mb-1 muted">Name</label>
        <input className="input" value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g., Support Bot" autoFocus />
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="btn flex-1" onClick={onClose}>Cancel</button>
        <button
          disabled={!can}
          className="btn btn-primary flex-1"
          style={{ opacity: can?1:.6, cursor: can?'pointer':'not-allowed' }}
          onClick={()=> can && onSave(val.trim())}
          onMouseEnter={(e)=>{ if(can) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
          onMouseLeave={(e)=>{ if(can) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

/* NEW: Create modal (same style as Rename) */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [val, setVal] = useState('');
  useEffect(()=>{ if(open){ setVal(''); } },[open]);
  const can = val.trim().length > 0;
  if(!open) return null;
  return (
    <ModalShell>
      <FrameHeader
        icon={<Plus className="ico" style={{ color:'var(--brand)' }} />}
        title="Create Assistant"
        onClose={onClose}
      />
      <div className="px-5 py-4">
        <label className="block text-xs mb-1 muted">Name</label>
        <input
          className="input"
          value={val}
          onChange={(e)=>setVal(e.target.value)}
          placeholder="e.g., Sales Bot"
          autoFocus
        />
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="btn flex-1" onClick={onClose}>Cancel</button>
        <button
          disabled={!can}
          className="btn btn-primary flex-1"
          style={{ opacity: can?1:.6, cursor: can?'pointer':'not-allowed' }}
          onClick={()=> can && onCreate(val.trim())}
          onMouseEnter={(e)=>{ if(can) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
          onMouseLeave={(e)=>{ if(can) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}

/* --------------------------------- Component -------------------------------- */
export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState('');
  const [q, setQ] = useState('');
  const [delId, setDelId] = useState<string|null>(null);
  const [renId, setRenId] = useState<string|null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement|null>(null);

  useEffect(()=>{ let alive=true; (async()=>{ const list=await loadAssistants(); if(!alive) return; setAssistants(list); if(list[0]) setActiveId(list[0].id);})(); return()=>{alive=false}; },[]);

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase();
    return !s?assistants:assistants.filter(a=>a.name.toLowerCase().includes(s) || (a.purpose||'').toLowerCase().includes(s));
  },[assistants,q]);

  async function createAssistant(name: string) {
    const a:AssistantLite={ id:`a_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`, name, createdAt:Date.now(), purpose:'' };
    const next=[a, ...assistants];
    setAssistants(next);
    setActiveId(a.id);
    await saveAssistants(next);
    setCreateOpen(false);
  }

  async function confirmDelete() {
    if(!delId) return;
    const next = assistants.filter(a=>a.id!==delId);
    setAssistants(next);
    if(activeId===delId) setActiveId(next[0]?.id || '');
    await saveAssistants(next);
    setDelId(null);
  }
  function saveRename(nextName:string){
    if(!renId) return;
    const next = assistants.map(a=>a.id===renId?{...a, name:nextName}:a);
    setAssistants(next); saveAssistants(next); setRenId(null);
  }

  const delName = assistants.find(a=>a.id===delId)?.name;
  const renName = assistants.find(a=>a.id===renId)?.name || '';

  return (
    <div className="rail px-3 py-4">
      <LocalTokens />

      {/* tiny section label like API Keys */}
      <div className="mb-2 text-[11px] font-semibold tracking-[.12em] muted">ASSISTANTS</div>

      <div className="panel p-3">
        {/* Header (API Keys chip + green Create) */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background:'var(--brand-weak)' }}>
              <Bot className="ico" style={{ color:'var(--brand)' }} />
            </div>
            <div className="text-[13px] font-semibold">Assistants</div>
          </div>
          <button
            className="btn btn-primary"
            onClick={()=> setCreateOpen(true)}
            onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
          >
            <Plus className="ico" /> Create
          </button>
        </div>

        {/* Search — single input (no extra inner card) */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <Search className="ico muted" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              className="input"
              placeholder="Search assistants"
              style={{ flex:1 }}
            />
            {q && (
              <button className="btn" onClick={()=>setQ('')} aria-label="Clear">
                <X className="ico" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length===0 ? (
            <div className="muted text-[12px] px-1 py-2">No assistants found</div>
          ) : (
            filtered.map(a=>{
              const active=a.id===activeId;
              return (
                <div key={a.id} className={`item ${active?'active':''}`} onClick={()=>setActiveId(a.id)} role="button">
                  {/* icon chip (thin border) */}
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center thin" style={{ background:'var(--card)' }}>
                    <Bot className="ico" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[13px] truncate">{a.name}</div>
                    <div className="muted text-[11.5px] truncate">{a.purpose || '—'}</div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button className="btn" style={{ height:28, padding:'0 8px' }} onClick={(e)=>{ e.stopPropagation(); setRenId(a.id); }} aria-label="Rename">
                      <Edit3 className="ico" />
                    </button>
                    <button className="btn" style={{ height:28, padding:'0 8px' }} onClick={(e)=>{ e.stopPropagation(); setDelId(a.id); }} aria-label="Delete">
                      <Trash2 className="ico" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="muted text-[11.5px] mt-3 px-1">Tip: saved to workspace (with local fallback).</div>
      </div>

      {/* Modals */}
      <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={createAssistant} />
      <ConfirmDeleteModal open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />
      <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
    </div>
  );
}
