'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

/* Optional scoped storage helper (falls back to localStorage if missing) */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* Types */
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };

/* Keys */
const STORAGE_KEY = 'agents';
const ACTIVE_KEY  = 'va:activeId';

/* Brand + theme tokens (match VoiceAgentSection) */
const CTA        = '#59d9b3';
const CTA_HOVER  = '#54cfa9';
const BRAND_OL30 = 'rgba(89,217,179,.30)';
const BRAND_OL18 = 'rgba(89,217,179,.18)';
const BRAND_OL14 = 'rgba(89,217,179,.14)';

/* Utils */
function uid() {
  return `a_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}
async function loadAssistants(): Promise<AssistantLite[]> {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); return await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []); } } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}
function writeActive(id:string){
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
  try { window.dispatchEvent(new CustomEvent('assistant:active', { detail: id })); } catch {}
}

/* ---------- Modal shells (PORTALED, high z-index, card styling) ---------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {/* overlay above everything — solid, no blur (match VoiceAgentSection) */}
      <div
        className="fixed inset-0 z-[100000] pointer-events-auto"
        style={{
          background: 'rgba(8,10,12,.78)'
        }}
      />
      {/* centered sheet with same style as solid cards */}
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <div
          className="w-full max-w-[720px] rounded-[12px] overflow-hidden"
          style={{
            background: 'var(--card)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}

function ModalHeader({ icon, title, subtitle, onClose }:{
  icon:React.ReactNode; title:string; subtitle?:string; onClose:()=>void;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 py-5"
      style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)'
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--brand-weak)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded hover:opacity-70" aria-label="Close modal">
        <X className="w-4 h-4" style={{ color:'var(--text)' }}/>
      </button>
    </div>
  );
}

/* Create / Rename / Delete modals */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name,setName] = useState('');
  useEffect(()=>{ if(open) setName(''); },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-5 h-5" style={{ color:CTA }}/>} title="Create Assistant" onClose={onClose}/>
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] rounded-[10px] px-3 text-sm outline-none border"
          style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#0a0f0d', fontSize:12.5 }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}
function RenameModal({ open, initial, onClose, onSave }:{
  open:boolean; initial:string; onClose:()=>void; onSave:(v:string)=>void;
}) {
  const [val,setVal]=useState(initial);
  useEffect(()=>{ if(open) setVal(initial); },[open,initial]);
  if(!open) return null;
  const can = val.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Edit3 className="w-5 h-5" style={{ color:CTA }}/>} title="Rename Assistant" onClose={onClose}/>
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input value={val} onChange={(e)=>setVal(e.target.value)}
               className="w-full h-[44px] rounded-[10px] px-3 text-sm outline-none border"
               style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }} />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onSave(val.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#0a0f0d', fontSize:12.5 }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}
function ConfirmDelete({ open, name, onClose, onConfirm }:{
  open:boolean; name?:string; onClose:()=>void; onConfirm:()=>void;
}) {
  if(!open) return null;
  return (
    <ModalShell>
      <ModalHeader
        icon={<AlertTriangle className="w-5 h-5" style={{ color:CTA }}/>}
        title="Delete Assistant" subtitle="This action cannot be undone." onClose={onClose}
      />
      <div className="px-6 py-5 text-sm" style={{ color:'var(--text)' }}>
        Delete <b>“{name||'assistant'}”</b>?
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:CTA, color:'#0a0f0d', fontSize:12.5 }}
                onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
                onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Row (assistant item) ---------- */
function Row({
  a, active, onClick, onRename, onDelete,
}:{
  a:AssistantLite; active:boolean; onClick:()=>void; onRename:()=>void; onDelete:()=>void;
}) {
  return (
    <button
      onClick={onClick}
      className="rail-row w-full text-left rounded-[10px] px-3 flex items-center gap-2 group transition"
      style={{
        minHeight: 60,
        background: active ? `linear-gradient(0deg, ${BRAND_OL30}, ${BRAND_OL30})` : 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--sidebar-text)',
        boxShadow: active
          ? `0 12px 28px rgba(0,0,0,.36), 0 0 0 1px ${BRAND_OL18}, 0 0 18px ${BRAND_OL18}`
          : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Tile avatar — subtle inner brand glow */}
      <div
        className="relative w-10 h-10 rounded-md grid place-items-center shrink-0"
        style={{
          background:'var(--rail-avatar-bg)',
          border:'1px solid var(--sidebar-border)',
        }}
      >
        <Bot className="w-4 h-4" style={{ color:CTA }} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{a.name}</div>
        <div className="text-[11px] truncate" style={{ color:'var(--sidebar-muted)' }}>
          {a.purpose || '—'}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e)=>{ e.stopPropagation(); onRename(); }}
          className="px-2 h-[30px] rounded-[10px] border"
          style={{ background:'var(--rail-chip-bg)', borderColor:'var(--rail-chip-border)' }}
          aria-label="Rename"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          className="px-2 h-[30px] rounded-[10px] border"
          style={{ background:'var(--rail-chip-bg)', borderColor:'var(--rail-chip-border)' }}
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Hover effect (soft brand) */}
      <style jsx>{`
        .rail-row:hover{
          background: linear-gradient(0deg, ${BRAND_OL14}, ${BRAND_OL14});
          box-shadow: 0 10px 24px rgba(0,0,0,.32), 0 0 0 1px ${BRAND_OL14}, 0 0 14px ${BRAND_OL14};
        }
      `}</style>
    </button>
  );
}

/* ---------- Main rail ---------- */
export default function AssistantRail() {
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [overlay,setOverlay] = useState(false); // full-screen loader
  const [q,setQ] = useState('');
  const [createOpen,setCreateOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);

  /* initial load + restore selection */
  useEffect(()=>{ (async()=>{
    const list = await loadAssistants();
    setAssistants(list);
    const savedActive = (()=>{ try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } })();
    const firstId = savedActive && list.find(a=>a.id===savedActive) ? savedActive : (list[0]?.id || '');
    setActiveId(firstId);
    if (firstId) writeActive(firstId);
  })(); },[]);

  /* filter */
  const filtered = useMemo(()=> {
    const s=q.trim().toLowerCase();
    return !s?assistants:assistants.filter(a=>a.name.toLowerCase().includes(s) || (a.purpose||'').toLowerCase().includes(s));
  },[assistants,q]);

  /* selection with AccountPage-style full-screen overlay */
  function select(id:string){
    setOverlay(true);
    setActiveId(id);
    writeActive(id);
    window.setTimeout(()=> setOverlay(false), 520);
  }

  /* CRUD */
  function addAssistant(name:string){
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'' };
    const next=[a, ...assistants];
    setAssistants(next); saveAssistants(next);
    select(a.id);
    setCreateOpen(false);
  }
  function saveRename(name:string){
    const next=assistants.map(x=> x.id===renId ? {...x, name} : x);
    setAssistants(next); saveAssistants(next); setRenId(null);
  }
  function confirmDelete(){
    const next = assistants.filter(x=> x.id!==delId);
    const deletedActive = activeId===delId;
    setAssistants(next); saveAssistants(next);
    if (deletedActive) {
      const nid = next[0]?.id || '';
      setActiveId(nid); if (nid) writeActive(nid);
    }
    setDelId(null);
  }

  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;

  return (
    <>
      <div
        className="assistant-rail px-3 py-3 h-full"
        style={{
          background:'var(--sidebar-bg)',
          borderRight:'1px solid var(--border)',
          color:'var(--sidebar-text)',
        }}
      >
        {/* Create Assistant */}
        <button
          type="button"
          className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold mb-3"
          style={{ height: 38, background: CTA, color: '#0a0f0d', fontSize: 12.5, boxShadow:'0 10px 22px rgba(89,217,179,.20)' }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
          onClick={()=> setCreateOpen(true)}
        >
          <Plus className="w-4 h-4" /> Create Assistant
        </button>

        {/* Search — ultra-thin hairline */}
        <div className="relative mb-3">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Search assistants"
            className="w-full h-[32px] rounded-[10px] pl-8 pr-3 text-sm outline-none"
            style={{
              background:'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: '0 0 0 1px rgba(255,255,255,.06) inset',
              color:'var(--text)'
            }}
          />
          <Search
            className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2"
            style={{ color:'var(--text-muted)' }}
          />
        </div>

        <div className="text-[11px] font-semibold tracking-[.12em] mb-2" style={{ color:'var(--sidebar-muted)' }}>
          ASSISTANTS
        </div>

        {/* List */}
        <div className="overflow-auto" style={{ maxHeight:'calc(100% - 118px)' }}>
          <div className="space-y-1.5">
            <AnimatePresence initial={false}>
              {filtered.map(a=>(
                <motion.div key={a.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}>
                  <Row
                    a={a}
                    active={a.id===activeId}
                    onClick={()=>select(a.id)}
                    onRename={()=>setRenId(a.id)}
                    onDelete={()=>setDelId(a.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {filtered.length===0 && (
              <div className="text-xs py-8 text-center" style={{ color:'var(--sidebar-muted)' }}>
                No assistants found.
              </div>
            )}
          </div>
        </div>

        {/* Modals (portaled, above all) */}
        <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={addAssistant} />
        <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
        <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />

        {/* Rail theme tokens */}
        <style jsx>{`
          /* Light */
          :global(:root:not([data-theme="dark"])) .assistant-rail{
            --rail-avatar-bg: linear-gradient(135deg,#f8fafc 0%,#eef2f7 100%);
            --rail-chip-bg: #fff;
            --rail-chip-border: rgba(0,0,0,.12);
            --sidebar-border: rgba(0,0,0,.12);
          }
          /* Dark */
          :global([data-theme="dark"]) .assistant-rail{
            --rail-avatar-bg: linear-gradient(135deg,#0f1214 0%,#11181a 100%);
            --rail-chip-bg: var(--card);
            --rail-chip-border: var(--border);
            --sidebar-border: var(--border);
          }
          .assistant-rail input::placeholder{ color: var(--text-muted); opacity: .9; }
        `}</style>
      </div>

      {/* Full-screen loader — above all content (solid, same tone) */}
      <AnimatePresence>
        {overlay && (
          <motion.div
            key="assistant-switch"
            className="fixed inset-0 z-[100002] flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
              background:
                'radial-gradient(1000px 500px at 50% -10%, var(--brand-weak), transparent 60%), var(--bg)'
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-[12px] border"
              style={{ border: '1px solid var(--border)', background: 'var(--panel)', boxShadow: 'var(--card-shadow)', color:'var(--text)' }}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <div className="text-sm">Loading assistant…</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
