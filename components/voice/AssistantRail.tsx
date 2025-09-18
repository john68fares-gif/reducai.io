'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle, Loader2, FolderPlus, Folder, ArrowLeft
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
const CTA        = '#59d9b3';
const CTA_HOVER  = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';     // green outline like your boxes
const LIGHT_OVERLAY = 'rgba(0,0,0,0.60)';

/* Shadows to mirror “overlay box” feel */
const BOX_SHADOW      = '0 22px 44px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.60) inset, 0 0 0 1px rgba(89,217,179,.20)';
const ITEM_SHADOW     = '0 10px 24px rgba(0,0,0,.08), 0 0 0 1px rgba(255,255,255,.50) inset, 0 0 0 1px rgba(89,217,179,.16)';
const HOVER_BOXSHADOW = '0 16px 36px rgba(0,0,0,.10), 0 0 0 1px rgba(255,255,255,.55) inset, 0 0 0 1px rgba(89,217,179,.26)';

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

/* ---------- Modal shells (PORTALED, light overlay style) ---------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[100000] pointer-events-auto animate-[fadeIn_140ms_ease]" style={{ background: LIGHT_OVERLAY }} />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <div
          className="w-full max-w-[720px] rounded-[16px] overflow-hidden animate-[popIn_140ms_ease]"
          style={{
            background: 'var(--panel)',
            color: 'var(--text)',
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: BOX_SHADOW
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
        background: `linear-gradient(90deg,
          var(--panel) 0%,
          color-mix(in oklab, var(--panel) 97%, white 3%) 50%,
          var(--panel) 100%)`,
        borderBottom: `1px solid ${GREEN_LINE}`
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

/* Create Assistant */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name,setName] = useState('');
  const [saving,setSaving] = useState(false);
  useEffect(()=>{ if(open){ setName(''); setSaving(false); } },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-5 h-5" style={{ color:CTA }}/>} title="Create Assistant" onClose={onClose}/>
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] rounded-[12px] px-3 text-sm outline-none"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', boxShadow:'inset 0 1px 0 rgba(0,0,0,.04)' }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[12px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can||saving}
          onClick={async()=>{ if(!can) return; setSaving(true); await new Promise(r=>setTimeout(r,420)); onCreate(name.trim()); setSaving(false); }}
          className="w-full h-[44px] rounded-[12px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background:CTA, color:'#ffffff', boxShadow:'0 10px 22px rgba(0,0,0,.12)', border:`1px solid ${GREEN_LINE}` }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
        >
          {saving ? <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /> : <Plus className="w-4 h-4" />}
          Create
        </button>
      </div>
    </ModalShell>
  );
}

/* Rename / Delete */
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
               className="w-full h-[44px] rounded-[12px] px-3 text-sm outline-none"
               style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }} />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[12px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> onSave(val.trim())}
          className="w-full h-[44px] rounded-[12px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#ffffff', border:`1px solid ${GREEN_LINE}` }}
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
                className="w-full h-[44px] rounded-[12px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}>
          Cancel
        </button>
        <button onClick={onConfirm}
                className="w-full h-[44px] rounded-[12px] font-semibold"
                style={{ background:CTA, color:'#ffffff', border:`1px solid ${GREEN_LINE}` }}
                onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
                onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Create Folder (OVERLAY) ---------- */
