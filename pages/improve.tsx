// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, RefreshCw, Send, Star, StarOff,
  ToggleLeft, ToggleRight, Undo2, Redo2, Upload, Download, Eye, EyeOff,
  Tag as TagIcon, Copy, Check, SplitSquareHorizontal, Images, Video, Paperclip
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/** Minimal API expectations (works even if some are missing)
 * GET    /api/chatbots?ownerId=...   (header x-owner-id)
 * PATCH  /api/chatbots/[id]          (header x-owner-id)
 * DELETE /api/chatbots/[id]          (header x-owner-id)
 * POST   /api/chatbots               (header x-owner-id)
 * POST   /api/assistants/chat        (optional; sim fallback if missing)
 */

type BotRow = {
  id: string;
  ownerId: string;
  name: string;
  model: string;
  temperature: number;
  system: string;
  createdAt?: string;
  updatedAt?: string;
};

type Version = {
  id: string;
  ts: number;
  label: string;       // concise AI-like title
  name: string;
  model: string;
  temperature: number;
  system: string;
};

type AgentMeta = {
  pinned?: boolean;
  draft?: boolean;
  notes?: string;
  lastOpenedAt?: number;
  tags?: string[];
  guardrails?: { blockedPhrases: string[]; enforceJson: boolean; jsonSchemaHint?: string };
  promptStack?: { pre: string; main: string; post: string };
};

type ChatMsg = { role: 'user' | 'assistant' | 'system'; text: string; at: number; attachments?: AttachmentMeta[] };
type AttachmentMeta = { id: string; name: string; type: 'file'|'image'|'video'; url?: string; size?: number };

/* ——— Styles (theme-friendly, no neon) ——— */
const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 94%, transparent)',
  boxShadow: '0 3px 16px rgba(0,0,0,.08)',
  borderRadius: 12,
};
const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 98%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 94%, transparent)',
  borderRadius: 10,
  boxShadow: '0 1px 8px rgba(0,0,0,.06)',
};
const BTN: React.CSSProperties = ({
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'color-mix(in oklab, var(--card) 98%, transparent)',
  fontSize: 13,
  lineHeight: '18px'
} as any);

const selectStyle: React.CSSProperties = {
  ...CARD,
  appearance: 'none',
  WebkitAppearance: 'none' as any,
  MozAppearance: 'none' as any,
  backgroundPosition: 'right 10px center',
  backgroundRepeat: 'no-repeat',
};

const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const chatKey = (o: string, a: string, lane: 'A'|'B') => `chat:${o}:${a}:${lane}`;

const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const stripMD = (t: string) => (t || '').replace(/\*\*|__|`/g, '');
const safeParse = <T,>(s:string|null): T|undefined => { try { return s ? JSON.parse(s) as T : undefined; } catch { return undefined; } };

/** Inject rules into the system under a stable header */
function applyRefinementsToSystem(baseSystem: string, rules: string[]) {
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = (rules||[]).filter(Boolean).map(r => `- ${r}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}

/** Combine pre + system(with rules) + post for serving */
function combineSystem(main: string, pre: string, post: string, rules: string[]) {
  const merged = applyRefinementsToSystem(main, rules);
  return [pre, merged, post].filter(Boolean).join('\n\n');
}

/** Simple diff-to-label (concise) */
function autoTitleFromDiff(prevSys: string, nextSys: string): string {
  const p = (prevSys || '').toLowerCase();
  const n = (nextSys || '').toLowerCase();
  if (n.includes('yes') && n.includes('no') && (n.includes('only') || n.includes('strict'))) return 'Answer only “Yes/No”';
  if (n.includes('be concise') || n.includes('concise')) return 'More concise answers';
  if (n.includes('ask') && n.includes('clarify')) return 'Ask clarifying question first';
  if (n.includes('json')) return 'Bias to JSON outputs';

  const pLines = p.split('\n'); const nLines = n.split('\n');
  for (let i=0;i<Math.max(pLines.length,nLines.length);i++){
    if ((pLines[i]||'') !== (nLines[i]||'')) {
      const s = stripMD(nLines[i]||'').trim();
      return s ? (s.length>64 ? s.slice(0,64)+'…' : s) : 'Prompt edited';
    }
  }
  return 'Prompt edited';
}

