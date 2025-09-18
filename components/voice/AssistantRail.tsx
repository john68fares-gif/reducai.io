// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Bot, Trash2, Edit3, AlertTriangle, Loader2,
  FolderPlus, Folder, ArrowLeft
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

/* Optional scoped storage helper */
type Scoped = { getJSON<T>(k:string,f:T):Promise<T>; setJSON(k:string,v:unknown):Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* Types */
export type AssistantLite = {
  id: string; name: string; purpose?: string; createdAt?: number; folderId?: string | null
};
type FolderLite = { id: string; name: string; createdAt?: number };

/* Keys */
const STORAGE_KEY       = 'agents';
const FOLDERS_KEY       = 'agentFolders';
const ACTIVE_KEY        = 'va:activeId';
const ACTIVE_FOLDER_KEY = 'va:activeFolderId';

/* Brand */
const CTA        = '#59d9b3';
const CTA_HOVER  = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';

/* Row glow overlays (use ::after so it “sits on top”) */
const HOVER_OPACITY  = 0.18; // ~18%
const ACTIVE_OPACITY = 0.28; // ~28%

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

/* ---------- Modal shells (PORTALED + blur backdrop) ---------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100000]"
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
      />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <div
          className="w-full max-w-[720px] rounded-[14px] overflow-hidden"
          style={{ background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}` }}
        >
          {children}
        </div>
      </div>
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
        background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
        borderBottom:`1px solid ${GREEN_LINE}`
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
      {/* no X */}
      <span className="w-5 h-5" />
    </div>
  );
}

/* Modals */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name,setName] = useState('');
  useEffect(()=>{ if(open) setName(''); },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-5 h-5" style={{ color:CTA }}/>} title="Create Assistant" />
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button
          onClick={onClose}
          className="w-full h-[44px] rounded-[10px] font-semibold"
          style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.8)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#fff' }}
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
      <ModalHeader icon={<Edit3 className="w-5 h-5" style={{ color:CTA }}/>} title="Rename Assistant" />
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input value={val} onChange={(e)=>setVal(e.target.value)}
               className="w-full h-[44px] rounded-[10px] px-3 text-sm outline-none"
               style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }} />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.8)', color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onSave(val.trim())}
          className="w-full h-[44px] rounded-[10px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#fff' }}
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
        icon={<AlertTriangle className="w-5 h-5" style={{ color:'#ef4444' }}/>}
        title="Delete Assistant" subtitle="This action cannot be undone."
      />
      <div className="px-6 py-5 text-sm" style={{ color:'var(--text)' }}>
        Delete <b>“{name||'assistant'}”</b>?
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.8)', color:'var(--text)' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
                className="w-full h-[44px] rounded-[10px] font-semibold"
                style={{ background:'#ef4444', color:'#fff' }}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Text-only assistant row with green overlay glow ---------- */
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
      className={`ai-row group w-full text-left rounded-[12px] px-3 py-3 flex items-center gap-2 transition`}
      data-active={active ? 'true' : 'false'}
      style={{ background:'transparent', color:'var(--text)', position:'relative' }}
    >
      {/* icons = same CTA green as boxes */}
      <Bot className="w-4 h-4" style={{ color: CTA }} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold truncate">{a.name}</div>
        <div className="text-[12px] truncate" style={{ color:'var(--sidebar-muted)' }}>
          {a.purpose || '—'}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e)=>{ e.stopPropagation(); onRename(); }}
          className="px-2 h-[28px] rounded-[8px]"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          aria-label="Rename"
        >
          <Edit3 className="w-4 h-4" style={{ color:CTA }} />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          className="px-2 h-[28px] rounded-[8px]"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" style={{ color:CTA }} />
        </button>
      </div>

      {/* green overlay glow */}
      <style jsx>{`
        .ai-row::after{
          content:'';
          position:absolute; inset:0;
          border-radius:12px;
          background: ${CTA};
          opacity: 0; /* default off */
          pointer-events:none;
          transition: opacity .18s ease, transform .18s ease;
          mix-blend-mode: normal;
        }
        .ai-row:hover::after{ opacity: ${HOVER_OPACITY}; }
        .ai-row[data-active="true"]::after{ opacity: ${ACTIVE_OPACITY}; }
        .ai-row:hover{ transform: translateY(-1px); }
      `}</style>
    </button>
  );
}

