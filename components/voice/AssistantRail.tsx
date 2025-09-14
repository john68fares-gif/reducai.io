// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* Optional scoped storage (no crash if not present) */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* Data */
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };
const STORAGE_KEY = 'agents';
const GREEN = '#10b981';
const GREEN_HOVER = '#0ea371';

/* Storage helpers */
async function loadAssistants(): Promise<AssistantLite[]> {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      const a = await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []);
      return Array.isArray(a) ? a : [];
    }
  } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

/* ---------- Modal Shell + Header (shared) ---------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,.60)' }}>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background:'var(--panel)',
          border:'1px solid var(--border)',
          boxShadow:'var(--shadow-soft)',
          maxWidth: 520,
          width:'100%',
        }}
      >
        {children}
      </div>
    </div>
  );
}
function FrameHeader({ icon, title, subtitle, onClose }:{
  icon:React.ReactNode; title:string; subtitle?:string; onClose:()=>void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--brand-weak)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded hover:opacity-70">
        <X className="w-4 h-4" style={{ color:'var(--text)' }}/>
      </button>
    </div>
  );
}

/* ---------- Specific Modals ---------- */
function ConfirmDelete({ open, name, onClose, onConfirm }:{
  open:boolean; name?:string; onClose:()=>void; onConfirm:()=>void;
}) {
  if(!open) return null;
  return (
    <ModalShell>
      <FrameHeader
        icon={<AlertTriangle className="w-5 h-5" style={{ color:'var(--brand)' }}/>}
        title="Delete Assistant"
        subtitle="This action cannot be undone."
        onClose={onClose}
      />
      <div className="px-5 py-4 text-sm" style={{ color:'var(--text)' }}>
        Are you sure you want to delete <b>“{name||'assistant'}”</b>?
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button
          className="h-[36px] flex-1 rounded-[10px] px-4"
          style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="h-[36px] flex-1 rounded-[10px] px-4 font-semibold text-white"
          style={{ background: GREEN, border:`1px solid ${GREEN}`, boxShadow:'0 10px 24px rgba(16,185,129,.22)' }}
          onMouseEnter={(e)=> (e.currentTarget.style.background = GREEN_HOVER)}
          onMouseLeave={(e)=> (e.currentTarget.style.background = GREEN)}
          onClick={onConfirm}
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
  if(!open) return null;
  const can = val.trim().length>0;
  return (
    <ModalShell>
      <FrameHeader icon={<Edit3 className="w-5 h-5" style={{ color:'var(--brand)' }}/>} title="Rename Assistant" onClose={onClose}/>
      <div className="px-5 py-4">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={val}
          onChange={e=>setVal(e.target.value)}
          className="w-full h-[36px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}
          autoFocus
        />
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="h-[36px] flex-1 rounded-[10px]" style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }} onClick={onClose}>Cancel</button>
        <button
          disabled={!can}
          className="h-[36px] flex-1 rounded-[10px] font-semibold text-white disabled:opacity-60"
          style={{ background: GREEN, border:`1px solid ${GREEN}`, boxShadow:'0 10px 24px rgba(16,185,129,.22)' }}
          onMouseEnter={(e)=> can && (e.currentTarget.style.background = GREEN_HOVER)}
          onMouseLeave={(e)=> can && (e.currentTarget.style.background = GREEN)}
          onClick={()=> can && onSave(val.trim())}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [val,setVal] = useState('');
  useEffect(()=>{ if(open) setVal(''); },[open]);
  if(!open) return null;
  const can = val.trim().length>0;
  return (
    <ModalShell>
      <FrameHeader icon={<Plus className="w-5 h-5" style={{ color:'var(--brand)' }}/>} title="Create Assistant" onClose={onClose}/>
      <div className="px-5 py-4">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={val}
          onChange={e=>setVal(e.target.value)}
          className="w-full h-[36px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}
          placeholder="e.g., Sales Bot"
          autoFocus
        />
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="h-[36px] flex-1 rounded-[10px]" style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }} onClick={onClose}>Cancel</button>
        <button
          disabled={!can}
          className="h-[36px] flex-1 rounded-[10px] font-semibold text-white disabled:opacity-60"
          style={{ background: GREEN, border:`1px solid ${GREEN}`, boxShadow:'0 10px 24px rgba(16,185,129,.22)' }}
          onMouseEnter={(e)=> can && (e.currentTarget.style.background = GREEN_HOVER)}
          onMouseLeave={(e)=> can && (e.currentTarget.style.background = GREEN)}
          onClick={()=> can && onCreate(val.trim())}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Main ---------- */
