// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Bot, Trash2, Edit3, AlertTriangle,
  Loader2, FolderPlus, Folder, ArrowLeft
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

/* Optional scoped storage helper (falls back to localStorage if missing) */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* Types */
export type AssistantLite = {
  id: string; name: string; purpose?: string; createdAt?: number; folderId?: string | null
};
type FolderLite = { id: string; name: string; createdAt?: number };

/* Keys */
const STORAGE_KEY      = 'agents';
const FOLDERS_KEY      = 'agentFolders';
const ACTIVE_KEY       = 'va:activeId';
const ACTIVE_FOLDERKEY = 'va:activeFolderId';

/* Brand */
const CTA         = '#59d9b3';                 // bright brand green (icons, glow)
const CTA_HOVER   = '#54cfa9';
const GREEN_LINE  = 'rgba(89,217,179,.20)';    // faint green hairline (borders)
const OVERLAY_BG  = 'rgba(8,10,12,.72)';       // overlay scrim
const BOX_SHADOW  = '0 22px 44px rgba(0,0,0,.36), 0 0 0 1px rgba(255,255,255,.05) inset, 0 0 0 1px rgba(89,217,179,.20)';
const ITEM_SHADOW = '0 12px 28px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.05) inset, 0 0 0 1px rgba(89,217,179,.20)';

/* Glow strengths */
const GLOW_HOVER_OPACITY  = 0.22;  // hover
const GLOW_ACTIVE_OPACITY = 0.32;  // active/working

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
async function loadFolders(): Promise<FolderLite[]> {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); return await ss.getJSON<FolderLite[]>(FOLDERS_KEY, []); } } catch {}
  try { const raw = localStorage.getItem(FOLDERS_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
async function saveFolders(list: FolderLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(FOLDERS_KEY, list); } } catch {}
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(list)); } catch {}
}
function writeActive(id:string){
  try { localStorage.setItem(ACTIVE_KEY, id); } catch {}
  try { window.dispatchEvent(new CustomEvent('assistant:active', { detail: id })); } catch {}
}

/* ---------- Modal shells (PORTALED) ---------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      {/* blurred scrim */}
      <motion.div
        className="fixed inset-0 z-[100000] pointer-events-auto"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background: OVERLAY_BG, backdropFilter: 'blur(6px)' }}
      />
      {/* narrow, taller, less rounded sheet */}
      <motion.div
        className="fixed inset-0 z-[100001] flex items-center justify-center px-4"
        initial={{ opacity: 0, scale: .98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: .98, y: -6 }}
        transition={{ type:'tween', duration: .18 }}
      >
        <div
          className="w-full max-w-[640px] rounded-[10px] overflow-hidden"
          style={{
            background: 'var(--panel)',
            color: 'var(--text)',
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: BOX_SHADOW
          }}
        >
          {children}
        </div>
      </motion.div>
    </>,
    document.body
  );
}

function ModalHeader({ icon, title, subtitle }:{
  icon:React.ReactNode; title:string; subtitle?:string;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 py-5"
      style={{
        background: `linear-gradient(90deg,
          var(--panel) 0%,
          color-mix(in oklab, var(--panel) 97%, white 3%) 50%,
          var(--panel) 100%)`,
        borderBottom: `1px solid ${GREEN_LINE}`
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--brand-weak)' }}>
          {/* icon stays bright CTA */}
          <span style={{ color: CTA }}>{icon}</span>
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      {/* no “X” — you asked to remove it */}
      <div />
    </div>
  );
}

/* ---------- Create / Rename / Delete MODALS ---------- */
function CreateAssistantModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name,setName] = useState('');
  useEffect(()=>{ if(open) setName(''); },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-5 h-5" />} title="Create Assistant" />
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[46px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.65)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:'#ffffff', color:'#0b0f0e', border:`1px solid ${GREEN_LINE}` }}
        >
          Create
        </button>
      </div>
    </ModalShell>
  );
}

function CreateFolderModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name,setName] = useState('');
  useEffect(()=>{ if(open) setName(''); },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<FolderPlus className="w-5 h-5" />} title="New Folder" />
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Folder Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[46px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          placeholder="e.g., Team A" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.65)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:'#ffffff', color:'#0b0f0e', border:`1px solid ${GREEN_LINE}` }}
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
      <ModalHeader icon={<Edit3 className="w-5 h-5" />} title="Rename Assistant" />
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input value={val} onChange={(e)=>setVal(e.target.value)}
               className="w-full h-[46px] rounded-[10px] px-3 text-sm outline-none"
               style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }} />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.65)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onSave(val.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:'#ffffff', color:'#0b0f0e', border:`1px solid ${GREEN_LINE}` }}
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
        icon={<AlertTriangle className="w-5 h-5" />}
        title="Delete Assistant"
        subtitle="This action cannot be undone."
      />
      <div className="px-6 py-5 text-sm" style={{ color:'var(--text)' }}>
        Delete <b>“{name||'assistant'}”</b>?
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.65)', color:'var(--text)' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'#ef4444', color:'#ffffff', border:'1px solid rgba(239,68,68,.6)' }}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Assistant Row (no border; text-only; green glow) ---------- */
function AssistantRow({
  a, active, onClick, onRename, onDelete, onDragStart
}:{
  a:AssistantLite; active:boolean; onClick:()=>void; onRename:()=>void; onDelete:()=>void; onDragStart:(id:string)=>void;
}) {
  return (
    <button
      draggable
      onDragStart={()=>onDragStart(a.id)}
      onClick={onClick}
      className="ai-row w-full text-left rounded-[12px] px-3 py-3 flex items-center gap-2 group transition relative"
      data-active={active ? 'true' : 'false'}
      style={{
        minHeight: 54,
        background: 'var(--panel)',  // NO border on assistant rows
        color: 'var(--sidebar-text)',
        overflow: 'hidden'
      }}
    >
      {/* icon stays bright */}
      <Bot className="w-4 h-4 shrink-0" style={{ color: CTA }} />

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium truncate" style={{ color:'var(--text)' }}>{a.name}</div>
        <div className="text-[11px] truncate" style={{ color:'var(--sidebar-muted)' }}>
          {a.purpose || '—'}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e)=>{ e.stopPropagation(); onRename(); }}
          className="px-2 h-[30px] rounded-[10px]"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          aria-label="Rename"
        >
          <Edit3 className="w-4 h-4" style={{ color: CTA }} />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          className="px-2 h-[30px] rounded-[10px]"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" style={{ color: CTA }} />
        </button>
      </div>

      {/* green glow overlay */}
      <style jsx>{`
        .ai-row::after{
          content:'';
          position:absolute; inset:0;
          border-radius:12px;
          background:${CTA};
          opacity:0;
          pointer-events:none;
          transition: opacity .18s ease, transform .18s ease;
          mix-blend-mode:screen;
        }
        .ai-row:hover::after{ opacity:${GLOW_HOVER_OPACITY}; }
        .ai-row[data-active="true"]::after{ opacity:${GLOW_ACTIVE_OPACITY}; }
        .ai-row:hover{ transform: translateY(-1px); }
      `}</style>
    </button>
  );
}

/* ---------- Folder row (with border; droppable) ---------- */
function FolderRow({
  f, onOpen, onDropIds
}:{
  f:FolderLite; onOpen:()=>void; onDropIds:(ids:string[])=>void;
}) {
  return (
    <button
      onClick={onOpen}
      onDragOver={(e)=>{ e.preventDefault(); }}
      onDrop={(e)=>{
        e.preventDefault();
        const ids = (e.dataTransfer.getData('text/plain')||'').split(',').filter(Boolean);
        if (ids.length) onDropIds(ids);
      }}
      className="w-full text-left rounded-[12px] px-3 py-3 flex items-center gap-2 transition relative"
      style={{
        background:'var(--panel)',
        border:`1px solid ${GREEN_LINE}`,
        boxShadow: ITEM_SHADOW,
        color:'var(--text)'
      }}
    >
      <Folder className="w-4 h-4" style={{ color: CTA }} />
      <div className="min-w-0 flex-1 truncate">{f.name}</div>
    </button>
  );
}

