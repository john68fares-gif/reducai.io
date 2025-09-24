// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Bot, Trash2, Edit3, AlertTriangle, Loader2,
  FolderPlus, Folder, ArrowLeft
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

/* Scoped storage helper (your implementation) */
import { scopedStorage, type Scoped } from '@/utils/scoped-storage';

/* Types */
export type AssistantLite = {
  id: string; name: string; purpose?: string; createdAt?: number; folderId?: string | null
};
type FolderLite = { id: string; name: string; createdAt?: number };

/* Keys (now saved in scoped storage, not global) */
const STORAGE_KEY       = 'agents';
const FOLDERS_KEY       = 'agentFolders';
const ACTIVE_KEY        = 'va:activeId';
const ACTIVE_FOLDER_KEY = 'va:activeFolderId';

/* Brand */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const GREEN_ICON = CTA;

/* Radius tweaks (less rounded) */
const R_SM = 6;   // small corners
const R_MD = 8;   // medium corners
const R_LG = 10;  // large corners (trimmed down from 12/14)

/* Row glow overlays */
const HOVER_OPACITY  = 0.20;
const ACTIVE_OPACITY = 0.34;

/* Utils */
function uid() {
  return `a_${Date.now().toString(36)}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

async function loadAssistants(ss: Scoped): Promise<AssistantLite[]> {
  return ss.getJSON<AssistantLite[]>(STORAGE_KEY, []);
}
async function saveAssistants(ss: Scoped, list: AssistantLite[]) {
  await ss.setJSON(STORAGE_KEY, list);
}
async function loadFolders(ss: Scoped): Promise<FolderLite[]> {
  return ss.getJSON<FolderLite[]>(FOLDERS_KEY, []);
}
async function saveFolders(ss: Scoped, list: FolderLite[]) {
  await ss.setJSON(FOLDERS_KEY, list);
}

async function readActiveId(ss: Scoped): Promise<string> {
  return ss.getJSON<string>(ACTIVE_KEY, '');
}
async function writeActiveId(ss: Scoped, id: string) {
  await ss.setJSON(ACTIVE_KEY, id);
  try { window.dispatchEvent(new CustomEvent('assistant:active', { detail: id })); } catch {}
}
async function readActiveFolderId(ss: Scoped): Promise<string> {
  return ss.getJSON<string>(ACTIVE_FOLDER_KEY, '');
}
async function writeActiveFolderId(ss: Scoped, id: string) {
  await ss.setJSON(ACTIVE_FOLDER_KEY, id);
}

/* ---------- Modal shells (PORTALED + blur + entrance anim) ---------- */
function ModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 z-[100000]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
      />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: .18, ease: 'easeOut' }}
          className="w-full max-w-[560px] overflow-hidden"
          style={{
            background: 'var(--panel)',
            color: 'var(--text)',
            border: `1px solid ${GREEN_LINE}`,
            maxHeight: '86vh',
            borderRadius: R_MD
          }}
        >
          {children}
        </motion.div>
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
      className="flex items-center justify-between px-6 py-4"
      style={{
        background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
        borderBottom:`1px solid ${GREEN_LINE}`
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid place-items-center"
          style={{ width: 40, height: 40, borderRadius: R_LG, background:'var(--brand-weak)' }}
        >
          <span style={{ color: GREEN_ICON, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <span style={{ width:20, height:20 }} />
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
      <ModalHeader icon={<Plus className="w-5 h-5" />} title="Create Assistant" />
      <div className="px-6 py-5">
        <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Name</label>
        <input
          value={name} onChange={(e)=>setName(e.target.value)}
          className="w-full h-[44px] px-3 text-sm outline-none"
          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: R_MD }}
          placeholder="e.g., Sales Bot" autoFocus
        />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button
          onClick={onClose}
          className="w-full h-[44px] font-semibold"
          style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.9)', color:'var(--text)', borderRadius: R_MD }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onCreate(name.trim())}
          className="w-full h-[44px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#fff', borderRadius: R_MD }}
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
               className="w-full h-[44px] px-3 text-sm outline-none"
               style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: R_MD }} />
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.9)', color:'var(--text)', borderRadius: R_MD }}>
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={()=> can && onSave(val.trim())}
          className="w-full h-[44px] font-semibold disabled:opacity-60"
          style={{ background:CTA, color:'#fff', borderRadius: R_MD }}
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
        title="Delete Assistant" subtitle="This action cannot be undone."
      />
      <div className="px-6 py-5 text-sm" style={{ color:'var(--text)' }}>
        Delete <b>“{name||'assistant'}”</b>?
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <button onClick={onClose}
                className="w-full h-[44px] font-semibold"
                style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.9)', color:'var(--text)', borderRadius: R_MD }}>
          Cancel
        </button>
        <button onClick={onConfirm}
                className="w-full h-[44px] font-semibold"
                style={{ background:'#ef4444', color:'#fff', border:'1px solid #ef4444', borderRadius: R_MD }}>
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* ---------- Text-only assistant row with green overlay + TOP shadow ---------- */
function AssistantRow({
  a, active, onClick, onRename, onDelete, onDragStart
}:{
  a:AssistantLite; active:boolean; onClick:(e:React.MouseEvent)=>void; onRename:()=>void; onDelete:()=>void; onDragStart:(id:string,e:React.DragEvent)=>void;
}) {
  return (
    <button
      draggable
      onDragStart={(e)=>onDragStart(a.id, e)}
      onClick={onClick}
      className={`ai-row group w-full text-left px-3 py-3 flex items-center gap-2 transition`}
      data-active={active ? 'true' : 'false'}
      style={{ background:'transparent', color:'var(--text)', position:'relative', borderRadius: R_MD }}
    >
      {/* icons = bright CTA */}
      <Bot className="w-4 h-4" style={{ color: GREEN_ICON }} />

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold truncate">{a.name}</div>
        <div className="text-[12px] truncate" style={{ color:'var(--sidebar-muted)' }}>
          {a.purpose || '—'}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Rename = WHITE */}
        <button
          onClick={(e)=>{ e.stopPropagation(); onRename(); }}
          className="px-2 h-[28px]"
          style={{ background:'#ffffff', border:`1px solid ${GREEN_LINE}`, color:'#0b0f0e', borderRadius: R_SM }}
          aria-label="Rename"
        >
          <Edit3 className="w-4 h-4" style={{ color: GREEN_ICON }} />
        </button>
        {/* Delete = RED */}
        <button
          onClick={(e)=>{ e.stopPropagation(); onDelete(); }}
          className="px-2 h-[28px]"
          style={{ background:'#ef4444', border:'1px solid #ef4444', color:'#ffffff', borderRadius: R_SM }}
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* green full overlay glow */}
      <style jsx>{`
        .ai-row::after{
          content:'';
          position:absolute; inset:0;
          border-radius:${R_MD}px;
          background:${CTA};
          opacity:0;
          pointer-events:none;
          transition: opacity .18s ease, transform .18s ease;
          mix-blend-mode:screen;
        }
        /* soft “top shadow” highlight */
        .ai-row::before{
          content:'';
          position:absolute; left:8px; right:8px; top:-6px;
          height:16px; border-radius:${R_MD}px;
          background:radial-gradient(60% 80% at 50% 100%, rgba(89,217,179,.45) 0%, rgba(89,217,179,0) 100%);
          opacity:0; pointer-events:none;
          transition:opacity .18s ease;
          filter:blur(6px);
        }
        .ai-row:hover::after{ opacity:${HOVER_OPACITY}; }
        .ai-row[data-active="true"]::after{ opacity:${ACTIVE_OPACITY}; }
        .ai-row:hover::before{ opacity:.75; }
        .ai-row[data-active="true"]::before{ opacity:1; }
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
      className="w-full text-left px-3 py-2 flex items-center gap-2 transition"
      style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: R_MD }}
    >
      <Folder className="w-4 h-4" style={{ color: GREEN_ICON }} />
      <div className="min-w-0 flex-1 truncate">{f.name}</div>
    </button>
  );
}