function CreateFolderModal({
  open, onClose, onCreate
}:{ open:boolean; onClose:()=>void; onCreate:(name:string)=>Promise<void>|void }) {
  const [name,setName]=useState(''); const [saving,setSaving]=useState(false);
  useEffect(()=>{ if(open){ setName(''); setSaving(false);} },[open]);
  if(!open) return null;
  const can = name.trim().length>1;
  return (
    <ModalShell>
      <ModalHeader icon={<FolderPlus className="w-5 h-5" style={{ color:CTA }}/>} title="Create Folder" onClose={onClose}/>
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Folder name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] rounded-[12px] px-3 text-sm outline-none"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          placeholder="e.g., Team A"
          autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] rounded-[12px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}>
          Cancel
        </button>
        <button
          disabled={!can||saving}
          onClick={async ()=>{ if(!can) return; setSaving(true); await new Promise(r=>setTimeout(r,420)); await onCreate(name.trim()); setSaving(false); }}
          className="w-full h-[44px] rounded-[12px] font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
          style={{ background:CTA, color:'#ffffff', border:`1px solid ${GREEN_LINE}` }}
          onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
          onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
        >
          {saving ? <span className="w-4 h-4 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /> : <FolderPlus className="w-4 h-4" />}
          Create
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Row (assistant item) ---------- */
function Row({
  a, active, onClick, onRename, onDelete, onDragStart
}:{
  a:AssistantLite; active:boolean; onClick:()=>void; onRename:()=>void; onDelete:()=>void; onDragStart:(id:string)=>void;
}) {
  return (
    <button
      draggable
      onDragStart={()=>onDragStart(a.id)}
      onClick={onClick}
      className="rail-row w-full text-left rounded-[12px] px-3 flex items-center gap-2 group transition will-change-transform"
      style={{
        minHeight: 60,
        background: 'var(--panel)',
        border: `1px solid ${GREEN_LINE}`,
        boxShadow: active ? HOVER_BOXSHADOW : ITEM_SHADOW,
        color: 'var(--sidebar-text)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        className="relative w-10 h-10 rounded-md grid place-items-center shrink-0"
        style={{
          background:'linear-gradient(135deg,#f7fafc 0%,#f1f5f9 100%)',
          border:`1px solid ${GREEN_LINE}`,
          boxShadow:'inset 0 1px 0 rgba(255,255,255,.8)'
        }}
      >
        <Bot className="w-4 h-4" style={{ color:CTA }} />
      </div>

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
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          className="px-2 h-[30px] rounded-[10px]"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <style jsx>{`
        .rail-row:hover{
          box-shadow: ${HOVER_BOXSHADOW};
          transform: translateY(-1px);
        }
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
      className="folder-row w-full text-left rounded-[12px] px-3 py-3 flex items-center gap-2 transition"
      style={{
        background:'var(--panel)',
        border:`1px solid ${GREEN_LINE}`,
        boxShadow: ITEM_SHADOW,
        color:'var(--text)'
      }}
    >
      <Folder className="w-4 h-4" style={{ color:CTA }} />
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
  const [overlay,setOverlay] = useState(false); // switch overlay
  const [initialLoading,setInitialLoading] = useState(true);
  const [q,setQ] = useState('');
  const [createOpen,setCreateOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);
  const [showCreateFolder,setShowCreateFolder] = useState(false);
  const [dragIds,setDragIds] = useState<string[]>([]);

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
    setTimeout(()=>setInitialLoading(false), 500);
  })(); },[]);

  const filtered = useMemo(()=> {
    const s=q.trim().toLowerCase();
    const list = activeFolderId ? assistants.filter(a=>a.folderId===activeFolderId) : assistants.filter(a=>!a.folderId);
    return !s ? list : list.filter(a=>(`${a.name} ${(a.purpose||'')}`.toLowerCase().includes(s)));
  },[assistants,q,activeFolderId]);

  function select(id:string){
    setOverlay(true);
    setActiveId(id);
    writeActive(id);
    window.setTimeout(()=> setOverlay(false), 620);
  }

  function addAssistant(name:string){
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'', folderId: activeFolderId||null };
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
      const nid = next.find(a=> activeFolderId ? a.folderId===activeFolderId : !a.folderId)?.id || '';
      setActiveId(nid); if (nid) writeActive(nid);
    }
    setDelId(null);
  }

  function createFolder(name:string){
    const f:FolderLite = { id: uid(), name, createdAt: Date.now() };
    const next=[f, ...folders];
    setFolders(next); saveFolders(next);
    setShowCreateFolder(false);
  }
  function moveAssistantsToFolder(ids:string[], folderId:string|null){
    const next = assistants.map(a => ids.includes(a.id) ? { ...a, folderId } : a);
    setAssistants(next); saveAssistants(next);
  }
  function onRowDragStart(id:string){
    setDragIds([id]);
    try { (event as DragEvent)?.dataTransfer?.setData('text/plain', [id].join(',')); } catch {}
  }

  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;
  const inAllScope = !activeFolderId;

  return (
    <>
      <div
        className="assistant-rail h-full flex flex-col"
        style={{
          /* LIGHT MODE — scoped to this rail only */
          background:'var(--sidebar-bg)',
          borderRight:`1px solid ${GREEN_LINE}`,
          color:'var(--sidebar-text)',
        }}
      >
        {/* Header */}
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
          <div className="grid grid-cols-2 gap-2">
            {/* Left: Create (green, white text) */}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold"
              style={{ height: 36, background: CTA, color:'#ffffff', boxShadow:'0 10px 22px rgba(0,0,0,.10)', border:`1px solid ${GREEN_LINE}` }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background=CTA)}
              onClick={()=> setCreateOpen(true)}
            >
              <Plus className="w-4 h-4" />
              Create
            </button>

            {/* Right: + Folder (opens overlay) */}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-[12px] font-semibold"
              style={{ height: 36, background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}`, boxShadow: ITEM_SHADOW }}
              onClick={()=> setShowCreateFolder(true)}
            >
              <FolderPlus className="w-4 h-4" />
              + Folder
            </button>
          </div>

          {/* Search */}
          <div className="mt-3 relative">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Search assistants"
              className="w-full h-[34px] rounded-[12px] pl-8 pr-3 text-sm outline-none"
              style={{
                background:'var(--panel)',
                border: `1px solid ${GREEN_LINE}`,
                boxShadow: 'inset 0 1px 0 rgba(0,0,0,.04)',
                color:'var(--text)'
              }}
            />
            <Search
              className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color:'var(--text-muted)' }}
            />
          </div>

          {/* Scope crumb */}
          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--sidebar-muted)' }}>
              {inAllScope ? 'ALL' : 'FOLDER'}
            </div>
            {!inAllScope && (
              <button
                onClick={()=>{ setActiveFolderId(''); try{ localStorage.setItem(ACTIVE_FOLDERKEY,''); }catch{} }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-[10px]"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
              >
                <ArrowLeft className="w-4 h-4" /> Back to All
              </button>
            )}
          </div>
        </div>

        {/* LIST */}
        <div className="px-3 py-3 overflow-auto" style={{ flex:1 }}>
          {/* Folders in All */}
          {inAllScope && (
            <>
              {folders.length>0 && (
                <div className="mb-2">
                  <div className="mb-2 text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--sidebar-muted)' }}>
                    FOLDERS
                  </div>
                  <div className="grid gap-2">
                    {folders.map(f=>(
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

              {folders.length>0 && (
                <div
                  className="mb-3 rounded-[12px] px-3 py-2 text-xs"
                  onDragOver={(e)=>e.preventDefault()}
                  onDrop={(e)=>{
                    const ids = (e.dataTransfer.getData('text/plain')||'').split(',').filter(Boolean);
                    if (ids.length) moveAssistantsToFolder(ids, null);
                  }}
                  style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', boxShadow: ITEM_SHADOW }}
                >
                  Drop here to move to <b>All</b>
                </div>
              )}
            </>
          )}

          <div className="space-y-2">
            {/* legit skeleton shimmer */}
            {initialLoading && (
              <>
                {[0,1,2,3].map(i=>(
                  <div key={i} className="rounded-[12px] h-[60px] w-full shimmer"
                       style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, boxShadow: ITEM_SHADOW }} />
                ))}
              </>
            )}

            {!initialLoading && (
              <AnimatePresence initial={false}>
                {filtered.map(a=>(
                  <motion.div key={a.id} initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-6 }}>
                    <Row
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
        <CreateModal open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={addAssistant} />
        <RenameModal open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={saveRename} />
        <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={confirmDelete} />
        <CreateFolderModal open={showCreateFolder} onClose={()=>setShowCreateFolder(false)} onCreate={async(name)=>createFolder(name)} />

        {/* Light theme tokens (scoped!) + shimmer */}
        <style jsx>{`
          .assistant-rail{
            /* Light palette that fits your API Keys page */
            --sidebar-bg: #f8fafc; /* slate-50-ish */
            --sidebar-text: #0f172a;
            --sidebar-muted: #64748b;
            --panel: #ffffff;
            --text: #0f172a;
            --text-muted: #64748b;
          }
          @keyframes shimmerLine {
            0%{ background-position:-200% 0; }
            100%{ background-position:200% 0; }
          }
          .shimmer{
            background-image: linear-gradient(90deg, rgba(0,0,0,0.03) 25%, rgba(0,0,0,0.06) 37%, rgba(0,0,0,0.03) 63%);
            background-size: 200% 100%;
            animation: shimmerLine 1.2s ease-in-out infinite;
          }
          @keyframes fadeIn { from{opacity:0} to{opacity:1} }
          @keyframes popIn { from{ transform:scale(.98); opacity:0 } to{ transform:scale(1); opacity:1 } }
        `}</style>
      </div>

      {/* Switch loader — overlay with animated dots */}
      <AnimatePresence>
        {overlay && (
          <motion.div
            key="assistant-switch"
            className="fixed inset-0 z-[100002] flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: LIGHT_OVERLAY }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="px-6 py-5 rounded-[14px]"
              style={{
                border: `1px solid ${GREEN_LINE}`,
                background: 'var(--panel)',
                boxShadow: BOX_SHADOW,
                color:'var(--text)'
              }}
            >
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <div className="text-sm">
                  Loading assistant<span className="inline-block w-6 text-left animate-[dots_1.2s_steps(4,end)_infinite]"></span>
                </div>
              </div>
            </motion.div>

            <style jsx>{`
              @keyframes dots {
                0% { content: ''; }
                25% { content: '.'; }
                50% { content: '..'; }
                75% { content: '...'; }
                100% { content: ''; }
              }
              .animate-[dots_1.2s_steps(4,end)_infinite]::after { content:''; animation:dots 1.2s steps(4,end) infinite; }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