/* ---------- Main rail ---------- */
export default function AssistantRail() {
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [folders,setFolders] = useState<FolderLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [activeFolderId,setActiveFolderId] = useState<string|''>('');
  const [overlayScreen,setOverlayScreen] = useState(false);  // full-screen page freeze on select
  const [initialLoading,setInitialLoading] = useState(true);
  const [q,setQ] = useState('');
  const [createAssistantOpen,setCreateAssistantOpen] = useState(false);
  const [createFolderOpen,setCreateFolderOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);

  /* initial load + restore selection + folder scope */
  useEffect(()=>{ (async()=>{
    const [list, flds] = await Promise.all([loadAssistants(), loadFolders()]);
    setAssistants(list);
    setFolders(flds);
    const savedActive = (()=>{ try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } })();
    const savedFolder = (()=>{ try { return localStorage.getItem(ACTIVE_FOLDERKEY) || ''; } catch { return ''; } })();
    const firstId = savedActive && list.find(a=>a.id===savedActive) ? savedActive : (list[0]?.id || '');
    setActiveId(firstId);
    if (firstId) writeActive(firstId);
    setActiveFolderId(savedFolder || '');
    setTimeout(()=>setInitialLoading(false), 380);
  })(); },[]);

  /* filter by query + folder scope */
  const filtered = useMemo(()=> {
    const s=q.trim().toLowerCase();
    const scoped = activeFolderId ? assistants.filter(a=>a.folderId===activeFolderId) : assistants;
    const base = scoped.filter(a=>{
      const hay = `${a.name} ${(a.purpose||'')}`.toLowerCase();
      if (!s) return true; return hay.includes(s);
    });
    return activeFolderId ? base : base.filter(a=>!a.folderId); // in All: only unfiled assistants list (folders shown above)
  },[assistants,q,activeFolderId]);

  function select(id:string){
    // freeze page immediately
    setOverlayScreen(true);
    // let the overlay paint before we switch
    setTimeout(()=>{
      setActiveId(id);
      writeActive(id);
      // keep the freeze for a bit to feel legit
      setTimeout(()=> setOverlayScreen(false), 650);
    }, 0);
  }

  /* CRUD assistants */
  function addAssistant(name:string){
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'', folderId: activeFolderId||null };
    const next=[a, ...assistants];
    setAssistants(next); saveAssistants(next);
    setCreateAssistantOpen(false);
    select(a.id);
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
      const nid = next.find(a=> activeFolderId ? a.folderId===activeFolderId : !a.folderId)?.id || '';
      if (nid) { setActiveId(nid); writeActive(nid); }
      else { setActiveId(''); }
    }
    setDelId(null);
  }

  /* Folders */
  function createFolder(name:string){
    const f:FolderLite = { id: uid(), name, createdAt: Date.now() };
    const next=[f, ...folders];
    setFolders(next); saveFolders(next);
    setCreateFolderOpen(false);
  }
  function moveAssistantsToFolder(ids:string[], folderId:string|null){
    const next = assistants.map(a => ids.includes(a.id) ? { ...a, folderId } : a);
    setAssistants(next); saveAssistants(next);
  }

  /* Drag */
  function onRowDragStart(id:string){
    try { (event as DragEvent)?.dataTransfer?.setData('text/plain', id); } catch {}
  }

  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;

  const visibleFolders = useMemo(()=> folders, [folders]);
  const inAllScope = !activeFolderId;

  return (
    <>
      <div
        className="assistant-rail h-full flex flex-col"
        /* Keep body the same vibe as the top header background */
        style={{
          background: `linear-gradient(90deg,
            var(--panel) 0%,
            color-mix(in oklab, var(--panel) 97%, white 3%) 50%,
            var(--panel) 100%)`,
          borderRight:`1px solid ${GREEN_LINE}`,
          color:'var(--sidebar-text)',
        }}
      >
        {/* Top header (unchanged look) */}
        <div
          className="px-3 py-3"
          style={{
            background: `linear-gradient(90deg,
              var(--panel) 0%,
              color-mix(in oklab, var(--panel) 97%, white 3%) 50%,
              var(--panel) 100%)`,
            borderBottom:`1px solid ${GREEN_LINE}`,
            boxShadow: BOX_SHADOW
          }}
        >
          {/* Buttons fill the row with no gap */}
          <div className="grid grid-cols-2 gap-0">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-l-[10px] font-semibold"
              style={{ height: 36, width:'100%', background: CTA, color:'#ffffff', boxShadow:'0 10px 22px rgba(0,0,0,.24)', border:`1px solid ${GREEN_LINE}` }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
              onClick={()=> setCreateAssistantOpen(true)}
            >
              <Plus className="w-4 h-4" style={{ color:'#fff' }} />
              Create
            </button>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-r-[10px] font-semibold"
              style={{ height: 36, width:'100%', background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}`, boxShadow: ITEM_SHADOW }}
              onClick={()=> setCreateFolderOpen(true)}
            >
              <FolderPlus className="w-4 h-4" style={{ color: CTA }} />
              + Folder
            </button>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Search assistants"
              className="w-full h-[34px] rounded-[10px] pl-8 pr-3 text-sm outline-none"
              style={{
                background:'var(--panel)',
                border: `1px solid ${GREEN_LINE}`,
                boxShadow: '0 0 0 1px rgba(255,255,255,.06) inset',
                color:'var(--text)'
              }}
            />
            <Search
              className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: CTA }}
            />
          </div>

          {/* Folder scope / breadcrumb */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--sidebar-muted)' }}>
              {inAllScope ? 'ALL' : 'FOLDER'}
            </div>
            {!inAllScope && (
              <button
                onClick={()=>{ setActiveFolderId(''); try{ localStorage.setItem(ACTIVE_FOLDERKEY,''); }catch{} }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: CTA }} /> Back to All
              </button>
            )}
          </div>
        </div>

        {/* LIST */}
        <div className="px-3 py-3 overflow-auto" style={{ flex:1 }}>
          {/* In ALL: show folders first */}
          {inAllScope && (
            <>
              {visibleFolders.length>0 && (
                <div className="mb-2">
                  <div className="mb-2 text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--sidebar-muted)' }}>
                    FOLDERS
                  </div>
                  <div className="grid gap-2">
                    {visibleFolders.map(f=>(
                      <FolderRow
                        key={f.id}
                        f={f}
                        onOpen={()=>{
                          setActiveFolderId(f.id);
                          try{ localStorage.setItem(ACTIVE_FOLDERKEY, f.id); }catch{}
                        }}
                        onDropIds={(ids)=> moveAssistantsToFolder(ids, f.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* separator line between folders and assistants */}
              <div className="my-3 h-px" style={{ background: GREEN_LINE }} />
            </>
          )}

          <div className="space-y-2">
            {/* Initial skeletons */}
            {initialLoading && (
              <>
                {[0,1,2,3].map(i=>(
                  <div key={i} className="rounded-[12px] h-[54px] w-full animate-pulse"
                       style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, boxShadow: ITEM_SHADOW, opacity:.65 }} />
                ))}
              </>
            )}

            {!initialLoading && (
              <AnimatePresence initial={false}>
                {filtered.map(a=>(
                  <motion.div key={a.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}>
                    <AssistantRow
                      a={a}
                      active={a.id===activeId}
                      onClick={()=>select(a.id)}
                      onRename={()=>setRenId(a.id)}
                      onDelete={()=>setDelId(a.id)}
                      onDragStart={onRowDragStart}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}

            {!initialLoading && filtered.length===0 && (
              <div className="text-xs py-8 text-center" style={{ color:'var(--sidebar-muted)' }}>
                No assistants found.
              </div>
            )}
          </div>
        </div>

        {/* Modals */}
        <CreateAssistantModal open={createAssistantOpen} onClose={()=>setCreateAssistantOpen(false)} onCreate={addAssistant} />
        <CreateFolderModal open={createFolderOpen} onClose={()=>setCreateFolderOpen(false)} onCreate={createFolder} />
        <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
        <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />

        {/* Rail theme tokens */}
        <style jsx>{`
          /* Light */
          :global(:root:not([data-theme="dark"])) .assistant-rail{
            --sidebar-text: #0f172a;
            --sidebar-muted: #64748b;
            --panel: #ffffff;
            --text: #0f172a;
            --text-muted: #64748b;
          }
          /* Dark */
          :global([data-theme="dark"]) .assistant-rail{
            --sidebar-text: var(--text);
            --sidebar-muted: var(--text-muted);
            /* --panel inherits from your app tokens */
          }
        `}</style>
      </div>

      {/* FULL-SCREEN FREEZE LOADER */}
      <AnimatePresence>
        {overlayScreen && (
          <motion.div
            key="assistant-switch"
            className="fixed inset-0 z-[100010] flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: OVERLAY_BG, backdropFilter:'blur(6px)' }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-[10px]"
              style={{
                border: `1px solid ${GREEN_LINE}`,
                background: 'var(--panel)',
                boxShadow: BOX_SHADOW,
                color:'var(--text)'
              }}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: CTA }} />
                <div className="text-sm">Loading assistant…</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