/* ---------- Main Rail ---------- */
export default function AssistantRail() {
  const [ss, setSS] = useState<Scoped | null>(null);

  const [assistants,setAssistants] = useState<AssistantLite[]>([]);
  const [folders,setFolders] = useState<FolderLite[]>([]);
  const [activeId,setActiveId] = useState('');
  const [activeFolderId,setActiveFolderId] = useState<string>('');
  const [veil,setVeil] = useState(false);
  const [initialLoading,setInitialLoading] = useState(true);
  const [q,setQ] = useState('');
  const [createOpen,setCreateOpen] = useState(false);
  const [renId,setRenId] = useState<string|null>(null);
  const [delId,setDelId] = useState<string|null>(null);

  /* New Folder modal */
  const [newFolderOpen,setNewFolderOpen] = useState(false);
  const [newFolderName,setNewFolderName] = useState('');

  /* body background = same as header bg while this rail is mounted */
  useEffect(() => {
    const prev = document.body.style.background;
    const headerBG = `linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`;
    document.body.style.background = headerBG;
    return () => { document.body.style.background = prev; };
  }, []);

  /* Init scoped storage + load everything from scoped namespace */
  useEffect(()=>{ (async()=>{
    const scoped = await scopedStorage();
    setSS(scoped);
    await scoped.ensureOwnerGuard();

    const [list, flds, savedActive, savedFolder] = await Promise.all([
      loadAssistants(scoped),
      loadFolders(scoped),
      readActiveId(scoped),
      readActiveFolderId(scoped)
    ]);

    setAssistants(list);
    setFolders(flds);

    // choose a valid active assistant
    const firstId =
      (savedActive && list.find(a=>a.id===savedActive)?.id) ||
      (list[0]?.id || '');
    setActiveId(firstId);
    if (firstId) await writeActiveId(scoped, firstId);

    setActiveFolderId(savedFolder || '');

    // slightly delayed to avoid flashing the skeleton too fast
    setTimeout(()=>setInitialLoading(false), 220);
  })(); },[]);

  const filtered = useMemo(()=>{
    const s=q.trim().toLowerCase();
    const scope = activeFolderId ? (a:AssistantLite)=>a.folderId===activeFolderId : (a:AssistantLite)=>!a.folderId;
    return assistants.filter(scope).filter(a=>{
      if(!s) return true;
      return (a.name.toLowerCase() + ' ' + (a.purpose||'').toLowerCase()).includes(s);
    });
  },[assistants,q,activeFolderId]);

  /* freeze helpers (keep look; just smaller radius already applied) */
  function freezePage(on:boolean){
    const html = document.documentElement;
    const body = document.body;
    if (on) {
      html.classList.add('va-freeze');
      body.classList.add('va-freeze');
      body.style.pointerEvents = 'none';
    } else {
      html.classList.remove('va-freeze');
      body.classList.remove('va-freeze');
      body.style.pointerEvents = '';
    }
  }

  async function select(id:string){
    if (!ss) return;
    freezePage(true);
    setVeil(true);
    setActiveId(id);
    await writeActiveId(ss, id);
    window.setTimeout(()=> { setVeil(false); freezePage(false); }, 800);
  }

  /* Assistant CRUD (scoped storage) */
  async function addAssistant(name:string){
    if (!ss) return;
    const a:AssistantLite = { id: uid(), name, createdAt: Date.now(), purpose:'', folderId: activeFolderId||null };
    const next=[a, ...assistants];
    setAssistants(next); await saveAssistants(ss, next);
    setCreateOpen(false);
    await select(a.id);
  }
  async function saveRename(name:string){
    if (!ss) return;
    const next=assistants.map(x=> x.id===renId ? {...x, name} : x);
    setAssistants(next); await saveAssistants(ss, next); setRenId(null);
  }
  async function confirmDelete(){
    if (!ss) return;
    const next = assistants.filter(x=> x.id!==delId);
    const deletedActive = activeId===delId;
    setAssistants(next); await saveAssistants(ss, next);
    if (deletedActive) {
      const nid = next.find(a=> activeFolderId ? a.folderId===activeFolderId : !a.folderId)?.id || '';
      setActiveId(nid);
      await writeActiveId(ss, nid);
    }
    setDelId(null);
  }

  /* Folders */
  async function createFolder(name:string){
    if (!ss) return;
    const f:FolderLite = { id: uid(), name, createdAt: Date.now() };
    const next=[f, ...folders];
    setFolders(next); await saveFolders(ss, next);
  }
  async function moveAssistantsToFolder(ids:string[], folderId:string|null){
    if (!ss) return;
    const next = assistants.map(a => ids.includes(a.id) ? { ...a, folderId } : a);
    setAssistants(next); await saveAssistants(ss, next);
  }

  function onRowDragStart(id:string, e:React.DragEvent){
    try { e.dataTransfer?.setData('text/plain', id); } catch {}
  }

  const renName = assistants.find(a=>a.id===renId)?.name || '';
  const delName = assistants.find(a=>a.id===delId)?.name;

  const inAllScope = !activeFolderId;
  const visibleFolders = folders;

  return (
    <>
      <div
        className="assistant-rail h-full flex flex-col"
        style={{
          background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
          borderRight:`1px solid ${GREEN_LINE}`,
          color:'var(--sidebar-text)'
        }}
      >
        {/* TOP */}
        <div
          className="px-3 py-3"
          style={{
            background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
            borderBottom:`1px solid ${GREEN_LINE}`
          }}
        >
          <div className="grid grid-cols-2 gap-0">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 font-semibold px-3"
              style={{
                height:36, background:CTA, color:'#fff',
                border:`1px solid ${GREEN_LINE}`,
                borderRightColor: 'transparent',
                borderTopLeftRadius: R_MD, borderBottomLeftRadius: R_MD
              }}
              onClick={()=> setCreateOpen(true)}
            >
              <Plus className="w-4 h-4" style={{ color:'#fff' }} />
              Create
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center px-0"
              style={{
                height:36, background:'var(--panel)', color:'var(--text)',
                border:`1px solid ${GREEN_LINE}`,
                borderTopRightRadius: R_MD, borderBottomRightRadius: R_MD
              }}
              onClick={()=>{ setNewFolderName(''); setNewFolderOpen(true); }}
              aria-label="New Folder"
            >
              <FolderPlus className="w-4 h-4" style={{ color: GREEN_ICON, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
              <span className="sr-only">New Folder</span>
            </button>
          </div>

          <div className="mt-3 relative">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Search assistants"
              className="w-full h-[34px] pl-8 pr-3 text-sm outline-none"
              style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: R_MD }}
            />
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }} />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-[.12em]" style={{ color:'var(--sidebar-muted)' }}>
              {inAllScope ? 'ALL' : 'FOLDER'}
            </div>
            {!inAllScope && (
              <button
                onClick={async ()=>{
                  setActiveFolderId('');
                  if (ss) await writeActiveFolderId(ss, '');
                }}
                className="inline-flex items-center gap-1 px-2 py-1"
                style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: R_SM }}
              >
                <ArrowLeft className="w-4 h-4" style={{ color: GREEN_ICON }} /> Back to All
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
                    onOpen={async ()=>{
                      setActiveFolderId(f.id);
                      if (ss) await writeActiveFolderId(ss, f.id);
                    }}
                    onDropIds={(ids)=> moveAssistantsToFolder(ids, f.id)}
                  />
                ))}
              </div>
              {/* divider between folders and assistants */}
              <div className="mt-3 mb-1" style={{ height:1, background:GREEN_LINE }} />
            </div>
          )}

          {initialLoading ? (
            <div className="space-y-3">
              {[0,1,2,3].map(i=>(
                <div key={i} className="h-[42px] animate-pulse"
                     style={{ background:'color-mix(in oklab, var(--panel) 90%, white 10%)', opacity:.55, borderRadius: R_MD }} />
              ))}
            </div>
          ) : (
            // no line under each assistant — remove any visual separation
            <div className="space-y-0">
              <AnimatePresence initial={false}>
                {filtered.map(a=>(
                  <motion.div key={a.id} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}>
                    <AssistantRow
                      a={a}
                      active={a.id===activeId}
                      onClick={()=>{ void select(a.id); }}
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
        <CreateModal  open={createOpen} onClose={()=>setCreateOpen(false)} onCreate={(name)=>{ void addAssistant(name); }} />
        <RenameModal  open={!!renId} initial={renName} onClose={()=>setRenId(null)} onSave={(v)=>{ void saveRename(v); }} />
        <ConfirmDelete open={!!delId} name={delName} onClose={()=>setDelId(null)} onConfirm={()=>{ void confirmDelete(); }} />

        {/* New Folder modal (overlay) */}
        <AnimatePresence>
          {newFolderOpen && (
            <ModalShell>
              <ModalHeader icon={<FolderPlus className="w-5 h-5" />} title="New Folder" />
              <div className="px-6 py-5">
                <label className="block text-xs mb-1" style={{ color:'var(--text-muted)' }}>Folder name</label>
                <input
                  value={newFolderName}
                  onChange={(e)=>setNewFolderName(e.target.value)}
                  className="w-full h-[44px] px-3 text-sm outline-none"
                  style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: R_MD }}
                  placeholder="e.g., Sales Team"
                  autoFocus
                />
              </div>
              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={()=>setNewFolderOpen(false)}
                  className="w-full h-[44px] font-semibold"
                  style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.9)', color:'var(--text)', borderRadius: R_MD }}
                >
                  Cancel
                </button>
                <button
                  onClick={async ()=>{
                    const v=newFolderName.trim();
                    if(!v) return;
                    await createFolder(v);
                    setNewFolderOpen(false);
                  }}
                  className="w-full h-[44px] font-semibold"
                  style={{ background:CTA, color:'#fff', borderRadius: R_MD }}
                >
                  Create
                </button>
              </div>
            </ModalShell>
          )}
        </AnimatePresence>

        {/* Theme + freeze */}
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
          :global(html.va-freeze), :global(body.va-freeze){ overflow:hidden !important; }
        `}</style>
      </div>

      {/* FULL-SCREEN loading veil */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {veil && (
            <motion.div
              key="switch-veil"
              className="fixed inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: .18 }}
              style={{ zIndex: 2147483647, background:'rgba(0,0,0,.72)', backdropFilter:'blur(4px)' }}
            >
              <div className="w-full h-full grid place-items-center">
                <motion.div initial={{ scale: .94 }} animate={{ scale: 1 }} transition={{ duration: .18 }}>
                  <Loader2 className="w-9 h-9 animate-spin" style={{ color:'#fff' }} />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