/** Tiny line diff block for the overlay */
function lineDiff(a: string, b: string) {
  const A = (a||'').split('\n'); const B = (b||'').split('\n');
  const out: {t:'+'|'-'|' ', s:string}[] = [];
  const len = Math.max(A.length, B.length);
  for (let i=0;i<len;i++){
    const l = A[i] ?? ''; const r = B[i] ?? '';
    if (l === r) out.push({t:' ', s:r});
    else { if (l) out.push({t:'-', s:l}); if (r) out.push({t:'+', s:r}); }
  }
  return out;
}
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  /* search/sort/tag */
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'pinned_first'|'name_asc'|'updated_desc'>('pinned_first');
  const [tagFilter, setTagFilter] = useState('');

  /* editor */
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [promptPre, setPromptPre] = useState('');
  const [promptPost, setPromptPost] = useState('');
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [ruleInput, setRuleInput] = useState('');
  const [showPrompt, setShowPrompt] = useState(false);

  /* ui + versions */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [hoverVer, setHoverVer] = useState<string|null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffBlocks, setDiffBlocks] = useState<{t:'+'|'-'|' '; s:string}[]>([]);
  const [diffTitle, setDiffTitle] = useState('');

  /* test lanes */
  const [laneBActive, setLaneBActive] = useState(false);
  const [bVersion, setBVersion] = useState<Version | null>(null);
  const [sendBoth, setSendBoth] = useState(false);

  /* chat state */
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AttachmentMeta[]>([]);
  const [laneA, setLaneA] = useState<ChatMsg[]>([]);
  const [laneB, setLaneB] = useState<ChatMsg[]>([]);

  /* undo/redo */
  const undoRef = useRef<{value:string; push(v:string):void; undo():string; redo():string; canUndo():boolean; canRedo():boolean;} | null>(null);
  useEffect(() => { undoRef.current = (function makeUndoStack(initial: string) {
    const stack = [initial]; let idx = 0;
    return {
      get value(){ return stack[idx]; },
      push(v: string){ if (v === stack[idx]) return; stack.splice(idx+1); stack.push(v); idx = stack.length-1; },
      undo(){ if (idx>0) idx--; return stack[idx]; },
      redo(){ if (idx<stack.length-1) idx++; return stack[idx]; },
      canUndo(){ return idx>0; }, canRedo(){ return idx<stack.length-1; },
    };
  })(''); }, []);
  useEffect(() => { if (undoRef.current) undoRef.current.push(system); }, [system]);

  /* auth */
  useEffect(() => { (async () => { const { data } = await supabase.auth.getUser(); setUserId(data?.user?.id || 'anon'); })(); }, []);

  /* fetch list */
  async function fetchBots(uid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, { headers: { 'x-owner-id': uid } });
      const json = await res.json();
      const rows: BotRow[] = json?.data || [];
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]); // eslint-disable-line

  /* load selection */
  useEffect(() => {
    if (!selected || !userId) return;

    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);

    const m: AgentMeta = safeParse(localStorage.getItem(metaKey(userId, selected.id))) || {};
    setNotes(m.notes || ''); setDraft(!!m.draft); setPinned(!!m.pinned);
    setTags(Array.isArray(m.tags) ? m.tags : []);
    setPromptPre(m.promptStack?.pre || ''); setPromptPost(m.promptStack?.post || '');

    // extract rules from system (if present)
    const re = new RegExp(`^${REFINEMENT_HEADER}\\n([\\s\\S]*?)\\n\\n`, 'm');
    const match = re.exec(selected.system || '');
    const existingRules = match ? match[1].split('\n').map(l => l.replace(/^- /, '').trim()).filter(Boolean) : [];
    setRules(existingRules);
    setSystem(selected.system || '');

    const rawV = safeParse<Version[]>(localStorage.getItem(versionsKey(userId, selected.id))) || [];
    setVersions(rawV);

    // chats
    setLaneA(safeParse(localStorage.getItem(chatKey(userId, selected.id, 'A'))) || []);
    setLaneB(safeParse(localStorage.getItem(chatKey(userId, selected.id, 'B'))) || []);
    setBVersion(rawV[0] || null);
    setLaneBActive((safeParse(localStorage.getItem(chatKey(userId, selected.id, 'B'))) || []).length>0);

    setShowPrompt(false);
    setDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, userId]);

  /* persist chat */
  useEffect(() => { if (userId && selected) localStorage.setItem(chatKey(userId, selected.id, 'A'), JSON.stringify(laneA)); }, [laneA, userId, selected]);
  useEffect(() => { if (userId && selected) localStorage.setItem(chatKey(userId, selected.id, 'B'), JSON.stringify(laneB)); }, [laneB, userId, selected]);

  /* filter list (fixes "filtered is not defined") */
  const filtered = useMemo(() => {
    let rows = [...list];
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(b => (b.name||'').toLowerCase().includes(q) || (b.model||'').toLowerCase().includes(q) || (b.id||'').toLowerCase().includes(q));
    }
    if (tagFilter.trim() && userId) {
      rows = rows.filter(b => {
        const m: AgentMeta = safeParse(localStorage.getItem(metaKey(userId, b.id))) || {};
        return (m.tags || []).some(t => t.toLowerCase().includes(tagFilter.toLowerCase()));
      });
    }
    if (sort === 'name_asc') rows.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    else if (sort === 'updated_desc') rows.sort((a,b)=>new Date(b.updatedAt||0).getTime()-new Date(a.updatedAt||0).getTime());
    else rows.sort((a,b)=>{
      const ma: AgentMeta = safeParse(localStorage.getItem(metaKey(userId||'', a.id))) || {};
      const mb: AgentMeta = safeParse(localStorage.getItem(metaKey(userId||'', b.id))) || {};
      return (mb.pinned?1:0)-(ma.pinned?1:0);
    });
    return rows;
  }, [list, query, sort, tagFilter, userId]);

  /* dirty flag */
  useEffect(() => {
    if (!selected) return;
    const injectedNow = applyRefinementsToSystem(system, rules);
    const injectedPrev = applyRefinementsToSystem(selected.system || '', rules);
    const d =
      name !== (selected.name || '') ||
      model !== (selected.model || 'gpt-4o') ||
      Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9 ||
      injectedNow !== injectedPrev ||
      notes !== '' || draft !== false || pinned !== false || tags.length>0 ||
      promptPre !== '' || promptPost !== '';
    setDirty(d);
  }, [name, model, temperature, system, notes, draft, pinned, tags, promptPre, promptPost, rules, selected]);

  async function saveEdits() {
    if (!userId || !selectedId) return;
    setSaving(true);
    try {
      const prev = list.find(b => b.id === selectedId) || null;
      const mergedSystem = combineSystem(system, promptPre, promptPost, rules);

      // version snapshot (concise title)
      const v: Version = {
        id: `v_${Date.now()}`, ts: Date.now(),
        label: autoTitleFromDiff(prev?.system || '', mergedSystem),
        name, model, temperature, system: mergedSystem
      };
      const nextVersions = [v, ...(versions||[])].slice(0, 120);
      setVersions(nextVersions);
      localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(nextVersions));

      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system: mergedSystem }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      const meta: AgentMeta = {
        pinned, draft, notes, lastOpenedAt: Date.now(), tags,
        promptStack: { pre: promptPre, main: '', post: promptPost },
      };
      localStorage.setItem(metaKey(userId, selectedId), JSON.stringify(meta));
      setSystem(mergedSystem);
      await fetchBots(userId);
      setSelectedId(selectedId);
      setDirty(false);
    } catch (e:any) { alert(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function deleteSelected() {
    if (!userId || !selectedId) return;
    if (!confirm('Delete this agent?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, { method:'DELETE', headers:{'x-owner-id': userId} });
      if (!res.ok) throw new Error('Failed to delete');
      localStorage.removeItem(versionsKey(userId, selectedId));
      localStorage.removeItem(metaKey(userId, selectedId));
      setSelectedId(null);
      await fetchBots(userId);
      setDirty(false);
    } catch (e:any) { alert(e?.message || 'Failed to delete'); }
    finally { setSaving(false); }
  }

  async function duplicateAgent() {
    if (!selected || !userId) return;
    try {
      const resp = await fetch('/api/chatbots', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name: `${selected.name || 'Untitled'} (Copy)`, model: selected.model, temperature: selected.temperature, system: selected.system }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok || !json?.data?.id) throw new Error(json?.error || 'Failed to duplicate');
      await fetchBots(userId); setSelectedId(json.data.id);
    } catch (e:any) { alert(e?.message || 'Failed to duplicate'); }
  }

  function exportAgent() {
    if (!selected) return;
    const payload = {
      type: 'reduc.ai/agent', version: 1,
      agent: { id: selected.id, name, model, temperature, system,
        meta: { notes, pinned, draft, tags, promptStack: { pre: promptPre, main: '', post: promptPost } }
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(name||'agent').replace(/\s+/g,'_')}.json`; a.click(); URL.revokeObjectURL(url);
  }

  async function importAgent(file: File) {
    if (!userId) return;
    try {
      const text = await file.text(); const parsed = JSON.parse(text); const a = parsed?.agent || parsed;
      const res = await fetch('/api/chatbots', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name: a.name || 'Imported Agent', model: a.model || 'gpt-4o', temperature: typeof a.temperature==='number'?a.temperature:0.5, system: a.system || '' }),
      });
      const json = await res.json(); if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to import');
      const newId = json.data.id as string;
      localStorage.setItem(metaKey(userId, newId), JSON.stringify(a.meta || {}));
      await fetchBots(userId); setSelectedId(newId);
    } catch (e:any) { alert(e?.message || 'Import failed'); }
  }

  async function copyId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {}
  }

  /* drag version → test lane B */
  function onVersionDragStart(v: Version, e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', JSON.stringify(v));
  }
  function onDropToTest(e: React.DragEvent) {
    const txt = e.dataTransfer.getData('text/plain');
    if (!txt) return;
    const v: Version = safeParse(txt as any) as any;
    if (!v) return;
    setLaneBActive(true);
    setBVersion(v);
    if (laneB.length===0) setLaneB([{ role:'system', text:`Loaded version: ${v.label} • ${fmtTime(v.ts)}`, at: Date.now() }]);
  }

  /* send a message */
  async function sendToLane(which: 'A'|'B', message: string, attach: AttachmentMeta[]) {
    if (!selected || !userId) return;
    const lane = which==='A' ? laneA : laneB;
    const setLane = which==='A' ? setLaneA : setLaneB;

    const v = which==='A' ? null : (bVersion || versions[0] || null);
    const useModel = which==='A' ? model : (v?.model || model);
    const useTemp = which==='A' ? temperature : (v?.temperature ?? temperature);
    const useSystem = which==='A'
      ? combineSystem(system, promptPre, promptPost, rules)
      : combineSystem(v?.system || system, promptPre, promptPost, rules);

    const body = {
      model: useModel,
      temperature: useTemp,
      system: useSystem,
      messages: [...lane, { role:'user', text: message, at: Date.now(), attachments: attach }].map(m=>({ role:m.role, content:m.text })),
    };

    const userMsg: ChatMsg = { role:'user', text: message, at: Date.now(), attachments: attach };
    setLane([...lane, userMsg]);

    try {
      const res = await fetch('/api/assistants/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('no backend, simulating');
      const json = await res.json();
      const text = (json?.content || json?.text || '—');
      setLane(cur => [...cur, { role:'assistant', text, at: Date.now() }]);
    } catch {
      // fallback simulation
      const concise = useSystem.toLowerCase().includes('yes') && useSystem.toLowerCase().includes('no');
      const t = concise ? (message.trim().toLowerCase().startsWith('y') ? 'Yes.' : 'No.') : `Okay — ${message}`;
      setLane(cur => [...cur, { role:'assistant', text: t, at: Date.now() }]);
    }
  }

  function onSend() {
    const msg = input.trim();
    if (!msg) return;
    const att = attachments; setAttachments([]);
    if (sendBoth && laneBActive) {
      void sendToLane('A', msg, att);
      void sendToLane('B', msg, att);
    } else {
      void sendToLane('A', msg, att);
    }
    setInput('');
    inputRef.current?.focus();
  }

  function addFiles(list: FileList | null, kind: 'file'|'image'|'video') {
    if (!list || list.length===0) return;
    const entries: AttachmentMeta[] = Array.from(list).map(f => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      name: f.name, type: kind, size: f.size, url: URL.createObjectURL(f)
    }));
    setAttachments(a => [...a, ...entries]);
  }

  /* UI */
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top bar (compact, consistent) */}
      <header className="sticky top-0 z-30 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 92%, transparent)' }}>
        <div className="max-w-[1680px] mx-auto flex items-center gap-3">
          <SplitSquareHorizontal className="w-5 h-5" />
          <h1 className="text-[18px] font-semibold">Tuning</h1>

          <span className="text-xs px-2 py-[2px] rounded-full border"
                style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--card) 96%, transparent)' }}>
            {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved ✓'}
          </span>

          {selected && (
            <button onClick={copyId} style={BTN}>
              {copied ? <><Check className="inline w-3.5 h-3.5 mr-1" />Copied</> : <><Copy className="inline w-3.5 h-3.5 mr-1" />ID</>}
            </button>
          )}

          <div className="ml-auto flex items-center gap-6">
            <div className="text-xs opacity-70">est {estimateTokens(system).toLocaleString()} tokens</div>
            <button onClick={() => userId && fetchBots(userId)} style={BTN}><RefreshCw className="inline w-4 h-4 mr-1" /> Refresh</button>
            <label style={BTN} className="cursor-pointer">
              <Upload className="inline w-4 h-4 mr-1" /> Import
              <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
            </label>
            <button onClick={exportAgent} style={BTN}><Download className="inline w-4 h-4 mr-1" /> Export</button>
            <button onClick={duplicateAgent} style={BTN}>Duplicate</button>
            <button onClick={deleteSelected} disabled={!selected || saving}
                    className="disabled:opacity-60" style={{ ...BTN, background:'rgba(255,80,80,.10)', borderColor:'rgba(255,80,80,.30)' }}>
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete
            </button>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <div className="max-w-[1680px] mx-auto px-6 py-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: '320px 1fr 320px' }}>
          {/* LEFT — Assistants list */}
          <aside className="h-[calc(100vh-150px)]" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-center gap-2"><span className="font-semibold">Assistants</span></div>
              <div className="relative mt-3">
                <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search"
                  className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none" style={CARD}/>
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select value={sort} onChange={(e)=>setSort(e.target.value as any)}
                        className="px-2 py-1 rounded-md text-xs" style={selectStyle as any}>
                  <option value="pinned_first">Pinned</option>
                  <option value="name_asc">Name</option>
                  <option value="updated_desc">Recent</option>
                </select>
                <div className="flex items-center gap-1">
                  <TagIcon className="w-4 h-4 opacity-70" />
                  <input placeholder="Tag filter" value={tagFilter} onChange={(e)=>setTagFilter(e.target.value)}
                         className="px-2 py-1 rounded-md text-xs" style={{ ...CARD, width:120 }}/>
                </div>
              </div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 118px)' }}>
              {loading ? (
                <div className="grid place-items-center py-10 opacity-70"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-sm opacity-80 py-10 text-center px-3">
                  No agents yet.
                  <div className="mt-2">
                    <Link href="/builder" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                          style={{ background: 'var(--brand)', color: '#00120a' }}>
                      Go to Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((b) => {
                    const meta: AgentMeta = safeParse(localStorage.getItem(metaKey(userId||'', b.id))) || {};
                    const active = selectedId === b.id;
                    return (
                      <li key={b.id}>
                        <button onClick={()=>setSelectedId(b.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.06)', border: '1px solid var(--border)' }}>
                            <span className="text-[11px] opacity-70">AI</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate flex items-center gap-2">
                              {b.name || 'Untitled'}
                              {meta.draft ? <span className="text-[10px] px-1.5 py-[1px] rounded-full" style={{ background:'rgba(255,200,0,.12)', border:'1px solid rgba(255,200,0,.35)' }}>Draft</span> : null}
                            </div>
                            <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0,8)}</div>
                            {(meta.tags||[]).length>0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {meta.tags!.slice(0,3).map(t => (
                                  <span key={t} className="text-[10px] px-1 py-[1px] rounded" style={{ background:'rgba(0,0,0,.05)', border:'1px solid var(--border)' }}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {meta.pinned ? <Star className="w-4 h-4" style={{ color:'var(--brand)' }} /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* CENTER — Editor + Live Test */}
          <section className="h-[calc(100vh-150px)] grid gap-3" style={{ gridTemplateRows: 'auto auto 1fr' }}>
            {/* Info row */}
            <div className="p-3 rounded-md border" style={{ ...CARD, borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Name</div>
                  <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-3 py-2 rounded-md text-[15px]" style={CARD} placeholder="Agent name"/>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Model</div>
                  <select value={model} onChange={(e)=>setModel(e.target.value)} className="w-full px-3 py-2 rounded-md" style={selectStyle as any}>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Temperature</div>
                  <div className="flex items-center gap-2">
                    {(['Precise','Balanced','Creative'] as const).map(label => {
                      const val = label==='Precise'?0.1:label==='Balanced'?0.5:0.9;
                      const active = Math.abs(temperature - val) < 0.15;
                      return (
                        <button key={label} onClick={()=>setTemperature(val)}
                                style={{ ...BTN, padding:'6px 12px', borderColor: active? 'var(--brand)': 'var(--border)',
                                  background: active? 'color-mix(in oklab, var(--brand) 14%, var(--card))' : BTN.background }}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Tags & Rules */}
              <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Tags (labels only)</div>
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Add tag and press Enter"
                      onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=(e.target.value||'').trim(); if(v && !tags.includes(v)) setTags([...tags, v]); e.target.value=''; }}}
                      className="px-3 py-2 rounded-md text-sm flex-1" style={CARD}/>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {tags.map(t => (
                      <span key={t} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(0,0,0,.05)', border:'1px solid var(--border)' }}>
                        {t} <button className="ml-1 opacity-70" onClick={()=>setTags(tags.filter(x=>x!==t))}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs opacity-70 mb-1">Rules (modify behavior)</div>
                  <div className="flex items-center gap-2">
                    <input value={ruleInput} onChange={e=>setRuleInput(e.target.value)}
                           onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=ruleInput.trim(); if(v){ const next=[...rules, v]; setRules(next); setSystem(s=>applyRefinementsToSystem(s,next)); setRuleInput(''); }}}}
                           placeholder='Add rule (Enter)…' className="px-3 py-2 rounded-md text-sm flex-1" style={CARD}/>
                    {!!rules.length && <button onClick={()=>{ setRules([]); setSystem(s=>applyRefinementsToSystem(s,[])); }} style={BTN}>Clear</button>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {rules.map((r,i)=>(
                      <span key={i} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(0,0,0,.05)', border:'1px solid var(--border)' }}>
                        {r} <button className="ml-1 opacity-70" onClick={()=>{ const next = rules.filter((_,idx)=>idx!==i); setRules(next); setSystem(s=>applyRefinementsToSystem(s,next)); }}>×</button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                  <button onClick={()=>setDraft(v=>!v)} style={BTN}>{draft ? <><ToggleLeft className="inline w-4 h-4 mr-1" /> Draft</> : <><ToggleRight className="inline w-4 h-4 mr-1" /> Published</>}</button>
                  <button onClick={()=>setPinned(v=>!v)} style={BTN}>{pinned ? <><Star className="inline w-4 h-4 mr-1" />Pinned</> : <><StarOff className="inline w-4 h-4 mr-1" />Pin</>}</button>
                  <button onClick={()=>!saving && dirty && saveEdits()} disabled={!dirty || saving} className="disabled:opacity-60"
                          style={{ ...BTN, background:'var(--brand)', color:'#00120a', borderColor:'var(--brand)' }}>
                    <Save className="w-4 h-4 inline mr-1" /> Save
                  </button>
                </div>
              </div>
            </div>

            {/* System / Pre / Post / Notes (compact) */}
            <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
              <div className="p-3 rounded-md border" style={{ ...CARD, borderColor:'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-70">Pre Prompt</div>
                  <div className="text-[11px] opacity-60">Optional</div>
                </div>
                <textarea value={promptPre} onChange={(e)=>setPromptPre(e.target.value)} rows={5}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                          placeholder="Optional: pre instructions (role, objectives)…"/>
              </div>

              <div className="p-3 rounded-md border" style={{ ...CARD, borderColor:'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs opacity-70">Post Prompt</div>
                  <div className="text-[11px] opacity-60">Optional</div>
                </div>
                <textarea value={promptPost} onChange={(e)=>setPromptPost(e.target.value)} rows={5}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                          placeholder="Optional: post processing (formatting, checks)…"/>
              </div>

              <div className="col-span-2 p-3 rounded-md border" style={{ ...CARD, borderColor:'var(--border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs opacity-70">System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=> setShowPrompt(s=>!s)} style={BTN}>{showPrompt ? <><EyeOff className="inline w-4 h-4 mr-1"/>Hide prompt</> : <><Eye className="inline w-4 h-4 mr-1"/>Show prompt</>}</button>
                    <button onClick={() => { if (undoRef.current?.canUndo()) setSystem(undoRef.current.undo()); }} disabled={!undoRef.current?.canUndo()} className="disabled:opacity-50" style={BTN}><Undo2 className="inline w-3.5 h-3.5 mr-1" /> Undo</button>
                    <button onClick={() => { if (undoRef.current?.canRedo()) setSystem(undoRef.current.redo()); }} disabled={!undoRef.current?.canRedo()} className="disabled:opacity-50" style={BTN}><Redo2 className="inline w-3.5 h-3.5 mr-1" /> Redo</button>
                  </div>
                </div>
                {showPrompt ? (
                  <textarea value={system} onChange={(e)=>setSystem(e.target.value)} rows={10}
                            className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6" style={CARD}
                            placeholder="Describe your agent’s behavior, tone, policies, knowledge…"/>
                ) : (
                  <div className="text-xs opacity-60">Hidden. Click “Show prompt” to edit.</div>
                )}
              </div>

              <div className="col-span-2 p-3 rounded-md border" style={{ ...CARD, borderColor:'var(--border)' }}>
                <div className="text-xs opacity-70 mb-1">Notes (low priority)</div>
                <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={3}
                          className="w-full px-3 py-2 rounded-md outline-none text-sm" style={CARD}
                          placeholder="Context for your future self and teammates…"/>
              </div>
            </div>

            {/* LIVE TEST */}
            <div onDragOver={e=>e.preventDefault()} onDrop={onDropToTest}
                 className="p-3 rounded-md border overflow-hidden"
                 style={{ ...CARD, borderColor:'var(--border)', display:'grid', gridTemplateRows:'auto 1fr auto', minHeight: 380 }}>
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Live Test</div>
                <div className="flex items-center gap-3">
                  <label className="text-sm flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sendBoth} onChange={e=>setSendBoth(e.target.checked)} /> Send to both lanes
                  </label>
                  <div className="text-xs opacity-60">Drag a version card here to create Lane B</div>
                </div>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: laneBActive ? '1fr 1fr' : '1fr' }}>
                {/* Lane A */}
                <div className="rounded-md border p-2 overflow-auto" style={{ ...CARD, borderColor:'var(--border)' }}>
                  <div className="text-xs opacity-70 mb-1">Lane A (current)</div>
                  <div className="space-y-2 max-h-[42vh] overflow-auto pr-1">
                    {laneA.length===0 ? <div className="text-xs opacity-60">No messages yet.</div> :
                      laneA.map((m,i)=>(
                        <div key={i} className="text-sm"><b>{m.role==='user'?'You':'AI'}:</b> {stripMD(m.text)}
                          {m.attachments?.length ? (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {m.attachments.map(a => (
                                <a key={a.id} href={a.url} target="_blank" className="text-[12px] underline opacity-70">{a.name}</a>
                              ))}
                            </div>
                          ):null}
                        </div>
                      ))}
                  </div>
                </div>

                {/* Lane B */}
                {laneBActive && (
                  <div className="rounded-md border p-2 overflow-auto" style={{ ...CARD, borderColor:'var(--border)' }}>
                    <div className="text-xs opacity-70 mb-1">
                      Lane B (version): {bVersion?.label || versions[0]?.label || '—'} <span className="opacity-60">· {bVersion ? fmtTime(bVersion.ts) : versions[0] ? fmtTime(versions[0].ts) : ''}</span>
                    </div>
                    <div className="space-y-2 max-h-[42vh] overflow-auto pr-1">
                      {laneB.length===0 ? <div className="text-xs opacity-60">No messages yet.</div> :
                        laneB.map((m,i)=>(
                          <div key={i} className="text-sm"><b>{m.role==='user'?'You':'AI'}:</b> {stripMD(m.text)}
                            {m.attachments?.length ? (
                              <div className="mt-1 flex flex-wrap gap-2">
                                {m.attachments.map(a => (
                                  <a key={a.id} href={a.url} target="_blank" className="text-[12px] underline opacity-70">{a.name}</a>
                                ))}
                              </div>
                            ):null}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* composer */}
              <div className="mt-2 flex items-center gap-2">
                {/* attachment tray */}
                <div className="flex items-center gap-1">
                  <label style={BTN} className="cursor-pointer"><Images className="w-4 h-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={e=>addFiles(e.target.files, 'image')} />
                  </label>
                  <label style={BTN} className="cursor-pointer"><Video className="w-4 h-4" />
                    <input type="file" accept="video/*" className="hidden" onChange={e=>addFiles(e.target.files, 'video')} />
                  </label>
                  <label style={BTN} className="cursor-pointer"><Paperclip className="w-4 h-4" />
                    <input type="file" className="hidden" onChange={e=>addFiles(e.target.files, 'file')} />
                  </label>
                </div>
                <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }}}
                       placeholder="Type a message…" className="flex-1 px-3 py-2 rounded-md text-sm" style={CARD}/>
                <button onClick={onSend} style={{ ...BTN, background:'var(--brand)', color:'#00120a', borderColor:'var(--brand)' }}>
                  <Send className="inline w-4 h-4 mr-1" /> Send
                </button>
              </div>

              {attachments.length>0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map(a=>(
                    <span key={a.id} className="text-xs px-2 py-1 rounded border" style={{ borderColor:'var(--border)' }}>
                      {a.name} <button className="ml-1 opacity-70" onClick={()=>setAttachments(cur=>cur.filter(x=>x.id!==a.id))}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
          {/* RIGHT — Versions (scrollable rail with contextual actions) */}
          <aside className="h-[calc(100vh-150px)]" style={PANEL}>
            <div className="p-3 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
              <div className="font-semibold">Versions</div>
              <div className="text-xs opacity-60">Hover a card for actions</div>
            </div>

            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 48px)' }}>
              {versions.length === 0 ? (
                <div className="text-xs opacity-60 py-8 text-center">No versions yet. Saving creates snapshots automatically.</div>
              ) : (
                <ul className="space-y-2">
                  {versions.map(v => (
                    <li key={v.id}
                        draggable
                        onDragStart={(e)=>onVersionDragStart(v, e)}
                        onMouseEnter={()=>setHoverVer(v.id)} onMouseLeave={()=>setHoverVer(null)}>
                      <div className="p-2 rounded-lg border" style={{ ...CARD, borderColor:'var(--border)' }}>
                        <div className="text-sm truncate">{v.label || 'Prompt edited'}</div>
                        <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>

                        {/* contextual actions (shown on hover) */}
                        <div className="mt-2 flex items-center gap-2" style={{ opacity: hoverVer===v.id ? 1 : 0.0, transition:'opacity .15s ease' }}>
                          <button
                            style={BTN}
                            onClick={()=>{
                              // Restore
                              setName(v.name); setModel(v.model); setTemperature(v.temperature);
                              setSystem(v.system);
                              setDirty(true);
                            }}>
                            Restore
                          </button>
                          <button
                            style={BTN}
                            onClick={()=>{
                              // Diff vs current system
                              setDiffTitle(v.label || 'Diff');
                              setDiffBlocks(lineDiff(system, v.system));
                              setDiffOpen(true);
                            }}>
                            Diff
                          </button>
                          <button
                            style={BTN}
                            onClick={()=>{
                              setBVersion(v); setLaneBActive(true);
                              if (laneB.length===0) setLaneB([{ role:'system', text:`Loaded version: ${v.label} • ${fmtTime(v.ts)}`, at: Date.now() }]);
                            }}>
                            Use in B
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* DIFF OVERLAY */}
      {diffOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setDiffOpen(false)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
              <div className="p-3 border-b flex items-center justify-between" style={{ borderColor:'var(--border)' }}>
                <div className="font-semibold">Diff — {diffTitle}</div>
                <button onClick={()=>setDiffOpen(false)} style={BTN}>Close</button>
              </div>
              <div className="p-3 overflow-auto" style={{ maxHeight:'calc(85vh - 48px)' }}>
                <pre className="text-xs leading-5">
{diffBlocks.map((d,i)=> (d.t===' ' ? `  ${d.s}` : d.t==='+' ? `+ ${d.s}` : `- ${d.s}`)).join('\n')}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
