// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* Optional scoped storage (no crash if missing) */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* ---------------- Data ---------------- */
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };
const STORAGE_KEY = 'agents';
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

/* ---------------- Helpers ---------------- */
async function loadAssistants(): Promise<AssistantLite[]> {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); return await ss.getJSON(STORAGE_KEY, []); } } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

/* ---------------- Shared modal shell ---------------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4 bg-black/60">
      <div className="rounded-2xl overflow-hidden shadow-2xl bg-[var(--panel)] border border-[var(--border)] max-w-md w-full">
        {children}
      </div>
    </div>
  );
}
function FrameHeader({ icon, title, subtitle, onClose }:{
  icon:React.ReactNode; title:string; subtitle?:string; onClose:()=>void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--brand-weak)]">
          {icon}
        </div>
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {subtitle && <div className="text-xs text-[var(--text-muted)]">{subtitle}</div>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded hover:opacity-70">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ---------------- Modals ---------------- */
function ConfirmDelete({ open, name, onClose, onConfirm }:{
  open:boolean; name?:string; onClose:()=>void; onConfirm:()=>void;
}) {
  if(!open) return null;
  return (
    <ModalShell>
      <FrameHeader icon={<AlertTriangle className="w-5 h-5 text-[var(--brand)]" />} title="Delete Assistant" subtitle="This action cannot be undone." onClose={onClose}/>
      <div className="px-5 py-4 text-sm">Delete <b>{name||'assistant'}</b>?</div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="flex-1 h-[40px] rounded-lg bg-[var(--card)] border border-[var(--border)]" onClick={onClose}>Cancel</button>
        <button
          className="flex-1 h-[40px] rounded-lg text-white font-semibold"
          style={{ background:BTN_GREEN }}
          onClick={onConfirm}
          onMouseEnter={e=>e.currentTarget.style.background=BTN_GREEN_HOVER}
          onMouseLeave={e=>e.currentTarget.style.background=BTN_GREEN}
        >Delete</button>
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
  return (
    <ModalShell>
      <FrameHeader icon={<Edit3 className="w-5 h-5 text-[var(--brand)]"/>} title="Rename Assistant" onClose={onClose}/>
      <div className="px-5 py-4">
        <input value={val} onChange={e=>setVal(e.target.value)} className="w-full h-[38px] rounded-lg px-3 border border-[var(--border)] bg-[var(--card)]" />
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="flex-1 h-[38px] rounded-lg bg-[var(--card)] border border-[var(--border)]" onClick={onClose}>Cancel</button>
        <button
          disabled={!val.trim()}
          className="flex-1 h-[38px] rounded-lg text-white font-semibold disabled:opacity-50"
          style={{ background:BTN_GREEN }}
          onClick={()=>onSave(val.trim())}
        >Save</button>
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
  return (
    <ModalShell>
      <FrameHeader icon={<Plus className="w-5 h-5 text-[var(--brand)]"/>} title="Create Assistant" onClose={onClose}/>
      <div className="px-5 py-4">
        <input value={val} onChange={e=>setVal(e.target.value)} className="w-full h-[38px] rounded-lg px-3 border border-[var(--border)] bg-[var(--card)]" placeholder="Assistant name"/>
      </div>
      <div className="px-5 pb-5 flex gap-2">
        <button className="flex-1 h-[38px] rounded-lg bg-[var(--card)] border border-[var(--border)]" onClick={onClose}>Cancel</button>
        <button
          disabled={!val.trim()}
          className="flex-1 h-[38px] rounded-lg text-white font-semibold disabled:opacity-50"
          style={{ background:BTN_GREEN }}
          onClick={()=>onCreate(val.trim())}
        >Create</button>
      </div>
    </ModalShell>
  );
}

/* ---------------- Main ---------------- */
export default function AssistantRail() {
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [q,setQ] = useState('');
  const [del,setDel] = useState<string|null>(null);
  const [ren,setRen] = useState<string|null>(null);
  const [create,setCreate] = useState(false);

  useEffect(()=>{ (async()=>{ setAssistants(await loadAssistants()); })(); },[]);

  const filtered = useMemo(()=>!q?assistants:assistants.filter(a=>a.name.toLowerCase().includes(q.toLowerCase())),[assistants,q]);
  const active = assistants.find(a=>a.id===activeId);

  function add(name:string){ const a={id:`a_${Date.now()}`,name}; const next=[a,...assistants]; setAssistants(next); setActiveId(a.id); saveAssistants(next); setCreate(false);}
  function saveName(newName:string){ const next=assistants.map(a=>a.id===ren?{...a,name:newName}:a); setAssistants(next); saveAssistants(next); setRen(null);}
  function confirmDelete(){ const next=assistants.filter(a=>a.id!==del); setAssistants(next); saveAssistants(next); setActiveId(next[0]?.id||''); setDel(null);}

  return (
    <div className="rail px-4 py-4">
      <div className="text-[11px] font-semibold tracking-[.12em] text-[var(--text-muted)] mb-3">ASSISTANTS</div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--brand-weak)] shadow-md">
            <Bot className="w-4 h-4 text-[var(--brand)]"/>
          </div>
          <span className="font-semibold text-sm">Assistants</span>
        </div>
        <button
          className="px-3 h-[34px] rounded-lg text-sm font-semibold text-white"
          style={{ background:BTN_GREEN }}
          onClick={()=>setCreate(true)}
        ><Plus className="w-4 h-4"/> Create</button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-[var(--text-muted)]"/>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search assistants"
               className="flex-1 h-[34px] rounded-lg px-3 text-sm bg-[var(--card)] border border-[var(--border)]"/>
        {q && <button onClick={()=>setQ('')}><X className="w-4 h-4 text-[var(--text-muted)]"/></button>}
      </div>

      {/* Assistants list (stacked top to bottom with glow) */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.map(a=>(
            <motion.div
              key={a.id}
              initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
              whileHover={{y:-2, boxShadow:'0 10px 28px rgba(0,255,194,.15), 0 4px 12px rgba(0,0,0,.35)'}}
              className={`p-3 rounded-xl cursor-pointer transition-colors ${a.id===activeId?'bg-[var(--card)]':''}`}
              onClick={()=>setActiveId(a.id)}
              style={{ background:'var(--panel)', boxShadow:'0 4px 12px rgba(0,0,0,.25)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--brand-weak)] flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[var(--brand)]"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{a.name}</div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">{a.purpose||'—'}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={e=>{e.stopPropagation();setRen(a.id);}}><Edit3 className="w-4 h-4"/></button>
                  <button onClick={e=>{e.stopPropagation();setDel(a.id);}}><Trash2 className="w-4 h-4 text-red-400"/></button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length===0 && <div className="text-xs text-[var(--text-muted)]">No assistants found.</div>}
      </div>

      {/* Modals */}
      <CreateModal open={create} onClose={()=>setCreate(false)} onCreate={add}/>
      <RenameModal open={!!ren} initial={assistants.find(a=>a.id===ren)?.name||''} onClose={()=>setRen(null)} onSave={saveName}/>
      <ConfirmDelete open={!!del} name={assistants.find(a=>a.id===del)?.name} onClose={()=>setDel(null)} onConfirm={confirmDelete}/>
    </div>
  );
}
