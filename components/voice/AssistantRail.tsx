// components/voice/AssistantRail.tsx
'use client'; // 👉 Next.js: render this component on the client

// 👉 React core + hooks
import React, { useEffect, useMemo, useState } from 'react';
// 👉 Code-split the rail safely so page never crashes if it errors
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';
// 👉 Lightweight entrance/exit animations for list rows
import { AnimatePresence, motion } from 'framer-motion';

/* ────────────────────────────────────────────────────────────────────────────
   Optional scoped storage helper (no-throw if the module doesn't exist)
   - We try to require '@/utils/scoped-storage' at runtime
   - If missing, everything still works with plain localStorage
──────────────────────────────────────────────────────────────────────────── */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* ───────────────────────── Types & constants ──────────────────────────────── */
// 👉 Minimal assistant shape for the rail
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };

// 👉 Keys: list cache + “active assistant” id (shared with VoiceAgentSection)
const STORAGE_KEY = 'agents';
const ACTIVE_KEY  = 'va:activeId';

// 👉 Brand greens for CTA hover effect
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

/* ───────────────────────── ID + storage helpers ──────────────────────────── */
// 👉 Create reasonably-unique ids (timestamp base + random)
function uid() {
  return `a_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

// 👉 Load assistants from scoped storage if available, else localStorage
async function loadAssistants(): Promise<AssistantLite[]> {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); const a=await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []); return Array.isArray(a)?a:[]; } } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}

// 👉 Save assistants to both storages (best effort)
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

// 👉 Persist active id and broadcast a DOM event for other components (VoiceAgentSection) to react to
function writeActive(id:string){
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
  try { window.dispatchEvent(new CustomEvent('assistant:active', { detail: id })); } catch {}
}

/* ───────────────────────────── Modal shells ──────────────────────────────── */
// 👉 Shared container for all modals; dim background + themed panel
function ModalShell({ children }:{ children:React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,.60)' }}>
      <div className="w-full max-w-[700px] rounded-[20px] overflow-hidden"
           style={{ background:'var(--panel)', border:'1px solid var(--border)', boxShadow:'var(--shadow-soft)' }}>
        {children}
      </div>
    </div>
  );
}

// 👉 Reusable modal header (icon + title + close)
function ModalHeader({ icon, title, subtitle, onClose }:{
  icon:React.ReactNode; title:string; subtitle?:string; onClose:()=>void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom:'1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--brand-weak)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded hover:opacity-70"><X className="w-4 h-4" style={{ color:'var(--text)' }}/></button>
    </div>
  );
}

// 👉 “Create assistant” modal: simple text field + CTA
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name,setName] = useState('');
  useEffect(()=>{ if(open) setName(''); },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-5 h-5" style={{ color:'var(--brand)' }}/>} title="Create Assistant" onClose={onClose}/>
      <div className="px-6 py-5">
        {/* 👉 Labeled input, theme-aware */}
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] rounded-[14px] px-3 text-sm outline-none border"
          style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        {/* 👉 Neutral cancel button */}
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[14px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        {/* 👉 Primary green CTA with hover color swap */}
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] rounded-[14px] font-semibold disabled:opacity-60"
          style={{ background:BTN_GREEN, color:'#fff', fontSize:12.5 }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}

// 👉 “Rename assistant” modal: same shell, writes new name
function RenameModal({ open, initial, onClose, onSave }:{
  open:boolean; initial:string; onClose:()=>void; onSave:(v:string)=>void;
}) {
  const [val,setVal]=useState(initial);
  useEffect(()=>{ if(open) setVal(initial); },[open,initial]);
  if(!open) return null;
  const can = val.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Edit3 className="w-5 h-5" style={{ color:'var(--brand)' }}/>} title="Rename Assistant" onClose={onClose}/>
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input value={val} onChange={(e)=>setVal(e.target.value)}
               className="w-full h-[44px] rounded-[14px] px-3 text-sm outline-none border"
               style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }} />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[14px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onSave(val.trim())}
          className="w-full h-[44px] rounded-[14px] font-semibold disabled:opacity-60"
          style={{ background:BTN_GREEN, color:'#fff', fontSize:12.5 }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

// 👉 “Confirm delete” modal: warning + irreversible copy
function ConfirmDelete({ open, name, onClose, onConfirm }:{
  open:boolean; name?:string; onClose:()=>void; onConfirm:()=>void;
}) {
  if(!open) return null;
  return (
    <ModalShell>
      <ModalHeader
        icon={<AlertTriangle className="w-5 h-5" style={{ color:'var(--brand)' }}/>}
        title="Delete Assistant" subtitle="This action cannot be undone." onClose={onClose}
      />
      <div className="px-6 py-5 text-sm" style={{ color:'var(--text)' }}>
        Delete <b>“{name||'assistant'}”</b>?
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[14px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
                className="w-full h-[44px] rounded-[14px] font-semibold"
                style={{ background:BTN_GREEN, color:'#fff', fontSize:12.5 }}
                onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
                onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────────────────────── Assistant list row ───────────────────────────────
   - Green GLOW on active/hover (no green border)
   - Click selects, small chip buttons on hover for rename/delete
──────────────────────────────────────────────────────────────────────────── */
function Row({
  a, active, onClick, onRename, onDelete,
}:{
  a:AssistantLite; active:boolean; onClick:()=>void; onRename:()=>void; onDelete:()=>void;
}) {
  return (
    <button
      onClick={onClick}
      className="rail-row w-full text-left rounded-[12px] px-3 flex items-center gap-2 group transition"
      style={{
        minHeight: 60,                                    // 👉 taller, touch-friendly
        background: active ? 'var(--rail-selected-bg)' : 'transparent', // 👉 subtle fill when active
        border: '1px solid transparent',                  // 👉 no visible border (we use shadow)
        color: 'var(--sidebar-text)',
        boxShadow: active
          ? '0 10px 26px rgba(0,0,0,.36), 0 0 0 1px rgba(16,185,129,.18), 0 0 18px rgba(16,185,129,.22)' // 👉 green halo
          : 'none',
      }}
    >
      {/* 👉 Avatar square with thin border to align with theme */}
      <div className="w-10 h-10 rounded-md grid place-items-center"
           style={{ background:'var(--rail-avatar-bg)', border:'1px solid var(--sidebar-border)' }}>
        <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
      </div>

      {/* 👉 Title + subtitle (purpose) clamps, respects narrow rails */}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate">{a.name}</div>
        <div className="text-[11px] truncate" style={{ color:'var(--sidebar-muted)' }}>
          {a.purpose || '—'}
        </div>
      </div>

      {/* 👉 Inline actions appear on hover only */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e)=>{ e.stopPropagation(); onRename(); }}
          className="px-2 h-[30px] rounded-[8px] border"
          style={{ background:'var(--rail-chip-bg)', borderColor:'var(--rail-chip-border)' }}
          aria-label="Rename"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          className="px-2 h-[30px] rounded-[8px] border"
          style={{ background:'var(--rail-chip-bg)', borderColor:'var(--rail-chip-border)' }}
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* 👉 Hover halo (slightly softer than active) */}
      <style jsx>{`
        .rail-row:hover{
          box-shadow: 0 10px 26px rgba(0,0,0,.32), 0 0 0 1px rgba(16,185,129,.14), 0 0 16px rgba(16,185,129,.18);
          background: var(--rail-selected-bg);
        }
      `}</style>
    </button>
  );
}

/* ─────────────────────────────── Main rail ───────────────────────────────── */
export default function AssistantRail() {
  // 👉 All assistants in rail (local cache)
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  // 👉 Currently selected assistant id
  const [activeId,setActiveId] = useState('');
  // 👉 Search query
  const [q,setQ] = useState('');
  // 👉 Modal states
  const [createOpen,setCreateOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);

  // 👉 First load: read list + restore previously active id (if exists)
  useEffect(()=>{ (async()=>{
    const list = await loadAssistants();
    setAssistants(list);
    const savedActive = (()=>{
      try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
    })();
    // 👉 If saved id is present in the list use it, else pick first assistant
    const firstId = savedActive && list.find(a=>a.id===savedActive) ? savedActive : (list[0]?.id || '');
    setActiveId(firstId); if (firstId) writeActive(firstId); // 👉 notify page selection
  })(); },[]);

  // 👉 Memo filter list by search query (name or purpose)
  const filtered = useMemo(()=> {
    const s=q.trim().toLowerCase();
    return !s?assistants:assistants.filter(a=>a.name.toLowerCase().includes(s) || (a.purpose||'').toLowerCase().includes(s));
  },[assistants,q]);

  // 👉 Selecting a row: set active id + broadcast
  function select(id:string){
    setActiveId(id);
    writeActive(id); // <- notify VoiceAgentSection + persist
  }

  // 👉 Create & select the new assistant
  function addAssistant(name:string){
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'' };
    const next=[a, ...assistants];
    setAssistants(next); saveAssistants(next);
    select(a.id);
    setCreateOpen(false);
  }

  // 👉 Rename in-place (by id)
  function saveRename(name:string){
    const next=assistants.map(x=> x.id===renId ? {...x, name} : x);
    setAssistants(next); saveAssistants(next); setRenId(null);
  }

  // 👉 Delete, and if we deleted the active one, fall back to first
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

  // 👉 Names for modal headers
  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;

  return (
    <div
      className="assistant-rail px-3 py-3 h-full"
      style={{
        background:'var(--sidebar-bg)',                // 👉 match global sidebar BG
        borderRight:'1px solid rgba(255,255,255,.14)', // 👉 thinner white-ish sideline
        color:'var(--sidebar-text)'
      }}
    >
      {/* 👉 Primary CTA (green) smaller text per your spec */}
      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold mb-3"
        style={{ height: 38, background: BTN_GREEN, color: '#fff', fontSize: 12.5 }}
        onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER)}
        onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN)}
        onClick={()=> setCreateOpen(true)}
      >
        <Plus className="w-4 h-4" /> Create Assistant
      </button>

      {/* 👉 Search: thin white border (dark), neutral (light) */}
      <div className="relative mb-3">
        <input
          value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search assistants"
          className="w-full h-[30px] rounded-[12px] pl-8 pr-8 text-sm outline-none border"
          style={{
            background:'var(--rail-input-bg)',
            borderColor:'var(--rail-input-border)',
            borderWidth:'1px',
            color:'var(--rail-input-text)'
          }}
        />
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2"
                style={{ color:'var(--rail-input-muted)' }}/>
      </div>

      {/* 👉 Section label */}
      <div className="text-[11px] font-semibold tracking-[.12em] mb-2" style={{ color:'var(--sidebar-muted)' }}>
        ASSISTANTS
      </div>

      {/* 👉 Scrollable list; space-y for row separation */}
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

          {/* 👉 Empty state when filter yields none */}
          {filtered.length===0 && (
            <div className="text-xs py-8 text-center" style={{ color:'var(--sidebar-muted)' }}>
              No assistants found.
            </div>
          )}
        </div>
      </div>

      {/* 👉 Modal mounts */}
      <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={addAssistant} />
      <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
      <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />

      {/* 👉 Theme tokens (light/dark) for inputs, chips, selection bg */}
      <style jsx>{`
        /* Light theme tokens for rail */
        :global(:root:not([data-theme="dark"])) .assistant-rail{
          --rail-input-bg: #fff;
          --rail-input-border: rgba(0,0,0,.14);
          --rail-input-text: #0f172a;
          --rail-input-muted: #64748b;

          --rail-selected-bg: rgba(0,0,0,.04);
          --rail-avatar-bg: rgba(0,0,0,.06);

          --rail-chip-bg: #fff;
          --rail-chip-border: rgba(0,0,0,.12);
        }
        /* Dark theme tokens for rail */
        :global([data-theme="dark"]) .assistant-rail{
          --rail-input-bg: var(--card);
          --rail-input-border: rgba(255,255,255,.78);  /* thin white line */
          --rail-input-text: var(--text);
          --rail-input-muted: var(--text-muted);

          --rail-selected-bg: rgba(255,255,255,.06);
          --rail-avatar-bg: rgba(255,255,255,.06);

          --rail-chip-bg: var(--card);
          --rail-chip-border: var(--border);
        }

        /* 👉 Placeholder color respects theme token */
        .assistant-rail input::placeholder{ color: var(--rail-input-muted); opacity: .9; }
      `}</style>
    </div>
  );
}