/* ---------- Folder row (droppable) ---------- */
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
      className="w-full text-left rounded-[12px] px-3 py-2 flex items-center gap-2 transition"
      style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
    >
      <Folder className="w-4 h-4" style={{ color: CTA }} />
      <div className="min-w-0 flex-1 truncate">{f.name}</div>
    </button>
  );
}

/* ---------- Main Rail ---------- */
export default function AssistantRail() {
  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [folders,setFolders] = useState<FolderLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [activeFolderId,setActiveFolderId] = useState<string|''>('');
  const [veil,setVeil] = useState(false);               // full-screen loader (portal)
  const [initialLoading,setInitialLoading] = useState(true);
  const [q,setQ] = useState('');
  const [createOpen,setCreateOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);

  /* New Folder modal */
  const [newFolderOpen,setNewFolderOpen] = useState(false);
  const [newFolderName,setNewFolderName] = useState('');

  useEffect(()=>{ (async()=>{
    const [list,flds] = await Promise.all([loadAssistants(), loadFolders()]);
    setAssistants(list);
    setFolders(flds);

    const savedActive = (()=>{ try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } })();
    const savedFolder = (()=>{ try { return localStorage.getItem(ACTIVE_FOLDER_KEY) || ''; } catch { return ''; } })();

    const firstId = savedActive && list.find(a=>a.id===savedActive) ? savedActive : (list[0]?.id || '');
    setActiveId(firstId);
    if (firstId) writeActive(firstId);

    setActiveFolderId(savedFolder || '');
    setTimeout(()=>setInitialLoading(false), 320);
  })(); },[]);

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase();
    const scope = activeFolderId ? (a:AssistantLite)=>a.folderId===activeFolderId : (a:AssistantLite)=>!a.folderId;
    return assistants.filter(scope).filter(a=>{
      if(!s) return true;
      return (a.name.toLowerCase() + ' ' + (a.purpose||'').toLowerCase()).includes(s);
    });
  },[assistants,q,activeFolderId]);

  function select(id:string){
    setVeil(true);                  // show full-screen veil
    setActiveId(id);
    writeActive(id);
    window.setTimeout(()=> setVeil(false), 750);
  }

  /* Assistant CRUD */
  function addAssistant(name:string){
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'', folderId: activeFolderId||null };
    const next=[a, ...assistants];
    setAssistants(next); saveAssistants(next);
    setCreateOpen(false);
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
      setActiveId(nid); if (nid) writeActive(nid);
    }
    setDelId(null);
  }

  /* Folders */
  function createFolder(name:string){
    const f:FolderLite = { id: uid(), name, createdAt: Date.now() };
    const next=[f, ...folders];
    setFolders(next); saveFolders(next);
  }
  function moveAssistantsToFolder(ids:string[], folderId:string|null){
    const next = assistants.map(a => ids.includes(a.id) ? { ...a, folderId } : a);
    setAssistants(next); saveAssistants(next);
  }

  function onRowDragStart(id:string){
    try { (event as DragEvent)?.dataTransfer?.setData('text/plain', id); } catch {}
  }

  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;

  const inAllScope = !activeFolderId;
  const visibleFolders = folders;

  return (
    <>
      <div
        className="assistant-rail h-full flex flex-col"
        /* background stays aligned with the top; NOT changing it */
        style={{ background:'var(--panel)', borderRight:`1px solid ${GREEN_LINE}`, color:'var(--sidebar-text)' }}
      >
        {/* TOP — UNTOUCHED except for icon greens */}
        <div
          className="px-3 py-3"
          style={{
            background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
            borderBottom:`1px solid ${GREEN_LINE}`
          }}
        >
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold px-3"
              style={{ height:36, background:CTA, color:'#fff', border:`1px solid ${GREEN_LINE}` }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
              onClick={()=> setCreateOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
            <div className="flex justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-[10px] w-[36px]"
                style={{ height:36, background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}` }}
                onClick={()=>{ setNewFolderName(''); setNewFolderOpen(true); }}
                aria-label="New Folder"
              >
                <FolderPlus className="w-4 h-4" style={{ color:CTA }} />
              </button>
            </div>
          </div>

          <div className="mt-3 relative">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Search assistants"
              className="w-full h-[34px] rounded-[10px] pl-8 pr-3 text-sm outline-none"
              style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
            />
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }} />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--sidebar-muted)' }}>
              {inAllScope ? 'ALL' : 'FOLDER'}
            </div>
            {!inAllScope && (
              <button
                onClick={()=>{ setActiveFolderId(''); try{ localStorage.setItem(ACTIVE_FOLDER_KEY,''); }catch{} }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color:CTA }} /> Back to All
              </button>
            )}
          </div>
        </div>

        {/* LIST */}
        <div className="px-3 py-3 overflow-auto" style={{ flex:1 }}>
          {inAllScope && visibleFolders.length>0 && (
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
                      try{ localStorage.setItem(ACTIVE_FOLDER_KEY, f.id); }catch{}
                    }}
                    onDropIds={(ids)=> moveAssistantsToFolder(ids, f.id)}
                  />
                ))}
              </div>
              <div className="mt-3 mb-1" style={{ height:1, background:GREEN_LINE }} />
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-3">
              {[0,1,2,3].map(i=>(
                <div key={i} className="h-[42px] rounded-[10px] animate-pulse"
                     style={{ background:'color-mix(in oklab, var(--panel) 90%, white 10%)', opacity:.55 }} />
              ))}
            </div>
          ) : (
            <div className="space-y-0.5">
              <AnimatePresence initial={false}>
                {filtered.map(a=>(
                  <motion.div key={a.id} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}>
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

              {filtered.length===0 && (
                <div className="text-xs py-8 text-center" style={{ color:'var(--sidebar-muted)' }}>
                  No assistants found.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Assistant modals */}
        <CreateModal  open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={addAssistant} />
        <RenameModal  open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
        <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />

        {/* New Folder modal (overlay) */}
        <AnimatePresence>
          {newFolderOpen && (
            <ModalShell>
              <ModalHeader icon={<FolderPlus className="w-5 h-5" style={{ color:CTA }}/>} title="New Folder" />
              <div className="px-6 py-5">
                <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Folder name</label>
                <input
                  value={newFolderName}
                  onChange={(e)=>setNewFolderName(e.target.value)}
                  className="w-full h-[44px] rounded-[10px] px-3 text-sm outline-none"
                  style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                  placeholder="e.g., Sales Team"
                  autoFocus
                />
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={()=>setNewFolderOpen(false)}
                  className="w-full h-[44px] rounded-[10px] font-semibold"
                  style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.8)', color:'var(--text)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={()=>{
                    const v=newFolderName.trim();
                    if(!v) return;
                    createFolder(v);
                    setNewFolderOpen(false);
                  }}
                  className="w-full h-[44px] rounded-[10px] font-semibold"
                  style={{ background:CTA, color:'#fff' }}
                >
                  Create
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* Theme tokens */}
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
          }
        `}</style>
      </div>

      {/* FULL-SCREEN loading veil (highest z, portal) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {veil && (
            <motion.div
              key="switch-veil"
              className="fixed inset-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ zIndex: 2147483647, background:'rgba(0,0,0,.72)', backdropFilter:'blur(4px)' }}
            >
              <div className="w-full h-full grid place-items-center">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color:'#fff' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
