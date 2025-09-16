// components/voice/AssistantRail.tsx
'use client';                           // ABOUT: make this component render on the client (required for localStorage, events)

import React, { useEffect, useMemo, useState } from 'react'; // ABOUT: core React + hooks
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react'; // ABOUT: icons
import { AnimatePresence, motion } from 'framer-motion';     // ABOUT: row enter/exit animation

/* ABOUT: Optional scoped storage helper. If your app has scoped-storage, use it.
         If not, everything silently falls back to window.localStorage. */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* ABOUT: Minimal assistant record */
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };

/* ABOUT: Keys used in storage (list + selected id) */
const STORAGE_KEY = 'agents';
const ACTIVE_KEY  = 'va:activeId';

/* ABOUT: Brand greens (button + glow overlay) */
const GREEN       = '#10b981';
const GREEN_HOVER = '#0ea473';
const GREEN_OL30  = 'rgba(16,185,129,.30)'; // ← 30% overlay
const GREEN_OL18  = 'rgba(16,185,129,.18)';
const GREEN_OL14  = 'rgba(16,185,129,.14)';

/* ABOUT: ID generator for new assistants */
function uid() {
  return `a_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

/* ABOUT: Load and save assistants (scoped first, then localStorage) */
async function loadAssistants(): Promise<AssistantLite[]> {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); return await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []); } } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

/* ABOUT: Persist current selection + broadcast a DOM event that VoiceAgentSection listens for */
function writeActive(id:string){
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
  try { window.dispatchEvent(new CustomEvent('assistant:active', { detail: id })); } catch {}
}

/* ────────────────────────────── Modal shells (shared) ───────────────────────
   ABOUT: Skeleton + header used by Create/Rename/Delete modals (theme-aware)
──────────────────────────────────────────────────────────────────────────── */
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

/* ABOUT: “Create Assistant” modal */
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
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] rounded-[14px] px-3 text-sm outline-none border"
          style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[14px] font-semibold border"
                style={{ background:'var(--card)', borderColor:'var(--border)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] rounded-[14px] font-semibold disabled:opacity-60"
          style={{ background:GREEN, color:'#fff', fontSize:12.5 }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN)}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}

/* ABOUT: “Rename” modal */
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
          style={{ background:GREEN, color:'#fff', fontSize:12.5 }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN)}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

/* ABOUT: “Confirm Delete” modal */
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
                style={{ background:GREEN, color:'#fff', fontSize:12.5 }}
                onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN_HOVER)}
                onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN)}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ───────────────────────── Row (assistant item) ─────────────────────────────
   ABOUT:
   - Active row: soft green background overlay (30%) + green halo — NO border
   - Hover row: same green overlay (a bit softer) + halo
   - Avatar: thin border to match theme
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
        minHeight: 60,
        // green overlay under content (active) — exactly ~30% opacity as requested
        background: active
          ? `linear-gradient(0deg, ${GREEN_OL30}, ${GREEN_OL30})`
          : 'transparent',
        border: '1px solid transparent', // no visible border, we’re using shadow halos
        color: 'var(--sidebar-text)',
        boxShadow: active
          ? `0 12px 28px rgba(0,0,0,.36), 0 0 0 1px ${GREEN_OL18}, 0 0 18px ${GREEN_OL18}`
          : 'none',
        fontFamily: 'var(--font-movatif, inherit)',
      }}
    >
      <div
        className="w-10 h-10 rounded-md grid place-items-center"
        style={{ background:'var(--rail-avatar-bg)', border:'1px solid var(--sidebar-border)' }}
      >
        <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
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

      {/* ABOUT: green hover effect (overlay + halo), softer than active */}
      <style jsx>{`
        .rail-row:hover{
          background: linear-gradient(0deg, ${GREEN_OL14}, ${GREEN_OL14});
          box-shadow: 0 10px 24px rgba(0,0,0,.32), 0 0 0 1px ${GREEN_OL14}, 0 0 14px ${GREEN_OL14};
        }
      `}</style>
    </button>
  );
}

/* ─────────────────────────────── Main rail ─────────────────────────────────
   ABOUT:
   - Movatif font (via CSS var) applied to the whole panel
   - Search bar: **hairline** border (0.5px) and white-ish in dark mode
   - “Create Assistant” small white text on green, hover to deeper green
   - Emits assistant:active events so VoiceAgentSection stays independent
──────────────────────────────────────────────────────────────────────────── */
export default function AssistantRail() {
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [q,setQ] = useState('');
  const [createOpen,setCreateOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);

  // ABOUT: initial load + restore selection
  useEffect(()=>{ (async()=>{
    const list = await loadAssistants();
    setAssistants(list);
    const savedActive = (()=>{ try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } })();
    const firstId = savedActive && list.find(a=>a.id===savedActive) ? savedActive : (list[0]?.id || '');
    setActiveId(firstId);
    if (firstId) writeActive(firstId);
  })(); },[]);

  // ABOUT: filter by query (name or purpose)
  const filtered = useMemo(()=> {
    const s=q.trim().toLowerCase();
    return !s?assistants:assistants.filter(a=>a.name.toLowerCase().includes(s) || (a.purpose||'').toLowerCase().includes(s));
  },[assistants,q]);

  // ABOUT: select row + broadcast
  function select(id:string){ setActiveId(id); writeActive(id); }

  // ABOUT: create → save → select new
  function addAssistant(name:string){
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'' };
    const next=[a, ...assistants];
    setAssistants(next); saveAssistants(next);
    select(a.id);
    setCreateOpen(false);
  }

  // ABOUT: rename in-place
  function saveRename(name:string){
    const next=assistants.map(x=> x.id===renId ? {...x, name} : x);
    setAssistants(next); saveAssistants(next); setRenId(null);
  }

  // ABOUT: delete + fix selection
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
    <div
      className="assistant-rail px-3 py-3 h-full"
      style={{
        background:'var(--sidebar-bg)',
        borderRight:'1px solid rgba(255,255,255,.14)',   // ABOUT: rail divider (thin, white-ish)
        color:'var(--sidebar-text)',
        fontFamily: 'var(--font-movatif, inherit)',      // ABOUT: Movatif font if provided globally
      }}
    >
      {/* ABOUT: primary CTA (small white text, green bg, hover darker green) */}
      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold mb-3"
        style={{ height: 38, background: GREEN, color: '#fff', fontSize: 12.5 }}
        onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN_HOVER)}
        onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=GREEN)}
        onClick={()=> setCreateOpen(true)}
      >
        <Plus className="w-4 h-4" /> Create Assistant
      </button>

      {/* ABOUT: search input — ultra-thin border (0.5px).
                Dark: white-ish border; Light: neutral. */}
      <div className="relative mb-3">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          placeholder="Search assistants"
          className="w-full h-[32px] rounded-[10px] pl-8 pr-3 text-sm outline-none"
          style={{
            background:'var(--rail-input-bg)',
            // Hairline border: some browsers ignore <1px; we safeguard with box-shadow
            border: '0.5px solid var(--rail-input-border)',
            boxShadow: '0 0 0 0.5px var(--rail-input-border)',
            color:'var(--rail-input-text)',
          }}
        />
        <Search
          className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2"
          style={{ color:'var(--rail-input-muted)' }}
        />
      </div>

      {/* ABOUT: section label */}
      <div className="text-[11px] font-semibold tracking-[.12em] mb-2" style={{ color:'var(--sidebar-muted)' }}>
        ASSISTANTS
      </div>

      {/* ABOUT: scrollable list */}
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

      {/* ABOUT: modals */}
      <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={addAssistant} />
      <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
      <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />

      {/* ABOUT: theme tokens (light vs dark) for input/chips/selected bg */}
      <style jsx>{`
        /* Light theme */
        :global(:root:not([data-theme="dark"])) .assistant-rail{
          --rail-input-bg: #fff;
          --rail-input-border: rgba(0,0,0,.18);    /* neutral hairline for light */
          --rail-input-text: #0f172a;
          --rail-input-muted: #64748b;

          --rail-avatar-bg: rgba(0,0,0,.06);
          --rail-chip-bg: #fff;
          --rail-chip-border: rgba(0,0,0,.12);
        }
        /* Dark theme */
        :global([data-theme="dark"]) .assistant-rail{
          --rail-input-bg: var(--card);
          --rail-input-border: rgba(255,255,255,.78);  /* white-ish hairline in dark */
          --rail-input-text: var(--text);
          --rail-input-muted: var(--text-muted);

          --rail-avatar-bg: rgba(255,255,255,.06);
          --rail-chip-bg: var(--card);
          --rail-chip-border: var(--border);
        }

        /* ABOUT: placeholder tint follows token */
        .assistant-rail input::placeholder{ color: var(--rail-input-muted); opacity: .9; }
      `}</style>
    </div>
  );
}