export default function AssistantRail() {
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [q,setQ] = useState('');
  const [delId,setDelId] = useState<string|null>(null);
  const [renId,setRenId] = useState<string|null>(null);
  const [createOpen,setCreateOpen] = useState(false);

  useEffect(()=>{ (async()=>{
    const list = await loadAssistants();
    setAssistants(list);
    if(list[0]) setActiveId(list[0].id);
  })(); },[]);

  const filtered = useMemo(()=> {
    const s=q.trim().toLowerCase();
    return !s?assistants:assistants.filter(a=>a.name.toLowerCase().includes(s) || (a.purpose||'').toLowerCase().includes(s));
  },[assistants,q]);

  function addAssistant(name:string){
    const a:AssistantLite = { id:`a_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`, name, createdAt: Date.now(), purpose:'' };
    const next=[a, ...assistants];
    setAssistants(next); setActiveId(a.id); saveAssistants(next); setCreateOpen(false);
  }
  function saveRename(name:string){
    const next=assistants.map(x=> x.id===renId ? {...x, name} : x);
    setAssistants(next); saveAssistants(next); setRenId(null);
  }
  function confirmDelete(){
    const next = assistants.filter(x=> x.id!==delId);
    setAssistants(next); saveAssistants(next);
    if(activeId===delId) setActiveId(next[0]?.id || '');
    setDelId(null);
  }

  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;

  return (
    <div className="px-4 py-4">
      {/* Label */}
      <div className="text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--text-muted)' }}>ASSISTANTS</div>

      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl grid place-items-center shadow-md" style={{ background:'var(--brand-weak)' }}>
            <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
          </div>
          <span className="font-semibold text-sm" style={{ color:'var(--text)' }}>Assistants</span>
        </div>

        {/* Vapi-style Create */}
        <button
          type="button"
          className="inline-flex items-center gap-2 select-none"
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            background: GREEN,
            color: '#fff',
            border: `1px solid ${GREEN}`,
            boxShadow: '0 10px 24px rgba(16,185,129,.22)',
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            WebkitAppearance: 'none' as any,
            appearance: 'none',
          }}
          onMouseEnter={(e)=> (e.currentTarget.style.background = GREEN_HOVER)}
          onMouseLeave={(e)=> (e.currentTarget.style.background = GREEN)}
          onMouseDown={(e)=> (e.currentTarget.style.transform = 'translateY(1px)')}
          onMouseUp={(e)=> (e.currentTarget.style.transform = 'translateY(0)')}
          onClick={()=> setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" /> Create Assistant
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Search assistants"
          className="flex-1 h-[36px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background:'var(--card)', border:'1px solid var(--border)', color:'var(--text)' }}
        />
        {q && (
          <button onClick={()=>setQ('')} className="px-2 h-[36px] rounded-[10px]" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <X className="w-4 h-4" style={{ color:'var(--text-muted)' }}/>
          </button>
        )}
      </div>

      {/* Assistants list */}
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {filtered.map(a=>(
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              whileHover={{ y: -2, boxShadow: '0 10px 28px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.04)' }}
              className="p-3 rounded-[14px] cursor-pointer transition-colors"
              onClick={()=>setActiveId(a.id)}
              style={{
                background: 'var(--panel)',
                boxShadow: '0 4px 14px rgba(0,0,0,.22)',
                color: 'var(--text)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl grid place-items-center" style={{ background:'var(--brand-weak)' }}>
                  <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm truncate">{a.name}</div>
                  <div className="text-[11.5px] truncate" style={{ color:'var(--text-muted)' }}>{a.purpose || '—'}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="px-2 h-[30px] rounded-[10px]"
                    style={{ background:'var(--card)', border:'1px solid var(--border)' }}
                    onClick={(e)=>{ e.stopPropagation(); setRenId(a.id); }}
                    aria-label="Rename"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    className="px-2 h-[30px] rounded-[10px]"
                    style={{ background:'var(--card)', border:'1px solid var(--border)' }}
                    onClick={(e)=>{ e.stopPropagation(); setDelId(a.id); }}
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-xs" style={{ color:'var(--text-muted)' }}>No assistants found.</div>
        )}
      </div>

      {/* Modals */}
      <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={addAssistant} />
      <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
      <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
